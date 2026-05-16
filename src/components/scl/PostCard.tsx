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
  const rt = useStore(s => (post.marketId ? s.runtimes[post.marketId] : undefined));
  const market = post.marketId ? MARKETS.find(m => m.id === post.marketId) : undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);

  // Session marker → render as a divider between sessions, not a normal card
  if (post.kind === 'session-end' || post.kind === 'session-start') {
    const isEnd = post.kind === 'session-end';
    return (
      <div className="my-2 flex items-center gap-3 px-1" aria-label={post.body}>
        <span className={`flex-shrink-0 h-6 w-[3px] rounded ${isEnd ? 'bg-destructive/60' : 'bg-accent/70'}`} />
        <span className={`flex-shrink-0 h-6 w-[3px] rounded ${isEnd ? 'bg-destructive/60' : 'bg-accent/70'}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-[8px] font-bold uppercase tracking-widest ${isEnd ? 'text-destructive' : 'text-accent'}`}>
            {isEnd ? `Session ended · ${post.contract}` : `New session · ${post.contract}`}
          </div>
          <div className="text-[10px] text-foreground/80 truncate font-mono">{post.body}</div>
        </div>
      </div>
    );
  }

  // General market post (no contract auto-detected) → render without live header band.
  if (!rt || !market) {
    return (
      <div className="border border-border/60 bg-card/40 rounded-lg p-3 hover:border-border transition-colors">
        <div className="flex items-start gap-2 mb-2">
          <div className={`w-5 h-5 rounded-sm shrink-0 grid place-items-center text-[8px] font-bold tracking-tighter ${
            post.isNpc ? 'bg-secondary text-muted-foreground' : 'bg-gold/20 text-gold'
          }`}>
            {post.authorName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
            <span className="text-[11px] font-semibold text-foreground truncate">{post.authorName}</span>
            <span className="text-[9px] text-muted-foreground font-mono truncate">{post.authorHandle}</span>
            <span className="text-[8px] text-muted-foreground/60 font-mono uppercase">market</span>
          </div>
          {post.isSelf && (
            <PostMenu
              onEdit={() => { setDraft(post.body); setEditing(true); }}
              onDelete={() => { if (confirm('Delete this post?')) actions.deletePost(post.id); }}
            />
          )}
        </div>
        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={3}
              className="w-full bg-background border border-border/60 rounded p-2 text-[13px] text-foreground/95 resize-none focus:outline-none focus:border-gold/50"
            />
            <div className="flex items-center justify-end gap-1.5 mt-1.5">
              <button onClick={() => setEditing(false)} className="text-[9px] text-muted-foreground hover:text-foreground uppercase tracking-wider px-2 py-1 rounded hover:bg-secondary/40">Cancel</button>
              <button onClick={() => { if (draft.trim()) { actions.editPost(post.id, draft.trim()); setEditing(false); } }} className="text-[9px] text-gold uppercase tracking-wider px-2 py-1 rounded bg-gold/10 hover:bg-gold/20 flex items-center gap-1"><Check className="w-3 h-3" /> Save</button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] leading-snug text-foreground/95 whitespace-pre-wrap">{post.body}</p>
        )}
        <div className="flex items-center gap-1 text-[9px] font-mono mt-2">
          {(['agree', 'disagree', 'fade'] as const).map(r => (
            <button key={r} onClick={() => actions.react(post.id, r)} className="px-1.5 py-0.5 rounded bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors">
              {r} {post.reactions[r] > 0 && <span className="text-foreground">{post.reactions[r]}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const isLive = rt.state.isRunning;
  const isFinal = rt.state.minute >= 90 && !rt.state.isRunning;
  const stateLabel = isFinal ? 'FINAL' : isLive ? 'LIVE' : (rt.state.minute === 0 ? 'PRE-MATCH' : 'HALTED');

  const conv = post.conviction;
  const roi = conv ? computeRoiPct(conv, rt.currentPrice) : null;
  const roiUp = (roi ?? 0) >= 0;

  // deterministic pre-match countdown derived from market id
  const preMatchCountdown = (() => {
    if (stateLabel !== 'PRE-MATCH') return null;
    const seed = market.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
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

  const tickerSlug = market.contract.split('/')[0];

  return (
    <div className="border border-border/60 bg-card/40 rounded-lg overflow-hidden hover:border-border transition-colors">
      {/* dark header band — ticker, state, live price + clock */}
      <div className="bg-[hsl(20,15%,12%)] px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {showHubLink ? (
            <Link
              to={`/?contract=${market.id}&view=trade`}
              className="text-gold font-bold font-mono text-[12px] tracking-wide hover:underline truncate"
              title="Open trade UI for this contract"
            >
              {market.contract}
            </Link>
          ) : (
            <Link
              to={`/?contract=${market.id}&view=trade`}
              className="text-gold font-bold font-mono text-[12px] tracking-wide hover:underline truncate"
              title="Open trade UI for this contract"
            >
              {market.contract}
            </Link>
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
        <div className="flex items-start gap-2 mb-2">
          <div className={`w-5 h-5 rounded-sm shrink-0 grid place-items-center text-[8px] font-bold tracking-tighter ${
            post.isNpc ? 'bg-secondary text-muted-foreground' : 'bg-gold/20 text-gold'
          }`}>
            {post.authorName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
            <span className="text-[11px] font-semibold text-foreground truncate">{post.authorName}</span>
            <span className="text-[9px] text-muted-foreground font-mono truncate">{post.authorHandle}</span>
            {post.isNpc && <span className="text-[8px] text-muted-foreground/60 font-mono">SIM</span>}
          </div>
          {post.isSelf && (
            <PostMenu
              onEdit={() => { setDraft(post.body); setEditing(true); }}
              onDelete={() => { if (confirm('Delete this post?')) actions.deletePost(post.id); }}
            />
          )}
        </div>

        {editing ? (
          <div className="mb-2.5">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={3}
              className="w-full bg-background border border-border/60 rounded p-2 text-[13px] text-foreground/95 resize-none focus:outline-none focus:border-gold/50"
            />
            <div className="flex items-center justify-end gap-1.5 mt-1.5">
              <button
                onClick={() => setEditing(false)}
                className="text-[9px] text-muted-foreground hover:text-foreground uppercase tracking-wider px-2 py-1 rounded hover:bg-secondary/40"
              >
                Cancel
              </button>
              <button
                onClick={() => { if (draft.trim()) { actions.editPost(post.id, draft.trim()); setEditing(false); } }}
                className="text-[9px] text-gold uppercase tracking-wider px-2 py-1 rounded bg-gold/10 hover:bg-gold/20 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] leading-snug text-foreground/95 mb-2.5 whitespace-pre-wrap">{post.body}</p>
        )}

        {/* tag chips — hashtag + market ticker */}
        <div className="flex items-center gap-1.5 mb-2 font-mono text-[9px]">
          <span className="px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground">#{tickerSlug}</span>
          <span className="px-1.5 py-0.5 rounded bg-gold/15 text-gold">{market.contract}</span>
        </div>

        {/* conviction badge — live ROI synced with current price */}
        {conv && roi !== null && (
          <div className="flex items-center justify-between border border-border/60 rounded px-2 py-1.5 mb-2 bg-secondary/30">
            <div className="flex items-center gap-2 font-mono text-[10px] min-w-0 flex-wrap">
              <span className="text-gold font-bold">{conv.contract}</span>
              <span className={`font-bold uppercase ${conv.side === 'long' ? 'text-accent' : 'text-destructive'}`}>{conv.side}</span>
              <span className="text-muted-foreground">@${conv.entryPrice.toFixed(2)}</span>
              <span className={`font-bold tabular-nums ${roiUp ? 'text-accent' : 'text-destructive'}`}>
                ROI {roiUp ? '+' : ''}{roi.toFixed(2)}%
              </span>
              {isLive && <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />}
            </div>
            {post.isSelf && (
              <button
                onClick={() => actions.detachConviction(post.id)}
                className="w-5 h-5 shrink-0 grid place-items-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Unlink position from this post (does not close the trade)"
                aria-label="Detach position"
              >
                <X className="w-3 h-3" />
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

function PostMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        aria-label="Post options"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 min-w-[120px] bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-secondary/60 text-left"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-destructive hover:bg-destructive/10 text-left"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
