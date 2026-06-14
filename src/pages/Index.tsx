import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MatchEvent, MARKETS,
} from '@/lib/match-engine';
import EventFeed from '@/components/EventFeed';
import AnimatedPitch from '@/components/AnimatedPitch';
import TradePanel from '@/components/TradePanel';
import PriceChart from '@/components/PriceChart';
import Commentary from '@/components/Commentary';
import OrderBook from '@/components/OrderBook';
import { supabase } from '@/integrations/supabase/client';
import { useStore } from '@/hooks/useStore';
import { actions, OpenTrade, ClosedTrade, LimitOrder, MarketRuntime } from '@/lib/simulation-store';

type ViewMode = 'events' | 'trade';
type EventTab = 'live' | 'simulation' | 'commentary' | 'scores' | 'possession';
type PositionTab = 'positions' | 'open-orders' | 'trade-history' | 'order-history';

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialContract = searchParams.get('contract');
  const initialView = searchParams.get('view');
  const [activeMarketId, setActiveMarketId] = useState(
    initialContract && MARKETS.some(m => m.id === initialContract) ? initialContract : MARKETS[0].id
  );
  const [viewMode, setViewMode] = useState<ViewMode>(initialView === 'trade' ? 'trade' : 'events');
  const [eventTab, setEventTab] = useState<EventTab>('live');
  const [positionTab, setPositionTab] = useState<PositionTab>('positions');

  // React to deep-link changes (e.g. tapping a ticker on a SCL post)
  useEffect(() => {
    const c = searchParams.get('contract');
    const v = searchParams.get('view');
    if (c && MARKETS.some(m => m.id === c) && c !== activeMarketId) setActiveMarketId(c);
    if (v === 'trade' && viewMode !== 'trade') setViewMode('trade');
    if (v === 'events' && viewMode !== 'events') setViewMode('events');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Shared simulation store — single source of truth for both Terminal and SCL
  const runtimes = useStore(s => s.runtimes);
  const balance = useStore(s => s.balance);
  const openTrades = useStore(s => s.openTrades);
  const closedTrades = useStore(s => s.closedTrades);
  const limitOrders = useStore(s => s.limitOrders);
  const setBalance = actions.setBalance;
  const setOpenTrades = actions.setOpenTrades;
  const setClosedTrades = actions.setClosedTrades;
  const setLimitOrders = actions.setLimitOrders;
  const startAll = actions.startAll;

  const [bottomPanelHeight, setBottomPanelHeight] = useState(320);
  const tradeLayoutRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Partial-close confirm modal state
  const [closeRequest, setCloseRequest] = useState<{ trade: OpenTrade; fraction: number } | null>(null);

  const executeClose = (trade: OpenTrade, fraction: number) => {
    const mPrice = runtimes[trade.marketId]?.currentPrice ?? trade.entryPrice;
    const f = Math.min(1, Math.max(0.01, fraction));
    const closedSize = Math.round(trade.size * f * 100) / 100;
    const remainingSize = Math.round((trade.size - closedSize) * 100) / 100;
    const priceDiff = mPrice - trade.entryPrice;
    const dir = trade.direction === 'long' ? 1 : -1;
    const pnl = Math.round(((priceDiff / trade.entryPrice) * closedSize * trade.leverage * dir) * 100) / 100;
    const returnAmount = closedSize + pnl;
    setBalance(b => Math.round((b + Math.max(0, returnAmount)) * 100) / 100);
    if (remainingSize > 0) {
      setOpenTrades(arr => arr.map(t => t.id === trade.id ? { ...t, size: remainingSize } : t));
    } else {
      setOpenTrades(arr => arr.filter(t => t.id !== trade.id));
    }
    setClosedTrades(c => [{
      id: trade.id + Math.floor(Math.random() * 1e6),
      contract: trade.contract, direction: trade.direction,
      entryPrice: trade.entryPrice, exitPrice: mPrice,
      size: closedSize, leverage: trade.leverage, pnl, reason: 'manual' as const,
    }, ...c].slice(0, 50));
    setCloseRequest(null);
  };

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStateRef.current = { startY: e.clientY, startHeight: bottomPanelHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragStateRef.current || !tradeLayoutRef.current) return;
      const containerH = tradeLayoutRef.current.clientHeight;
      const delta = dragStateRef.current.startY - ev.clientY;
      const next = Math.max(60, Math.min(containerH - 80, dragStateRef.current.startHeight + delta));
      setBottomPanelHeight(next);
    };
    const onUp = () => {
      dragStateRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [bottomPanelHeight]);
  const [contractDropdownOpen, setContractDropdownOpen] = useState(false);

  // Trading-session persistence is handled globally in App's Bootstrap so
  // it keeps running across page navigations (Index ↔ SCL). No-op here.

  const activeMarket = MARKETS.find(m => m.id === activeMarketId)!;
  const activeRuntime = runtimes[activeMarketId];

  const latestEvent = activeRuntime.state.events[activeRuntime.state.events.length - 1];

  const prices: Record<string, number> = {};
  const priceChanges: Record<string, number> = {};
  const matchMinutes: Record<string, number> = {};
  const isRunningMap: Record<string, boolean> = {};
  const latestEvents: Record<string, MatchEvent | undefined> = {};
  const allEvents: Record<string, MatchEvent[]> = {};
  MARKETS.forEach(m => {
    const rt = runtimes[m.id];
    prices[m.id] = rt.currentPrice;
    priceChanges[m.id] = rt.currentPrice - m.startPrice;
    matchMinutes[m.id] = rt.state.minute;
    isRunningMap[m.id] = rt.state.isRunning;
    latestEvents[m.id] = rt.state.events[rt.state.events.length - 1];
    allEvents[m.id] = rt.state.events;
  });

  const cancelLimitOrder = (orderId: number) => {
    const order = limitOrders.find(o => o.id === orderId);
    if (order) {
      setBalance(b => Math.round((b + order.size) * 100) / 100);
    }
    setLimitOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const matchStates = Object.fromEntries(MARKETS.map(m => [m.id, { isRunning: runtimes[m.id].state.isRunning, minute: runtimes[m.id].state.minute }]));

  const scoresData = MARKETS.map(m => {
    const rt = runtimes[m.id];
    const goals = rt.state.events.filter(e => e.type === 'Goal' || e.type === 'Penalty' || e.type === 'Own Goal');
    const cards = rt.state.events.filter(e => e.type === 'Yellow Card' || e.type === 'Red Card');
    const shots = rt.state.events.filter(e => e.type === 'Shot on Target');
    const lastEv = rt.state.events[rt.state.events.length - 1];
    return { market: m, rt, goals: goals.length, cards: cards.length, shots: shots.length, lastEv };
  });

  // Contract dropdown component (shared between views)
  const ContractDropdown = () => (
    <div className="relative">
      <button
        onClick={() => setContractDropdownOpen(!contractDropdownOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <span className="text-sm font-bold text-foreground tracking-wide">
          {activeMarket.contract}
        </span>
        <svg
          className={`w-3 h-3 text-muted-foreground transition-transform ${contractDropdownOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {contractDropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContractDropdownOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl min-w-[280px] py-1 max-h-[400px] overflow-y-auto">
            {MARKETS.map(m => {
              const active = m.id === activeMarketId;
              const mPrice = prices[m.id] ?? m.startPrice;
              const mChange = priceChanges[m.id] ?? 0;
              const mChangePct = m.startPrice > 0 ? (mChange / m.startPrice * 100) : 0;
              const mIsUp = mChange >= 0;
              const mMinute = matchMinutes[m.id] ?? 0;
              const mRunning = isRunningMap[m.id] ?? false;
              return (
                <button
                  key={m.id}
                  onClick={() => { setActiveMarketId(m.id); setContractDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                    active ? 'bg-secondary' : 'hover:bg-secondary/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {mRunning && <div className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />}
                    <div>
                      <div className="font-mono text-xs font-bold text-foreground">{m.contract}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        <span style={{ color: m.homeColor }}>{m.homeShort}</span>
                        <span className="mx-1 text-muted-foreground/40">vs</span>
                        <span style={{ color: m.awayColor }}>{m.awayShort}</span>
                        {mMinute > 0 && <span className="ml-2">{mMinute}'</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-black tabular-nums text-foreground">${mPrice.toFixed(4)}</div>
                    <div className={`font-mono text-[10px] font-bold ${mIsUp ? 'text-accent' : 'text-destructive'}`}>
                      {mIsUp ? '+' : ''}{mChangePct.toFixed(2)}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // Stats bar (shared)
  const StatsBar = () => {
    const ms = matchStates[activeMarketId];
    const isLive = ms?.isRunning;
    const minute = ms?.minute ?? 0;
    const currentPrice = activeRuntime.currentPrice;
    const change = priceChanges[activeMarketId] ?? 0;
    const changePct = activeMarket.startPrice > 0 ? (change / activeMarket.startPrice * 100) : 0;
    const isUp = change >= 0;
    return (
      <div className="flex items-center gap-6 ml-6 text-[10px]">
        <div className="flex flex-col items-start gap-0.5">
          <div className="text-muted-foreground uppercase tracking-widest text-[8px]">Price</div>
          <div className="font-mono text-sm font-black tabular-nums text-foreground">${currentPrice.toFixed(4)}</div>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <div className="text-muted-foreground uppercase tracking-widest text-[8px]">Change</div>
          <div className={`font-mono text-sm font-bold tabular-nums ${isUp ? 'text-accent' : 'text-destructive'}`}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </div>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <div className="text-muted-foreground uppercase tracking-widest text-[8px]">Score</div>
          <div className="font-mono text-sm font-black tabular-nums text-foreground">
            {activeRuntime.state.homeScore} - {activeRuntime.state.awayScore}
          </div>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <div className="text-muted-foreground uppercase tracking-widest text-[8px]">Minutes</div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold tabular-nums text-foreground">{minute}'</span>
            {isLive && <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-card/90 px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold text-gold tracking-wider">ADVANCED MICRO-EVENT SIMULATION <span className="text-muted-foreground">·</span> OLPA DEX</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={startAll}
            className="text-[9px] font-semibold px-3 py-1.5 rounded bg-gold text-primary-foreground hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-wider mr-2"
          >
            ▶ AUTO
          </button>
          <button
            onClick={() => setViewMode('events')}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded transition-all ${
              viewMode === 'events'
                ? 'bg-gold text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            ⚡ Live Simulation
          </button>
          <button
            onClick={() => setViewMode('trade')}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded transition-all ${
              viewMode === 'trade'
                ? 'bg-gold text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            📊 Trade
          </button>
          <Link
            to={`/scl/${activeMarketId}`}
            className="text-[10px] font-semibold px-3 py-1.5 rounded transition-all bg-secondary text-muted-foreground hover:text-foreground"
            title="Open the Social Conviction Layer for this contract"
          >
            🧠 SCL
          </Link>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'events' ? (
          /* ─── PAGE 1: EVENT VIEW ─── */
          <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b border-border bg-card/90">
              <div className="px-4 py-2 flex items-center">
                <ContractDropdown />
                <StatsBar />
              </div>
              <div className="px-4 pb-1 flex items-center gap-1 overflow-x-auto">
                {([
                  { key: 'live', label: '🟢 Live Simulation' },
                  { key: 'simulation', label: '⚡ Event-Simulation' },
                  { key: 'commentary', label: '📺 Commentary' },
                  { key: 'scores', label: '📊 LiveScore' },
                  { key: 'possession', label: '⚽ Possession' },
                ] as { key: EventTab; label: string }[]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setEventTab(tab.key)}
                    className={`text-[10px] font-semibold px-3 py-1 rounded transition-all whitespace-nowrap ${
                      eventTab === tab.key
                        ? 'bg-secondary text-gold border-b-2 border-gold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* VAR banner */}
            {activeRuntime.state.varActive && (
              <div className="bg-[hsl(var(--impact-high)/0.12)] border-b border-[hsl(var(--impact-high)/0.4)] px-4 py-2 flex items-center justify-center gap-2">
                <span className="text-sm">📺</span>
                <span className="text-[11px] font-bold text-impact-high">VAR REVIEW — PENDA MODE</span>
                <span className="font-mono text-[10px] text-gold font-bold">{activeRuntime.state.varMinutesLeft}m</span>
              </div>
            )}

            <div className="flex-1 flex overflow-hidden">
              {/* Left: Event content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {eventTab === 'live' && (
                <div className="h-full flex flex-col">
                  <AnimatedPitch
                    selectedZone={activeRuntime.state.selectedZone}
                    onZoneSelect={() => {}}
                    lastEventZone={activeRuntime.state.events.length > 0 ? activeRuntime.state.events[activeRuntime.state.events.length - 1].zone : undefined}
                    lastEventTeam={activeRuntime.state.events.length > 0 ? activeRuntime.state.events[activeRuntime.state.events.length - 1].team : undefined}
                    isRunning={activeRuntime.state.isRunning}
                    minute={activeRuntime.state.minute}
                    ballZone={activeRuntime.state.selectedZone}
                    homeTeam={activeMarket.homeTeam}
                    awayTeam={activeMarket.awayTeam}
                    homeColor={activeMarket.homeColor}
                    awayColor={activeMarket.awayColor}
                    varActive={activeRuntime.state.varActive}
                  />
                  {/* Live event ticker below pitch */}
                  <div className="mt-2 space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {[...activeRuntime.state.events].reverse().slice(0, 8).map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 text-[10px] font-mono py-0.5 border-b border-border/30">
                        <span className="text-muted-foreground w-6 text-right">{ev.minute}'</span>
                        <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold text-white ${
                          ev.team === 'home' ? 'bg-accent' : 'bg-destructive'
                        }`}>
                          {ev.team === 'home' ? 'H' : 'A'}
                        </span>
                        <span className="text-foreground">{ev.emoji} {ev.type}</span>
                        <span className={`text-[8px] uppercase font-semibold ${
                          ev.impact === 'high' ? 'text-impact-high' : ev.impact === 'medium' ? 'text-impact-medium' : 'text-impact-low'
                        }`}>{ev.impact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {eventTab === 'simulation' && (
                <EventFeed events={activeRuntime.state.events} />
              )}
              {eventTab === 'commentary' && (
                <Commentary
                  allEvents={allEvents}
                  markets={MARKETS}
                  activeMarketId={activeMarketId}
                  matchStates={matchStates}
                />
              )}
              {eventTab === 'scores' && (
                <div className="space-y-1.5">
                  <h3 className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">📊 Live Scores</h3>
                  {scoresData.map(({ market: m, rt, goals, cards, shots, lastEv }) => {
                    const active = m.id === activeMarketId;
                    const pChange = rt.currentPrice - m.startPrice;
                    const pChangePct = m.startPrice > 0 ? (pChange / m.startPrice * 100) : 0;
                    const isUp2 = pChange >= 0;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setActiveMarketId(m.id)}
                        className={`w-full text-left rounded-md p-2 transition-all ${
                          active ? 'bg-secondary border border-[hsl(var(--gold-muted))]' : 'bg-secondary/30 hover:bg-secondary/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {rt.state.isRunning && <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                            <span className="font-mono text-[10px] text-gold font-bold">{m.contract}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">{rt.state.minute}'</span>
                          </div>
                          <span className={`font-mono text-[10px] font-bold ${isUp2 ? 'text-accent' : 'text-destructive'}`}>
                            ${rt.currentPrice.toFixed(4)} {isUp2 ? '▲' : '▼'}{Math.abs(pChangePct).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px]">
                            <span style={{ color: m.homeColor }} className="font-semibold">{m.homeShort}</span>
                            <span className="font-mono font-black text-foreground">{rt.state.homeScore} - {rt.state.awayScore}</span>
                            <span style={{ color: m.awayColor }} className="font-semibold">{m.awayShort}</span>
                          </div>
                          <div className="flex gap-2 text-[8px] text-muted-foreground">
                            <span>🎯{shots}</span><span>🟨{cards}</span><span>⚽{goals}</span>
                          </div>
                        </div>
                        {lastEv && (
                          <div className="text-[8px] text-muted-foreground/70 mt-0.5 truncate">
                            {lastEv.minute}' — {lastEv.emoji} {lastEv.type} ({lastEv.team === 'home' ? m.homeShort : m.awayShort})
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {eventTab === 'possession' && (
                <PossessionView runtimes={runtimes} activeMarketId={activeMarketId} />
              )}
              </div>
              {/* Right: Live Price Chart */}
              <div className="w-[45%] shrink-0 border-l border-border overflow-hidden p-2">
                <div className="h-full">
                  <PriceChart
                    priceHistory={activeRuntime.priceHistory}
                    currentPrice={activeRuntime.currentPrice}
                    startPrice={activeMarket.startPrice}
                    contract={activeMarket.contract}
                    homeTeam={activeMarket.homeTeam}
                    awayTeam={activeMarket.awayTeam}
                    homeColor={activeMarket.homeColor}
                    awayColor={activeMarket.awayColor}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── PAGE 2: TRADE VIEW ─── */
          <div className="h-full flex flex-col overflow-hidden">
            {/* Header — same style as event view */}
            <div className="border-b border-border bg-card/90">
              <div className="px-4 py-2 flex items-center">
                <ContractDropdown />
                <StatsBar />
              </div>
            </div>

            {/* Main trade layout — left (chart + bottom tabs) + right (Trade/OrderBook full height) */}
            <div ref={tradeLayoutRef} className="flex-1 flex overflow-hidden min-h-0">
              {/* Left column: Chart on top, Tabs at bottom */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Chart — fills remaining space */}
                <div className="flex-1 overflow-hidden p-2 min-h-0">
                  <div className="h-full">
                    <PriceChart
                      priceHistory={activeRuntime.priceHistory}
                      currentPrice={activeRuntime.currentPrice}
                      startPrice={activeMarket.startPrice}
                      contract={activeMarket.contract}
                      homeTeam={activeMarket.homeTeam}
                      awayTeam={activeMarket.awayTeam}
                      homeColor={activeMarket.homeColor}
                      awayColor={activeMarket.awayColor}
                    />
                  </div>
                </div>

                {/* Drag divider — drag up/down to resize positions panel */}
                <div
                  onMouseDown={handleDividerMouseDown}
                  className="group h-2 shrink-0 cursor-ns-resize bg-border hover:bg-gold/60 transition-colors flex items-center justify-center relative"
                  title="Drag up or down to resize"
                >
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-card border border-border group-hover:border-gold absolute z-10">
                    <span className="text-[8px] text-muted-foreground group-hover:text-gold leading-none">▲</span>
                    <span className="text-[7px] font-semibold text-muted-foreground group-hover:text-gold uppercase tracking-wider leading-none">Drag</span>
                    <span className="text-[8px] text-muted-foreground group-hover:text-gold leading-none">▼</span>
                  </div>
                </div>

                {/* Bottom tabs — height controlled by drag divider */}
                <div
                  style={{ height: `${bottomPanelHeight}px` }}
                  className="border-t border-border bg-card/40 shrink-0 flex flex-col"
                >
                  <div className="flex items-center gap-0 border-b border-border px-2 shrink-0">
                    {([
                      { key: 'positions', label: 'Positions', count: openTrades.length },
                      { key: 'open-orders', label: 'Open Orders', count: limitOrders.length },
                      { key: 'trade-history', label: 'Trade History', count: closedTrades.length },
                      { key: 'order-history', label: 'Order History', count: 0 },
                    ] as { key: PositionTab; label: string; count: number }[]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setPositionTab(tab.key)}
                        className={`text-[10px] font-semibold px-3 py-2 transition-all border-b-2 ${
                          positionTab === tab.key
                            ? 'text-foreground border-gold'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                        }`}
                      >
                        {tab.label}
                        {tab.count > 0 && (
                          <span className="ml-1 text-[8px] bg-secondary rounded-full px-1.5 py-0.5">{tab.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    {positionTab === 'positions' && (
                      <PositionsTable
                        openTrades={openTrades}
                        prices={prices}
                        onRequestClose={(trade, fraction) => setCloseRequest({ trade, fraction })}
                      />
                    )}
                    {positionTab === 'open-orders' && (
                      <OpenOrdersTable limitOrders={limitOrders} cancelOrder={cancelLimitOrder} />
                    )}
                    {positionTab === 'trade-history' && (
                      <TradeHistoryTable closedTrades={closedTrades} />
                    )}
                    {positionTab === 'order-history' && (
                      <div className="text-center py-4 text-[10px] text-muted-foreground">No cancelled orders</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right panel: Trade + OrderBook — full height */}
              <div className="w-[390px] shrink-0 border-l border-border overflow-y-auto custom-scrollbar p-2 space-y-2">
                <TradePanel
                  activeMarket={activeMarket}
                  prices={prices}
                  latestEvents={latestEvents}
                  balance={balance}
                  setBalance={setBalance}
                  openTrades={openTrades}
                  setOpenTrades={setOpenTrades}
                  closedTrades={closedTrades}
                  setClosedTrades={setClosedTrades}
                  matchStates={matchStates}
                  onPlaceLimitOrder={(order) => setLimitOrders(prev => [order, ...prev])}
                />
                <OrderBook
                  currentPrice={activeRuntime.currentPrice}
                  lastEventImpact={latestEvent?.impact}
                  lastEventDirection={activeRuntime.lastDirection}
                  contract={activeMarket.contract.split('/')[0]}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      {closeRequest && (
        <CloseConfirmModal
          trade={closeRequest.trade}
          fraction={closeRequest.fraction}
          currentPrice={runtimes[closeRequest.trade.marketId]?.currentPrice ?? closeRequest.trade.entryPrice}
          onCancel={() => setCloseRequest(null)}
          onConfirm={() => executeClose(closeRequest.trade, closeRequest.fraction)}
        />
      )}
    </div>
  );
}

/* ─── Positions Table ─── */
function PositionsTable({
  openTrades, prices, onRequestClose,
}: {
  openTrades: OpenTrade[];
  prices: Record<string, number>;
  onRequestClose: (t: OpenTrade, fraction: number) => void;
}) {
  if (openTrades.length === 0) {
    return <div className="text-center py-4 text-[10px] text-muted-foreground">No open positions</div>;
  }

  return (
    <div className="px-2">
      <table className="w-full text-[9px] font-mono">
        <thead>
          <tr className="text-muted-foreground uppercase tracking-wider">
            <th className="text-left py-1.5 px-1">Contract</th>
            <th className="text-left py-1.5 px-1">Side</th>
            <th className="text-right py-1.5 px-1">Size</th>
            <th className="text-right py-1.5 px-1">Lev</th>
            <th className="text-right py-1.5 px-1">Entry</th>
            <th className="text-right py-1.5 px-1">Mark</th>
            <th className="text-right py-1.5 px-1">uPnL</th>
            <th className="text-right py-1.5 px-1">Liq</th>
            <th className="text-center py-1.5 px-1">Mode</th>
            <th className="text-center py-1.5 px-1">Close</th>
          </tr>
        </thead>
        <tbody>
          {openTrades.map(t => {
            const mPrice = prices[t.marketId] ?? t.entryPrice;
            const diff = mPrice - t.entryPrice;
            const dir = t.direction === 'long' ? 1 : -1;
            const pnl = (diff / t.entryPrice) * t.size * t.leverage * dir;
            const pnlPct = (pnl / t.size) * 100;
            return (
              <tr key={t.id} className="border-t border-border/30 hover:bg-secondary/30">
                <td className="py-1 px-1 text-gold">{t.contract}</td>
                <td className={`py-1 px-1 font-bold ${t.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                  {t.direction.toUpperCase()}
                </td>
                <td className="py-1 px-1 text-right text-foreground">${t.size}</td>
                <td className="py-1 px-1 text-right text-muted-foreground">{t.leverage}x</td>
                <td className="py-1 px-1 text-right text-foreground">{t.entryPrice.toFixed(4)}</td>
                <td className="py-1 px-1 text-right text-foreground">{mPrice.toFixed(4)}</td>
                <td className={`py-1 px-1 text-right font-bold ${pnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(0)}%)
                </td>
                <td className="py-1 px-1 text-right text-muted-foreground">{t.liquidationPrice.toFixed(4)}</td>
                <td className="py-1 px-1 text-center">
                  <span className={`text-[7px] uppercase font-bold px-1 py-0.5 rounded ${
                    t.marginMode === 'cross' ? 'bg-gold/20 text-gold' : 'bg-secondary text-muted-foreground'
                  }`}>{t.marginMode}</span>
                </td>
                <td className="py-1 px-1 text-center">
                  <div className="inline-flex gap-0.5">
                    {[0.25, 0.5, 0.75, 1].map(f => (
                      <button
                        key={f}
                        onClick={() => onRequestClose(t, f)}
                        className={`text-[8px] px-1 py-0.5 rounded transition-colors ${
                          f === 1
                            ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 font-bold'
                            : 'bg-muted text-foreground hover:bg-foreground/20'
                        }`}
                        title={`Close ${f * 100}% of this position`}
                      >
                        {f === 1 ? '100%' : `${f * 100}%`}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Close-position confirmation modal ─── */
function CloseConfirmModal({
  trade, fraction, currentPrice, onConfirm, onCancel,
}: {
  trade: OpenTrade;
  fraction: number;
  currentPrice: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const closedSize = Math.round(trade.size * fraction * 100) / 100;
  const remainingSize = Math.round((trade.size - closedSize) * 100) / 100;
  const diff = currentPrice - trade.entryPrice;
  const dir = trade.direction === 'long' ? 1 : -1;
  const pnl = (diff / trade.entryPrice) * closedSize * trade.leverage * dir;
  const pnlPct = closedSize > 0 ? (pnl / closedSize) * 100 : 0;
  const profit = pnl >= 0;
  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-[420px] bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-card/90 flex items-center justify-between">
          <span className="font-mono text-[12px] font-bold text-gold tracking-wider">CONFIRM CLOSE · {Math.round(fraction * 100)}%</span>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>
        <div className="p-4 space-y-3 text-[11px] font-mono">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Contract</span>
            <span className="text-gold font-bold">{trade.contract}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Side</span>
            <span className={`font-bold ${trade.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>{trade.direction.toUpperCase()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Leverage / Mode</span>
            <span className="text-foreground">{trade.leverage}x · <span className="uppercase">{trade.marginMode}</span></span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Entry → Mark</span>
            <span className="text-foreground tabular-nums">${trade.entryPrice.toFixed(4)} → ${currentPrice.toFixed(4)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Liquidation</span>
            <span className="text-foreground tabular-nums">${trade.liquidationPrice.toFixed(4)}</span>
          </div>
          {(trade.stopLoss != null || trade.takeProfit != null) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">SL / TP</span>
              <span className="text-foreground tabular-nums">
                {trade.stopLoss != null ? `$${trade.stopLoss.toFixed(4)}` : '—'} / {trade.takeProfit != null ? `$${trade.takeProfit.toFixed(4)}` : '—'}
              </span>
            </div>
          )}
          <div className="border-t border-border pt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Closing size</span>
              <span className="text-foreground tabular-nums font-bold">${closedSize.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Remaining size</span>
              <span className={`tabular-nums ${remainingSize > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>${remainingSize.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Realized PnL</span>
              <span className={`tabular-nums font-bold ${profit ? 'text-accent' : 'text-destructive'}`}>
                {profit ? '+' : ''}{pnl.toFixed(2)} ({profit ? '+' : ''}{pnlPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border bg-card/40 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button onClick={onConfirm} className="text-[10px] uppercase tracking-wider font-bold px-4 py-1.5 rounded bg-destructive text-destructive-foreground hover:brightness-110">
            Close {Math.round(fraction * 100)}%
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Open Orders Table ─── */
function OpenOrdersTable({
  limitOrders, cancelOrder,
}: {
  limitOrders: LimitOrder[];
  cancelOrder: (id: number) => void;
}) {
  if (limitOrders.length === 0) {
    return <div className="text-center py-4 text-[10px] text-muted-foreground">No open orders</div>;
  }
  return (
    <div className="px-2">
      <table className="w-full text-[9px] font-mono">
        <thead>
          <tr className="text-muted-foreground uppercase tracking-wider">
            <th className="text-left py-1.5 px-1">Contract</th>
            <th className="text-left py-1.5 px-1">Side</th>
            <th className="text-right py-1.5 px-1">Size</th>
            <th className="text-right py-1.5 px-1">Lev</th>
            <th className="text-right py-1.5 px-1">Limit Price</th>
            <th className="text-center py-1.5 px-1">Mode</th>
            <th className="text-right py-1.5 px-1"></th>
          </tr>
        </thead>
        <tbody>
          {limitOrders.map(o => (
            <tr key={o.id} className="border-t border-border/30 hover:bg-secondary/30">
              <td className="py-1 px-1 text-gold">{o.contract}</td>
              <td className={`py-1 px-1 font-bold ${o.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                {o.direction.toUpperCase()}
              </td>
              <td className="py-1 px-1 text-right text-foreground">${o.size}</td>
              <td className="py-1 px-1 text-right text-muted-foreground">{o.leverage}x</td>
              <td className="py-1 px-1 text-right text-foreground">${o.limitPrice.toFixed(4)}</td>
              <td className="py-1 px-1 text-center">
                <span className={`text-[7px] uppercase font-bold px-1 py-0.5 rounded ${
                  o.marginMode === 'cross' ? 'bg-gold/20 text-gold' : 'bg-secondary text-muted-foreground'
                }`}>{o.marginMode}</span>
              </td>
              <td className="py-1 px-1 text-right">
                <button onClick={() => cancelOrder(o.id)}
                  className="text-[8px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/30 transition-colors">
                  Cancel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Trade History Table ─── */
function TradeHistoryTable({ closedTrades }: { closedTrades: ClosedTrade[] }) {
  if (closedTrades.length === 0) {
    return <div className="text-center py-4 text-[10px] text-muted-foreground">No trade history</div>;
  }
  return (
    <div className="px-2">
      <table className="w-full text-[9px] font-mono">
        <thead>
          <tr className="text-muted-foreground uppercase tracking-wider">
            <th className="text-left py-1.5 px-1">Contract</th>
            <th className="text-left py-1.5 px-1">Side</th>
            <th className="text-right py-1.5 px-1">Size</th>
            <th className="text-right py-1.5 px-1">Entry</th>
            <th className="text-right py-1.5 px-1">Exit</th>
            <th className="text-right py-1.5 px-1">PnL</th>
            <th className="text-center py-1.5 px-1">Reason</th>
          </tr>
        </thead>
        <tbody>
          {closedTrades.map(t => (
            <tr key={`${t.id}-${t.reason}`} className="border-t border-border/30 hover:bg-secondary/30">
              <td className="py-1 px-1 text-gold">{t.contract}</td>
              <td className={`py-1 px-1 font-bold ${t.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                {t.direction.toUpperCase()}
              </td>
              <td className="py-1 px-1 text-right text-foreground">${t.size}</td>
              <td className="py-1 px-1 text-right text-foreground">{t.entryPrice.toFixed(4)}</td>
              <td className="py-1 px-1 text-right text-foreground">{t.exitPrice.toFixed(4)}</td>
              <td className={`py-1 px-1 text-right font-bold ${t.pnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
              </td>
              <td className="py-1 px-1 text-center">
                <span className={`text-[7px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  t.reason === 'liquidated' ? 'bg-destructive/20 text-destructive' :
                  t.reason === 'stop-loss' ? 'bg-destructive/15 text-destructive' :
                  t.reason === 'take-profit' ? 'bg-accent/15 text-accent' :
                  t.reason === 'expired' ? 'bg-gold/15 text-gold' :
                  'bg-secondary text-muted-foreground'
                }`}>{t.reason}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Possession View ─── */
function PossessionView({ runtimes, activeMarketId }: { runtimes: Record<string, MarketRuntime>; activeMarketId: string }) {
  const rt = runtimes[activeMarketId];
  const market = MARKETS.find(m => m.id === activeMarketId)!;
  const events = rt.state.events;
  const homeEvents = events.filter(e => e.team === 'home').length;
  const awayEvents = events.filter(e => e.team === 'away').length;
  const total = homeEvents + awayEvents || 1;
  const homePoss = Math.round((homeEvents / total) * 100);
  const awayPoss = 100 - homePoss;

  // By event type
  const eventTypes = ['Pass', 'Shot on Target', 'Cross', 'Tackle', 'Foul', 'Corner Kick', 'Free Kick'];
  const breakdown = eventTypes.map(type => {
    const h = events.filter(e => e.team === 'home' && e.type === type).length;
    const a = events.filter(e => e.team === 'away' && e.type === type).length;
    return { type, home: h, away: a };
  }).filter(b => b.home > 0 || b.away > 0);

  return (
    <div className="space-y-4">
      <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">⚽ Possession & Stats</h3>

      {/* Possession bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold" style={{ color: market.homeColor }}>{market.homeShort} {homePoss}%</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Possession</span>
          <span className="text-[10px] font-semibold" style={{ color: market.awayColor }}>{awayPoss}% {market.awayShort}</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
          <div className="transition-all duration-500" style={{ width: `${homePoss}%`, backgroundColor: market.homeColor }} />
          <div className="transition-all duration-500" style={{ width: `${awayPoss}%`, backgroundColor: market.awayColor }} />
        </div>
      </div>

      {/* Stats breakdown */}
      <div className="space-y-1.5">
        {breakdown.map(b => {
          const bTotal = b.home + b.away || 1;
          const hPct = Math.round((b.home / bTotal) * 100);
          return (
            <div key={b.type}>
              <div className="flex items-center justify-between text-[9px] font-mono mb-0.5">
                <span style={{ color: market.homeColor }} className="font-bold">{b.home}</span>
                <span className="text-muted-foreground uppercase tracking-wider text-[8px]">{b.type}</span>
                <span style={{ color: market.awayColor }} className="font-bold">{b.away}</span>
              </div>
              <div className="flex h-1 rounded-full overflow-hidden bg-secondary">
                <div className="transition-all duration-500" style={{ width: `${hPct}%`, backgroundColor: market.homeColor }} />
                <div className="transition-all duration-500" style={{ width: `${100 - hPct}%`, backgroundColor: market.awayColor }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Event totals */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="bg-secondary/40 rounded p-2 text-center">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Home Events</div>
          <div className="font-mono text-lg font-black" style={{ color: market.homeColor }}>{homeEvents}</div>
        </div>
        <div className="bg-secondary/40 rounded p-2 text-center">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Away Events</div>
          <div className="font-mono text-lg font-black" style={{ color: market.awayColor }}>{awayEvents}</div>
        </div>
      </div>
    </div>
  );
}
