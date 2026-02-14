import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../supabase/client';
import type {
  JournalEntry,
  JournalEntryUpdate,
  NewJournalEntry,
} from '../types/database.types';

const formatError = (error: unknown, context: string): Error => {
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(`${context}: ${(error as { message: string }).message}`);
  }

  return new Error(`${context}: Unknown error`);
};

const assertNoError = (error: PostgrestError | null, context: string): void => {
  if (error) {
    throw formatError(error, context);
  }
};

const withClient = () => getSupabaseBrowserClient();

export const createJournalEntry = async (
  entry: NewJournalEntry,
): Promise<JournalEntry> => {
  try {
    const supabase = withClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .insert(entry)
      .select()
      .single();

    assertNoError(error, 'Unable to create journal entry');

    if (!data) {
      throw new Error('Unable to create journal entry: Empty response payload');
    }

    return data;
  } catch (error) {
    throw formatError(error, 'Unable to create journal entry');
  }
};

export const getMyJournalEntries = async (
  limit = 20,
  offset = 0,
): Promise<JournalEntry[]> => {
  try {
    const supabase = withClient();
    let query = supabase
      .from('journal_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (typeof limit === 'number' && limit > 0) {
      const start = Math.max(offset, 0);
      const end = start + limit - 1;
      query = query.range(start, end);
    }

    const { data, error } = await query;
    assertNoError(error, 'Unable to fetch journal entries');

    return data ?? [];
  } catch (error) {
    throw formatError(error, 'Unable to fetch journal entries');
  }
};

export const getEntryByTxSignature = async (
  txSignature: string,
): Promise<JournalEntry | null> => {
  try {
    const supabase = withClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('tx_signature', txSignature)
      .maybeSingle();

    assertNoError(error, 'Unable to fetch journal entry');

    return data;
  } catch (error) {
    throw formatError(error, 'Unable to fetch journal entry');
  }
};

export const searchByTags = async (tags: string[]): Promise<JournalEntry[]> => {
  try {
    if (!tags.length) {
      return getMyJournalEntries();
    }

    const supabase = withClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .contains('tags', tags)
      .order('created_at', { ascending: false });

    assertNoError(error, 'Unable to search by tags');

    return data ?? [];
  } catch (error) {
    throw formatError(error, 'Unable to search by tags');
  }
};

export const filterByRating = async (
  minRating: number,
  maxRating = 5,
): Promise<JournalEntry[]> => {
  try {
    const lowerBound = Math.max(1, Math.min(5, minRating));
    const upperBound = Math.max(lowerBound, Math.min(5, maxRating));

    const supabase = withClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .gte('rating', lowerBound)
      .lte('rating', upperBound)
      .order('created_at', { ascending: false });

    assertNoError(error, 'Unable to filter by rating');

    return data ?? [];
  } catch (error) {
    throw formatError(error, 'Unable to filter by rating');
  }
};

export const updateJournalEntry = async (
  id: string,
  updates: JournalEntryUpdate,
): Promise<JournalEntry> => {
  try {
    const supabase = withClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    assertNoError(error, 'Unable to update journal entry');

    if (!data) {
      throw new Error('Unable to update journal entry: Empty response payload');
    }

    return data;
  } catch (error) {
    throw formatError(error, 'Unable to update journal entry');
  }
};

export const deleteJournalEntry = async (id: string): Promise<void> => {
  try {
    const supabase = withClient();
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id);

    assertNoError(error, 'Unable to delete journal entry');
  } catch (error) {
    throw formatError(error, 'Unable to delete journal entry');
  }
};

export const getJournalStats = async (): Promise<{
  totalEntries: number;
  avgRating: number;
  topTags: string[];
}> => {
  try {
    const supabase = withClient();
    const { data, count, error } = await supabase
      .from('journal_entries')
      .select('rating, tags', { count: 'exact' });

    assertNoError(error, 'Unable to load journal stats');

    const ratings = data ?? [];
    const totalEntries = count ?? ratings.length;
    const avgRating =
      ratings.length === 0
        ? 0
        : ratings.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / ratings.length;

    const tagFrequency = new Map<string, number>();
    ratings.forEach((entry) => {
      entry.tags?.forEach((tag) => {
        if (!tag) {
          return;
        }

        const normalized = tag.trim().toLowerCase();
        const nextValue = (tagFrequency.get(normalized) ?? 0) + 1;
        tagFrequency.set(normalized, nextValue);
      });
    });

    const topTags = Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    return {
      totalEntries,
      avgRating: Number(avgRating.toFixed(2)),
      topTags,
    };
  } catch (error) {
    throw formatError(error, 'Unable to load journal stats');
  }
};
