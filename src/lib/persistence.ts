// Global trading-session persistence.
// Loads ONCE at app boot, then subscribes to the simulation store and
// debounce-saves whenever balance / trades / orders change.
// Lives outside React so navigation between pages can't pause it.

import { supabase } from '@/integrations/supabase/client';
import { actions, getState, subscribe, OpenTrade, ClosedTrade, LimitOrder } from '@/lib/simulation-store';

let loaded = false;
let installed = false;

const SIM_MINUTE_MS = 1667;

function splitExpiredPersistedTrades(openTrades: OpenTrade[] = [], closedTrades: ClosedTrade[] = []) {
  const now = Date.now();
  const active: OpenTrade[] = [];
  const expired: ClosedTrade[] = [];
  let refund = 0;

  openTrades.forEach(t => {
    const endsAt = t.sessionEndsAt ?? (t.timestamp + Math.max(0, 90 - (t.minute ?? 0)) * SIM_MINUTE_MS);
    if (endsAt <= now) {
      refund += t.size;
      expired.push({
        id: t.id, contract: t.contract, direction: t.direction,
        entryPrice: t.entryPrice, exitPrice: t.entryPrice,
        size: t.size, leverage: t.leverage, pnl: 0, reason: 'expired',
      });
    } else {
      active.push({ ...t, sessionEndsAt: endsAt });
    }
  });

  return { active, closed: [...expired, ...closedTrades].slice(0, 50), refund };
}

function splitExpiredPersistedOrders(limitOrders: LimitOrder[] = []) {
  const now = Date.now();
  let refund = 0;
  const active = limitOrders.filter(o => {
    const endsAt = o.sessionEndsAt ?? (o.timestamp + 90 * SIM_MINUTE_MS);
    const keep = endsAt > now;
    if (!keep) refund += o.size;
    return keep;
  }).map(o => ({ ...o, sessionEndsAt: o.sessionEndsAt ?? (o.timestamp + 90 * SIM_MINUTE_MS) }));
  return { active, refund };
}

export async function loadPersistedState() {
  if (loaded) return;
  loaded = true;
  try {
    const { data, error } = await supabase.functions.invoke('trading-session', { method: 'GET' });
    if (!error && data && !data.isNew) {
      const trades = splitExpiredPersistedTrades(data.openTrades || [], data.closedTrades || []);
      const orders = splitExpiredPersistedOrders(data.limitOrders || []);
      actions.hydrate({
        balance: Math.round((data.balance + trades.refund + orders.refund) * 100) / 100,
        openTrades: trades.active,
        closedTrades: trades.closed,
        limitOrders: orders.active,
      });
    }
  } catch (e) {
    console.warn('Failed to load trading session:', e);
  }
}

export function installAutoSave() {
  if (installed) return;
  installed = true;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let prevSig = '';

  const compute = () => {
    const s = getState();
    return {
      balance: s.balance,
      openTrades: s.openTrades,
      closedTrades: s.closedTrades,
      limitOrders: s.limitOrders,
    };
  };

  const sigOf = (p: ReturnType<typeof compute>) =>
    `${p.balance}|${p.openTrades.length}:${p.openTrades.map(t => t.id + ':' + t.size).join(',')}|${p.closedTrades.length}|${p.limitOrders.length}:${p.limitOrders.map(o => o.id).join(',')}`;

  prevSig = sigOf(compute());

  subscribe(() => {
    if (!loaded) return; // don't save until first hydrate finished
    const payload = compute();
    const sig = sigOf(payload);
    if (sig === prevSig) return;
    prevSig = sig;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await supabase.functions.invoke('trading-session', { method: 'POST', body: payload });
      } catch (e) {
        console.warn('Failed to save trading session:', e);
      }
    }, 1000);
  });
}
