import { useState, useEffect } from 'react';

interface OrderBookProps {
  currentPrice: number;
  lastEventImpact?: 'high' | 'medium' | 'low';
  lastEventDirection?: number;
  contract: string;
}

interface Order {
  price: number;
  size: number;
  total: number;
}

function generateOrders(basePrice: number, side: 'buy' | 'sell', count: number): Order[] {
  const orders: Order[] = [];
  let cumTotal = 0;
  for (let i = 0; i < count; i++) {
    const offset = (i + 1) * (0.05 + Math.random() * 0.15);
    const price = side === 'buy'
      ? Math.round((basePrice - offset) * 100) / 100
      : Math.round((basePrice + offset) * 100) / 100;
    const size = Math.round((50 + Math.random() * 500) * 100) / 100;
    cumTotal += size;
    orders.push({ price, size, total: Math.round(cumTotal * 100) / 100 });
  }
  return orders;
}

export default function OrderBook({ currentPrice, lastEventImpact, lastEventDirection, contract }: OrderBookProps) {
  const [asks, setAsks] = useState<Order[]>(() => generateOrders(currentPrice, 'sell', 8));
  const [bids, setBids] = useState<Order[]>(() => generateOrders(currentPrice, 'buy', 8));
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setAsks(generateOrders(currentPrice, 'sell', 8));
    setBids(generateOrders(currentPrice, 'buy', 8));
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 300);
    return () => clearTimeout(t);
  }, [currentPrice]);

  const maxTotal = Math.max(...asks.map(o => o.total), ...bids.map(o => o.total));
  const spread = asks.length > 0 && bids.length > 0
    ? Math.round((asks[0].price - bids[0].price) * 100) / 100
    : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">Order Book</h3>
        <span className="font-mono text-[9px] text-muted-foreground">
          Spread: <span className="text-foreground font-bold">${spread.toFixed(2)}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 text-[9px] uppercase tracking-wider text-muted-foreground mb-1 px-1">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      <div className="space-y-px mb-1">
        {[...asks].reverse().map((order, i) => (
          <div key={`ask-${i}`} className="relative grid grid-cols-3 text-[10px] font-mono px-1 py-0.5">
            <div
              className="absolute inset-0 bg-destructive/10"
              style={{ width: `${(order.total / maxTotal) * 100}%`, right: 0, left: 'auto' }}
            />
            <span className="text-destructive relative z-10">{order.price.toFixed(2)}</span>
            <span className="text-right text-muted-foreground relative z-10">{order.size.toFixed(0)}</span>
            <span className="text-right text-muted-foreground/70 relative z-10">{order.total.toFixed(0)}</span>
          </div>
        ))}
      </div>

      <div className={`text-center py-1.5 border-y border-border transition-colors ${flash ? 'bg-gold/10' : ''}`}>
        <span className={`font-mono text-sm font-black ${
          (lastEventDirection ?? 0) > 0 ? 'text-accent' : (lastEventDirection ?? 0) < 0 ? 'text-destructive' : 'text-foreground'
        }`}>
          ${currentPrice.toFixed(2)}
        </span>
        <span className="text-[9px] text-muted-foreground ml-2">{contract}</span>
      </div>

      <div className="space-y-px mt-1">
        {bids.map((order, i) => (
          <div key={`bid-${i}`} className="relative grid grid-cols-3 text-[10px] font-mono px-1 py-0.5">
            <div
              className="absolute inset-0 bg-accent/10"
              style={{ width: `${(order.total / maxTotal) * 100}%`, right: 0, left: 'auto' }}
            />
            <span className="text-accent relative z-10">{order.price.toFixed(2)}</span>
            <span className="text-right text-muted-foreground relative z-10">{order.size.toFixed(0)}</span>
            <span className="text-right text-muted-foreground/70 relative z-10">{order.total.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
