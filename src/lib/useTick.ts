import { useState, useEffect } from 'react';

/**
 * Forces a re-render at `intervalMs` while `active` is true.
 * Useful for animating progress bars driven by external time-based state.
 */
export function useTick(active: boolean, intervalMs = 50): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}
