-- Create trading sessions table for daily IP-based state persistence
CREATE TABLE public.trading_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  balance NUMERIC NOT NULL DEFAULT 10000,
  open_trades JSONB NOT NULL DEFAULT '[]'::jsonb,
  closed_trades JSONB NOT NULL DEFAULT '[]'::jsonb,
  limit_orders JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ip_address, session_date)
);

-- Enable RLS
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth, IP-based identification via edge function)
CREATE POLICY "Allow all select" ON public.trading_sessions FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.trading_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.trading_sessions FOR UPDATE USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_trading_sessions_updated_at
  BEFORE UPDATE ON public.trading_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();