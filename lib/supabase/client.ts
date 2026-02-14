import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in your environment.',
  );
}

let browserClient: SupabaseClient<Database> | null = null;

const ensureBrowser = () => {
  if (typeof window === 'undefined') {
    throw new Error(
      'getSupabaseBrowserClient is only available in the browser. Use createSupabaseServerClient on the server.',
    );
  }
};

const createBrowserClient = () =>
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'solana-dashboard-auth',
    },
  });

export const getSupabaseBrowserClient = (): SupabaseClient<Database> => {
  ensureBrowser();

  if (!browserClient) {
    browserClient = createBrowserClient();
  }

  return browserClient;
};

export const getCurrentWallet = async (): Promise<string | null> => {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Unable to fetch the current wallet: ${error.message}`);
  }

  const user = data.user;
  const metadata = user?.user_metadata as Record<string, unknown> | null;

  const walletAddress =
    (metadata?.wallet_address as string | undefined) ??
    (metadata?.wallet as string | undefined) ??
    (user?.app_metadata?.wallet_address as string | undefined) ??
    null;

  return walletAddress;
};

export const signOut = async (): Promise<void> => {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`Failed to sign out: ${error.message}`);
  }
};
