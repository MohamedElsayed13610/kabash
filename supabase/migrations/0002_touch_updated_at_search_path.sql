-- Pin the search_path of the updated_at trigger function (Supabase security advisor:
-- "function search_path mutable"). Safe to run more than once.
alter function public.touch_updated_at() set search_path = public;
