import { ObjectId } from "mongodb";
import * as BlacklistDal from "../../src/dal/blocklist";

describe("BlocklistDal", () => {
  describe("add", () => {
    beforeEach(() => {
      vitest.useFakeTimers();
    });
    afterEach(() => {
      vitest.useRealTimers();
    });
    it("adds user", async () => {
      //GIVEN
      const now = 1715082588;
      vitest.setSystemTime(now);

      const name = "user" + new ObjectId().toHexString();
      const email = `${name}@example.com`;

      //WHEN
      await BlacklistDal.add({ name, email });

      //THEN
      expect(
        BlacklistDal.getCollection().findOne({
          emailHash: BlacklistDal.sha256(email),
        })
      ).resolves.toMatchObject({
        emailHash: BlacklistDal.sha256(email),
        timestamp: now,
      });

      expect(
        BlacklistDal.getCollection().findOne({
          usernameHash: BlacklistDal.sha256(name),
        })
      ).resolves.toMatchObject({
        usernameHash: BlacklistDal.sha256(name),
        timestamp: now,
      });
    });
    it("adds user with discordId", async () => {
      //GIVEN
      const now = 1715082588;
      vitest.setSystemTime(now);

      const name = "user" + new ObjectId().toHexString();
      const email = `${name}@example.com`;
      const discordId = `${name}DiscordId`;

      //WHEN
      await BlacklistDal.add({ name, email, discordId });

      //THEN
      expect(
        BlacklistDal.getCollection().findOne({
          discordIdHash: BlacklistDal.sha256(discordId),
        })
      ).resolves.toMatchObject({
        discordIdHash: BlacklistDal.sha256(discordId),
        timestamp: now,
      });
    });
  });
  describe("contains", () => {
    it("contains user", async () => {
      //GIVEN
      const name = "user" + new ObjectId().toHexString();
      const email = `${name}@example.com`;
      const discordId = `${name}DiscordId`;
      await BlacklistDal.add({ name, email, discordId });
      await BlacklistDal.add({ name: "test", email: "test@example.com" });

      //WHEN / THEN
      //by name
      expect(BlacklistDal.contains({ name })).resolves.toBeTruthy();
      expect(
        BlacklistDal.contains({ name, email: "unknown", discordId: "unknown" })
      ).resolves.toBeTruthy();

      //by email
      expect(BlacklistDal.contains({ email })).resolves.toBeTruthy();
      expect(
        BlacklistDal.contains({ name: "unknown", email, discordId: "unknown" })
      ).resolves.toBeTruthy();

      //by discordId
      expect(BlacklistDal.contains({ discordId })).resolves.toBeTruthy();
      expect(
        BlacklistDal.contains({ name: "unknown", email: "unknown", discordId })
      ).resolves.toBeTruthy();

      //by name and email and discordId
      expect(
        BlacklistDal.contains({ name, email, discordId })
      ).resolves.toBeTruthy();
    });
    it("does not contain user", async () => {
      //GIVEN
      await BlacklistDal.add({ name: "test", email: "test@example.com" });
      await BlacklistDal.add({ name: "test2", email: "test2@example.com" });

      //WHEN / THEN
      expect(BlacklistDal.contains({ name: "unknown" })).resolves.toBeFalsy();
      expect(BlacklistDal.contains({ email: "unknown" })).resolves.toBeFalsy();
      expect(
        BlacklistDal.contains({ discordId: "unknown" })
      ).resolves.toBeFalsy();
      expect(
        BlacklistDal.contains({
          name: "unknown",
          email: "unknown",
          discordId: "unknown",
        })
      ).resolves.toBeFalsy();

      expect(BlacklistDal.contains({})).resolves.toBeFalsy();
    });
  });

  describe("remove", () => {
    it("removes existing username", async () => {
      //GIVEN
      const name = "user" + new ObjectId().toHexString();
      const email = `${name}@example.com`;
      await BlacklistDal.add({ name, email });
      await BlacklistDal.add({ name: "test", email: "test@example.com" });

      //WHEN
      await BlacklistDal.remove({ name });

      //THEN
      expect(BlacklistDal.contains({ name })).resolves.toBeFalsy();
      expect(BlacklistDal.contains({ email })).resolves.toBeTruthy();

      //decoy still exists
      expect(BlacklistDal.contains({ name: "test" })).resolves.toBeTruthy();
      expect(
        BlacklistDal.contains({ email: "test@example.com" })
      ).resolves.toBeTruthy();
    });
    it("removes existing email", async () => {
      //GIVEN
      const name = "user" + new ObjectId().toHexString();
      const email = `${name}@example.com`;
      await BlacklistDal.add({ name, email });
      await BlacklistDal.add({ name: "test", email: "test@example.com" });

      //WHEN
      await BlacklistDal.remove({ email });

      //THEN
      expect(BlacklistDal.contains({ email })).resolves.toBeFalsy();
      expect(BlacklistDal.contains({ name })).resolves.toBeTruthy();

      //decoy still exists
      expect(BlacklistDal.contains({ name: "test" })).resolves.toBeTruthy();
      expect(
        BlacklistDal.contains({ email: "test@example.com" })
      ).resolves.toBeTruthy();
    });
    it("removes existing discordId", async () => {
      //GIVEN
      const name = "user" + new ObjectId().toHexString();
      const email = `${name}@example.com`;
      const discordId = `${name}DiscordId`;
      await BlacklistDal.add({ name, email, discordId });
      await BlacklistDal.add({
        name: "test",
        email: "test@example.com",
        discordId: "testDiscordId",
      });

      //WHEN
      await BlacklistDal.remove({ discordId });

      //THEN
      expect(BlacklistDal.contains({ discordId })).resolves.toBeFalsy();
      expect(BlacklistDal.contains({ name })).resolves.toBeTruthy();
      expect(BlacklistDal.contains({ email })).resolves.toBeTruthy();

      //decoy still exists
      expect(BlacklistDal.contains({ name: "test" })).resolves.toBeTruthy();
      expect(
        BlacklistDal.contains({ email: "test@example.com" })
      ).resolves.toBeTruthy();
      expect(
        BlacklistDal.contains({ discordId: "testDiscordId" })
      ).resolves.toBeTruthy();
    });
    it("removes existing username,email and discordId", async () => {
      //GIVEN
      const name = "user" + new ObjectId().toHexString();
      const email = `${name}@example.com`;
      const discordId = `${name}DiscordId`;
      await BlacklistDal.add({ name, email, discordId });
      await BlacklistDal.add({
        name: "test",
        email: "test@example.com",
        discordId: "testDiscordId",
      });

      //WHEN
      await BlacklistDal.remove({ name, email, discordId });

      //THEN
      expect(BlacklistDal.contains({ email })).resolves.toBeFalsy();
      expect(BlacklistDal.contains({ name })).resolves.toBeFalsy();
      expect(BlacklistDal.contains({ discordId })).resolves.toBeFalsy();

      //decoy still exists
      expect(BlacklistDal.contains({ name: "test" })).resolves.toBeTruthy();
      expect(
        BlacklistDal.contains({ email: "test@example.com" })
      ).resolves.toBeTruthy();
      expect(
        BlacklistDal.contains({ discordId: "testDiscordId" })
      ).resolves.toBeTruthy();
    });

    it("does not remove for empty user", async () => {
      //GIVEN
      const name = "user" + new ObjectId().toHexString();
      const email = `${name}@example.com`;
      const discordId = `${name}DiscordId`;
      await BlacklistDal.add({ name, email, discordId });
      await BlacklistDal.add({ name: "test", email: "test@example.com" });

      //WHEN
      await BlacklistDal.remove({});

      //THEN
      expect(BlacklistDal.contains({ email })).resolves.toBeTruthy();
      expect(BlacklistDal.contains({ name })).resolves.toBeTruthy();
      expect(BlacklistDal.contains({ discordId })).resolves.toBeTruthy();
    });
  });
  describe("sha256", () => {
    it("hashes", () => {
      expect(BlacklistDal.sha256("test")).toEqual(
        "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
      );
    });
  });
});
