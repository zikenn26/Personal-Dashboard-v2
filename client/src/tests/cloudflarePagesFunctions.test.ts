import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequest } from '../../../functions/api/[[path]].ts';

// Mock the neon serverless database driver
const mockQuery = vi.fn();
vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({
    query: (...args: any[]) => mockQuery(...args),
  }),
}));

describe('Cloudflare Pages Functions API (/api/*)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createContext = (url: string, method: string, body?: any, headers: Record<string, string> = {}) => {
    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    if (body !== undefined && !['GET', 'HEAD'].includes(method)) {
      init.body = JSON.stringify(body);
    }
    const request = new Request(url, init);
    return {
      request,
      env: {
        DATABASE_URL: 'postgresql://test:test@ep-test.neon.tech/neondb?sslmode=require',
      },
      params: {},
      waitUntil: vi.fn(),
      next: vi.fn(),
    };
  };

  it('handles CORS OPTIONS preflight correctly', async () => {
    const context = createContext('https://personal-dashboard-3ag.pages.dev/api/auth/register', 'OPTIONS', null, {
      Origin: 'https://personal-dashboard-3ag.pages.dev',
    });

    const response = await onRequest(context as any);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://personal-dashboard-3ag.pages.dev');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('registers a new user successfully on /api/auth/register', async () => {
    // 1st query: check existing email -> returns empty array
    // 2nd query: insert user
    // 3rd query: insert workspace
    mockQuery
      .mockResolvedValueOnce([]) // existing check
      .mockResolvedValueOnce([]) // insert user
      .mockResolvedValueOnce([]); // insert workspace

    const context = createContext('https://personal-dashboard-3ag.pages.dev/api/auth/register', 'POST', {
      email: 'newuser@example.com',
      password: 'StrongPassword123!',
      name: 'Test User',
    });

    const response = await onRequest(context as any);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('newuser@example.com');
    expect(data.user.name).toBe('Test User');
    expect(data.user.provider).toBe('neon');
  });

  it('rejects registration with invalid email or short password', async () => {
    const context = createContext('https://personal-dashboard-3ag.pages.dev/api/auth/register', 'POST', {
      email: 'invalid-email',
      password: 'short',
    });

    const response = await onRequest(context as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it('rejects registration when email already exists (409 Conflict)', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 'existing-id' }]); // user already exists

    const context = createContext('https://personal-dashboard-3ag.pages.dev/api/auth/register', 'POST', {
      email: 'existing@example.com',
      password: 'StrongPassword123!',
    });

    const response = await onRequest(context as any);
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.message).toContain('already exists');
  });

  it('verifies a valid session token on /api/auth/verify', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        user_email: 'user@example.com',
        device_id: 'dev_123',
        device_name: 'Chrome on Windows',
        created_at: Date.now(),
        id: 'usr_uuid',
        display_name: 'Verified User',
        user_created_at: new Date().toISOString(),
        generation: '1',
      },
    ]);

    const context = createContext(
      'https://personal-dashboard-3ag.pages.dev/api/auth/verify',
      'GET',
      undefined,
      { Authorization: 'Bearer neon_tok_test123456' }
    );

    const response = await onRequest(context as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.valid).toBe(true);
    expect(data.user.email).toBe('user@example.com');
    expect(data.device_id).toBe('dev_123');
  });

  it('rejects verification if token is missing', async () => {
    const context = createContext('https://personal-dashboard-3ag.pages.dev/api/auth/verify', 'GET');

    const response = await onRequest(context as any);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.valid).toBe(false);
  });

  it('returns storage diagnostic info on /api/storage/diagnostic', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        generation: '1',
        created_at: Date.now(),
        schema_version: 2,
        database: 'neondb',
        role: 'neondb_owner',
      },
    ]);

    const context = createContext(
      'https://personal-dashboard-3ag.pages.dev/api/storage/diagnostic',
      'GET',
      undefined,
      { Authorization: 'Bearer neon_tok_test123' }
    );

    const response = await onRequest(context as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.generation).toBe(1);
    expect(data.database_fingerprint).toBeDefined();
  });

  it('logs in an existing user and creates a singleton session on /api/auth/login', async () => {
    // 1st query: app_state generation
    // 2nd query: app_users account lookup
    // 3rd query: update devices is_revoked = true
    // 4th query: update connected_devices is_revoked = true
    // 5th query: update devices is_revoked = false
    // 6th query: update connected_devices is_revoked = false
    // 7th query: insert user_active_sessions

    // Generate a valid password record to test against
    const saltBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const saltB64 = btoa(String.fromCharCode(...saltBytes));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('ValidPassword123!'),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derived)));

    mockQuery
      .mockResolvedValueOnce([{ generation: '1' }])
      .mockResolvedValueOnce([
        {
          id: 'user-uuid',
          email: 'valid@example.com',
          display_name: 'Valid User',
          password_hash: JSON.stringify({
            version: 2,
            algorithm: 'PBKDF2-SHA256',
            iterations: 100000,
            salt: saltB64,
            hash: hashB64,
          }),
          created_at: new Date().toISOString(),
        },
      ])
      .mockResolvedValueOnce([]) // update devices
      .mockResolvedValueOnce([]) // update connected_devices
      .mockResolvedValueOnce([]) // update devices
      .mockResolvedValueOnce([]) // update connected_devices
      .mockResolvedValueOnce([]); // insert user_active_sessions

    const context = createContext('https://personal-dashboard-3ag.pages.dev/api/auth/login', 'POST', {
      email: 'valid@example.com',
      password: 'ValidPassword123!',
      device_id: 'test_dev_1',
      device_name: 'Test Browser',
    });

    const response = await onRequest(context as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.token).toContain('neon_tok_');
    expect(data.user.email).toBe('valid@example.com');
    expect(data.device_id).toBe('test_dev_1');
    expect(data.generation).toBe(1);
  });

  it('rejects login with wrong password (401)', async () => {
    mockQuery
      .mockResolvedValueOnce([{ generation: '1' }])
      .mockResolvedValueOnce([
        {
          id: 'user-uuid',
          email: 'valid@example.com',
          display_name: 'Valid User',
          password_hash: JSON.stringify({
            version: 2,
            algorithm: 'PBKDF2-SHA256',
            iterations: 210000,
            salt: 'AAAA',
            hash: 'BBBB',
          }),
          created_at: new Date().toISOString(),
        },
      ]);

    const context = createContext('https://personal-dashboard-3ag.pages.dev/api/auth/login', 'POST', {
      email: 'valid@example.com',
      password: 'WrongPassword!',
    });

    const response = await onRequest(context as any);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it('handles logout by deleting active session on /api/auth/logout', async () => {
    mockQuery.mockResolvedValueOnce([]); // delete session

    const context = createContext(
      'https://personal-dashboard-3ag.pages.dev/api/auth/logout',
      'POST',
      undefined,
      { Authorization: 'Bearer neon_tok_test_to_delete' }
    );

    const response = await onRequest(context as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('returns 404 for unknown API routes', async () => {
    const context = createContext('https://personal-dashboard-3ag.pages.dev/api/nonexistent', 'GET');

    const response = await onRequest(context as any);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('API endpoint not found');
  });
});
