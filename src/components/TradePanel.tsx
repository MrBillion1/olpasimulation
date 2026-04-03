import { useState, useEffect } from 'react';
import { MatchEvent, getEventSentiment, MarketConfig } from '@/lib/match-engine';

export interface OpenTrade {
  id: number;
  marketId: string;
  contract: string;
  direction: 'long' | 'short';
  entryPrice: number;
  size: number;
  leverage: number;
  timestamp: number;
  minute: number;
  liquidationPrice: number;
}

export interface ClosedTrade {
  id: number;
  contract: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  leverage: number;
  pnl: number;
  reason: 'manual' | 'liquidated' | 'expired' | 'counter-closed';
}

interface TradePanelProps {
  activeMarket: MarketConfig;
  prices: Record<string, number>;
  latestEvents: Record<string, MatchEvent | undefined>;
  balance: number;
  setBalance: (fn: (b: number) => number) => void;
  openTrades: OpenTrade[];
  setOpenTrades: React.Dispatch<React.SetStateAction<OpenTrade[]>>;
  closedTrades: ClosedTrade[];
  setClosedTrades: React.Dispatch<React.SetStateAction<ClosedTrade[]>>;
  matchStates: Record<string, { isRunning: boolean; minute: number }>;
}

let tradeIdCounter = 0;

