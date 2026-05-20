import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { BudgetState } from './types';
import { loadBudget, remainingSeconds, saveBudget, todayStr, currentWindow } from './storage';

export interface UseBudget {
  budget: BudgetState;
  remaining: number;
  /** Ref that always holds the current remaining seconds — read this inside
   * memoized child components without needing to re-render on every tick. */
  remainingRef: React.MutableRefObject<number>;
  noNewVideos: boolean;
  startTicking: () => void;
  stopTicking: (consumeIfLow?: boolean) => void;
  addBonusSeconds: (s: number) => void;
  refresh: () => void;
  fiveMinuteWarning: number;
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
        const w = currentWindow();
        const next = w === 'morning'
          ? { ...prev, morningSecondsUsed: prev.morningSecondsUsed + 1 }
          : { ...prev, afternoonSecondsUsed: prev.afternoonSecondsUsed + 1 };
        persistAccumRef.current += 1;
        if (persistAccumRef.current >= 10) {
          saveBudget(next);
          persistAccumRef.current = 0;
        }
        return next;
      });
    }, 1000);
  }, []);

  // consumeIfLow: pass true ONLY when the video session has genuinely ended
  // (video completed or user pressed Back). When false/omitted the sub-2-min
  // consumption is skipped, preventing mid-video buffering pauses from
  // eating the remaining budget and kicking the user home early.
  const stopTicking = useCallback((consumeIfLow = false) => {
    if (!tickingRef.current) return;
    tickingRef.current = false;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Always persist on stop. Optionally consume a sub-2-min leftover so the
    // child isn't stranded with an amount that can't start another video.
    setBudget((prev) => {
      let next = prev;
      if (consumeIfLow) {
        const rem = remainingSeconds(prev);
        if (rem > 0 && rem < 120) {
          const w = currentWindow();
          next = w === 'morning'
            ? { ...prev, morningSecondsUsed: prev.morningLimitSeconds + prev.morningBonusSeconds }
            : { ...prev, afternoonSecondsUsed: prev.afternoonLimitSeconds + prev.afternoonBonusSeconds };
        }
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
      const w = currentWindow();
      const next = w === 'morning'
        ? { ...prev, morningBonusSeconds: prev.morningBonusSeconds + s }
        : { ...prev, afternoonBonusSeconds: prev.afternoonBonusSeconds + s };
      saveBudget(next);
      return next;
    });
  }, []);

  const remaining = remainingSeconds(budget);
  const noNewVideos = remaining <= 0;
  // Always-current ref: memoized child components (e.g. WebPlayer) read this
  // directly so they don't need to re-render on every 1-second budget tick.
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  // 5-minute warning: fire when remaining first drops to <=300s. Re-arm if
  // remaining is bumped back above the threshold (e.g. parent grants bonus,
  // or the daily limit is increased), so the warning fires again next time
  // we cross down through 5 minutes.
  useEffect(() => {
    const prev = lastRemainingRef.current;
    lastRemainingRef.current = remaining;
    if (remaining > 300 && warnedForRef.current === budget.date) {
      // Re-arm so the next downward crossing can fire again today.
      warnedForRef.current = null;
    }
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

  return { budget, remaining, remainingRef, noNewVideos, startTicking, stopTicking, addBonusSeconds, refresh, fiveMinuteWarning };
}
