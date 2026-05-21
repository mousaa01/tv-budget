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
  const tickStartRef = useRef<number | null>(null);
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
    tickStartRef.current = Date.now();
    // Persist elapsed seconds to localStorage every 10 s without calling
    // setBudget — eliminates per-second React re-renders during video playback.
    // Also detects the 5-minute budget crossing so the warning still fires.
    intervalRef.current = window.setInterval(() => {
      if (tickStartRef.current === null) return;
      const elapsed = Math.round((Date.now() - tickStartRef.current) / 1000);
      if (elapsed === 0) return;
      tickStartRef.current = Date.now(); // re-anchor to avoid double-counting at stopTicking
      const snap = loadBudget();
      const w = currentWindow();
      const next = w === 'morning'
        ? { ...snap, morningSecondsUsed: snap.morningSecondsUsed + elapsed }
        : { ...snap, afternoonSecondsUsed: snap.afternoonSecondsUsed + elapsed };
      saveBudget(next);
      // Fire the 5-minute warning if budget crossed ≤300 s during this interval.
      if (
        remainingSeconds(snap) > 300 &&
        remainingSeconds(next) <= 300 &&
        remainingSeconds(next) > 0 &&
        warnedForRef.current !== next.date
      ) {
        warnedForRef.current = next.date;
        setFiveMinuteWarning((n) => n + 1);
      }
    }, 10_000);
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
    // Flush any seconds elapsed since the last localStorage-only write.
    // Load from localStorage so that persistence-interval writes are included.
    const elapsed = tickStartRef.current !== null
      ? Math.round((Date.now() - tickStartRef.current) / 1000)
      : 0;
    tickStartRef.current = null;
    setBudget((prev) => {
      const base = elapsed > 0 ? loadBudget() : prev;
      const w = currentWindow();
      let next = elapsed > 0
        ? (w === 'morning'
            ? { ...base, morningSecondsUsed: base.morningSecondsUsed + elapsed }
            : { ...base, afternoonSecondsUsed: base.afternoonSecondsUsed + elapsed })
        : base;
      if (consumeIfLow) {
        const rem = remainingSeconds(next);
        if (rem > 0 && rem < 120) {
          next = w === 'morning'
            ? { ...next, morningSecondsUsed: next.morningLimitSeconds + next.morningBonusSeconds }
            : { ...next, afternoonSecondsUsed: next.afternoonLimitSeconds + next.afternoonBonusSeconds };
        }
      }
      saveBudget(next);
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
