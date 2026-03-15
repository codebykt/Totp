import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_LEN = 32;
const ITERATIONS = 100_000;

export function createSalt() {
  return randomBytes(16).toString("hex");
}

export function deriveKey(masterPassword, salt) {
  return pbkdf2Sync(masterPassword, salt, ITERATIONS, KEY_LEN, "sha256");
}

export function buildVerifier(masterPassword, salt) {
  return createHash("sha256").update(deriveKey(masterPassword, salt)).digest("hex");
}

export function verifyMasterPassword(masterPassword, salt, expectedVerifier) {
  const calculated = Buffer.from(buildVerifier(masterPassword, salt), "hex");
  const expected = Buffer.from(expectedVerifier, "hex");
  if (calculated.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(calculated, expected);
}

export function encryptJson(payload, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

export function decryptJson(blob, key) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString("utf-8"));
}
