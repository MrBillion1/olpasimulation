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
  stopLoss: number | null;
  takeProfit: number | null;
  marginMode: 'cross' | 'isolated';
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
  reason: 'manual' | 'liquidated' | 'expired' | 'counter-closed' | 'stop-loss' | 'take-profit' | 'limit-filled';
}

export interface LimitOrder {
  id: number;
  marketId: string;
  contract: string;
  direction: 'long' | 'short';
  limitPrice: number;
  size: number;
  leverage: number;
  timestamp: number;
  stopLoss: number | null;
  takeProfit: number | null;
  marginMode: 'cross' | 'isolated';
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
  onPlaceLimitOrder: (order: LimitOrder) => void;
}

let tradeIdCounter = 0;

export default function TradePanel({
  activeMarket, prices, latestEvents, balance, setBalance,
  openTrades, setOpenTrades, closedTrades, setClosedTrades, matchStates,
  onPlaceLimitOrder,
}: TradePanelProps) {
  const [tradeSize, setTradeSize] = useState(100);
  const [leverage, setLeverage] = useState(5);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slPct, setSlPct] = useState(5);
  const [tpPct, setTpPct] = useState(10);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [marginMode, setMarginMode] = useState<'cross' | 'isolated'>('cross');
  const [limitPrice, setLimitPrice] = useState('');

  const currentPrice = prices[activeMarket.id] ?? activeMarket.startPrice;
  const latestEvent = latestEvents[activeMarket.id];

  // Live unrealized PnL across all open positions (mark-to-market)
  const unrealizedPnl = openTrades.reduce((sum, t) => {
    const mPrice = prices[t.marketId] ?? t.entryPrice;
    const diff = mPrice - t.entryPrice;
    const dir = t.direction === 'long' ? 1 : -1;
    return sum + (diff / t.entryPrice) * t.size * t.leverage * dir;
  }, 0);
  // Margin locked into open positions + pending limit orders
  const usedMargin = openTrades.reduce((s, t) => s + t.size, 0);
  // Equity = free balance + locked margin + unrealized PnL (real-time, like a derivatives exchange)
  const equity = balance + usedMargin + unrealizedPnl;
  const equityIsUp = unrealizedPnl >= 0;

  // Sync limit price placeholder when price changes
  useEffect(() => {
    if (!limitPrice) return;
  }, [currentPrice]);

  const calcLiqPrice = (entry: number, dir: 'long' | 'short', lev: number) => {
    if (dir === 'long') return Math.round(entry * (1 - 1 / lev) * 10000) / 10000;
    return Math.round(entry * (1 + 1 / lev) * 10000) / 10000;
  };

  const calcSlTp = (entry: number, dir: 'long' | 'short') => {
    const slPrice = dir === 'long'
      ? entry * (1 - slPct / 100)
      : entry * (1 + slPct / 100);
    const tpPrice = dir === 'long'
      ? entry * (1 + tpPct / 100)
      : entry * (1 - tpPct / 100);
    return {
      sl: slEnabled ? Math.round(slPrice * 10000) / 10000 : null,
      tp: tpEnabled ? Math.round(tpPrice * 10000) / 10000 : null,
    };
  };

  const closeTrade = (trade: OpenTrade, reason: ClosedTrade['reason'] = 'manual', overridePrice?: number) => {
    const mPrice = overridePrice ?? prices[trade.marketId] ?? trade.entryPrice;
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

  // Auto-liquidation + SL/TP check
  useEffect(() => {
    setOpenTrades(prev => {
      const stillOpen: OpenTrade[] = [];
      const newClosed: ClosedTrade[] = [];
      prev.forEach(t => {
        const mPrice = prices[t.marketId] ?? 0;
        const isLiquidated = t.direction === 'long'
          ? mPrice <= t.liquidationPrice
          : mPrice >= t.liquidationPrice;
        const slHit = t.stopLoss !== null && (
          t.direction === 'long' ? mPrice <= t.stopLoss : mPrice >= t.stopLoss
        );
        const tpHit = t.takeProfit !== null && (
          t.direction === 'long' ? mPrice >= t.takeProfit : mPrice <= t.takeProfit
        );

        if (isLiquidated) {
          newClosed.push({
            id: t.id, contract: t.contract, direction: t.direction,
            entryPrice: t.entryPrice, exitPrice: mPrice,
            size: t.size, leverage: t.leverage, pnl: -t.size, reason: 'liquidated',
          });
        } else if (slHit) {
          const exitP = t.stopLoss!;
          const diff = exitP - t.entryPrice;
          const dir = t.direction === 'long' ? 1 : -1;
          const pnl = Math.round(((diff / t.entryPrice) * t.size * t.leverage * dir) * 100) / 100;
          newClosed.push({
            id: t.id, contract: t.contract, direction: t.direction,
            entryPrice: t.entryPrice, exitPrice: exitP,
            size: t.size, leverage: t.leverage, pnl, reason: 'stop-loss',
          });
          const ret = t.size + pnl;
          setBalance(b => Math.round((b + Math.max(0, ret)) * 100) / 100);
        } else if (tpHit) {
          const exitP = t.takeProfit!;
          const diff = exitP - t.entryPrice;
          const dir = t.direction === 'long' ? 1 : -1;
          const pnl = Math.round(((diff / t.entryPrice) * t.size * t.leverage * dir) * 100) / 100;
          newClosed.push({
            id: t.id, contract: t.contract, direction: t.direction,
            entryPrice: t.entryPrice, exitPrice: exitP,
            size: t.size, leverage: t.leverage, pnl, reason: 'take-profit',
          });
          const ret = t.size + pnl;
          setBalance(b => Math.round((b + Math.max(0, ret)) * 100) / 100);
        } else {
          stillOpen.push(t);
        }
      });
      if (newClosed.length > 0) {
        setClosedTrades(c => [...newClosed, ...c].slice(0, 50));
      }
      return stillOpen;
    });
  }, [prices, setOpenTrades, setClosedTrades, setBalance]);

  // Contract expiry
  useEffect(() => {
    if (!matchStates) return;
    Object.entries(matchStates).forEach(([marketId, ms]) => {
      if (ms.minute >= 90 && !ms.isRunning) {
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
    if (ms && ms.minute >= 90 && !ms.isRunning) return;

    if (orderType === 'limit') {
      const lp = parseFloat(limitPrice);
      if (isNaN(lp) || lp <= 0) return;
      const { sl, tp } = calcSlTp(lp, direction);
      const order: LimitOrder = {
        id: ++tradeIdCounter,
        marketId: activeMarket.id,
        contract: activeMarket.contract,
        direction,
        limitPrice: lp,
        size: tradeSize,
        leverage,
        timestamp: Date.now(),
        stopLoss: sl,
        takeProfit: tp,
        marginMode,
      };
      setBalance(b => Math.round((b - tradeSize) * 100) / 100);
      onPlaceLimitOrder(order);
      setLimitPrice('');
      return;
    }

    // Market order
    const existingOnMarket = openTrades.filter(t => t.marketId === activeMarket.id);
    const opposites = existingOnMarket.filter(t => t.direction !== direction);
    opposites.forEach(t => closeTrade(t, 'counter-closed'));

    const liqPrice = calcLiqPrice(currentPrice, direction, leverage);
    const { sl, tp } = calcSlTp(currentPrice, direction);
    const trade: OpenTrade = {
      id: ++tradeIdCounter, marketId: activeMarket.id, contract: activeMarket.contract,
      direction, entryPrice: currentPrice, size: tradeSize, leverage,
      timestamp: Date.now(), minute: latestEvent?.minute ?? 0, liquidationPrice: liqPrice,
      stopLoss: sl, takeProfit: tp, marginMode,
    };
    setBalance(b => Math.round((b - tradeSize) * 100) / 100);
    setOpenTrades(t => [trade, ...t]);
  };

  const isExpired = matchStates?.[activeMarket.id]?.minute >= 90 && !matchStates?.[activeMarket.id]?.isRunning;

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] uppercase tracking-widest text-gold font-semibold">Trade</h3>
          <span className={`font-mono text-[11px] font-black tabular-nums ${equityIsUp ? 'text-accent' : 'text-destructive'}`}>
            ${equity.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5 text-[8px] font-mono text-muted-foreground">
          <span>Avail ${balance.toFixed(2)} · Margin ${usedMargin.toFixed(2)}</span>
          <span className={equityIsUp ? 'text-accent' : 'text-destructive'}>
            uPnL {equityIsUp ? '+' : ''}{unrealizedPnl.toFixed(2)}
          </span>
        </div>
      </div>

      {isExpired && (
        <div className="text-center py-2 mb-2 bg-muted/30 rounded border border-border">
          <span className="text-[10px] text-muted-foreground font-semibold">🏁 Contract expired</span>
        </div>
      )}

      {!isExpired && (
        <>
          {/* Cross / Isolated */}
          <div className="flex gap-1 mb-2">
            {(['cross', 'isolated'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setMarginMode(mode)}
                className={`flex-1 text-[9px] py-1 rounded font-semibold uppercase tracking-wider transition-all ${
                  marginMode === mode
                    ? 'bg-gold text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Market / Limit */}
          <div className="flex gap-1 mb-2">
            {(['market', 'limit'] as const).map(ot => (
              <button
                key={ot}
                onClick={() => setOrderType(ot)}
                className={`flex-1 text-[9px] py-1 rounded font-semibold uppercase tracking-wider transition-all ${
                  orderType === ot
                    ? 'bg-secondary text-foreground border border-border'
                    : 'bg-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {ot}
              </button>
            ))}
          </div>

          {/* Limit price input */}
          {orderType === 'limit' && (
            <div className="mb-2">
              <label className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Limit Price</label>
              <input
                type="number"
                step="0.0001"
                value={limitPrice}
                onChange={e => setLimitPrice(e.target.value)}
                placeholder={currentPrice.toFixed(4)}
                className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold"
              />
              {limitPrice && (
                <div className="text-[8px] text-muted-foreground mt-0.5 font-mono">
                  {parseFloat(limitPrice) < currentPrice ? '↓ Below market' : '↑ Above market'} • Δ{Math.abs(((parseFloat(limitPrice) - currentPrice) / currentPrice) * 100).toFixed(2)}%
                </div>
              )}
            </div>
          )}

          {/* Position size */}
          <div className="mb-2">
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Size (USDT)</label>
            <input
              type="range" min={10} max={Math.min(2000, balance)} step={10}
              value={tradeSize} onChange={e => setTradeSize(Number(e.target.value))}
              className="w-full accent-[hsl(var(--gold))] h-1"
            />
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
              <span>${tradeSize}</span>
              <span>Notional: ${(tradeSize * leverage).toFixed(0)}</span>
            </div>
          </div>

          {/* Leverage */}
          <div className="mb-2">
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Leverage</label>
            <div className="flex gap-0.5">
              {[1, 2, 5, 10, 20].map(lev => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  className={`flex-1 text-[9px] py-1 rounded font-semibold transition-all ${
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

          {/* SL/TP */}
          <div className="mb-2 space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSlEnabled(!slEnabled)}
                className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded transition-all ${
                  slEnabled ? 'bg-destructive/20 text-destructive border border-destructive/40' : 'bg-secondary text-muted-foreground'
                }`}
              >
                SL {slEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setTpEnabled(!tpEnabled)}
                className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded transition-all ${
                  tpEnabled ? 'bg-accent/20 text-accent border border-accent/40' : 'bg-secondary text-muted-foreground'
                }`}
              >
                TP {tpEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {(slEnabled || tpEnabled) && (
              <div className="bg-secondary/30 rounded p-1.5 border border-border space-y-1">
                {slEnabled && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] text-destructive font-semibold uppercase">SL {slPct}%</label>
                      <span className="text-[8px] font-mono text-muted-foreground">
                        ${(currentPrice * (1 - slPct / 100)).toFixed(4)}
                      </span>
                    </div>
                    <input type="range" min={1} max={50} step={1} value={slPct} onChange={e => setSlPct(Number(e.target.value))}
                      className="w-full accent-destructive h-1" />
                  </div>
                )}
                {tpEnabled && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] text-accent font-semibold uppercase">TP {tpPct}%</label>
                      <span className="text-[8px] font-mono text-muted-foreground">
                        ${(currentPrice * (1 + tpPct / 100)).toFixed(4)}
                      </span>
                    </div>
                    <input type="range" min={1} max={100} step={1} value={tpPct} onChange={e => setTpPct(Number(e.target.value))}
                      className="w-full accent-[hsl(var(--accent))] h-1" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Buy/Sell */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <button
              onClick={() => openTrade('long')}
              disabled={tradeSize > balance}
              className="bg-accent text-accent-foreground font-semibold text-[10px] py-2 rounded
                         hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40"
            >
              {orderType === 'limit' ? 'Limit' : ''} Long / Buy
            </button>
            <button
              onClick={() => openTrade('short')}
              disabled={tradeSize > balance}
              className="bg-destructive text-destructive-foreground font-semibold text-[10px] py-2 rounded
                         hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40"
            >
              {orderType === 'limit' ? 'Limit' : ''} Short / Sell
            </button>
          </div>

          {/* Margin mode info */}
          <div className="text-[8px] text-muted-foreground font-mono border-t border-border pt-1">
            <span className="text-gold uppercase font-semibold">{marginMode}</span>
            {marginMode === 'cross' && ' • Shared margin across positions'}
            {marginMode === 'isolated' && ' • Isolated margin per position'}
            <span className="ml-1">• Liq: ${calcLiqPrice(currentPrice, 'long', leverage).toFixed(4)}</span>
          </div>
        </>
      )}
    </div>
  );
}
