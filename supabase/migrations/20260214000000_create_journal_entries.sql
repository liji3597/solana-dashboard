-- SQL migration for journal_entries table

create extension if not exists "pgcrypto";

create table if not exists public.journal_entries (
    id uuid primary key default gen_random_uuid(),
    user_wallet varchar(64) not null,
    tx_signature varchar(128) not null unique,
    rating smallint not null check (rating between 1 and 5),
    tags text[] not null default array[]::text[],
    notes jsonb not null default '{}'::jsonb,
    screenshot_url text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_journal_entries_tx_signature
    on public.journal_entries using btree (tx_signature);

create index if not exists idx_journal_entries_user_wallet_created_at
    on public.journal_entries using btree (user_wallet, created_at desc);

create index if not exists idx_journal_entries_tags
    on public.journal_entries using gin (tags);

create index if not exists idx_journal_entries_notes
    on public.journal_entries using gin (notes jsonb_path_ops);

create or replace function public.set_journal_entries_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$ language plpgsql;

create trigger journal_entries_set_updated_at
    before update on public.journal_entries
    for each row
    execute function public.set_journal_entries_updated_at();

alter table public.journal_entries enable row level security;

drop policy if exists "Journal entries are selectable by owner" on public.journal_entries;
create policy "Journal entries are selectable by owner" on public.journal_entries
    for select
    using ((auth.jwt()->>'wallet_address')::text = user_wallet);

drop policy if exists "Journal entries are insertable by owner" on public.journal_entries;
create policy "Journal entries are insertable by owner" on public.journal_entries
    for insert
    with check ((auth.jwt()->>'wallet_address')::text = user_wallet);

drop policy if exists "Journal entries are updatable by owner" on public.journal_entries;
create policy "Journal entries are updatable by owner" on public.journal_entries
    for update
    using ((auth.jwt()->>'wallet_address')::text = user_wallet)
    with check ((auth.jwt()->>'wallet_address')::text = user_wallet);

drop policy if exists "Journal entries are deletable by owner" on public.journal_entries;
create policy "Journal entries are deletable by owner" on public.journal_entries
    for delete
    using ((auth.jwt()->>'wallet_address')::text = user_wallet);

