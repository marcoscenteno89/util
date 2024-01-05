import { msgError, msgSuccess } from './util.js';
// TO-DO Break this class into limiter class and storage class
class Limiter {
  constructor(elem, status) {
    this.target = elem;
    this.disabled = false;
    // this.on = true; // SET THIS TO FALSE IF YOU WANT TO TURN OFF LIMITER
    this.now = new Date();
    this.expiration = false;
    this.id = elem.getAttribute('data-limit-id');
    this.min = parseInt(elem.getAttribute('data-limit-min'));
    this.hr = parseInt(elem.getAttribute('data-limit-hr'));
    this.day = parseInt(elem.getAttribute('data-limit-day'));
    this.count;
    this.countLimit = parseInt(elem.getAttribute('data-limit-count'));
    this.status = status;

    this.init();
  }

  init() {
    if (this.storageAvailable()) {
      let jsonData = localStorage.getItem(`agile_${this.target.getAttribute('data-limit-id')}`);
      if (jsonData) { // USE EXISTING DATA 
        this.dataExists(JSON.parse(jsonData));
      } else { // NO DATA AVAILABLE, CREATE NEW ENTRY
        this.resetLimit();
      }
      if (this.now > this.expiration) {
        this.resetLimit();
      }
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
  }

  add() {
    this.count = this.count + 1;
    let label = this.id.replace('_', ' ');
    console.log(`You can try ${label} ${this.countLimit - this.count} more times.`);
    this.setExpiration();
    this.save();
  }
  dataExists(data) {
    this.count = data.count;
    this.disabled = data.disabled;
    this.expiration = data.expiration ? new Date(data.expiration) : false;
  }

  save() {
    localStorage.setItem(`agile_${this.id}`, JSON.stringify({
      count: this.count,
      disabled: this.disabled,
      expiration: this.expiration
    }));
  }

  setExpiration() {
    this.expiration = new Date();
    if (this.min > 0) this.expiration.setMinutes( this.now.getMinutes() + this.min );
    if (this.hr > 0) this.expiration.setHours( this.now.getHours() + this.hr);
    if (this.day > 0) this.expiration.setHours( this.now.getHours() + (this.day * 24));
  }
  disableTarget() {
    this.target.disabled = true;
    this.disabled = true
  }

  resetLimit() {
    this.count = 0;
    this.disabled = false;
    this.target.disabled = false;
    this.expiration = false;
  }

  currentlyDisabled() {
    let totalMin = Math.floor(((this.expiration - this.now) / 1000) / 60);
    let day = Math.floor(totalMin / 1440);
    let dayRemainder = totalMin % 1440;
    let hr = Math.floor(dayRemainder / 60);
    let hrRemainder = dayRemainder % 60;
    let min = hrRemainder % 60;
    let dayTemp = day > 0 ? `${day} day${day > 1 ? 's' : ''}${hr > 0 ? ',' : ''}` : '';
    let hrTemp = hr > 0 ? `${hr} hour${hr > 1 ? 's' : ''}` : '';
    let minTemp = '';
    if (min > 0) {
      minTemp = `${hr > 0 || day > 0 ? ' and' : ''} ${min} minute${min > 1 ? 's' : ''}`;
    } else {
      minTemp = '';
    }
    this.target.disabled = true;
    this.status.innerHTML = msgError(`
      Limit of uses reached. Try again in ${dayTemp} ${hrTemp} ${minTemp}.
    `);
  }

  storageAvailable = () => {
    try {
      const testKey = 'test';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch(e) {
      console.log('localStorage not available');
      return false;
    }
  }
}

export { Limiter }