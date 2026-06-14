// Global trading-session persistence.
// Loads ONCE at app boot, then subscribes to the simulation store and
// debounce-saves whenever balance / trades / orders change.
// Lives outside React so navigation between pages can't pause it.

import { supabase } from '@/integrations/supabase/client';
import { actions, getState, subscribe } from '@/lib/simulation-store';

let loaded = false;
let installed = false;

export async function loadPersistedState() {
  if (loaded) return;
  loaded = true;
  try {
    const { data, error } = await supabase.functions.invoke('trading-session', { method: 'GET' });
    if (!error && data && !data.isNew) {
      actions.hydrate({
        balance: data.balance,
        openTrades: data.openTrades || [],
        closedTrades: data.closedTrades || [],
        limitOrders: data.limitOrders || [],
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
