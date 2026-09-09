import * as React from 'react';

/**
 * State persisted to localStorage.
 *
 * Used for preferences that are genuinely local — saved products, theme,
 * balance visibility. Anything the server owns (balances, links, profile) must
 * not be cached here, or a second device would show stale data.
 *
 * Storage can throw: Safari private mode blocks it entirely and any browser can
 * hit the quota. Both cases fall back to in-memory state instead of crashing
 * the component tree.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = React.useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return initialValue;
      return JSON.parse(stored) as T;
    } catch {
      return initialValue;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Quota exceeded or storage disabled; state still works for this page. */
    }
  }, [key, value]);

  return [value, setValue];
}
