import { describe, it, expect } from 'vitest';
import { formatHMS, formatMMSS } from './format';

describe('formatMMSS', () => {
  it('formats seconds under a minute', () => {
    expect(formatMMSS(45)).toBe('0:45');
  });
  it('formats exactly one minute', () => {
    expect(formatMMSS(60)).toBe('1:00');
  });
  it('formats minutes and seconds', () => {
    expect(formatMMSS(125)).toBe('2:05');
  });
  it('handles zero', () => {
    expect(formatMMSS(0)).toBe('0:00');
  });
  it('handles negative (clamps to 0)', () => {
    expect(formatMMSS(-5)).toBe('0:00');
  });
  it('formats large value', () => {
    expect(formatMMSS(3599)).toBe('59:59');
  });
});

describe('formatHMS', () => {
  it('formats under one hour as MM:SS', () => {
    expect(formatHMS(3599)).toBe('59:59');
  });
  it('formats exactly one hour', () => {
    expect(formatHMS(3600)).toBe('1:00:00');
  });
  it('formats hours, minutes, seconds', () => {
    expect(formatHMS(3723)).toBe('1:02:03');
  });
  it('handles zero', () => {
    expect(formatHMS(0)).toBe('0:00');
  });
  it('pads minutes and seconds with leading zeros', () => {
    expect(formatHMS(3661)).toBe('1:01:01');
  });
});
