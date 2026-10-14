import { storageAvailable } from './util.js';
import { MS, Timer, formatDuration } from './time.js';

// Reads a whole-number data attribute; missing or invalid values fall back to `fallback`.
const intAttr = (elem, name, fallback) => {
  const value = parseInt(elem.getAttribute(name), 10);
  return Number.isNaN(value) ? fallback : value;
}

/**
 * Limits how many times an element (usually a button) can be used, remembered across page loads.
 *
 * Configured with data attributes on the element:
 *   data-limit-id     storage name, unique per limited action (required)
 *   data-limit-count  uses allowed before locking (default 1)
 *   data-limit-min / data-limit-hr / data-limit-day
 *                     lock length; they add up, e.g. hr=1 min=30 is 90 minutes
 *
 * Every use restarts the timer, so the element unlocks once that much time passes with no use.
 * When locked, the element is disabled and `status` (optional) shows how long is left. It
 * unlocks by itself when the time is up, even if the page stays open.
 * Falls back to an in-memory count if localStorage is blocked (some private browsing modes).
 */
class Limiter {
  constructor(elem, status=null) {
    this.target = elem;
    this.status = status;
    this.id = elem.getAttribute('data-limit-id');
    // Stored under the original key prefix so limits saved by older versions keep working
    this.key = `agile_${this.id}`;
    this.countLimit = intAttr(elem, 'data-limit-count', 1);
    this.duration = intAttr(elem, 'data-limit-min', 0) * MS.MINUTE
      + intAttr(elem, 'data-limit-hr', 0) * MS.HOUR
      + intAttr(elem, 'data-limit-day', 0) * MS.DAY;
    this.persist = storageAvailable();
    this.count = 0;
    this.expiration = null;
    this.timer = null;

    this.load();
    if (this.locked) this.lock();
  }

  get locked() {
    return this.count >= this.countLimit && this.expiration > Date.now();
  }

  get remaining() {
    return Math.max(0, this.countLimit - this.count);
  }

  /**
   * Records one use. Locks the element when the limit is reached.
   * @returns uses left, or false if it was already locked
   */
  add() {
    if (this.locked) return false;
    this.count++;
    this.expiration = new Date(Date.now() + this.duration);
    this.save();
    if (this.locked) this.lock();
    return this.remaining;
  }

  /**
   * Clears the count and unlocks immediately.
   */
  resetLimit() {
    this.timer?.cancel();
    this.timer = null;
    this.count = 0;
    this.expiration = null;
    this.target.disabled = false;
    if (this.status) this.status.innerHTML = '';
    if (this.persist) localStorage.removeItem(this.key);
  }

  // Restores a saved count, ignoring it if its time has already run out.
  // Older versions also saved a `disabled` flag; it's implied by count, so it's not needed.
  load() {
    if (!this.persist) return;
    try {
      const data = JSON.parse(localStorage.getItem(this.key));
      const expiration = data?.expiration ? new Date(data.expiration) : null;
      if (expiration > Date.now()) {
        this.count = data.count;
        this.expiration = expiration;
      } else {
        localStorage.removeItem(this.key);
      }
    } catch {
      localStorage.removeItem(this.key);
    }
  }

  save() {
    if (!this.persist) return;
    localStorage.setItem(this.key, JSON.stringify({ count: this.count, expiration: this.expiration }));
  }

  // Disables the element, shows the wait time, and unlocks when it's up (Timer handles waits
  // longer than setTimeout's 24.8 day limit).
  lock() {
    this.target.disabled = true;
    if (this.status) this.status.innerHTML = `Limit of uses reached. Try again in ${this.timeLeft()}.`;
    this.timer?.cancel();
    this.timer = new Timer(this.expiration, () => this.resetLimit());
  }

  // e.g. "1 day, 2 hours, and 5 minutes". Rounds up, so it never claims 0 minutes while locked.
  // English to match the rest of the message, rather than the visitor's browser language.
  timeLeft() {
    return formatDuration(this.expiration - Date.now(), { smallest: 'minute', round: 'up', locale: 'en-US' });
  }
}

export { Limiter }
