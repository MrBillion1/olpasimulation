import { Link, useParams } from 'react-router-dom';
import { useStore } from '@/hooks/useStore';
import { MARKETS } from '@/lib/match-engine';
import PostComposer from '@/components/scl/PostComposer';
import PostCard from '@/components/scl/PostCard';
import ComputedPricingPanel from '@/components/scl/ComputedPricingPanel';
import LiveMatchStatePanel from '@/components/scl/LiveMatchStatePanel';
import H2HIntelligence from '@/components/scl/H2HIntelligence';
import AIAnalysisPanel from '@/components/scl/AIAnalysisPanel';
import OrderBookRouting from '@/components/scl/OrderBookRouting';
import PriceChart from '@/components/PriceChart';
import OrderBook from '@/components/OrderBook';
import SCLNav from '@/components/scl/SCLNav';

function HubList({ activeId }: { activeId?: string }) {
  const runtimes = useStore(s => s.runtimes);
  const posts = useStore(s => s.posts);
  return (
    <div className="space-y-1">
      <div className="px-2 py-1.5 text-[8px] uppercase tracking-widest text-muted-foreground font-semibold">
        Contract Hubs
      </div>
      {MARKETS.map(m => {
        const rt = runtimes[m.id];
        const change = rt.currentPrice - m.startPrice;
        const pct = (change / m.startPrice) * 100;
        const up = change >= 0;
        const isLive = rt.state.isRunning;
        const isFinal = rt.state.minute >= 90 && !rt.state.isRunning;
        const count = posts.filter(p => p.marketId === m.id).length;
        const active = m.id === activeId;
        return (
          <Link
            key={m.id}
            to={`/scl/${m.id}`}
            className={`block px-2 py-1.5 rounded text-[10px] font-mono transition-colors border ${
              active ? 'border-gold/40 bg-gold/5' : 'border-transparent hover:bg-secondary/40'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />}
                <span className="text-gold font-bold truncate">{m.contract}</span>
              </div>
              <span className={`tabular-nums font-bold ${up ? 'text-accent' : 'text-destructive'}`}>
                {up ? '+' : ''}{pct.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>
                <span style={{ color: m.homeColor }}>{m.homeShort}</span>
                <span className="mx-1 text-muted-foreground/40">vs</span>
                <span style={{ color: m.awayColor }}>{m.awayShort}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`px-1 rounded text-[7px] uppercase ${
                  isLive ? 'bg-accent/15 text-accent' : isFinal ? 'bg-gold/15 text-gold' : 'bg-secondary text-muted-foreground'
                }`}>{isFinal ? 'final' : isLive ? `${rt.state.minute}'` : 'pre'}</span>
                <span>{count}</span>
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function SCLHub() {
  const { contract: marketId } = useParams<{ contract: string }>();
  const market = MARKETS.find(m => m.id === marketId);
  const rt = useStore(s => (marketId ? s.runtimes[marketId] : undefined));
  const posts = useStore(s => s.posts.filter(p => p.marketId === marketId));

  if (!market || !rt) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="text-[12px] text-muted-foreground">Hub not found.</div>
        <Link to="/scl" className="text-gold text-[12px] hover:underline">← Back to SCL</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* top bar */}
      <div className="border-b border-border bg-card/90 px-4 py-1.5 flex items-center justify-between">
        <span className="font-mono text-[11px] font-bold text-gold tracking-wider">
          SOCIAL CONVICTION LAYER <span className="text-muted-foreground">·</span> {market.contract}
        </span>
        <SCLNav />
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* left: hub list */}
        <aside className="w-[200px] shrink-0 border-r border-border overflow-y-auto custom-scrollbar p-2">
          <HubList activeId={marketId} />
        </aside>

        {/* center: chart + composer + feed */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 min-w-0">
          {/* hub header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-black text-gold">{market.contract}</span>
              <span className="text-[11px] text-foreground/80">{market.homeTeam} <span className="text-muted-foreground mx-1">vs</span> {market.awayTeam}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-foreground tabular-nums">${rt.currentPrice.toFixed(4)}</span>
              <span className={`tabular-nums font-bold ${rt.currentPrice >= market.startPrice ? 'text-accent' : 'text-destructive'}`}>
                {rt.currentPrice >= market.startPrice ? '+' : ''}{(((rt.currentPrice - market.startPrice) / market.startPrice) * 100).toFixed(2)}%
              </span>
              <span className="text-muted-foreground tabular-nums">{rt.state.homeScore}-{rt.state.awayScore} · {rt.state.minute}'</span>
            </div>
          </div>

          {/* live chart */}
          <div className="h-[260px] border border-border rounded-md bg-card/40 p-2">
            <PriceChart
              priceHistory={rt.priceHistory}
              currentPrice={rt.currentPrice}
              startPrice={market.startPrice}
              contract={market.contract}
              homeTeam={market.homeTeam}
              awayTeam={market.awayTeam}
              homeColor={market.homeColor}
              awayColor={market.awayColor}
            />
          </div>

          <PostComposer defaultMarketId={market.id} />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Live Conviction Feed</span>
              <span className="text-[9px] text-muted-foreground font-mono">{posts.length} posts</span>
            </div>
            {posts.length === 0 && (
              <div className="text-[10px] text-muted-foreground py-6 text-center border border-dashed border-border rounded">
                No posts in this hub yet. Start the simulation or post a conviction.
              </div>
            )}
            {posts.map(p => <PostCard key={p.id} post={p} showHubLink={false} />)}
          </div>
        </main>

        {/* right: terminal panels */}
        <aside className="w-[340px] shrink-0 border-l border-border overflow-y-auto custom-scrollbar p-3 space-y-3">
          <LiveMatchStatePanel marketId={market.id} />
          <OrderBookRouting marketId={market.id} />
          <div className="border border-border bg-card/40 rounded-md p-2">
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1">Orderbook</div>
            <OrderBook
              currentPrice={rt.currentPrice}
              lastEventImpact={rt.state.events[rt.state.events.length - 1]?.impact}
              lastEventDirection={rt.lastDirection}
              contract={market.contract.split('/')[0]}
            />
          </div>
          <ComputedPricingPanel marketId={market.id} />
          <AIAnalysisPanel marketId={market.id} />
          <H2HIntelligence marketId={market.id} />
        </aside>
      </div>
    </div>
  );
}
