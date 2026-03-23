import { useState } from 'react';
import { MatchEvent, getEventSentiment } from '@/lib/match-engine';

interface OpenTrade {
  id: number;
  direction: 'long' | 'short';
  entryPrice: number;
  size: number;
  leverage: number;
  timestamp: number;
  minute: number;
}

interface ClosedTrade {
  id: number;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  leverage: number;
  pnl: number;
}

interface TradePanelProps {
  currentPrice: number;
  latestEvent?: MatchEvent;
}

let tradeIdCounter = 0;

export default function TradePanel({ currentPrice, latestEvent }: TradePanelProps) {
  const [balance, setBalance] = useState(10000);
  const [tradeSize, setTradeSize] = useState(100);
  const [leverage, setLeverage] = useState(5);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);

  const openTrade = (direction: 'long' | 'short') => {
    if (tradeSize > balance || tradeSize <= 0) return;
    const trade: OpenTrade = {
      id: ++tradeIdCounter,
      direction,
      entryPrice: currentPrice,
      size: tradeSize,
      leverage,
      timestamp: Date.now(),
      minute: latestEvent?.minute ?? 0,
    };
    setBalance(b => Math.round((b - tradeSize) * 100) / 100);
    setOpenTrades(t => [trade, ...t]);
  };

  const closeTrade = (trade: OpenTrade) => {
    const priceDiff = currentPrice - trade.entryPrice;
    const direction = trade.direction === 'long' ? 1 : -1;
    const pnl = Math.round(((priceDiff / trade.entryPrice) * trade.size * trade.leverage * direction) * 100) / 100;
    const returnAmount = trade.size + pnl;

    setBalance(b => Math.round((b + Math.max(0, returnAmount)) * 100) / 100);
    setOpenTrades(t => t.filter(tr => tr.id !== trade.id));
    setClosedTrades(c => [{
      id: trade.id,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      exitPrice: currentPrice,
      size: trade.size,
      leverage: trade.leverage,
      pnl,
    }, ...c].slice(0, 10));
  };

  const totalUnrealizedPnl = openTrades.reduce((sum, t) => {
    const diff = currentPrice - t.entryPrice;
    const dir = t.direction === 'long' ? 1 : -1;
    return sum + ((diff / t.entryPrice) * t.size * t.leverage * dir);
  }, 0);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">Trade MCIMUN/USDT</h3>
        <span className="font-mono text-sm font-bold text-gold tabular-nums">${balance.toFixed(2)}</span>
      </div>

      {/* Latest event info */}
      {latestEvent && (
        <div className="bg-secondary/50 rounded-md p-2 mb-3 border border-[hsl(var(--gold-muted))]">
          <p className="text-[10px] text-muted-foreground">
            {latestEvent.emoji} <span className="text-foreground font-medium">{latestEvent.type}</span> @ {latestEvent.minute}′
            <span className={`ml-1 text-[9px] uppercase font-semibold ${
              latestEvent.impact === 'high' ? 'text-impact-high' : latestEvent.impact === 'medium' ? 'text-impact-medium' : 'text-impact-low'
            }`}>{latestEvent.impact}</span>
            <span className={`ml-1 text-[9px] ${
              getEventSentiment(latestEvent.type) === 'positive' ? 'text-accent' : getEventSentiment(latestEvent.type) === 'negative' ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              ({latestEvent.team === 'home' ? 'City' : 'United'} • {getEventSentiment(latestEvent.type)})
            </span>
          </p>
        </div>
      )}

      {/* Trade size */}
      <div className="mb-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Position Size</label>
        <input
          type="range" min={10} max={Math.min(2000, balance)} step={10}
          value={tradeSize} onChange={e => setTradeSize(Number(e.target.value))}
          className="w-full accent-[hsl(var(--gold))] h-1"
        />
        <div className="text-right font-mono text-xs text-muted-foreground">${tradeSize}</div>
      </div>

      {/* Leverage */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Leverage</label>
        <div className="flex gap-1">
          {[1, 2, 5, 10, 20].map(lev => (
            <button
              key={lev}
              onClick={() => setLeverage(lev)}
              className={`flex-1 text-[10px] py-1 rounded font-semibold transition-all ${
                leverage === lev
                  ? 'bg-gold text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* Long / Short buttons */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => openTrade('long')}
          disabled={tradeSize > balance}
          className="bg-accent text-accent-foreground font-semibold text-xs py-2.5 rounded-md
                     hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40"
        >
          Long / Buy
          <div className="font-mono text-[9px] opacity-80">Price goes ↑ = Profit</div>
        </button>
        <button
          onClick={() => openTrade('short')}
          disabled={tradeSize > balance}
          className="bg-destructive text-destructive-foreground font-semibold text-xs py-2.5 rounded-md
                     hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40"
        >
          Short / Sell
          <div className="font-mono text-[9px] opacity-80">Price goes ↓ = Profit</div>
        </button>
      </div>

      {/* Open positions */}
      {openTrades.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Open Positions</span>
            <span className={`font-mono text-[10px] font-bold ${totalUnrealizedPnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
              uPnL: {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)}
            </span>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar">
            {openTrades.map(t => {
              const diff = currentPrice - t.entryPrice;
              const dir = t.direction === 'long' ? 1 : -1;
              const pnl = (diff / t.entryPrice) * t.size * t.leverage * dir;
              return (
                <div key={t.id} className="flex items-center justify-between bg-secondary/40 rounded px-2 py-1.5 text-[10px]">
                  <div>
                    <span className={`font-semibold ${t.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                      {t.direction.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground ml-1">{t.leverage}x</span>
                    <span className="text-muted-foreground ml-1 font-mono">${t.entryPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold ${pnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </span>
                    <button
                      onClick={() => closeTrade(t)}
                      className="text-[9px] bg-muted px-1.5 py-0.5 rounded hover:bg-foreground/20 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trade history */}
      {closedTrades.length > 0 && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">History</span>
          <div className="space-y-0.5 max-h-[80px] overflow-y-auto custom-scrollbar">
            {closedTrades.map(t => (
              <div key={t.id} className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>
                  <span className={t.direction === 'long' ? 'text-accent' : 'text-destructive'}>{t.direction}</span>
                  {' '}{t.leverage}x ${t.entryPrice.toFixed(2)}→${t.exitPrice.toFixed(2)}
                </span>
                <span className={`font-bold ${t.pnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
