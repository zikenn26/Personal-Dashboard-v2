const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const deriveKey = async (secret: string, salt: Uint8Array): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export interface EncryptedPayload {
  version: 1;
  algorithm: 'AES-GCM-256/PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export const encryptJson = async (value: unknown, secret: string): Promise<EncryptedPayload> => {
  if (!crypto?.subtle) throw new Error('Web Crypto API is unavailable in this browser.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)));
  return {
    version: 1,
    algorithm: 'AES-GCM-256/PBKDF2-SHA-256',
    iterations: 210_000,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
};

export const decryptJson = async <T>(payload: EncryptedPayload, secret: string): Promise<T> => {
  if (!payload || payload.version !== 1 || payload.algorithm !== 'AES-GCM-256/PBKDF2-SHA-256') {
    throw new Error('Unsupported encrypted payload.');
  }
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const key = await deriveKey(secret, salt);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64(payload.ciphertext));
  return JSON.parse(decoder.decode(plaintext)) as T;
};

export const hashPassword = async (password: string): Promise<string> => {
  const payload = await encryptJson({ password }, password);
  return JSON.stringify(payload);
};

export const verifyPasswordHash = async (stored: string, password: string): Promise<boolean> => {
  try {
    const payload = JSON.parse(stored) as EncryptedPayload;
    const value = await decryptJson<{ password: string }>(payload, password);
    return value.password === password;
  } catch {
    return false;
  }
};

export const isEncryptedPayload = (value: unknown): value is EncryptedPayload => {
  return !!value && typeof value === 'object' && (value as EncryptedPayload).version === 1 && (value as EncryptedPayload).algorithm === 'AES-GCM-256/PBKDF2-SHA-256';
};
