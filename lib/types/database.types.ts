export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      journal_entries: {
        Row: {
          id: string;
          user_wallet: string;
          tx_signature: string;
          rating: number;
          tags: string[];
          notes: Json;
          screenshot_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_wallet: string;
          tx_signature: string;
          rating: number;
          tags?: string[];
          notes?: Json;
          screenshot_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_wallet?: string;
          tx_signature?: string;
          rating?: number;
          tags?: string[];
          notes?: Json;
          screenshot_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];

export type NewJournalEntry = Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>;

export type JournalEntryUpdate = Partial<
  Omit<JournalEntry, 'id' | 'user_wallet' | 'created_at' | 'updated_at'>
>;

export interface TiptapMark {
  type: string;
  attrs?: Record<string, Json | undefined>;
}

export interface TiptapDocument {
  type: string;
  attrs?: Record<string, Json | undefined>;
  content?: Array<TiptapDocument>;
  text?: string;
  marks?: TiptapMark[];
}

export interface SlateNode {
  type?: string;
  text?: string;
  children?: SlateNode[];
  [key: string]: Json | undefined;
}
