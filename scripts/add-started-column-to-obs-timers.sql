-- Add started column to obs_timers table
ALTER TABLE public.obs_timers
ADD COLUMN started BOOLEAN DEFAULT false;
