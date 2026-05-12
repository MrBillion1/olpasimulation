import { useStore } from '@/hooks/useStore';
import { MARKETS } from '@/lib/match-engine';

// Rule-based "AI" institutional summaries derived from current state.
// Labeled "Model" — no external LLM call required for v1.

export default function AIAnalysisPanel({ marketId }: { marketId: string }) {
  const rt = useStore(s => s.runtimes[marketId]);
  const posts = useStore(s => s.posts.filter(p => p.marketId === marketId));
  const market = MARKETS.find(m => m.id === marketId);
  if (!rt || !market) return null;

  const isLive = rt.state.isRunning;
  const events = rt.state.events;
  const recent = events.slice(-15);
  const recentHigh = recent.filter(e => e.impact === 'high').length;
  const recentMed = recent.filter(e => e.impact === 'medium').length;
  const volatility = recentHigh * 3 + recentMed * 1;

  // crowd positioning proxy: count long vs short conviction badges across posts
  const longs = posts.filter(p => p.conviction?.side === 'long').length;
  const shorts = posts.filter(p => p.conviction?.side === 'short').length;
  const totalConv = longs + shorts;
  const longPct = totalConv > 0 ? Math.round((longs / totalConv) * 100) : 50;

  const insights: { label: string; tone: 'neutral' | 'bull' | 'bear' | 'risk'; body: string }[] = [];

  if (!isLive && rt.state.minute === 0) {
    insights.push({ label: 'Pre-match', tone: 'neutral', body: `Opening at $${market.startPrice.toFixed(4)}. Scenario: ${market.scenario}. No realized flow.` });
  }

  if (isLive) {
    if (volatility > 6) insights.push({ label: 'Volatility', tone: 'risk', body: `Elevated event density (${recentHigh}H/${recentMed}M last 15). Expect wider effective spreads.` });
    else insights.push({ label: 'Volatility', tone: 'neutral', body: `Stable event tempo. Pricing engine in baseline mode.` });

    if (Math.abs(rt.state.momentum) > 0.4) {
      const fav = rt.state.momentum > 0 ? market.homeShort : market.awayShort;
      insights.push({ label: 'Momentum', tone: rt.state.momentum > 0 ? 'bull' : 'bear', body: `Sustained tilt toward ${fav}. Magnitude ${(Math.abs(rt.state.momentum) * 100).toFixed(0)}/100.` });
    }
  }

  if (totalConv > 0) {
    const skew = longPct - 50;
    insights.push({
      label: 'Crowd Positioning',
      tone: Math.abs(skew) > 25 ? 'risk' : 'neutral',
      body: `${longPct}% long / ${100 - longPct}% short across ${totalConv} attached convictions. ${
        Math.abs(skew) > 25 ? 'Asymmetric positioning — fade risk elevated.' : 'Balanced book.'
      }`,
    });
  }

  if (rt.state.minute >= 90 && !rt.state.isRunning) {
    const totalMove = ((rt.currentPrice - market.startPrice) / market.startPrice) * 100;
    insights.push({
      label: 'Settlement',
      tone: totalMove >= 0 ? 'bull' : 'bear',
      body: `Final tape: ${totalMove >= 0 ? '+' : ''}${totalMove.toFixed(2)}%. ${rt.state.homeScore}-${rt.state.awayScore}.`,
    });
  }

  return (
    <div className="border border-border bg-card/40 rounded-md">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Model Analysis</span>
        <span className="text-[8px] text-muted-foreground font-mono uppercase tracking-wider">Rule-derived</span>
      </div>
      <div className="p-3 space-y-2">
        {insights.length === 0 && (
          <div className="text-[10px] text-muted-foreground">Awaiting state transitions.</div>
        )}
        {insights.map((i, idx) => (
          <div key={idx} className="text-[10px] font-mono">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                i.tone === 'bull' ? 'bg-accent' : i.tone === 'bear' ? 'bg-destructive' : i.tone === 'risk' ? 'bg-gold' : 'bg-muted-foreground/50'
              }`} />
              <span className="uppercase tracking-wider text-muted-foreground text-[8px]">{i.label}</span>
            </div>
            <div className="text-foreground/85 leading-snug pl-3">{i.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
