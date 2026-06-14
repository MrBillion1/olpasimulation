import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ArrowLeft } from 'lucide-react';

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

function ContractRow({ marketId }: { marketId: string }) {
  const market = MARKETS.find(m => m.id === marketId)!;
  const rt = useStore(s => s.runtimes[marketId]);
  const posts = useStore(s => s.posts);
  const change = rt.currentPrice - market.startPrice;
  const pct = (change / market.startPrice) * 100;
  const up = change >= 0;
  const isLive = rt.state.isRunning;
  const isFinal = rt.state.minute >= 90 && !rt.state.isRunning;
  const count = posts.filter(p => p.marketId === market.id).length;

  return (
    <div className="w-full text-left">
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />}
          <span className="text-gold font-bold truncate">{market.contract}</span>
        </div>
        <span className={`tabular-nums font-bold ${up ? 'text-accent' : 'text-destructive'}`}>
          {up ? '+' : ''}{pct.toFixed(2)}%
        </span>
      </div>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <span>
          <span style={{ color: market.homeColor }}>{market.homeShort}</span>
          <span className="mx-1 text-muted-foreground/40">vs</span>
          <span style={{ color: market.awayColor }}>{market.awayShort}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`px-1 rounded text-[7px] uppercase ${
            isLive ? 'bg-accent/15 text-accent' : isFinal ? 'bg-gold/15 text-gold' : 'bg-secondary text-muted-foreground'
          }`}>{isFinal ? 'final' : isLive ? `${rt.state.minute}'` : 'pre'}</span>
          <span>{count}</span>
        </span>
      </div>
    </div>
  );
}

function ContractSelector({ activeId }: { activeId: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const others = MARKETS.filter(m => m.id !== activeId);

  return (
    <div ref={ref} className="relative">
      <div className="px-2 py-1 text-[8px] uppercase tracking-widest text-muted-foreground font-semibold">
        Contract Hub
      </div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-2 py-2 rounded text-[10px] font-mono border border-gold/40 bg-gold/5 hover:bg-gold/10 transition-colors flex items-center gap-2"
      >
        <div className="flex-1 min-w-0">
          <ContractRow marketId={activeId} />
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gold transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 border border-border bg-card rounded shadow-lg max-h-[60vh] overflow-y-auto custom-scrollbar">
          {others.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setOpen(false); navigate(`/scl/${m.id}`); }}
              className="w-full text-left px-2 py-1.5 text-[10px] font-mono hover:bg-secondary/40 border-b border-border/50 last:border-0"
            >
              <ContractRow marketId={m.id} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SCLHub() {
  const { contract: marketId } = useParams<{ contract: string }>();
  const market = MARKETS.find(m => m.id === marketId);
  const rt = useStore(s => (marketId ? s.runtimes[marketId] : undefined));
  const posts = useStore(s => s.posts); // global feed — same on every hub

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
      <div className="border-b border-border bg-card/90 px-4 py-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/scl"
            title="Back to Conviction Feed"
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-gold px-2 py-1 rounded border border-border hover:border-gold/40 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </Link>
          <span className="font-mono text-[11px] font-bold text-gold tracking-wider truncate">
            SOCIAL CONVICTION LAYER <span className="text-muted-foreground">·</span> {market.contract}
          </span>
        </div>
        <SCLNav />
      </div>


      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT: composer + feed */}
        <aside className="w-[360px] shrink-0 border-r border-border overflow-y-auto custom-scrollbar p-3 space-y-3">
          <PostComposer />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Live Conviction Feed</span>
              <span className="text-[9px] text-muted-foreground font-mono">{posts.length} posts · all markets</span>
            </div>
            {posts.length === 0 && (
              <div className="text-[10px] text-muted-foreground py-6 text-center border border-dashed border-border rounded">
                No posts yet. Start AUTO from /scl to populate analyst voices, or post your take.
              </div>
            )}
            {posts.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        </aside>

        {/* MIDDLE: contract selector + chart (slim) */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 min-w-0">
          <ContractSelector activeId={market.id} />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm font-black text-gold">{market.contract}</span>
              <span className="text-[10px] text-foreground/80 truncate">{market.homeTeam} <span className="text-muted-foreground mx-1">vs</span> {market.awayTeam}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-foreground tabular-nums">${rt.currentPrice.toFixed(4)}</span>
            <span className={`tabular-nums font-bold ${rt.currentPrice >= market.startPrice ? 'text-accent' : 'text-destructive'}`}>
              {rt.currentPrice >= market.startPrice ? '+' : ''}{(((rt.currentPrice - market.startPrice) / market.startPrice) * 100).toFixed(2)}%
            </span>
            <span className="text-muted-foreground tabular-nums">{rt.state.homeScore}-{rt.state.awayScore} · {rt.state.minute}'</span>
          </div>

          <div className="h-[240px] border border-border rounded-md bg-card/40 p-2">
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

          <div className="border border-border bg-card/40 rounded-md p-2">
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1">Orderbook</div>
            <OrderBook
              currentPrice={rt.currentPrice}
              lastEventImpact={rt.state.events[rt.state.events.length - 1]?.impact}
              lastEventDirection={rt.lastDirection}
              contract={market.contract.split('/')[0]}
            />
          </div>
        </main>

        {/* RIGHT: terminal panels */}
        <aside className="w-[340px] shrink-0 border-l border-border overflow-y-auto custom-scrollbar p-3 space-y-3">
          <LiveMatchStatePanel marketId={market.id} />
          <OrderBookRouting marketId={market.id} />
          <ComputedPricingPanel marketId={market.id} />
          <AIAnalysisPanel marketId={market.id} />
          <H2HIntelligence marketId={market.id} />
        </aside>
      </div>
    </div>
  );
}
