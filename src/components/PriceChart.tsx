import { useMemo } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Customized } from 'recharts';
import { EVENT_META, EventType } from '@/lib/match-engine';

interface PriceChartProps {
  priceHistory: { minute: number; price: number; event?: string; team?: 'home' | 'away' }[];
  currentPrice: number;
  startPrice: number;
  contract: string;
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
}

interface Candle {
  minute: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isUp: boolean;
  range: [number, number]; // for bar body
  wickRange: [number, number]; // for wick
  event?: string;
  team?: 'home' | 'away';
}

const UP_COLOR = 'hsl(145, 60%, 48%)';
const DOWN_COLOR = 'hsl(0, 70%, 55%)';

// Custom wick shape — thin vertical line across high-low
function Wick(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const color = payload.isUp ? UP_COLOR : DOWN_COLOR;
  const cx = x + width / 2;
  return <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />;
}

// Custom body shape — thin rectangle from open to close
function Body(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const color = payload.isUp ? UP_COLOR : DOWN_COLOR;
  const h = Math.max(height, 1);
  // Slim body: cap width at 5px, centered
  const bodyW = Math.min(width, 5);
  const bx = x + (width - bodyW) / 2;
  return <rect x={bx} y={y} width={bodyW} height={h} fill={color} stroke={color} />;
}

