"use client";

import { useMemo } from "react";
import { CalendarDays, ChevronDown, Filter, X } from "lucide-react";

import type { SwapTransaction } from "@/lib/types/api";

interface TransactionFiltersProps {
    transactions: SwapTransaction[];
    selectedToken: string;
    onTokenChange: (token: string) => void;
    dateFrom: string;
    onDateFromChange: (date: string) => void;
    dateTo: string;
    onDateToChange: (date: string) => void;
    filteredCount: number;
    totalCount: number;
}

const ALL_TOKENS = "__ALL__";

export function TransactionFilters({
    transactions,
    selectedToken,
    onTokenChange,
    dateFrom,
    onDateFromChange,
    dateTo,
    onDateToChange,
    filteredCount,
    totalCount,
}: TransactionFiltersProps) {
    // Extract unique token symbols from all transactions, sorted alphabetically
    const availableTokens = useMemo(() => {
        const tokenSet = new Set<string>();
        for (const tx of transactions) {
            for (const symbol of tx.tokenSymbols) {
                if (symbol) tokenSet.add(symbol);
            }
        }
        return Array.from(tokenSet).sort((a, b) => a.localeCompare(b));
    }, [transactions]);

    const hasActiveFilters =
        selectedToken !== ALL_TOKENS || dateFrom !== "" || dateTo !== "";

    const handleClearAll = () => {
        onTokenChange(ALL_TOKENS);
        onDateFromChange("");
        onDateToChange("");
    };

    return (
        <div className="mb-5 space-y-3">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Filter Icon & Label */}
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                </div>

                {/* Token Dropdown */}
                <div className="relative">
                    <select
                        id="token-filter"
                        value={selectedToken}
                        onChange={(e) => onTokenChange(e.target.value)}
                        className="
              h-9 appearance-none rounded-lg border border-border bg-card
              pl-3 pr-8 text-sm text-card-foreground
              shadow-sm transition-colors
              hover:border-muted-foreground/40
              focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20
            "
                    >
                        <option value={ALL_TOKENS}>All Tokens</option>
                        {availableTokens.map((token) => (
                            <option key={token} value={token}>
                                {token}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>

                {/* Date From */}
                <div className="relative flex items-center">
                    <CalendarDays className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        id="date-from"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => onDateFromChange(e.target.value)}
                        className="
              h-9 rounded-lg border border-border bg-card
              pl-8 pr-3 text-sm text-card-foreground
              shadow-sm transition-colors
              hover:border-muted-foreground/40
              focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20
            "
                        title="From date"
                    />
                </div>

                {/* Date Separator */}
                <span className="text-xs text-muted-foreground">to</span>

                {/* Date To */}
                <div className="relative flex items-center">
                    <CalendarDays className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        id="date-to"
                        type="date"
                        value={dateTo}
                        onChange={(e) => onDateToChange(e.target.value)}
                        className="
              h-9 rounded-lg border border-border bg-card
              pl-8 pr-3 text-sm text-card-foreground
              shadow-sm transition-colors
              hover:border-muted-foreground/40
              focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20
            "
                        title="To date"
                    />
                </div>

                {/* Clear All */}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={handleClearAll}
                        className="
              flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50
              px-3 text-sm font-medium text-rose-600
              shadow-sm transition-all
              hover:border-rose-300 hover:bg-rose-100
              dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400
              dark:hover:border-rose-700 dark:hover:bg-rose-950/60
            "
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear
                    </button>
                )}
            </div>

            {/* Results count badge */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                        Showing {filteredCount} of {totalCount} transactions
                    </span>

                    {/* Active filter pills */}
                    {selectedToken !== ALL_TOKENS && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            Token: {selectedToken}
                            <button
                                type="button"
                                onClick={() => onTokenChange(ALL_TOKENS)}
                                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {dateFrom && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            From: {dateFrom}
                            <button
                                type="button"
                                onClick={() => onDateFromChange("")}
                                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {dateTo && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            To: {dateTo}
                            <button
                                type="button"
                                onClick={() => onDateToChange("")}
                                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export { ALL_TOKENS };
