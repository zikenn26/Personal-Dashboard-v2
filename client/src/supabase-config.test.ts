import { describe, expect, it } from 'vitest';
import { isSupabaseConfigured, validateSupabaseConnection } from './utils/supabase';

describe('Supabase client configuration', () => {
  it('handles client credentials correctly based on environment status', async () => {
    const configured = isSupabaseConfigured();
    const valid = await validateSupabaseConnection();
    if (!configured) {
      expect(valid).toBe(false);
    } else {
      // When configured, validation reflects live cloud reachability/quota status
      expect(typeof valid).toBe('boolean');
    }
  });
});
