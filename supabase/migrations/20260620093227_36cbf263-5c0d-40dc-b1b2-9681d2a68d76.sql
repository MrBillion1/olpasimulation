
DROP POLICY IF EXISTS "Allow all insert" ON public.trading_sessions;
DROP POLICY IF EXISTS "Allow all select" ON public.trading_sessions;
DROP POLICY IF EXISTS "Allow all update" ON public.trading_sessions;

REVOKE ALL ON public.trading_sessions FROM anon, authenticated;
GRANT ALL ON public.trading_sessions TO service_role;

-- No policies for anon/authenticated → all access denied via PostgREST.
-- The edge function uses the service role key which bypasses RLS.
