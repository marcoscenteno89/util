/**
 * Time utilities: duration math and text, date formatting and parsing, a stopwatch, a countdown
 * timer, and an aligned ticker. Built on the browser's Intl APIs, so there are no dependencies
 * and all text follows the user's language unless a `locale` is passed.
 */

const MS = Object.freeze({
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000
});

// setTimeout stores its delay as a signed 32-bit number; anything longer (~24.8 days) fires at once.
const MAX_TIMEOUT = 2 ** 31 - 1;

const UNITS = [['day', MS.DAY], ['hour', MS.HOUR], ['minute', MS.MINUTE], ['second', MS.SECOND], ['millisecond', 1]];
const ROUND = { down: Math.floor, up: Math.ceil, nearest: Math.round };

// Creating Intl formatters is slow, so build each combination once and reuse it.
const formatters = new Map();
const cached = (Type, locale, options) => {
  const key = `${Type.name}|${locale}|${JSON.stringify(options)}`;
  if (!formatters.has(key)) formatters.set(key, new Type(locale, options));
  return formatters.get(key);
}

const pad = (n, size=2) => String(n).padStart(size, '0');

// performance.now() keeps counting steadily even if the user changes the system clock.
const monotonic = () => globalThis.performance?.now?.() ?? Date.now();

/**
 * Splits a length of time into whole days, hours, minutes, seconds and milliseconds.
 * `negative` is true for negative input; the parts are always positive.
 * @example duration(93784005) // { days: 1, hours: 2, minutes: 3, seconds: 4, milliseconds: 5, negative: false }
 */
const duration = (ms) => {
  let rest = Math.abs(ms);
  const parts = { negative: ms < 0 };
  for (const [unit, size] of UNITS) {
    parts[`${unit}s`] = Math.floor(rest / size);
    rest %= size;
  }
  return parts;
}

/**
 * Turns a length of time into text.
 * @param ms - milliseconds
 * @param [o.style='long'] - 'long': "1 day, 2 hours, and 5 minutes"
 *                           'short': "1d 2h 5m"
 *                           'clock': "26:05:09" (hours keep counting past 24)
 * @param [o.smallest='second'] - smallest unit shown in long/short: 'day', 'hour', 'minute', 'second'
 * @param [o.round] - 'down', 'up' or 'nearest' at the smallest unit. Defaults to 'down';
 *                    use 'up' for countdowns so they never show 0 while time remains.
 * @param [o.fraction=0] - clock style only: digits after the seconds, e.g. 2 gives "00:01:05.42"
 * @param [o.locale] - e.g. 'en-US'; defaults to the browser's language
 */
const formatDuration = (ms, { style='long', smallest='second', round='down', fraction=0, locale } = {}) => {
  const roundFn = ROUND[round];
  const abs = Math.abs(ms);

  if (style === 'clock') {
    // Count in fractions of a second first so rounding happens once, at the last digit shown
    const scale = 10 ** fraction;
    const ticks = roundFn((abs * scale) / MS.SECOND);
    const secs = Math.floor(ticks / scale);
    const text = `${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs % 3600 / 60))}:${pad(secs % 60)}`;
    return (ms < 0 ? '-' : '') + text + (fraction ? `.${pad(ticks % scale, fraction)}` : '');
  }

  const last = UNITS.findIndex(([unit]) => unit === smallest);
  const size = UNITS[last][1];
  let rest = roundFn(abs / size) * size;
  const display = style === 'short' ? 'narrow' : 'long';
  const parts = [];
  for (const [unit, unitSize] of UNITS.slice(0, last + 1)) {
    const n = Math.floor(rest / unitSize);
    rest -= n * unitSize;
    if (n) parts.push(cached(Intl.NumberFormat, locale, { style: 'unit', unit, unitDisplay: display }).format(n));
  }
  if (!parts.length) parts.push(cached(Intl.NumberFormat, locale, { style: 'unit', unit: smallest, unitDisplay: display }).format(0));

  const list = style === 'short' ? { type: 'unit', style: 'narrow' } : { type: 'conjunction' };
  return cached(Intl.ListFormat, locale, list).format(parts);
}

/**
 * Relative time from now: "now", "5 minutes ago", "in 2 hours", "yesterday", "last month".
 * Picks the largest unit that fits, so 90 minutes reads as "2 hours ago" (rounded).
 * @param date - anything parseDate() accepts
 * @param [o.now=Date.now()] - reference time
 * @returns the text, or '' for an invalid date
 */
