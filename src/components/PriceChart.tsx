import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MatchEvent } from '@/lib/match-engine';

interface PriceChartProps {
  priceHistory: { minute: number; price: number; event?: string }[];
  selectedTeam: 'home' | 'away';
  onSelectTeam: (team: 'home' | 'away') => void;
  currentPrice: number;
  startPrice: number;
}

export default function PriceChart({ priceHistory, selectedTeam, onSelectTeam, currentPrice, startPrice }: PriceChartProps) {
  const priceChange = currentPrice - startPrice;
  const priceChangePct = startPrice > 0 ? ((priceChange / startPrice) * 100).toFixed(2) : '0.00';
  const isUp = priceChange >= 0;

  const chartColor = isUp ? 'hsl(145, 55%, 42%)' : 'hsl(0, 68%, 50%)';

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      {/* Team selector */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">Live Price</h3>
        <div className="flex gap-1">
          <button
            onClick={() => onSelectTeam('home')}
            className={`text-[10px] px-3 py-1 rounded font-semibold transition-all ${
              selectedTeam === 'home'
                ? 'bg-gold text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            🏠 FC Dynamic
          </button>
          <button
            onClick={() => onSelectTeam('away')}
            className={`text-[10px] px-3 py-1 rounded font-semibold transition-all ${
              selectedTeam === 'away'
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            ✈️ Micro United
          </button>
        </div>
      </div>

      {/* Price display */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-2xl font-black tabular-nums text-foreground">
          ${currentPrice.toFixed(2)}
        </span>
        <span className={`font-mono text-sm font-bold ${isUp ? 'text-accent' : 'text-destructive'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)} ({isUp ? '+' : ''}{priceChangePct}%)
        </span>
      </div>

      {/* Pair label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
          {selectedTeam === 'home' ? 'FCDYN' : 'MCUTD'}/USDT
        </span>
        <span className="text-[9px] text-muted-foreground">Micro-Event Market</span>
      </div>

      {/* Chart */}
      <div className="h-[140px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={priceHistory} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
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
              width={40}
              tickFormatter={v => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(24, 12%, 12%)',
                border: '1px solid hsl(24, 10%, 20%)',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              labelFormatter={v => `${v}'`}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
            />
            <ReferenceLine y={startPrice} stroke="hsl(38, 78%, 52%)" strokeDasharray="3 3" strokeOpacity={0.3} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={chartColor}
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>Home events push price {selectedTeam === 'home' ? '↑' : '↓'}</span>
        <span>Away events push price {selectedTeam === 'home' ? '↓' : '↑'}</span>
      </div>
    </div>
  );
}
