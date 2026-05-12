import { useSyncExternalStore } from 'react';
import { getState, subscribe } from '@/lib/simulation-store';

type State = ReturnType<typeof getState>;

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getState()), () => selector(getState()));
}
