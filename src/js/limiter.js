import { storageAvailable } from './util.js';

const plural = (n, unit) => `${n} ${unit}${n > 1 ? 's' : ''}`;

class Limiter {
  constructor(elem, status) {
    this.target = elem;
    this.status = status;
    this.disabled = false;
    this.now = new Date();
    this.expiration = false;
    this.id = elem.getAttribute('data-limit-id');
    this.min = parseInt(elem.getAttribute('data-limit-min'));
    this.hr = parseInt(elem.getAttribute('data-limit-hr'));
    this.day = parseInt(elem.getAttribute('data-limit-day'));
    this.countLimit = parseInt(elem.getAttribute('data-limit-count'));

    this.init();
  }

  get key() {
    return `agile_${this.id}`;
  }

  init() {
    if (!storageAvailable()) return;

    const jsonData = localStorage.getItem(this.key);
    if (jsonData) {
      this.dataExists(JSON.parse(jsonData));
    } else {
      this.resetLimit();
    }
    if (this.now > this.expiration) this.resetLimit();
    if (this.disabled) {
      this.currentlyDisabled();
      return false;
    }
    if (this.count >= this.countLimit) {
      this.disableTarget();
      this.currentlyDisabled();
      return false;
    }
    this.save();
  }

  add() {
    this.count++;
    console.log(`You can try ${this.id.replace('_', ' ')} ${this.countLimit - this.count} more times.`);
    this.setExpiration();
    this.save();
  }

  dataExists(data) {
    this.count = data.count;
    this.disabled = data.disabled;
    this.expiration = data.expiration ? new Date(data.expiration) : false;
  }

  save() {
    localStorage.setItem(this.key, JSON.stringify({
      count: this.count,
      disabled: this.disabled,
      expiration: this.expiration
    }));
  }

  setExpiration() {
    this.expiration = new Date();
    if (this.min > 0) this.expiration.setMinutes(this.now.getMinutes() + this.min);
    if (this.hr > 0) this.expiration.setHours(this.now.getHours() + this.hr);
    if (this.day > 0) this.expiration.setHours(this.now.getHours() + (this.day * 24));
  }

  disableTarget() {
    this.target.disabled = true;
    this.disabled = true;
  }

  resetLimit() {
    this.count = 0;
    this.disabled = false;
    this.target.disabled = false;
    this.expiration = false;
  }

  currentlyDisabled() {
    const totalMin = Math.floor((this.expiration - this.now) / 60000);
    const day = Math.floor(totalMin / 1440);
    const hr = Math.floor((totalMin % 1440) / 60);
    const min = totalMin % 60;
    const dayTemp = day > 0 ? `${plural(day, 'day')}${hr > 0 ? ',' : ''}` : '';
    const hrTemp = hr > 0 ? plural(hr, 'hour') : '';
    const minTemp = min > 0 ? `${hr > 0 || day > 0 ? ' and' : ''} ${plural(min, 'minute')}` : '';
    this.target.disabled = true;
    this.status.innerHTML = `Limit of uses reached. Try again in ${dayTemp} ${hrTemp} ${minTemp}.`;
  }

  storageAvailable = storageAvailable;
}

export { Limiter }
