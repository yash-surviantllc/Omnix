-- Adds a stable wrapper for the working_order_seq so Supabase/PostgREST can expose it
-- and allows the backend to fetch the next work order number via RPC.

create or replace function public.next_working_order_seq()
returns bigint
language sql
stable
as $$
  select nextval('working_order_seq');
$$;
