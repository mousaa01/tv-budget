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
  fiveMinuteWarning: number; // increments when the 5-min mark is crossed
}

export function useBudget(): UseBudget {
  const [budget, setBudget] = useState<BudgetState>(() => loadBudget());
  const tickingRef = useRef(false);
  const persistAccumRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const [fiveMinuteWarning, setFiveMinuteWarning] = useState(0);
  const warnedForRef = useRef<string | null>(null); // date the warning fired for
  const lastRemainingRef = useRef<number>(remainingSeconds(budget));

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
    // Always persist on stop. Also: if less than 2 minutes remain after this
    // video, consume the remainder so we don't leave a sub-2-min orphan budget.
    setBudget((prev) => {
      let next = prev;
      const rem = remainingSeconds(prev);
      if (rem > 0 && rem < 120) {
        next = {
          ...prev,
          secondsUsedToday: prev.dailyLimitSeconds + prev.bonusSecondsToday,
        };
      }
      saveBudget(next);
      persistAccumRef.current = 0;
      return next;
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

  // 5-minute warning: fire once per day when remaining first drops to <=300s.
  useEffect(() => {
    const prev = lastRemainingRef.current;
    lastRemainingRef.current = remaining;
    if (
      prev > 300 &&
      remaining <= 300 &&
      remaining > 0 &&
      warnedForRef.current !== budget.date
    ) {
      warnedForRef.current = budget.date;
      setFiveMinuteWarning((n) => n + 1);
    }
  }, [remaining, budget.date]);

  return { budget, remaining, noNewVideos, startTicking, stopTicking, addBonusSeconds, refresh, fiveMinuteWarning };
}
