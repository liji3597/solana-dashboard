import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured for server-side access.',
  );
}

export const createSupabaseServerClient = async (): Promise<SupabaseClient<Database>> => {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set(name, value, options);
      },
      remove(name: string, _options: CookieOptions) {
        cookieStore.delete(name);
      },
    },
  });
};

export const getServerWallet = async (): Promise<string | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Unable to read wallet from server session: ${error.message}`);
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

export const serverSignOut = async (): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`Server sign-out failed: ${error.message}`);
  }
};
