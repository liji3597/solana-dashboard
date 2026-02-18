'use server';

import { createSupabaseServerClient, getServerWallet } from '@/lib/supabase/server';
import { WHALE_WALLET } from '@/lib/constants/wallets';
import type { SaveJournalEntryInput } from '@/lib/types/api';
import type { JournalEntry } from '@/lib/types/database.types';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function formatError(error: unknown, context: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return `${context}: ${(error as { message: string }).message}`;
  }

  return `${context}: Unknown error`;
}

export async function saveJournalEntry(
  entry: SaveJournalEntryInput,
): Promise<ActionResult<JournalEntry>> {
  try {
    // Development workaround: use a fixed wallet when no authenticated session exists.
    const wallet = (await getServerWallet()) ?? WHALE_WALLET;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .upsert(
        {
          user_wallet: wallet,
          tx_signature: entry.tx_signature,
          rating: entry.rating,
          tags: entry.tags,
          notes: entry.notes,
        },
        { onConflict: 'tx_signature' },
      )
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Empty response payload');
    }

    const savedEntry = data as JournalEntry;

    return {
      success: true,
      data: savedEntry,
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error, 'Unable to save journal entry'),
    };
  }
}

export async function getJournalEntry(
  txSignature: string,
): Promise<ActionResult<JournalEntry | null>> {
  try {
    // Development workaround: use a fixed wallet when no authenticated session exists.
    const wallet = (await getServerWallet()) ?? WHALE_WALLET;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_wallet', wallet)
      .eq('tx_signature', txSignature)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const entry = (data ?? null) as JournalEntry | null;

    return {
      success: true,
      data: entry,
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error, 'Unable to fetch journal entry'),
    };
  }
}

export async function batchGetJournalEntries(
  txSignatures: string[],
): Promise<ActionResult<Map<string, JournalEntry>>> {
  try {
    const uniqueSignatures = Array.from(new Set(txSignatures.filter(Boolean)));
    if (uniqueSignatures.length === 0) {
      return {
        success: true,
        data: new Map<string, JournalEntry>(),
      };
    }

    // Development workaround: use a fixed wallet when no authenticated session exists.
    const wallet = (await getServerWallet()) ?? WHALE_WALLET;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_wallet', wallet)
      .in('tx_signature', uniqueSignatures);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as JournalEntry[];
    const map = new Map<string, JournalEntry>();
    rows.forEach((entry) => {
      map.set(entry.tx_signature, entry);
    });

    return {
      success: true,
      data: map,
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error, 'Unable to fetch journal entries'),
    };
  }
}
