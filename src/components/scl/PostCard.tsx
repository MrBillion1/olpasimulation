import { useStore } from '@/hooks/useStore';
import { actions, SocialPost } from '@/lib/simulation-store';
import { computeRoiPct } from '@/lib/conviction';
import { MARKETS } from '@/lib/match-engine';
import { Link } from 'react-router-dom';
import { Clock, MoreHorizontal, X, Pencil, Trash2, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  post: SocialPost;
  showHubLink?: boolean;
}

export default function PostCard({ post, showHubLink = true }: Props) {
  const rt = useStore(s => s.runtimes[post.marketId]);
  const market = MARKETS.find(m => m.id === post.marketId);
  if (!rt || !market) return null;

  const isLive = rt.state.isRunning;
  const isFinal = rt.state.minute >= 90 && !rt.state.isRunning;
  const stateLabel = isFinal ? 'FINAL' : isLive ? 'LIVE' : (rt.state.minute === 0 ? 'PRE-MATCH' : 'HALTED');

  const conv = post.conviction;
  const roi = conv ? computeRoiPct(conv, rt.currentPrice) : null;
  const roiUp = (roi ?? 0) >= 0;

  // deterministic pre-match countdown derived from market id
  const preMatchCountdown = (() => {
    if (stateLabel !== 'PRE-MATCH') return null;
    const seed = post.marketId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const d = (seed % 14) + 1;
    const h = (seed * 7) % 24;
    return `${d}d ${h.toString().padStart(2, '0')}h`;
  })();

  // live match clock formatted MM:SS using minute + interpolated seconds
  const liveClock = (() => {
    if (!isLive) return null;
    const m = rt.state.minute;
    // pseudo-seconds from event counter for sub-minute motion
    const s = (rt.eventCounter * 7) % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  })();

  const tickerSlug = post.contract.split('/')[0];

  return (
    <div className="border border-border/60 bg-card/40 rounded-lg overflow-hidden hover:border-border transition-colors">
      {/* dark header band — ticker, state, live price + clock */}
      <div className="bg-[hsl(20,15%,12%)] px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {showHubLink ? (
            <Link to={`/scl/${post.marketId}`} className="text-gold font-bold font-mono text-[12px] tracking-wide hover:underline truncate">
              {post.contract}
            </Link>
          ) : (
            <span className="text-gold font-bold font-mono text-[12px] tracking-wide truncate">{post.contract}</span>
          )}
          <span className={`flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
            isLive
              ? 'bg-destructive/20 text-destructive'
              : isFinal
              ? 'bg-gold/20 text-gold'
              : 'bg-secondary text-muted-foreground'
          }`}>
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />}
            {stateLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono">
          <span className="text-foreground font-bold text-[12px] tabular-nums">${rt.currentPrice.toFixed(2)}</span>
          {(liveClock || preMatchCountdown) && (
            <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
              {!isLive && <Clock className="w-3 h-3" />}
              <span className={isLive ? 'text-destructive' : ''}>{liveClock ?? preMatchCountdown}</span>
            </span>
          )}
        </div>
      </div>

      {/* author + body */}
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-5 h-5 rounded-sm shrink-0 grid place-items-center text-[8px] font-bold tracking-tighter ${
            post.isNpc ? 'bg-secondary text-muted-foreground' : 'bg-gold/20 text-gold'
          }`}>
            {post.authorName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex items-baseline gap-1.5">
            <span className="text-[11px] font-semibold text-foreground truncate">{post.authorName}</span>
            <span className="text-[9px] text-muted-foreground font-mono truncate">{post.authorHandle}</span>
            {post.isNpc && <span className="text-[8px] text-muted-foreground/60 font-mono">SIM</span>}
          </div>
        </div>

        <p className="text-[13px] leading-snug text-foreground/95 mb-2.5 whitespace-pre-wrap">{post.body}</p>

        {/* tag chips — hashtag + market ticker */}
        <div className="flex items-center gap-1.5 mb-2 font-mono text-[9px]">
          <span className="px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground">#{tickerSlug}</span>
          <span className="px-1.5 py-0.5 rounded bg-gold/15 text-gold">{post.contract}</span>
        </div>

        {/* conviction badge */}
        {conv && roi !== null && (
          <div className="flex items-center justify-between border border-border/60 rounded px-2 py-1.5 mb-2 bg-secondary/30">
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-gold font-bold">{conv.contract}</span>
              <span className={`font-bold uppercase ${conv.side === 'long' ? 'text-accent' : 'text-destructive'}`}>{conv.side}</span>
              <span className={`font-bold tabular-nums ${roiUp ? 'text-accent' : 'text-destructive'}`}>
                {roiUp ? '+' : ''}{roi.toFixed(2)}%
              </span>
              {isLive && <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />}
            </div>
            {post.isSelf && (
              <button
                onClick={() => actions.detachConviction(post.id)}
                className="text-[8px] text-muted-foreground hover:text-destructive uppercase tracking-wider"
                title="Removes public visibility only — does not close the position"
              >
                Detach
              </button>
            )}
          </div>
        )}

        {/* signal reactions */}
        <div className="flex items-center gap-1 text-[9px] font-mono">
          {(['agree', 'disagree', 'fade'] as const).map(r => (
            <button
              key={r}
              onClick={() => actions.react(post.id, r)}
              className="px-1.5 py-0.5 rounded bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
            >
              {r} {post.reactions[r] > 0 && <span className="text-foreground">{post.reactions[r]}</span>}
            </button>
          ))}
          {post.verdict && (
            <span className={`ml-auto text-[8px] uppercase font-bold ${
              post.verdict === 'correct' ? 'text-accent' : post.verdict === 'incorrect' ? 'text-destructive' : 'text-muted-foreground'
            }`}>{post.verdict}</span>
          )}
        </div>
      </div>
    </div>
  );
}