const timeAgo = (date, { now=Date.now(), locale } = {}) => {
  const d = parseDate(date);
  if (!d) return '';
  const diff = d.getTime() - now;
  const abs = Math.abs(diff);
  const rtf = cached(Intl.RelativeTimeFormat, locale, { numeric: 'auto' });
  if (abs < 10 * MS.SECOND) return rtf.format(0, 'second');
  const [unit, size] =
    abs < MS.MINUTE ? ['second', MS.SECOND] :
    abs < MS.HOUR ? ['minute', MS.MINUTE] :
    abs < MS.DAY ? ['hour', MS.HOUR] :
    abs < MS.WEEK ? ['day', MS.DAY] :
    abs < 30 * MS.DAY ? ['week', MS.WEEK] :
    abs < 365 * MS.DAY ? ['month', 30 * MS.DAY] :
    ['year', 365 * MS.DAY];
  // Round the size, then apply the direction: Math.round(-1.5) is -1, which would make the past
  // round differently from the future
  return rtf.format(Math.sign(diff) * Math.round(abs / size), unit);
}

// Common formats by name; any Intl.DateTimeFormat options object works too.
const DATE_PRESETS = {
  date: { dateStyle: 'medium' },                       // Oct 14, 2026
  long: { dateStyle: 'full' },                         // Wednesday, October 14, 2026
  time: { timeStyle: 'short' },                        // 3:05 PM
  clock: { timeStyle: 'medium' },                      // 3:05:09 PM
  datetime: { dateStyle: 'medium', timeStyle: 'short' }, // Oct 14, 2026, 3:05 PM
  weekday: { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } // Wed, Oct 14, 3:05 PM
};

/**
 * Formats a date for display.
 * @param date - anything parseDate() accepts
 * @param [format='date'] - a preset name ('date', 'long', 'time', 'clock', 'datetime', 'weekday',
 *                          'iso') or an Intl.DateTimeFormat options object
 * @param [o.locale] [o.timeZone] - e.g. 'en-US', 'America/Denver'; default to the browser's
 * @returns the text, or '' for an invalid date
 */
const formatDate = (date, format='date', { locale, timeZone } = {}) => {
  const d = parseDate(date);
  if (!d) return '';
  // YYYY-MM-DD in local time (toISOString would give the UTC date, which can be a day off)
  if (format === 'iso') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const options = typeof format === 'string' ? DATE_PRESETS[format] : format;
  return cached(Intl.DateTimeFormat, locale, { ...options, timeZone }).format(d);
}

// "2026-10-14", "2026-10-14 15:05", "2026-10-14T15:05:09.123" - no time zone given
const NO_ZONE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

/**
 * Converts common date inputs to a Date, or null if it isn't a valid date.
 * - Date: copied
 * - number: epoch milliseconds, or epoch seconds if below 100 billion (APIs like OpenWeather's
 *   `dt` use seconds; 100 billion ms is 1973, so real ms timestamps are always larger)
 * - "YYYY-MM-DD" and "YYYY-MM-DD HH:mm:ss" without a zone: local time, or UTC with { utc: true }.
 *   (JavaScript alone reads a bare date as UTC midnight, which shows as the previous day in the
 *   Americas, and doesn't officially support the space-separated form at all.)
 * - anything else, including ISO strings with Z or an offset: new Date(value)
 * Impossible dates like 2026-02-30 return null instead of rolling over to March.
 */