export default function TradePanel({
  activeMarket, prices, latestEvents, balance, setBalance,
  openTrades, setOpenTrades, closedTrades, setClosedTrades, matchStates,
}: TradePanelProps) {
  const [tradeSize, setTradeSize] = useState(100);
  const [leverage, setLeverage] = useState(5);

  const currentPrice = prices[activeMarket.id] ?? activeMarket.startPrice;
  const latestEvent = latestEvents[activeMarket.id];

  const calcLiqPrice = (entry: number, dir: 'long' | 'short', lev: number) => {
    if (dir === 'long') return Math.round(entry * (1 - 1 / lev) * 10000) / 10000;
    return Math.round(entry * (1 + 1 / lev) * 10000) / 10000;
  };

  // Close a single trade and return margin + pnl to balance
  const closeTrade = (trade: OpenTrade, reason: 'manual' | 'liquidated' | 'expired' | 'counter-closed' = 'manual') => {
    const mPrice = prices[trade.marketId] ?? trade.entryPrice;
    const priceDiff = mPrice - trade.entryPrice;
    const dir = trade.direction === 'long' ? 1 : -1;
    const pnl = Math.round(((priceDiff / trade.entryPrice) * trade.size * trade.leverage * dir) * 100) / 100;
    const returnAmount = reason === 'liquidated' ? 0 : trade.size + pnl;
    setBalance(b => Math.round((b + Math.max(0, returnAmount)) * 100) / 100);
    setOpenTrades(t => t.filter(tr => tr.id !== trade.id));
    setClosedTrades(c => [{
      id: trade.id, contract: trade.contract, direction: trade.direction,
      entryPrice: trade.entryPrice, exitPrice: mPrice,
      size: trade.size, leverage: trade.leverage,
      pnl: reason === 'liquidated' ? -trade.size : pnl,
      reason,
    }, ...c].slice(0, 50));
  };

  // Auto-liquidation across ALL markets
  useEffect(() => {
    setOpenTrades(prev => {
      const stillOpen: OpenTrade[] = [];
      const newClosed: ClosedTrade[] = [];
      prev.forEach(t => {
        const mPrice = prices[t.marketId] ?? 0;
        const isLiquidated = t.direction === 'long'
          ? mPrice <= t.liquidationPrice
          : mPrice >= t.liquidationPrice;
        if (isLiquidated) {
          newClosed.push({
            id: t.id, contract: t.contract, direction: t.direction,
            entryPrice: t.entryPrice, exitPrice: mPrice,
            size: t.size, leverage: t.leverage, pnl: -t.size, reason: 'liquidated',
          });
        } else {
          stillOpen.push(t);
        }
      });
      if (newClosed.length > 0) {
        setClosedTrades(c => [...newClosed, ...c].slice(0, 50));
      }
      return stillOpen;
    });
  }, [prices, setOpenTrades, setClosedTrades]);

  // CONTRACT EXPIRY: Force-close all trades on markets that reach full-time
  useEffect(() => {
    if (!matchStates) return;
    Object.entries(matchStates).forEach(([marketId, ms]) => {
      if (ms.minute >= 90 && !ms.isRunning) {
        // Find all open trades for this expired market
        const expiredTrades = openTrades.filter(t => t.marketId === marketId);
        expiredTrades.forEach(t => {
          const mPrice = prices[t.marketId] ?? t.entryPrice;
          const priceDiff = mPrice - t.entryPrice;
          const dir = t.direction === 'long' ? 1 : -1;
          const pnl = Math.round(((priceDiff / t.entryPrice) * t.size * t.leverage * dir) * 100) / 100;
          const returnAmount = t.size + pnl;
          setBalance(b => Math.round((b + Math.max(0, returnAmount)) * 100) / 100);
          setClosedTrades(c => [{
            id: t.id, contract: t.contract, direction: t.direction,
            entryPrice: t.entryPrice, exitPrice: mPrice,
            size: t.size, leverage: t.leverage, pnl, reason: 'expired' as const,
          }, ...c].slice(0, 50));
        });
        if (expiredTrades.length > 0) {
          setOpenTrades(prev => prev.filter(t => t.marketId !== marketId));
        }
      }
    });
  }, [matchStates, openTrades, prices, setBalance, setOpenTrades, setClosedTrades]);

  const openTrade = (direction: 'long' | 'short') => {
    if (tradeSize > balance || tradeSize <= 0) return;

    const ms = matchStates?.[activeMarket.id];
    if (ms && ms.minute >= 90 && !ms.isRunning) return; // Can't trade expired contract

    // COUNTER TRADE: Close existing opposite position on same contract first
    const existingOnMarket = openTrades.filter(t => t.marketId === activeMarket.id);
    const opposites = existingOnMarket.filter(t => t.direction !== direction);
    opposites.forEach(t => closeTrade(t, 'counter-closed'));

    // If same direction exists, just add new position
    const liqPrice = calcLiqPrice(currentPrice, direction, leverage);
    const trade: OpenTrade = {
      id: ++tradeIdCounter, marketId: activeMarket.id, contract: activeMarket.contract,
      direction, entryPrice: currentPrice, size: tradeSize, leverage,
      timestamp: Date.now(), minute: latestEvent?.minute ?? 0, liquidationPrice: liqPrice,
    };
    setBalance(b => Math.round((b - tradeSize) * 100) / 100);
    setOpenTrades(t => [trade, ...t]);
  };

  const totalUnrealizedPnl = openTrades.reduce((sum, t) => {
    const mPrice = prices[t.marketId] ?? t.entryPrice;
    const diff = mPrice - t.entryPrice;
    const dir = t.direction === 'long' ? 1 : -1;
    return sum + ((diff / t.entryPrice) * t.size * t.leverage * dir);
  }, 0);

  const totalMargin = openTrades.reduce((s, t) => s + t.size, 0);
  const pnlPct = totalMargin > 0 ? (totalUnrealizedPnl / totalMargin * 100) : 0;

  const isExpired = matchStates?.[activeMarket.id]?.minute >= 90 && !matchStates?.[activeMarket.id]?.isRunning;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">Trade {activeMarket.contract}</h3>
        <span className="font-mono text-sm font-bold text-gold tabular-nums">${balance.toFixed(2)}</span>
      </div>

      {isExpired && (
        <div className="text-center py-2 mb-3 bg-muted/30 rounded border border-border">
          <span className="text-[10px] text-muted-foreground font-semibold">🏁 Contract expired — Trading disabled</span>
        </div>
      )}

      {latestEvent && !isExpired && (
        <div className="bg-secondary/50 rounded-md p-2 mb-3 border border-[hsl(var(--gold-muted))]">
          <p className="text-[10px] text-muted-foreground">
            {latestEvent.emoji} <span className="text-foreground font-medium">{latestEvent.type}</span> @ {latestEvent.minute}′
            <span className={`ml-1 text-[9px] uppercase font-semibold ${
              latestEvent.impact === 'high' ? 'text-impact-high' : latestEvent.impact === 'medium' ? 'text-impact-medium' : 'text-impact-low'
            }`}>{latestEvent.impact}</span>
            <span className={`ml-1 text-[9px] ${
              getEventSentiment(latestEvent.type) === 'positive' ? 'text-accent' : getEventSentiment(latestEvent.type) === 'negative' ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              ({latestEvent.team === 'home' ? activeMarket.homeTeam : activeMarket.awayTeam} • {getEventSentiment(latestEvent.type)})
            </span>
          </p>
        </div>
      )}

      {!isExpired && (
        <>
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
              Liq. (long): ${calcLiqPrice(currentPrice, 'long', leverage).toFixed(4)} •
              (short): ${calcLiqPrice(currentPrice, 'short', leverage).toFixed(4)}
            </div>
          </div>

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
        </>
      )}

      {openTrades.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">All Positions ({openTrades.length})</span>
            <span className={`font-mono text-[10px] font-bold ${totalUnrealizedPnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
              uPnL: {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
            </span>
          </div>
          <div className="space-y-1 max-h-[180px] overflow-y-auto custom-scrollbar">
            {openTrades.map(t => {
              const mPrice = prices[t.marketId] ?? t.entryPrice;
              const diff = mPrice - t.entryPrice;
              const dir = t.direction === 'long' ? 1 : -1;
              const pnl = (diff / t.entryPrice) * t.size * t.leverage * dir;
              const pnlPctTrade = (pnl / t.size) * 100;
              const isNearLiq = t.direction === 'long'
                ? mPrice < t.entryPrice * (1 - 0.7 / t.leverage)
                : mPrice > t.entryPrice * (1 + 0.7 / t.leverage);
              return (
                <div key={t.id} className={`flex items-center justify-between bg-secondary/40 rounded px-2 py-1.5 text-[10px] ${
                  isNearLiq ? 'border border-[hsl(var(--impact-high)/0.5)] animate-impact-pulse' : ''
                }`}>
                  <div>
                    <span className="text-gold font-mono text-[8px]">{t.contract.split('/')[0]}</span>
                    <span className={`ml-1 font-semibold ${t.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                      {t.direction.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground ml-1">{t.leverage}x</span>
                    <span className="text-muted-foreground ml-1 font-mono">${t.entryPrice.toFixed(4)}</span>
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
                      onClick={() => closeTrade(t, 'manual')}
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

      {closedTrades.length > 0 && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">History</span>
          <div className="space-y-0.5 max-h-[80px] overflow-y-auto custom-scrollbar">
            {closedTrades.slice(0, 20).map(t => (
              <div key={t.id} className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>
                  <span className="text-gold">{t.contract.split('/')[0]}</span>{' '}
                  <span className={t.direction === 'long' ? 'text-accent' : 'text-destructive'}>{t.direction}</span>
                  {' '}{t.leverage}x
                  {t.reason === 'liquidated' && <span className="text-impact-high ml-1">LIQ</span>}
                  {t.reason === 'expired' && <span className="text-gold ml-1">EXP</span>}
                  {t.reason === 'counter-closed' && <span className="text-muted-foreground ml-1">NET</span>}
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
