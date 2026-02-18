"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SaveJournalEntryInput, SwapTransaction } from "@/lib/types/api";
import type { JournalEntry } from "@/lib/types/database.types";

const TAG_OPTIONS = [
  "FOMO",
  "Revenge",
  "Greed",
  "Fear",
  "Win",
  "Loss",
  "Breakeven",
  "Good Setup",
  "Bad Entry",
  "Perfect Exit",
] as const;

interface EntrySheetProps {
  transaction: SwapTransaction | null;
  existingEntry: JournalEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entry: SaveJournalEntryInput) => Promise<void>;
}

function formatHash(signature: string): string {
  if (signature.length <= 8) {
    return signature;
  }

  return `${signature.slice(0, 4)}...${signature.slice(-4)}`;
}

function toStringNotes(notes: JournalEntry["notes"] | null | undefined): string {
  if (typeof notes === "string") {
    return notes;
  }

  return "";
}

export function EntrySheet({
  transaction,
  existingEntry,
  open,
  onOpenChange,
  onSave,
}: EntrySheetProps) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setRating(existingEntry?.rating ?? 0);
    setTags(existingEntry?.tags ?? []);
    setNotes(toStringNotes(existingEntry?.notes));
  }, [existingEntry, open, transaction?.signature]);

  const shortHash = useMemo(
    () => (transaction ? formatHash(transaction.signature) : "--"),
    [transaction]
  );

  const canSave = Boolean(transaction) && rating >= 1 && !isSaving;

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!transaction || rating < 1 || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        tx_signature: transaction.signature,
        rating,
        notes: notes.trim(),
        tags,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-slate-200 bg-white p-0 sm:max-w-[500px]"
      >
        <SheetHeader className="border-b border-slate-200 px-6 py-5">
          <SheetTitle className="text-lg text-slate-900">Journal Entry</SheetTitle>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="font-mono text-slate-700">{shortHash}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-slate-300 bg-white text-xs text-slate-700"
              >
                {transaction?.platform || "--"}
              </Badge>
              <span className="text-slate-700">{transaction?.action || "--"}</span>
            </div>
            <p>{transaction?.date || "--"}</p>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-6 py-5">
          <section className="space-y-2">
            <p className="text-sm font-medium text-slate-800">Rating</p>
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => {
                const value = index + 1;
                const active = value <= rating;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="rounded-md p-1 transition hover:bg-slate-100"
                    aria-label={`Set rating to ${value}`}
                  >
                    <Star
                      className={cn(
                        "size-5 text-slate-300",
                        active && "fill-amber-400 text-amber-400"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-slate-800">Tags</p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => {
                const selected = tags.includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="rounded-full"
                  >
                    <Badge
                      variant={selected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer",
                        selected
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {tag}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-slate-800">Notes</p>
            <Textarea
              rows={6}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What happened? What did you learn?"
              className="resize-none border-slate-300 text-slate-800 placeholder:text-slate-400 focus-visible:ring-slate-300"
            />
          </section>
        </div>

        <SheetFooter className="border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
