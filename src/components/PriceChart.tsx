import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
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

function EventDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.event || !cx || !cy) return null;

  const meta = EVENT_META[payload.event as EventType];
  if (!meta) return null;
  if (meta.impact === 'low') return null;

  const isHome = payload.team === 'home';
  const actorColor = isHome ? 'hsl(145, 55%, 42%)' : 'hsl(0, 68%, 50%)';
  const actorBg = isHome ? 'hsl(145, 55%, 25%)' : 'hsl(0, 68%, 30%)';
  const actorLabel = isHome ? 'H' : 'A';
  const r = meta.impact === 'high' ? 5 : 3.5;

  return (
    <g>
      {/* Actor circle */}
      <circle cx={cx} cy={cy} r={r} fill={actorBg} fillOpacity={0.9} stroke={actorColor} strokeWidth={1.5} />
      <text x={cx} y={cy + 3} textAnchor="middle" fill="white" fontSize={7} fontWeight="bold" fontFamily="monospace">
        {actorLabel}
      </text>
      {/* Event label */}
      <text
        x={cx}
        y={cy - (meta.impact === 'high' ? 10 : 8)}
        textAnchor="middle"
        fill={actorColor}
        fontSize={meta.impact === 'high' ? 7 : 6}
        fontWeight="bold"
        fontFamily="monospace"
      >
        [{actorLabel}] {payload.event}
      </text>
    </g>
  );
}

export default function PriceChart({ priceHistory, currentPrice, startPrice, contract, homeTeam, awayTeam, homeColor, awayColor }: PriceChartProps) {
  const priceChange = currentPrice - startPrice;
  const priceChangePct = startPrice > 0 ? ((priceChange / startPrice) * 100).toFixed(2) : '0.00';
  const isUp = priceChange >= 0;
  const chartColor = isUp ? 'hsl(145, 55%, 42%)' : 'hsl(0, 68%, 50%)';
  const gradientId = `priceGrad-${contract.replace(/\//g, '')}`;

  return (
    <div className="bg-card border border-border rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">Live Price</h3>
        <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
          {contract}
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
        <span className={`font-mono text-sm font-bold ${isUp ? 'text-accent' : 'text-destructive'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(priceChange).toFixed(4)} ({isUp ? '+' : ''}{priceChangePct}%)
        </span>
      </div>

      <div className="h-[160px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={priceHistory} margin={{ top: 18, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
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
              width={45}
              tickFormatter={v => `$${Number(v).toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(24, 12%, 12%)',
                border: '1px solid hsl(24, 10%, 20%)',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              labelFormatter={v => `${v}'`}
              formatter={(value: number, _name: string, props: any) => {
                const ev = props?.payload?.event;
                const team = props?.payload?.team;
                const actor = team === 'home' ? '[H]' : team === 'away' ? '[A]' : '';
                const label = ev ? `Price (${actor} ${ev})` : 'Price';
                return [`$${value.toFixed(4)}`, label];
              }}
            />
            <ReferenceLine y={startPrice} stroke="hsl(38, 78%, 52%)" strokeDasharray="3 3" strokeOpacity={0.3} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={<EventDot />}
              activeDot={{ r: 4, stroke: chartColor, strokeWidth: 2 }}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>
          <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: 'hsl(145, 55%, 42%)' }} />
          [H] = {homeTeam}
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: 'hsl(0, 68%, 50%)' }} />
          [A] = {awayTeam}
        </span>
      </div>
    </div>
  );
}
