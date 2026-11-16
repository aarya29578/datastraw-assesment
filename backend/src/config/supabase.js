import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

/**
 * Validates whether Supabase credentials are configured with non-placeholder values.
 */
export const isSupabaseConfigured = () => {
  const isUrlValid =
    supabaseUrl &&
    !supabaseUrl.includes('your_supabase_project_url') &&
    !supabaseUrl.includes('your-project-id');

  const isKeyValid =
    supabaseSecretKey &&
    !supabaseSecretKey.includes('your_supabase_secret_key');

  return Boolean(isUrlValid && isKeyValid);
};

/**
 * Initializes and exports the Supabase client.
 * Uses fallback dummy strings if unconfigured so the Express server can still boot
 * for health-checks and diagnostics without throwing an uncaught constructor error.
 */
let supabaseClient = null;

if (isSupabaseConfigured()) {
  supabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  console.log('[Database] Supabase client initialized with configured project credentials.');
} else {
  // Graceful placeholder client for development before .env credentials are provided
  supabaseClient = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseSecretKey || 'placeholder-secret-key-do-not-use-in-production',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
  console.warn(
    '[Database Warning] Supabase credentials in .env are using placeholder values. Database queries will require valid project credentials.'
  );
}

export const supabase = supabaseClient;
export default supabase;
