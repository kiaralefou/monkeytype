import { Collection, ObjectId } from "mongodb";
import * as db from "../init/db";
import { createHash } from "crypto";

type BlocklistEntry = Pick<SharedTypes.User, "name" | "email">;
// Export for use in tests
export const getCollection = (): Collection<MonkeyTypes.DBBlocklistEntry> =>
  db.collection("blocklist");

export async function add(user: BlocklistEntry): Promise<void> {
  const timestamp = Date.now();
  const entries: MonkeyTypes.DBBlocklistEntry[] = [
    {
      _id: new ObjectId(),
      usernameHash: sha256(user.name),
      timestamp,
    },
    {
      _id: new ObjectId(),
      emailHash: sha256(user.email),
      timestamp,
    },
  ];

  await getCollection().insertMany(entries);
}

export async function remove(user: Partial<BlocklistEntry>): Promise<void> {
  const filter = getFilter(user);
  if (filter.length === 0) return;
  await getCollection().deleteMany({ $or: filter });
}

export async function contains(
  user: Partial<BlocklistEntry>
): Promise<boolean> {
  const filter = getFilter(user);
  if (filter.length === 0) return false;

  return (
    (await getCollection().countDocuments({
      $or: filter,
    })) !== 0
  );
}
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getFilter(
  user: Partial<BlocklistEntry>
): Partial<MonkeyTypes.DBBlocklistEntry>[] {
  const filter: Partial<MonkeyTypes.DBBlocklistEntry>[] = [];
  if (user.email !== undefined) {
    filter.push({ emailHash: sha256(user.email) });
  }
  if (user.name !== undefined) {
    filter.push({ usernameHash: sha256(user.name) });
  }
  return filter;
}
