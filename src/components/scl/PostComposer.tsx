import { useState, useMemo } from 'react';
import { detectContract } from '@/lib/contract-router';
import { useStore } from '@/hooks/useStore';
import { actions } from '@/lib/simulation-store';
import { MARKETS } from '@/lib/match-engine';
import ConvictionAttachDialog from './ConvictionAttachDialog';

const SELF = { id: 'self', name: 'You', handle: '@you' };

// Note: defaultMarketId is intentionally unused. The composer is now contract-agnostic —
// the contract is inferred from the body text or from an attached position. Mention any
// team and the system auto-routes the tweet to the right contract.
interface Props {
  defaultMarketId?: string;
}

export default function PostComposer({ defaultMarketId: _unused }: Props) {
  const [body, setBody] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachedTradeId, setAttachedTradeId] = useState<number | null>(null);

  const openTrades = useStore(s => s.openTrades);
  const runtimes = useStore(s => s.runtimes);

  const detected = useMemo(() => detectContract(body), [body]);
  const attachedTrade = openTrades.find(t => t.id === attachedTradeId);

  // Priority for routing: detected text > attached position > none (general market post).
  const targetMarket = detected
    ? MARKETS.find(m => m.id === detected.id)
    : attachedTrade
      ? MARKETS.find(m => m.id === attachedTrade.marketId)
      : null;

  const submit = () => {
    if (!body.trim()) return;
    const rt = targetMarket ? runtimes[targetMarket.id] : null;
    actions.addPost({
      authorId: SELF.id,
      authorName: SELF.name,
      authorHandle: SELF.handle,
      isNpc: false,
      isSelf: true,
      marketId: targetMarket?.id,
      contract: targetMarket?.contract,
      body: body.trim(),
      matchMinuteAtPost: rt?.state.minute ?? 0,
      priceAtPost: rt?.currentPrice ?? 0,
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
        placeholder="Post your read on any market. Mention a team and we'll auto-tag the contract live."
        className="w-full bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/60 resize-none outline-none min-h-[60px]"
        rows={3}
      />

      <div className="flex items-center justify-end mt-2 gap-1.5">
        <span className="text-[9px] text-muted-foreground font-mono mr-auto">
          {targetMarket
            ? <>auto-tagged <span className="text-gold font-bold">{targetMarket.contract}</span></>
            : <>{body.length}/280</>}
        </span>
        {targetMarket && <span className="text-[9px] text-muted-foreground font-mono">{body.length}/280</span>}
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
          disabled={!body.trim()}
          className="text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded bg-gold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
        >
          Post
        </button>
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
