import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalt, deriveKey, encryptJson, decryptJson, buildVerifier, verifyMasterPassword } from '../src/crypto.js';

test('encrypt/decrypt json roundtrip', () => {
  const salt = createSalt();
  const key = deriveKey('super-secure-master', salt);
  const payload = { username: 'demo', password: 'secret', otherFields: { region: 'us' } };
  const blob = encryptJson(payload, key);
  const restored = decryptJson(blob, key);
  assert.deepEqual(restored, payload);
});

test('verifier validation works', () => {
  const salt = createSalt();
  const verifier = buildVerifier('super-secure-master', salt);
  assert.equal(verifyMasterPassword('super-secure-master', salt, verifier), true);
  assert.equal(verifyMasterPassword('wrong', salt, verifier), false);
});
