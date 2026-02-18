"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EntrySheet } from "@/components/dashboard/entry-sheet";
import {
  ALL_TOKENS,
  TransactionFilters,
} from "@/components/dashboard/transaction-filters";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  batchGetJournalEntries,
  saveJournalEntry,
} from "@/lib/actions/journal";
import type { SaveJournalEntryInput, SwapTransaction } from "@/lib/types/api";
import type { JournalEntry } from "@/lib/types/database.types";

interface TransactionTableProps {
  data: SwapTransaction[];
  isLoading: boolean;
}

interface FormattedTransaction {
  signature: string;
  date: string;
  platform: string;
  action: string;
  shortHash: string;
  solscanUrl: string;
  raw: SwapTransaction;
}

const SKELETON_ROWS = 5;

function toTimestampMs(timestamp: number): number {
  return timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value: string, timestamp: number): string {
  if (value) {
    const normalized = value.replace("T", " ").replace("Z", "");

    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(normalized)) {
      return normalized.slice(0, 16);
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateFromDate(parsed);
    }
  }

  const parsedTimestamp = new Date(toTimestampMs(timestamp));
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return "--";
  }

  return formatDateFromDate(parsedTimestamp);
}

function formatHash(signature: string): string {
  if (signature.length <= 8) {
    return signature;
  }

  return `${signature.slice(0, 4)}...${signature.slice(-4)}`;
}

/**
 * Convert a transaction timestamp to YYYY-MM-DD for date comparison.
 */
function timestampToDateString(timestamp: number): string {
  const ms = toTimestampMs(timestamp);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TransactionTable({ data, isLoading }: TransactionTableProps) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<SwapTransaction | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [journalEntries, setJournalEntries] = useState<Map<string, JournalEntry>>(
    new Map()
  );

  // ── Filter state ──
  const [selectedToken, setSelectedToken] = useState(ALL_TOKENS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const formattedTransactions = useMemo<FormattedTransaction[]>(
    () =>
      data.map((transaction) => ({
        signature: transaction.signature,
        date: formatDate(transaction.date, transaction.timestamp),
        platform: transaction.platform || "--",
        action: transaction.action || "--",
        shortHash: formatHash(transaction.signature),
        solscanUrl: `https://solscan.io/tx/${transaction.signature}`,
        raw: transaction,
      })),
    [data]
  );

  // ── Apply filters ──
  const filteredTransactions = useMemo(() => {
    return formattedTransactions.filter((tx) => {
      // Token filter
      if (selectedToken !== ALL_TOKENS) {
        const symbols = tx.raw.tokenSymbols ?? [];
        const matchesToken = symbols.some(
          (s) => s.toUpperCase() === selectedToken.toUpperCase()
        );
        if (!matchesToken) return false;
      }

      // Date range filter
      const txDate = timestampToDateString(tx.raw.timestamp);

      if (dateFrom && txDate < dateFrom) return false;
      if (dateTo && txDate > dateTo) return false;

      return true;
    });
  }, [formattedTransactions, selectedToken, dateFrom, dateTo]);

  useEffect(() => {
    const signatures = Array.from(
      new Set(data.map((transaction) => transaction.signature).filter(Boolean))
    );

    if (signatures.length === 0) {
      setJournalEntries(new Map());
      return;
    }

    let isMounted = true;

    const loadJournalEntries = async () => {
      const result = await batchGetJournalEntries(signatures);

      if (!isMounted) {
        return;
      }

      if (result.success && result.data) {
        setJournalEntries(result.data);
        return;
      }

      toast.error(result.error ?? "Unable to load journal entries");
    };

    loadJournalEntries();

    return () => {
      isMounted = false;
    };
  }, [data]);

  const selectedEntry = useMemo(
    () =>
      selectedTransaction
        ? journalEntries.get(selectedTransaction.signature) ?? null
        : null,
    [journalEntries, selectedTransaction]
  );

  const handleOpenSheet = (transaction: SwapTransaction) => {
    setSelectedTransaction(transaction);
    setSheetOpen(true);
  };

  const handleSaveEntry = useCallback(async (entry: SaveJournalEntryInput) => {
    const result = await saveJournalEntry(entry);

    if (!result.success || !result.data) {
      toast.error(result.error ?? "Unable to save journal entry");
      return;
    }

    const savedEntry = result.data;

    setJournalEntries((previousEntries) => {
      const nextEntries = new Map(previousEntries);
      nextEntries.set(savedEntry.tx_signature, savedEntry);
      return nextEntries;
    });

    toast.success("Journal entry saved");
    setSheetOpen(false);
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      {/* Filter bar */}
      {!isLoading && data.length > 0 && (
        <TransactionFilters
          transactions={data}
          selectedToken={selectedToken}
          onTokenChange={setSelectedToken}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          filteredCount={filteredTransactions.length}
          totalCount={formattedTransactions.length}
        />
      )}

      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-muted-foreground">Date</TableHead>
            <TableHead className="text-muted-foreground">Platform</TableHead>
            <TableHead className="text-muted-foreground">Action</TableHead>
            <TableHead className="text-muted-foreground">Hash</TableHead>
            <TableHead className="text-muted-foreground">Log Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
                <TableCell>
                  <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-7 w-20 animate-pulse rounded bg-muted" />
                </TableCell>
              </TableRow>
            ))
            : null}

          {!isLoading && filteredTransactions.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                {formattedTransactions.length === 0
                  ? "No transactions found"
                  : "No transactions match the current filters"}
              </TableCell>
            </TableRow>
          ) : null}

          {!isLoading &&
            filteredTransactions.map((transaction) => (
              <TableRow key={transaction.signature} className="hover:bg-muted/50">
                <TableCell>{transaction.date}</TableCell>
                <TableCell>{transaction.platform}</TableCell>
                <TableCell>{transaction.action}</TableCell>
                <TableCell className="font-mono">
                  <a
                    href={transaction.solscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary transition-colors hover:text-primary/80 hover:underline"
                  >
                    {transaction.shortHash}
                  </a>
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant={
                      journalEntries.has(transaction.signature) ? "outline" : "default"
                    }
                    size="sm"
                    onClick={() => handleOpenSheet(transaction.raw)}
                    className={
                      journalEntries.has(transaction.signature)
                        ? "border-border bg-card text-card-foreground hover:bg-muted"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }
                  >
                    {journalEntries.has(transaction.signature)
                      ? "Edit Note"
                      : "Add Note"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      <EntrySheet
        transaction={selectedTransaction}
        existingEntry={selectedEntry}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSave={handleSaveEntry}
      />
    </div>
  );
}