const parseDate = (value, { utc=false } = {}) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(Math.abs(value) < 1e11 ? value * 1000 : value) : null;
  if (typeof value !== 'string') return null;

  const match = NO_ZONE.exec(value.trim());
  if (match) {
    const [y, mo, d, h=0, mi=0, s=0, msText='0'] = match.slice(1);
    const parts = [+y, +mo - 1, +d, +h, +mi, +s, +msText.padEnd(3, '0')];
    const date = utc ? new Date(Date.UTC(...parts)) : new Date(...parts);
    const check = utc ? [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()] : [date.getFullYear(), date.getMonth(), date.getDate()];
    return check.every((v, i) => v === parts[i]) ? date : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Measures elapsed time from real clock readings, not by counting timer ticks, so it stays
 * accurate in background tabs and under load. Can be paused and resumed.
 * @example const sw = new Stopwatch().start(); ...; sw.stop(); sw.toString(2) // "00:01:05.42"
 */
class Stopwatch {
  constructor() {
    this.reset();
  }

  get running() { return this.startedAt !== null; }

  // Total ms, including the current run if it's still going
  get elapsed() {
    return this.saved + (this.running ? monotonic() - this.startedAt : 0);
  }

  start() {
    if (!this.running) this.startedAt = monotonic();
    return this;
  }

  // Pauses and returns the elapsed ms; start() resumes from there.
  stop() {
    if (this.running) {
      this.saved += monotonic() - this.startedAt;
      this.startedAt = null;
    }
    return this.elapsed;
  }

  reset() {
    this.startedAt = null;
    this.saved = 0;
    this.laps = [];
    return this;
  }

  /**
   * Records a lap. Each lap is { total, split }: total elapsed, and time since the previous lap.
   */
  lap() {
    const total = this.elapsed;
    const split = total - (this.laps.at(-1)?.total ?? 0);
    this.laps.push({ total, split });
    return { total, split };
  }

  toString(fraction=2) {
    return formatDuration(this.elapsed, { style: 'clock', fraction });
  }
}

/**
 * A countdown to a fixed moment. Knows how much time is left and can call `onEnd` when it's up,
 * including for waits longer than setTimeout's 24.8 day limit.
 * It only stores an end time, so you can save it (JSON.stringify) and restore it after a reload
 * with Timer.from(saved).
 * @param end - ms from now (numbers under 100 billion, about 3 years), or the
 *              Date/timestamp/string to count down to
 * @param [onEnd] - called once when time is up (not called if cancelled)
 */
class Timer {
  constructor(end, onEnd=null) {
    const isDuration = typeof end === 'number' && Math.abs(end) < 1e11;
    const date = isDuration ? null : parseDate(end);
    if (!isDuration && !date) throw new TypeError(`Timer: invalid end time ${end}`);
    this.endsAt = isDuration ? Date.now() + end : date.getTime();
    this.onEnd = onEnd;
    this.handle = null;
    if (onEnd) this.schedule();
  }

  static from(saved, onEnd) {
    return new Timer(saved, onEnd);
  }

  get remaining() { return Math.max(0, this.endsAt - Date.now()); }
  get expired() { return this.remaining === 0; }

  // Waits in chunks no longer than setTimeout allows, re-checking the real time after each one,
  // so it also stays correct after the computer sleeps.
  schedule() {
    clearTimeout(this.handle);
    if (this.expired) {
      this.handle = null;
      return this.onEnd?.();
    }
    this.handle = setTimeout(() => this.schedule(), Math.min(this.remaining, MAX_TIMEOUT));
  }

  /**
   * Moves the end time by `ms` (negative to shorten).
   */
  extend(ms) {
    this.endsAt += ms;
    if (this.onEnd && this.handle !== null) this.schedule();
    return this;
  }

  cancel() {
    clearTimeout(this.handle);
    this.handle = null;
  }

  /**
   * Remaining time as text. Rounds up by default so it never reads 0 before the end.
   * Takes the same options as formatDuration().
   */
  toString(options={}) {
    return formatDuration(this.remaining, { round: 'up', ...options });
  }

  toJSON() {
    return new Date(this.endsAt).toISOString();
  }
}

/**
 * Calls `fn(now)` every `ms`, lined up with the wall clock: with ms = MS.SECOND it fires right as
 * each second changes, so a displayed clock never lags behind. (Alignment is to whole multiples of
 * `ms` in UTC, which matches local time for seconds and minutes.) Each tick is scheduled from the
 * real time, so it doesn't drift.
 * @param [o.immediate=false] - also call once right away
 * @returns a function that stops the ticks; call it when the component unmounts
 * @example const stop = every(MS.SECOND, now => setTime(now));
 */
const every = (ms, fn, { immediate=false } = {}) => {
  let handle = null;
  const tick = () => {
    const now = Date.now();
    handle = setTimeout(() => { fn(Date.now()); tick(); }, ms - (now % ms));
  };
  if (immediate) fn(Date.now());
  tick();
  return () => clearTimeout(handle);
}

export { MS, duration, formatDuration, timeAgo, formatDate, parseDate, Stopwatch, Timer, every };
