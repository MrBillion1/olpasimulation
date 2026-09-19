import { useMemo } from 'react';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Customized } from 'recharts';

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

interface StepPoint {
  minute: number;
  close: number;
  open: number;
  high: number;
  low: number;
  event?: string;
  team?: 'home' | 'away';
}

const UP_COLOR = 'hsl(145, 60%, 48%)';
const DOWN_COLOR = 'hsl(0, 70%, 55%)';
const GOLD = 'hsl(38, 78%, 52%)';
const PLOT_LINE = 'hsl(var(--foreground))';
const AXIS_LINE = 'hsl(var(--border))';
const AXIS_TEXT = 'hsl(var(--muted-foreground))';

// Event annotation tag at 5px — [H]/[A] above the step that repriced the market
function EventTag({ cx, cy, event, team }: { cx: number | null; cy: number | null; event: string; team?: 'home' | 'away' }) {
  if (cx == null || cy == null) return null;
  const isHome = team === 'home';
  const tag = isHome ? '[H]' : '[A]';
  const color = isHome ? GOLD : 'hsl(190, 70%, 55%)';
  const label = `${tag} ${event}`;
  const w = label.length * 3.1;
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <line x1={0} y1={2} x2={0} y2={6} stroke={color} strokeWidth={0.6} />
      <rect x={-w / 2} y={-6} width={w} height={7} rx={1.5}
        fill="hsl(24, 12%, 10%)" stroke={color} strokeWidth={0.5} />
      <text x={0} y={-0.5} textAnchor="middle" fontSize={5} fill={color} fontFamily="monospace" fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

export default function PriceChart({ priceHistory, currentPrice, startPrice, contract, homeTeam, awayTeam, homeColor, awayColor }: PriceChartProps) {
  const priceChange = currentPrice - startPrice;
  const priceChangePct = startPrice > 0 ? ((priceChange / startPrice) * 100).toFixed(2) : '0.00';
  const isUp = priceChange >= 0;
  const lineColor = isUp ? UP_COLOR : DOWN_COLOR;

  // Per-minute step points (close price drives the step line)
  const steps = useMemo<StepPoint[]>(() => {
    if (!priceHistory.length) return [];
    const buckets = new Map<number, typeof priceHistory>();
    for (const p of priceHistory) {
      const m = Math.floor(p.minute);
      if (!buckets.has(m)) buckets.set(m, []);
      buckets.get(m)!.push(p);
    }
    const keys = Array.from(buckets.keys()).sort((a, b) => a - b);
    const out: StepPoint[] = [];
    let prevClose: number | null = null;
    for (const k of keys) {
      const pts = buckets.get(k)!;
      const prices = pts.map(p => p.price);
      const open = prevClose ?? prices[0];
      const close = prices[prices.length - 1];
      const evPt = pts.find(p => p.event);
      out.push({
        minute: k,
        open,
        close,
        high: Math.max(open, close, ...prices),
        low: Math.min(open, close, ...prices),
        event: evPt?.event,
        team: evPt?.team,
      });
      prevClose = close;
    }
    return out;
  }, [priceHistory]);

  const plotWidth = Math.max(320, steps.length * 24);

  const yDomain = useMemo<[number, number]>(() => {
    const values = steps.flatMap(step => [step.low, step.high]);
    if (!values.length) return [startPrice * 0.995, startPrice * 1.005];

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = Math.max(maximum - minimum, startPrice * 0.002);

    return [minimum - span * 0.12, maximum + span * 0.16];
  }, [startPrice, steps]);

  const last = steps[steps.length - 1];
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

      {/* Step line plot: clamped between 15px and 100px tall */}
      <div className="mt-auto h-[100px] min-h-[15px] max-h-[100px] -mx-2 overflow-x-auto overflow-y-hidden custom-scrollbar">
        <div className="h-full min-w-full" style={{ width: `${plotWidth}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={steps} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="minute"
              tick={{ fontSize: 8, fill: AXIS_TEXT }}
              axisLine={{ stroke: AXIS_LINE }}
              tickLine={false}
              tickFormatter={v => `${v}'`}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 8, fill: AXIS_TEXT }}
              axisLine={{ stroke: AXIS_LINE }}
              tickLine={false}
              tickCount={3}
              width={48}
              orientation="left"
              tickFormatter={v => `$${Number(v).toFixed(2)}`}
            />
            <Tooltip
              cursor={{ stroke: GOLD, strokeDasharray: '3 3', strokeOpacity: 0.4 }}
              contentStyle={{
                background: 'hsl(24, 12%, 12%)',
                border: '1px solid hsl(24, 10%, 20%)',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              labelFormatter={v => `${v}'`}
              formatter={(_value: any, _name: string, props: any) => {
                const p: StepPoint | undefined = props?.payload;
                if (!p) return ['', ''];
                const ev = p.event ? ` (${p.team === 'home' ? '[H]' : '[A]'} ${p.event})` : '';
                return [`$${p.close.toFixed(4)}${ev}`, 'Price'];
              }}
            />
            <ReferenceLine y={startPrice} stroke={GOLD} strokeDasharray="3 3" strokeOpacity={0.3} />
            {/* Step line — horizontal treads per minute, vertical risers between prices */}
            <Line
              type="stepAfter"
              dataKey="close"
              stroke={PLOT_LINE}
              strokeWidth={1.25}
              strokeLinecap="square"
              strokeLinejoin="miter"
              dot={false}
              activeDot={{ r: 2.5 }}
              isAnimationActive={false}
            />
            {/* Event annotations at 5px above the step that repriced the market */}
            <Customized
              component={(p: any) => {
                const xMap = p.xAxisMap && p.xAxisMap[Object.keys(p.xAxisMap)[0]];
                const yMap = p.yAxisMap && p.yAxisMap[Object.keys(p.yAxisMap)[0]];
                if (!xMap || !yMap) return null;
                const xScale = xMap.scale;
                const yScale = yMap.scale;
                return (
                  <g>
                    {steps.filter(s => s.event).map((s, i) => (
                      <EventTag
                        key={i}
                        cx={xScale(s.minute)}
                        cy={yScale(s.close) - 6}
                        event={s.event!}
                        team={s.team}
                      />
                    ))}
                  </g>
                );
              }}
            />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>Step line · 1m interval</span>
        <span className={isUp ? 'text-accent' : 'text-destructive'}>
          {isUp ? '▲' : '▼'} {isUp ? 'Up' : 'Down'} trend
        </span>
      </div>
    </div>
  );
}
