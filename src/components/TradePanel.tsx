import { useState, useEffect, useCallback } from 'react';
import { MatchEvent, getEventSentiment } from '@/lib/match-engine';

interface OpenTrade {
  id: number;
  direction: 'long' | 'short';
  entryPrice: number;
  size: number;
  leverage: number;
  timestamp: number;
  minute: number;
  liquidationPrice: number;
}

interface ClosedTrade {
  id: number;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  leverage: number;
  pnl: number;
  reason: 'manual' | 'liquidated';
}

interface TradePanelProps {
  currentPrice: number;
  latestEvent?: MatchEvent;
  contract: string;
  homeTeam: string;
  awayTeam: string;
}

let tradeIdCounter = 0;

export default function TradePanel({ currentPrice, latestEvent, contract, homeTeam, awayTeam }: TradePanelProps) {
  const [balance, setBalance] = useState(10000);
  const [tradeSize, setTradeSize] = useState(100);
  const [leverage, setLeverage] = useState(5);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);

  // Calculate liquidation price: when loss = margin (position size)
  // For long: liq = entry * (1 - 1/leverage)
  // For short: liq = entry * (1 + 1/leverage)
  const calcLiqPrice = (entry: number, dir: 'long' | 'short', lev: number) => {
    if (dir === 'long') return Math.round(entry * (1 - 1 / lev) * 100) / 100;
    return Math.round(entry * (1 + 1 / lev) * 100) / 100;
  };

  // Auto-liquidation check
  useEffect(() => {
    setOpenTrades(prev => {
      const stillOpen: OpenTrade[] = [];
      const newClosed: ClosedTrade[] = [];
      
      prev.forEach(t => {
        const isLiquidated = t.direction === 'long'
          ? currentPrice <= t.liquidationPrice
          : currentPrice >= t.liquidationPrice;
        
        if (isLiquidated) {
          newClosed.push({
            id: t.id, direction: t.direction,
            entryPrice: t.entryPrice, exitPrice: currentPrice,
            size: t.size, leverage: t.leverage,
            pnl: -t.size,
            reason: 'liquidated' as const,
          });
        } else {
          stillOpen.push(t);
        }
      });

      if (newClosed.length > 0) {
        setClosedTrades(c => [...newClosed, ...c].slice(0, 20));
        // Liquidated positions lose entire margin — no return
      }
      return stillOpen;
    });
  }, [currentPrice]);

  const openTrade = (direction: 'long' | 'short') => {
    if (tradeSize > balance || tradeSize <= 0) return;
    const liqPrice = calcLiqPrice(currentPrice, direction, leverage);
    const trade: OpenTrade = {
      id: ++tradeIdCounter, direction,
      entryPrice: currentPrice, size: tradeSize, leverage,
      timestamp: Date.now(), minute: latestEvent?.minute ?? 0,
      liquidationPrice: liqPrice,
    };
    setBalance(b => Math.round((b - tradeSize) * 100) / 100);
    setOpenTrades(t => [trade, ...t]);
  };

  const closeTrade = (trade: OpenTrade) => {
    const priceDiff = currentPrice - trade.entryPrice;
    const direction = trade.direction === 'long' ? 1 : -1;
    // PnL = (priceChange / entryPrice) * margin * leverage
    const pnl = Math.round(((priceDiff / trade.entryPrice) * trade.size * trade.leverage * direction) * 100) / 100;
    const returnAmount = trade.size + pnl;

    setBalance(b => Math.round((b + Math.max(0, returnAmount)) * 100) / 100);
    setOpenTrades(t => t.filter(tr => tr.id !== trade.id));
    setClosedTrades(c => [{
      id: trade.id, direction: trade.direction,
      entryPrice: trade.entryPrice, exitPrice: currentPrice,
      size: trade.size, leverage: trade.leverage, pnl,
      reason: 'manual',
    }, ...c].slice(0, 20));
  };

  const totalUnrealizedPnl = openTrades.reduce((sum, t) => {
    const diff = currentPrice - t.entryPrice;
    const dir = t.direction === 'long' ? 1 : -1;
    return sum + ((diff / t.entryPrice) * t.size * t.leverage * dir);
  }, 0);

  const pnlPct = openTrades.length > 0
    ? (totalUnrealizedPnl / openTrades.reduce((s, t) => s + t.size, 0) * 100)
    : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">Trade {contract}</h3>
        <span className="font-mono text-sm font-bold text-gold tabular-nums">${balance.toFixed(2)}</span>
      </div>

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
              ({latestEvent.team === 'home' ? homeTeam : awayTeam} • {getEventSentiment(latestEvent.type)})
            </span>
          </p>
        </div>
      )}

      {/* Trade size */}
      <div className="mb-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Position Size (Margin)</label>
        <input
          type="range" min={10} max={Math.min(2000, balance)} step={10}
          value={tradeSize} onChange={e => setTradeSize(Number(e.target.value))}
          className="w-full accent-[hsl(var(--gold))] h-1"
        />
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>${tradeSize}</span>
          <span className="text-[9px]">Notional: ${(tradeSize * leverage).toFixed(0)}</span>
        </div>
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
        <div className="text-[9px] text-muted-foreground mt-1 font-mono">
          Liq. price (long): ${calcLiqPrice(currentPrice, 'long', leverage).toFixed(2)} • 
          (short): ${calcLiqPrice(currentPrice, 'short', leverage).toFixed(2)}
        </div>
      </div>

      {/* Long / Short */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => openTrade('long')}
          disabled={tradeSize > balance}
          className="bg-accent text-accent-foreground font-semibold text-xs py-2.5 rounded-md
                     hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40"
        >
          Long / Buy
          <div className="font-mono text-[9px] opacity-80">Price ↑ = Profit</div>
        </button>
        <button
          onClick={() => openTrade('short')}
          disabled={tradeSize > balance}
          className="bg-destructive text-destructive-foreground font-semibold text-xs py-2.5 rounded-md
                     hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40"
        >
          Short / Sell
          <div className="font-mono text-[9px] opacity-80">Price ↓ = Profit</div>
        </button>
      </div>

      {/* Open positions */}
      {openTrades.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Open Positions</span>
            <span className={`font-mono text-[10px] font-bold ${totalUnrealizedPnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
              uPnL: {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
            </span>
          </div>
          <div className="space-y-1 max-h-[140px] overflow-y-auto custom-scrollbar">
            {openTrades.map(t => {
              const diff = currentPrice - t.entryPrice;
              const dir = t.direction === 'long' ? 1 : -1;
              const pnl = (diff / t.entryPrice) * t.size * t.leverage * dir;
              const pnlPctTrade = (pnl / t.size) * 100;
              const isNearLiq = t.direction === 'long'
                ? currentPrice < t.entryPrice * (1 - 0.7 / t.leverage)
                : currentPrice > t.entryPrice * (1 + 0.7 / t.leverage);
              return (
                <div key={t.id} className={`flex items-center justify-between bg-secondary/40 rounded px-2 py-1.5 text-[10px] ${
                  isNearLiq ? 'border border-[hsl(var(--impact-high)/0.5)] animate-impact-pulse' : ''
                }`}>
                  <div>
                    <span className={`font-semibold ${t.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                      {t.direction.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground ml-1">{t.leverage}x</span>
                    <span className="text-muted-foreground ml-1 font-mono">${t.entryPrice.toFixed(2)}</span>
                    <span className="text-[8px] text-muted-foreground/60 ml-1">liq: ${t.liquidationPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className={`font-mono font-bold ${pnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </span>
                      <span className={`text-[8px] ml-1 ${pnl >= 0 ? 'text-accent/70' : 'text-destructive/70'}`}>
                        ({pnlPctTrade >= 0 ? '+' : ''}{pnlPctTrade.toFixed(0)}%)
                      </span>
                    </div>
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
                  {t.reason === 'liquidated' && <span className="text-impact-high ml-1">LIQUIDATED</span>}
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
