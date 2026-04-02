import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Dot } from 'recharts';
import { EVENT_META, EventType } from '@/lib/match-engine';

interface PriceChartProps {
  priceHistory: { minute: number; price: number; event?: string }[];
  currentPrice: number;
  startPrice: number;
  contract: string;
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
}

// Custom dot that renders event annotations on the chart
function EventDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.event || !cx || !cy) return null;

  const meta = EVENT_META[payload.event as EventType];
  if (!meta) return null;

  // Only annotate medium and high impact events
  if (meta.impact === 'low') return null;

  const color =
    meta.impact === 'high' ? 'hsl(0, 68%, 50%)' :
    'hsl(38, 78%, 52%)';

  return (
    <g>
      <circle cx={cx} cy={cy} r={meta.impact === 'high' ? 5 : 3.5} fill={color} fillOpacity={0.85} stroke="hsl(24, 12%, 12%)" strokeWidth={1.5} />
      <text
        x={cx}
        y={cy - (meta.impact === 'high' ? 10 : 8)}
        textAnchor="middle"
        fill={color}
        fontSize={meta.impact === 'high' ? 8 : 7}
        fontWeight="bold"
        fontFamily="monospace"
      >
        {meta.emoji} {payload.event}
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
    <div className="bg-card border border-border rounded-lg p-4">
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
              formatter={(value: number, name: string, props: any) => {
                const ev = props?.payload?.event;
                const label = ev ? `Price (${ev})` : 'Price';
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
        <span>{homeTeam} positive → price ↑</span>
        <span>{awayTeam} positive → price ↓</span>
      </div>
    </div>
  );
}
