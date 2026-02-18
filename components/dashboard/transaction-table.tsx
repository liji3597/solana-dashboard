"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EntrySheet } from "@/components/dashboard/entry-sheet";
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

export function TransactionTable({ data, isLoading }: TransactionTableProps) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<SwapTransaction | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [journalEntries, setJournalEntries] = useState<Map<string, JournalEntry>>(
    new Map()
  );

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
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-slate-600">Date</TableHead>
            <TableHead className="text-slate-600">Platform</TableHead>
            <TableHead className="text-slate-600">Action</TableHead>
            <TableHead className="text-slate-600">Hash</TableHead>
            <TableHead className="text-slate-600">Log Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
                  <TableCell>
                    <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                  </TableCell>
                  <TableCell>
                    <div className="h-7 w-20 animate-pulse rounded bg-slate-200" />
                  </TableCell>
                </TableRow>
              ))
            : null}

          {!isLoading && formattedTransactions.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                No transactions found
              </TableCell>
            </TableRow>
          ) : null}

          {!isLoading &&
            formattedTransactions.map((transaction) => (
              <TableRow key={transaction.signature} className="hover:bg-slate-50">
                <TableCell>{transaction.date}</TableCell>
                <TableCell>{transaction.platform}</TableCell>
                <TableCell>{transaction.action}</TableCell>
                <TableCell className="font-mono">
                  <a
                    href={transaction.solscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 transition-colors hover:text-sky-800 hover:underline"
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
                        ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        : "bg-slate-900 text-white hover:bg-slate-800"
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
