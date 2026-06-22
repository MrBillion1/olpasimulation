import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { MatchEvent, getEventSentiment, MarketConfig } from '@/lib/match-engine';
import MultiMarketPanel from '@/components/multi/MultiMarketPanel';
import PortfolioTrackerCard from '@/components/multi/PortfolioTrackerCard';
import AdjustLeverageModal from '@/components/AdjustLeverageModal';

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
  sessionEndsAt?: number;
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
  sessionEndsAt?: number;
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
const nextTradeId = () => Date.now() * 1000 + (++tradeIdCounter % 1000);

export default function TradePanel({
  activeMarket, prices, latestEvents, balance, setBalance,
  openTrades, setOpenTrades, closedTrades, setClosedTrades, matchStates,
  onPlaceLimitOrder,
}: TradePanelProps) {
  const [tradeMode, setTradeMode] = useState<'single' | 'multi'>('single');
  const [tradeSize, setTradeSize] = useState(100);
  const [leverage, setLeverage] = useState(5);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slPct, setSlPct] = useState(5);
  const [tpPct, setTpPct] = useState(10);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [marginMode, setMarginMode] = useState<'cross' | 'isolated'>('cross');
  const [limitPrice, setLimitPrice] = useState('');
  const [showLevModal, setShowLevModal] = useState(false);

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

  // Position expiry, liquidation, SL/TP are handled by the global simulation store
  // so they keep working when this trade panel is unmounted on SCL routes.

  const openTrade = (direction: 'long' | 'short') => {
    if (tradeSize > balance || tradeSize <= 0) return;
    const ms = matchStates?.[activeMarket.id];
    if (ms && ms.minute >= 90 && !ms.isRunning) return;

    if (orderType === 'limit') {
      const lp = parseFloat(limitPrice);
      if (isNaN(lp) || lp <= 0) return;
      const { sl, tp } = calcSlTp(lp, direction);
      const order: LimitOrder = {
        id: nextTradeId(),
        marketId: activeMarket.id,
        contract: activeMarket.contract,
        direction,
        limitPrice: lp,
        size: tradeSize,
        leverage,
        timestamp: Date.now(),
        sessionEndsAt: ms ? Date.now() + Math.max(0, 90 - ms.minute) * 1667 : undefined,
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
      id: nextTradeId(), marketId: activeMarket.id, contract: activeMarket.contract,
      direction, entryPrice: currentPrice, size: tradeSize, leverage,
      timestamp: Date.now(), minute: latestEvent?.minute ?? 0, sessionEndsAt: ms ? Date.now() + Math.max(0, 90 - ms.minute) * 1667 : undefined, liquidationPrice: liqPrice,
      stopLoss: sl, takeProfit: tp, marginMode,
    };
    setBalance(b => Math.round((b - tradeSize) * 100) / 100);
    setOpenTrades(t => [trade, ...t]);
  };

  const isExpired = matchStates?.[activeMarket.id]?.minute >= 90 && !matchStates?.[activeMarket.id]?.isRunning;

  return (
    <div className="space-y-2">
      {/* Top-level mode selector */}
      <div className="bg-card border border-border rounded-lg p-1 flex gap-1">
        {([
          { id: 'single', label: 'Single Market', sub: '1 Market · 1 Position' },
          { id: 'multi', label: 'Multi Market', sub: '1 Portfolio · Up to 5' },
        ] as const).map(opt => (
          <button
            key={opt.id}
            onClick={() => setTradeMode(opt.id)}
            className={`flex-1 px-2 py-1.5 rounded text-left transition-all ${
              tradeMode === opt.id
                ? 'bg-gold text-primary-foreground'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider leading-tight">{opt.label}</div>
            <div className={`text-[8px] font-mono leading-tight ${tradeMode === opt.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{opt.sub}</div>
          </button>
        ))}
      </div>

      {tradeMode === 'multi' ? (
        <>
          <MultiMarketPanel balance={balance} />
          <PortfolioTrackerCard prices={prices} />
        </>
      ) : (
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
          {/* Mode + Leverage — Bybit-style header row */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <MarginModeSelect value={marginMode} onChange={setMarginMode} />
            <LeverageSelect
              value={leverage}
              onChange={setLeverage}
              onCustomize={() => setShowLevModal(true)}
            />
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

          {/* Long / Short — pill style */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => openTrade('long')}
              disabled={tradeSize > balance}
              className="bg-accent text-accent-foreground font-bold text-[12px] py-2.5 rounded-full
                         hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40 shadow-sm"
            >
              {orderType === 'limit' ? 'Limit ' : ''}Long
            </button>
            <button
              onClick={() => openTrade('short')}
              disabled={tradeSize > balance}
              className="bg-destructive text-destructive-foreground font-bold text-[12px] py-2.5 rounded-full
                         hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40 shadow-sm"
            >
              {orderType === 'limit' ? 'Limit ' : ''}Short
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
      )}

      {/* Portfolio tracker always visible when active portfolios exist */}
      {tradeMode === 'single' && <PortfolioTrackerCard prices={prices} />}

      {showLevModal && (
        <AdjustLeverageModal
          initial={leverage}
          notional={tradeSize}
          onConfirm={(v) => { setLeverage(v); setShowLevModal(false); }}
          onCancel={() => setShowLevModal(false)}
        />
      )}
    </div>
  );
}

/* ─── Margin Mode dropdown (Cross / Isolated) ─── */
function MarginModeSelect({ value, onChange }: { value: 'cross' | 'isolated'; onChange: (m: 'cross' | 'isolated') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-secondary border border-border rounded px-2.5 py-2 flex items-center justify-between hover:border-gold/50 transition-colors"
      >
        <span className="text-[11px] font-semibold text-foreground capitalize">{value}</span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-card border border-border rounded shadow-xl overflow-hidden">
          {(['cross', 'isolated'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { onChange(m); setOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                value === m ? 'text-gold bg-secondary' : 'text-foreground hover:bg-secondary/60'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Leverage dropdown with preset stops + Customize ─── */
function LeverageSelect({
  value, onChange, onCustomize,
}: { value: number; onChange: (n: number) => void; onCustomize: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const STOPS = [1, 2, 3, 5, 10, 25, 50, 100];
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-secondary border border-border rounded px-2.5 py-2 flex items-center justify-between hover:border-gold/50 transition-colors"
      >
        <span className="text-[11px] font-semibold text-foreground font-mono tabular-nums">{value.toFixed(2)}x</span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-card border border-border rounded shadow-xl overflow-hidden max-h-[260px] overflow-y-auto custom-scrollbar">
          {STOPS.map((s) => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                value === s ? 'text-gold bg-secondary' : 'text-foreground hover:bg-secondary/60'
              }`}
            >
              {s}x
            </button>
          ))}
          <button
            onClick={() => { setOpen(false); onCustomize(); }}
            className="w-full text-left px-2.5 py-1.5 text-[11px] font-semibold text-gold border-t border-border hover:bg-secondary/60"
          >
            Customize
          </button>
        </div>
      )}
    </div>
  );
}

