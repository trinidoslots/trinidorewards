-- Create bonus_hunts table
create table if not exists public.bonus_hunts (
  id uuid primary key default gen_random_uuid(),
  game_name text not null,
  buy_in numeric(10, 2) not null,
  result numeric(10, 2),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.bonus_hunts enable row level security;

-- Create policies for public read access (anyone can view)
create policy "bonus_hunts_select_all"
  on public.bonus_hunts for select
  using (true);

-- Only allow inserts, updates, and deletes from authenticated users (admin)
create policy "bonus_hunts_insert_authenticated"
  on public.bonus_hunts for insert
  with check (auth.uid() is not null);

create policy "bonus_hunts_update_authenticated"
  on public.bonus_hunts for update
  using (auth.uid() is not null);

create policy "bonus_hunts_delete_authenticated"
  on public.bonus_hunts for delete
  using (auth.uid() is not null);

-- Create index for faster queries
create index if not exists bonus_hunts_created_at_idx on public.bonus_hunts(created_at desc);
create index if not exists bonus_hunts_status_idx on public.bonus_hunts(status);
