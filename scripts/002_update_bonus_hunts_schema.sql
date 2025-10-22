-- Add starting_balance and ending_balance columns
alter table public.bonus_hunts
  add column if not exists starting_balance numeric(10, 2),
  add column if not exists ending_balance numeric(10, 2);

-- Rename buy_in to bet_size
alter table public.bonus_hunts
  rename column buy_in to bet_size;

-- Drop the status column and its check constraint
alter table public.bonus_hunts
  drop column if exists status;

-- Drop the old status index
drop index if exists bonus_hunts_status_idx;
