import { useRef, useSyncExternalStore } from 'react';
import { getState, subscribe } from '@/lib/simulation-store';

type State = ReturnType<typeof getState>;

function shallowEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

export function useStore<T>(selector: (s: State) => T): T {
  const cacheRef = useRef<{ has: boolean; value: T }>({ has: false, value: undefined as any });
  const getSnapshot = () => {
    const next = selector(getState());
    if (cacheRef.current.has && shallowEqual(cacheRef.current.value, next)) {
      return cacheRef.current.value;
    }
    cacheRef.current = { has: true, value: next };
    return next;
  };
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
