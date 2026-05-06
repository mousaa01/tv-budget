import { useCallback, useEffect, useRef, useState } from 'react';
import type { BudgetState } from './types';
import { loadBudget, remainingSeconds, saveBudget, todayStr } from './storage';

export interface UseBudget {
  budget: BudgetState;
  remaining: number;
  noNewVideos: boolean;
  startTicking: () => void;
  stopTicking: () => void;
  addBonusSeconds: (s: number) => void;
  refresh: () => void;
}

export function useBudget(): UseBudget {
  const [budget, setBudget] = useState<BudgetState>(() => loadBudget());
  const tickingRef = useRef(false);
  const persistAccumRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setBudget(loadBudget());
  }, []);

  // Daily reset watcher: re-load when date changes
  useEffect(() => {
    const id = window.setInterval(() => {
      if (budget.date !== todayStr()) {
        const fresh = loadBudget();
        setBudget(fresh);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [budget.date]);

  const startTicking = useCallback(() => {
    if (tickingRef.current) return;
    tickingRef.current = true;
    intervalRef.current = window.setInterval(() => {
      setBudget((prev) => {
        const next = { ...prev, secondsUsedToday: prev.secondsUsedToday + 1 };
        persistAccumRef.current += 1;
        if (persistAccumRef.current >= 10) {
          saveBudget(next);
          persistAccumRef.current = 0;
        }
        return next;
      });
    }, 1000);
  }, []);

  const stopTicking = useCallback(() => {
    if (!tickingRef.current) return;
    tickingRef.current = false;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Always persist on stop
    setBudget((prev) => {
      saveBudget(prev);
      persistAccumRef.current = 0;
      return prev;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  const addBonusSeconds = useCallback((s: number) => {
    setBudget((prev) => {
      const next = { ...prev, bonusSecondsToday: prev.bonusSecondsToday + s };
      saveBudget(next);
      return next;
    });
  }, []);

  const remaining = remainingSeconds(budget);
  const noNewVideos = remaining <= 0;

  return { budget, remaining, noNewVideos, startTicking, stopTicking, addBonusSeconds, refresh };
}
