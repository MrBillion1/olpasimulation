import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_TRADES = 500;
const MIN_BALANCE = 0;
const MAX_BALANCE = 1_000_000;

function sanitizeTrades(input: unknown): unknown[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_TRADES).filter((t) => t && typeof t === "object");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Trust only Cloudflare-set headers; never the client-controlled x-forwarded-for first entry.
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const today = new Date().toISOString().split("T")[0];

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("trading_sessions")
        .select("*")
        .eq("ip_address", ip)
        .eq("session_date", today)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return new Response(
          JSON.stringify({
            balance: 10000,
            openTrades: [],
            closedTrades: [],
            limitOrders: [],
            isNew: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          balance: Number(data.balance),
          openTrades: data.open_trades,
          closedTrades: data.closed_trades,
          limitOrders: data.limit_orders,
          isNew: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return new Response(
          JSON.stringify({ error: "Invalid request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { balance, openTrades, closedTrades, limitOrders } = body as Record<string, unknown>;

      if (
        typeof balance !== "number" ||
        !Number.isFinite(balance) ||
        balance < MIN_BALANCE ||
        balance > MAX_BALANCE
      ) {
        return new Response(
          JSON.stringify({ error: "balance must be a number between 0 and 1,000,000" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const safeOpen = sanitizeTrades(openTrades);
      const safeClosed = sanitizeTrades(closedTrades);
      const safeLimits = sanitizeTrades(limitOrders);

      const { error } = await supabase
        .from("trading_sessions")
        .upsert(
          {
            ip_address: ip,
            session_date: today,
            balance,
            open_trades: safeOpen,
            closed_trades: safeClosed,
            limit_orders: safeLimits,
          },
          { onConflict: "ip_address,session_date" }
        );

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Trading session error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
