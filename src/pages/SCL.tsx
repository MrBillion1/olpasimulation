import { Link } from 'react-router-dom';
import { useStore } from '@/hooks/useStore';
import { actions } from '@/lib/simulation-store';
import { MARKETS } from '@/lib/match-engine';
import PostComposer from '@/components/scl/PostComposer';
import PostCard from '@/components/scl/PostCard';
import ReputationPanel from '@/components/scl/ReputationPanel';
import SCLNav from '@/components/scl/SCLNav';

export default function SCL() {
  const runtimes = useStore(s => s.runtimes);
  const posts = useStore(s => s.posts);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* top bar */}
      <div className="border-b border-border bg-card/90 px-4 py-1.5 flex items-center justify-between">
        <span className="font-mono text-[11px] font-bold text-gold tracking-wider">
          SOCIAL CONVICTION LAYER <span className="text-muted-foreground">·</span> OLPA DEX
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={actions.startAll}
            className="text-[9px] font-semibold px-3 py-1.5 rounded bg-gold text-primary-foreground hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-wider"
          >
            ▶ AUTO
          </button>
          <SCLNav />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* left: contract hubs */}
        <aside className="w-[240px] shrink-0 border-r border-border overflow-y-auto custom-scrollbar p-2">
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
            return (
              <Link
                key={m.id}
                to={`/scl/${m.id}`}
                className="block px-2 py-2 rounded text-[10px] font-mono hover:bg-secondary/40 border border-transparent hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
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
                    <span className="mx-1">vs</span>
                    <span style={{ color: m.awayColor }}>{m.awayShort}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={`px-1 rounded text-[7px] uppercase ${
                      isLive ? 'bg-accent/15 text-accent' : isFinal ? 'bg-gold/15 text-gold' : 'bg-secondary text-muted-foreground'
                    }`}>{isFinal ? 'final' : isLive ? `${rt.state.minute}'` : 'pre'}</span>
                    <span className="tabular-nums">${rt.currentPrice.toFixed(3)}</span>
                    <span>· {count}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </aside>

        {/* center: global feed */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 min-w-0">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gold mb-1">Global Conviction Feed</div>
            <div className="text-[10px] text-muted-foreground">Posts auto-route to contract hubs by detected fixture. Conviction badges expose only direction and live ROI — never size, leverage, or wallet.</div>
          </div>
          <PostComposer />
          <div className="space-y-2">
            {posts.length === 0 && (
              <div className="text-[10px] text-muted-foreground py-8 text-center border border-dashed border-border rounded">
                No posts yet. Start AUTO to populate analyst voices, or post a conviction.
              </div>
            )}
            {posts.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        </main>

        {/* right: reputation */}
        <aside className="w-[360px] shrink-0 border-l border-border overflow-y-auto custom-scrollbar p-3">
          <ReputationPanel />
        </aside>
      </div>
    </div>
  );
}
