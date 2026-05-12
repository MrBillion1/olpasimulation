import { useState, useMemo } from 'react';
import { detectContract } from '@/lib/contract-router';
import { useStore } from '@/hooks/useStore';
import { actions } from '@/lib/simulation-store';
import { MARKETS } from '@/lib/match-engine';
import ConvictionAttachDialog from './ConvictionAttachDialog';

const SELF = { id: 'self', name: 'You', handle: '@you' };

interface Props {
  defaultMarketId?: string;
}

export default function PostComposer({ defaultMarketId }: Props) {
  const [body, setBody] = useState('');
  const [overrideMarketId, setOverrideMarketId] = useState<string | null>(defaultMarketId ?? null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachedTradeId, setAttachedTradeId] = useState<number | null>(null);

  const openTrades = useStore(s => s.openTrades);
  const runtimes = useStore(s => s.runtimes);

  const detected = useMemo(() => detectContract(body), [body]);
  const targetMarket = MARKETS.find(m => m.id === (overrideMarketId ?? detected?.id ?? defaultMarketId));

  const attachedTrade = openTrades.find(t => t.id === attachedTradeId);

  const submit = () => {
    if (!body.trim() || !targetMarket) return;
    const rt = runtimes[targetMarket.id];
    actions.addPost({
      authorId: SELF.id,
      authorName: SELF.name,
      authorHandle: SELF.handle,
      isNpc: false,
      isSelf: true,
      marketId: targetMarket.id,
      contract: targetMarket.contract,
      body: body.trim(),
      matchMinuteAtPost: rt.state.minute,
      priceAtPost: rt.currentPrice,
      conviction: attachedTrade ? {
        contract: attachedTrade.contract,
        marketId: attachedTrade.marketId,
        side: attachedTrade.direction,
        entryPrice: attachedTrade.entryPrice,
        tradeId: attachedTrade.id,
      } : undefined,
    });
    setBody('');
    setAttachedTradeId(null);
  };

  return (
    <div className="border border-border bg-card/60 rounded-md p-3">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value.slice(0, 280))}
        placeholder="Post conviction. Reference a match or fixture and the system routes it to the contract hub."
        className="w-full bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/60 resize-none outline-none min-h-[60px]"
        rows={3}
      />

      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="flex items-center gap-2 text-[10px] font-mono min-w-0">
          {targetMarket ? (
            <>
              <span className="text-gold font-bold">{targetMarket.contract}</span>
              <span className="text-muted-foreground/70 truncate">
                {detected?.id === targetMarket.id && body ? 'auto-routed' : 'selected hub'}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground/70">No contract detected — mention a team or fixture</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] text-muted-foreground font-mono">{body.length}/280</span>
          {attachedTrade ? (
            <div className="flex items-center gap-1 px-1.5 py-1 bg-secondary rounded text-[9px] font-mono">
              <span className="text-gold">{attachedTrade.contract}</span>
              <span className={attachedTrade.direction === 'long' ? 'text-accent' : 'text-destructive'}>
                {attachedTrade.direction.toUpperCase()}
              </span>
              <button onClick={() => setAttachedTradeId(null)} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAttachOpen(true)}
              disabled={openTrades.length === 0}
              className="text-[9px] uppercase tracking-wider font-semibold px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-gold hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={openTrades.length === 0 ? 'Open a position first' : 'Attach a live position to this post'}
            >
              + Attach Live Position
            </button>
          )}
          <button
            onClick={submit}
            disabled={!body.trim() || !targetMarket}
            className="text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded bg-gold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            Post
          </button>
        </div>
      </div>

      {attachOpen && (
        <ConvictionAttachDialog
          openTrades={openTrades}
          onCancel={() => setAttachOpen(false)}
          onConfirm={(tradeId) => { setAttachedTradeId(tradeId); setAttachOpen(false); }}
        />
      )}
    </div>
  );
}
