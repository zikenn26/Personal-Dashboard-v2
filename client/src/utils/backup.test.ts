import { beforeAll, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Storage } from './storage';
import { encryptJson } from './crypto';

beforeAll(() => {
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
  
  // Mock localStorage for node/vitest environment if needed
  if (typeof globalThis.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = String(val); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: 0,
    } as Storage;
  }
});

describe('Dashboard Backup & Restore Engine', () => {
  it('exports all dashboard data as valid JSON', () => {
    const jsonStr = Storage.exportAllDataJSON();
    expect(jsonStr).toBeDefined();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.version).toBe('4.0.0');
    expect(parsed.profile).toBeDefined();
    expect(Array.isArray(parsed.todos)).toBe(true);
    expect(Array.isArray(parsed.habits)).toBe(true);
    expect(Array.isArray(parsed.goals)).toBe(true);
  });

  it('keeps vault secrets encrypted during export and backup', async () => {
    const pin = '5678';
    const rawSecrets = [{ id: '1', service: 'Test API', username: 'tester', maskedSecret: 'ultra-secret-key-xyz', category: 'API Keys' as const, updatedAt: '2026-09-05', strength: 'strong' as const }];
    await Storage.setVault(rawSecrets, pin);

    const jsonStr = Storage.exportAllDataJSON();
    expect(jsonStr).not.toContain('ultra-secret-key-xyz');

    const parsed = JSON.parse(jsonStr);
    expect(parsed.vaultEncrypted).toBeDefined();
    expect(parsed.vaultEncrypted.algorithm).toBe('AES-GCM-256/PBKDF2-SHA-256');
    expect(parsed.vaultEncrypted.iterations).toBe(210000);
    expect(parsed.vaultEncrypted.ciphertext).toBeDefined();
  });

  it('safely rejects invalid or corrupted backup payloads', () => {
    expect(Storage.importAllDataJSON('not-json-at-all')).toBe(false);
    expect(Storage.importAllDataJSON('{}')).toBe(false);
    expect(Storage.importAllDataJSON('{"foo": 123}')).toBe(false);
  });

  it('restores exported data correctly and hydrates storage', () => {
    const initialExport = Storage.exportAllDataJSON();
    const res = Storage.importAllDataJSON(initialExport);
    expect(res).toBe(true);
  });
});
