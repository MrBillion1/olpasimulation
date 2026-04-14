import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get client IP from headers
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const today = new Date().toISOString().split("T")[0];

  try {
    if (req.method === "GET") {
      // Load session for today
      const { data, error } = await supabase
        .from("trading_sessions")
        .select("*")
        .eq("ip_address", ip)
        .eq("session_date", today)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // No session today — return fresh state
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
      const body = await req.json();
      const { balance, openTrades, closedTrades, limitOrders } = body;

      if (typeof balance !== "number") {
        return new Response(
          JSON.stringify({ error: "balance must be a number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert session for today
      const { error } = await supabase
        .from("trading_sessions")
        .upsert(
          {
            ip_address: ip,
            session_date: today,
            balance,
            open_trades: openTrades ?? [],
            closed_trades: closedTrades ?? [],
            limit_orders: limitOrders ?? [],
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
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
