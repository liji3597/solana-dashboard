"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, EyeOff } from "lucide-react";

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
  valueSol?: number;
  valueUsd?: number;
  status: "success" | "failed";
  shortHash: string;
  solscanUrl: string;
  raw: SwapTransaction;
}

const SKELETON_ROWS = 5;
const SPAM_THRESHOLD_USD = 1;

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

/**
 * Export transactions to CSV and trigger a download.
 */
function exportToCsv(transactions: FormattedTransaction[]) {
  const headers = ["Date", "Platform", "Action", "Value (SOL)", "Value (USD)", "Status", "Hash", "Solscan URL"];
  const rows = transactions.map((tx) => [
    tx.date,
    tx.platform,
    tx.action,
    tx.valueSol?.toFixed(6) ?? "",
    tx.valueUsd?.toFixed(2) ?? "",
    tx.status,
    tx.raw.signature,
    tx.solscanUrl,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
  const [hideSpam, setHideSpam] = useState(false);

  const formattedTransactions = useMemo<FormattedTransaction[]>(
    () =>
      data.map((transaction) => ({
        signature: transaction.signature,
        date: formatDate(transaction.date, transaction.timestamp),
        platform: transaction.platform || "--",
        action: transaction.action || "--",
        valueSol: transaction.valueSol,
        valueUsd: transaction.valueUsd,
        status: transaction.status,
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

      // Spam filter: hide low-value, failed, Unknown Swap, and wSOL wrap/unwrap txs
      if (hideSpam) {
        // Hide failed transactions
        if (tx.status === "failed") return false;
        // Hide low-value (< $1)
        const usdValue = tx.valueUsd ?? 0;
        if (usdValue < SPAM_THRESHOLD_USD) return false;
        // Hide Unknown Swap
        if (tx.action === "Unknown Swap") return false;
        // Hide wSOL wrap/unwrap (e.g. SOL -> wSOL)
        const actionLower = tx.action.toLowerCase();
        if (
          actionLower === "sol -> wsol" ||
          actionLower === "wsol -> sol" ||
          actionLower === "sol -> sol"
        ) return false;
      }

      return true;
    });
  }, [formattedTransactions, selectedToken, dateFrom, dateTo, hideSpam]);

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
      {/* Filter bar + action buttons */}
      {!isLoading && data.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
          <div className="flex items-center gap-2">
            {/* Spam filter toggle */}
            <Button
              type="button"
              variant={hideSpam ? "default" : "outline"}
              size="sm"
              onClick={() => setHideSpam(!hideSpam)}
              className="gap-1.5 text-xs"
              title="Hide low-value (<$1), failed, Unknown Swap, and wSOL wrap/unwrap transactions"
            >
              <EyeOff className="h-3.5 w-3.5" />
              {hideSpam
                ? `Filtered (${formattedTransactions.length - filteredTransactions.length} hidden)`
                : "Hide spam"}
            </Button>
            {/* CSV export */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(filteredTransactions)}
              className="gap-1.5 text-xs"
              title="Export filtered transactions to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      )}

      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-muted-foreground">Date</TableHead>
            <TableHead className="text-muted-foreground">Platform</TableHead>
            <TableHead className="text-muted-foreground">Action</TableHead>
            <TableHead className="text-muted-foreground text-right">Value</TableHead>
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
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
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
                <TableCell className="max-w-[240px] truncate" title={transaction.action}>
                  {transaction.action}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {transaction.valueSol != null ? (
                    <div>
                      <span className="text-card-foreground">
                        {transaction.valueSol.toFixed(4)} SOL
                      </span>
                      {transaction.valueUsd != null && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (${transaction.valueUsd.toFixed(2)})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </TableCell>
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