export default function PriceChart({ priceHistory, currentPrice, startPrice, contract, homeTeam, awayTeam, homeColor, awayColor }: PriceChartProps) {
  const priceChange = currentPrice - startPrice;
  const priceChangePct = startPrice > 0 ? ((priceChange / startPrice) * 100).toFixed(2) : '0.00';
  const isUp = priceChange >= 0;

  // Aggregate priceHistory into OHLC candles per minute bucket
  const candles = useMemo<Candle[]>(() => {
    if (!priceHistory.length) return [];
    const buckets = new Map<number, typeof priceHistory>();
    for (const p of priceHistory) {
      const m = Math.floor(p.minute);
      if (!buckets.has(m)) buckets.set(m, []);
      buckets.get(m)!.push(p);
    }
    const keys = Array.from(buckets.keys()).sort((a, b) => a - b);
    const out: Candle[] = [];
    let prevClose: number | null = null;
    for (const k of keys) {
      const pts = buckets.get(k)!;
      const prices = pts.map(p => p.price);
      const open = prevClose ?? prices[0];
      const close = prices[prices.length - 1];
      const high = Math.max(open, close, ...prices);
      const low = Math.min(open, close, ...prices);
      const evPt = pts.find(p => p.event);
      const up = close >= open;
      out.push({
        minute: k,
        open,
        high,
        low,
        close,
        isUp: up,
        range: up ? [open, close] : [close, open],
        wickRange: [low, high],
        event: evPt?.event,
        team: evPt?.team,
      });
      prevClose = close;
    }
    return out;
  }, [priceHistory]);

  const last = candles[candles.length - 1];
  const o = last?.open ?? startPrice;
  const h = last?.high ?? currentPrice;
  const l = last?.low ?? currentPrice;
  const c = last?.close ?? currentPrice;

  return (
    <div className="bg-card border border-border rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">Live Price</h3>
        <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
          {contract}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-1 text-[10px] font-mono">
        <span className="text-muted-foreground">O<span className="text-foreground ml-1">{o.toFixed(4)}</span></span>
        <span className="text-muted-foreground">H<span style={{ color: UP_COLOR }} className="ml-1">{h.toFixed(4)}</span></span>
        <span className="text-muted-foreground">L<span style={{ color: DOWN_COLOR }} className="ml-1">{l.toFixed(4)}</span></span>
        <span className="text-muted-foreground">C<span className="text-foreground ml-1">{c.toFixed(4)}</span></span>
        <span className={`ml-1 ${isUp ? 'text-accent' : 'text-destructive'}`}>
          {isUp ? '+' : ''}{priceChange.toFixed(4)} ({isUp ? '+' : ''}{priceChangePct}%)
        </span>
      </div>

      <div className="flex items-center justify-between mb-1 text-[9px]">
        <span style={{ color: homeColor }} className="font-semibold">🏠 {homeTeam} (Home)</span>
        <span style={{ color: awayColor }} className="font-semibold">✈️ {awayTeam} (Away)</span>
      </div>

      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-2xl font-black tabular-nums text-foreground">
          ${currentPrice.toFixed(4)}
        </span>
      </div>

      <div className="flex-1 min-h-[160px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={candles} margin={{ top: 18, right: 5, bottom: 0, left: 0 }} barCategoryGap={2}>
            <XAxis
              dataKey="minute"
              tick={{ fontSize: 9, fill: 'hsl(30, 10%, 48%)' }}
              axisLine={{ stroke: 'hsl(24, 10%, 20%)' }}
              tickLine={false}
              tickFormatter={v => `${v}'`}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 9, fill: 'hsl(30, 10%, 48%)' }}
              axisLine={false}
              tickLine={false}
              width={55}
              orientation="right"
              tickFormatter={v => `$${Number(v).toFixed(2)}`}
            />
            <Tooltip
              cursor={{ stroke: 'hsl(38, 78%, 52%)', strokeDasharray: '3 3', strokeOpacity: 0.4 }}
              contentStyle={{
                background: 'hsl(24, 12%, 12%)',
                border: '1px solid hsl(24, 10%, 20%)',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              labelFormatter={v => `${v}'`}
              formatter={(_value: any, _name: string, props: any) => {
                const p: Candle = props?.payload;
                if (!p) return ['', ''];
                const ev = p.event ? ` (${p.team === 'home' ? '[H]' : '[A]'} ${p.event})` : '';
                return [`O ${p.open.toFixed(4)}  H ${p.high.toFixed(4)}  L ${p.low.toFixed(4)}  C ${p.close.toFixed(4)}${ev}`, 'OHLC'];
              }}
            />
            <ReferenceLine y={startPrice} stroke="hsl(38, 78%, 52%)" strokeDasharray="3 3" strokeOpacity={0.3} />
            {/* Wick */}
            <Bar dataKey="wickRange" shape={<Wick />} isAnimationActive={false} legendType="none" />
            {/* Body */}
            <Bar dataKey="range" shape={<Body />} isAnimationActive={false} legendType="none">
              {candles.map((cd, i) => (
                <Cell key={i} fill={cd.isUp ? UP_COLOR : DOWN_COLOR} />
              ))}
            </Bar>
            {/* Event annotations [H]/[A] above candles that repriced the market */}
            <Customized
              component={(p: any) => {
                const xMap = p.xAxisMap && p.xAxisMap[Object.keys(p.xAxisMap)[0]];
                const yMap = p.yAxisMap && p.yAxisMap[Object.keys(p.yAxisMap)[0]];
                if (!xMap || !yMap) return null;
                const xScale = xMap.scale;
                const yScale = yMap.scale;
                return (
                  <g>
                    {candles.filter(c => c.event).map((c, i) => {
                      const cx = xScale(c.minute);
                      const cy = yScale(c.high) - 8;
                      if (cx == null || cy == null) return null;
                      const isHome = c.team === 'home';
                      const tag = isHome ? '[H]' : '[A]';
                      const color = isHome ? 'hsl(38, 78%, 52%)' : 'hsl(190, 70%, 55%)';
                      const label = `${tag} ${c.event}`;
                      return (
                        <g key={i} transform={`translate(${cx}, ${cy})`}>
                          <line x1={0} y1={4} x2={0} y2={10} stroke={color} strokeWidth={1} />
                          <rect x={-label.length * 2.6} y={-9} width={label.length * 5.2} height={11} rx={2}
                            fill="hsl(24, 12%, 10%)" stroke={color} strokeWidth={0.7} />
                          <text x={0} y={-1} textAnchor="middle" fontSize={8} fill={color} fontFamily="monospace" fontWeight={600}>
                            {label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>
          <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: UP_COLOR }} />
          Bullish minute
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: DOWN_COLOR }} />
          Bearish minute
        </span>
      </div>
    </div>
  );
}
