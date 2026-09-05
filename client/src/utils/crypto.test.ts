import { beforeAll, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { decryptJson, encryptJson, hashPassword, verifyPasswordHash } from './crypto';

beforeAll(() => {
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
});

describe('client-side cryptography', () => {
  it('encrypts vault records and rejects an incorrect PIN', async () => {
    const records = [{ service: 'Example', maskedSecret: 'secret-value' }];
    const encrypted = await encryptJson(records, 'correct-pin');
    expect(JSON.stringify(encrypted)).not.toContain('secret-value');
    await expect(decryptJson(encrypted, 'wrong-pin')).rejects.toBeTruthy();
    await expect(decryptJson(encrypted, 'correct-pin')).resolves.toEqual(records);
  });

  it('stores local passwords as verifiable protected records, not plaintext', async () => {
    const stored = await hashPassword('correct-password');
    expect(stored).not.toContain('correct-password');
    await expect(verifyPasswordHash(stored, 'wrong-password')).resolves.toBe(false);
    await expect(verifyPasswordHash(stored, 'correct-password')).resolves.toBe(true);
  });
});
