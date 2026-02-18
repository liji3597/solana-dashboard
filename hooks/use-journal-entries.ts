import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type {
  JournalEntry,
  JournalEntryUpdate,
  NewJournalEntry,
} from '../lib/types/database.types';
import {
  createJournalEntry,
  deleteJournalEntry,
  getEntryByTxSignature,
  getJournalStats,
  getMyJournalEntries,
  updateJournalEntry,
} from '../lib/services/journal-entries';

const JOURNAL_ENTRIES_KEY = ['journalEntries'] as const;
const JOURNAL_ENTRY_KEY = ['journalEntry'] as const;
const JOURNAL_STATS_KEY = ['journalEntryStats'] as const;

const makeTempId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `temp-${Math.random().toString(36).slice(2)}`;
};

type MutationContext = {
  previousQueries: Array<{
    queryKey: QueryKey;
    data: JournalEntry[] | undefined;
  }>;
} | null;

const collectQueries = (queryClient: QueryClient, queryKey: QueryKey) =>
  queryClient
    .getQueriesData<JournalEntry[]>({ queryKey })
    .map(([key, data]) => ({ queryKey: key, data }));

export const useJournalEntries = (limit?: number, offset?: number) => {
  return useQuery<JournalEntry[], Error>({
    queryKey: [...JOURNAL_ENTRIES_KEY, { limit, offset }],
    queryFn: () => getMyJournalEntries(limit, offset),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};

export const useJournalEntry = (txSignature: string | null) => {
  return useQuery<JournalEntry | null, Error>({
    queryKey: [...JOURNAL_ENTRY_KEY, txSignature],
    queryFn: () => getEntryByTxSignature(txSignature ?? ''),
    enabled: Boolean(txSignature),
    staleTime: 60 * 1000,
  });
};

export const useCreateJournalEntry = () => {
  const queryClient = useQueryClient();

  return useMutation<JournalEntry, Error, NewJournalEntry, MutationContext>({
    mutationFn: (entry) => createJournalEntry(entry),
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: JOURNAL_ENTRIES_KEY });

      const context: MutationContext = {
        previousQueries: collectQueries(queryClient, JOURNAL_ENTRIES_KEY),
      };

      const now = new Date().toISOString();
      const optimisticEntry: JournalEntry = {
        ...entry,
        id: makeTempId(),
        created_at: now,
        updated_at: now,
      };

      context.previousQueries.forEach(({ queryKey }) => {
        queryClient.setQueryData<JournalEntry[]>(queryKey, (oldEntries = []) => [
          optimisticEntry,
          ...oldEntries,
        ]);
      });

      return context;
    },
    onError: (_error, _entry, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: JOURNAL_STATS_KEY });
    },
  });
};

export const useUpdateJournalEntry = () => {
  const queryClient = useQueryClient();

  return useMutation<JournalEntry, Error, { id: string; updates: JournalEntryUpdate }, MutationContext>({
    mutationFn: ({ id, updates }) => updateJournalEntry(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: JOURNAL_ENTRIES_KEY });
      await queryClient.cancelQueries({ queryKey: JOURNAL_ENTRY_KEY });

      const previousQueries = collectQueries(queryClient, JOURNAL_ENTRIES_KEY);

      previousQueries.forEach(({ queryKey, data }) => {
        if (!data) {
          return;
        }

        queryClient.setQueryData<JournalEntry[]>(
          queryKey,
          data.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  ...updates,
                  updated_at: new Date().toISOString(),
                }
              : entry,
          ),
        );
      });

      const context: MutationContext = { previousQueries };
      return context;
    },
    onError: (_error, _payload, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRY_KEY });
      queryClient.invalidateQueries({ queryKey: JOURNAL_STATS_KEY });
    },
  });
};

export const useDeleteJournalEntry = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string }, MutationContext>({
    mutationFn: ({ id }) => deleteJournalEntry(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: JOURNAL_ENTRIES_KEY });

      const previousQueries = collectQueries(queryClient, JOURNAL_ENTRIES_KEY);

      previousQueries.forEach(({ queryKey, data }) => {
        if (!data) {
          return;
        }

        queryClient.setQueryData<JournalEntry[]>(
          queryKey,
          data.filter((entry) => entry.id !== id),
        );
      });

      const context: MutationContext = { previousQueries };
      return context;
    },
    onError: (_error, _payload, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRY_KEY });
      queryClient.invalidateQueries({ queryKey: JOURNAL_STATS_KEY });
    },
  });
};

export const useJournalStats = () => {
  return useQuery<{ totalEntries: number; avgRating: number; topTags: string[] }, Error>({
    queryKey: JOURNAL_STATS_KEY,
    queryFn: () => getJournalStats(),
    staleTime: 5 * 60 * 1000,
  });
};
