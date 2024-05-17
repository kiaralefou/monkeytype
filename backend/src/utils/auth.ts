import FirebaseAdmin from "./../init/firebase-admin";
import { UserRecord } from "firebase-admin/lib/auth/user-record";
import { DecodedIdToken } from "firebase-admin/lib/auth/token-verifier";
import LRUCache from "lru-cache";
import {
  recordTokenCacheAccess,
  setTokenCacheLength,
  setTokenCacheSize,
} from "./prometheus";

const MAX_CACHE_ENTRIES = 20000;
const MAX_CACHE_SIZE = 50000000; // 50MB
const TOKEN_CACHE_BUFFER = 1000 * 60 * 5; // 5 minutes

const tokenCache = new LRUCache<string, DecodedIdToken>({
  max: MAX_CACHE_ENTRIES,
  maxSize: MAX_CACHE_SIZE,
  sizeCalculation: (token, key): number =>
    JSON.stringify(token).length + key.length, //sizeInBytes
});

setInterval(() => {
  for (const [key, token] of tokenCache.entries()) {
    const expirationDate = token.exp * 1000 - TOKEN_CACHE_BUFFER;
    if (expirationDate < Date.now()) {
      tokenCache.delete(key);
    }
  }
}, TOKEN_CACHE_BUFFER);

export async function verifyIdToken(
  idToken: string,
  noCache = false
): Promise<DecodedIdToken> {
  if (noCache) {
    return await FirebaseAdmin().auth().verifyIdToken(idToken, true);
  }

  setTokenCacheLength(tokenCache.size);
  setTokenCacheSize(tokenCache.calculatedSize ?? 0);

  const cached = tokenCache.get(idToken);

  if (cached) {
    const expirationDate = cached.exp * 1000 - TOKEN_CACHE_BUFFER;

    if (expirationDate < Date.now()) {
      recordTokenCacheAccess("hit_expired");
      tokenCache.delete(idToken);
    } else {
      recordTokenCacheAccess("hit");
      return cached;
    }
  } else {
    recordTokenCacheAccess("miss");
  }

  try {
    const decoded = await FirebaseAdmin().auth().verifyIdToken(idToken, true);
    tokenCache.set(idToken, decoded);
    return decoded;
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw error;
  }
}

export async function updateUserEmail(
  uid: string,
  email: string
): Promise<UserRecord> {
  return await FirebaseAdmin().auth().updateUser(uid, {
    email,
    emailVerified: false,
  });
}

export async function deleteUser(uid: string): Promise<void> {
  await FirebaseAdmin().auth().deleteUser(uid);
  removeTokensFromCacheByUid(uid);
}

export function removeTokensFromCacheByUid(uid: string): void {
  for (const entry of tokenCache.entries()) {
    if (entry[1].uid === uid) {
      tokenCache.delete(entry[0]);
    }
  }
}
