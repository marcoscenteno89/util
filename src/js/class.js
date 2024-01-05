class Color {

  constructor(hex) {
    this.hex;
    this.rgb;
    this.variations = [];

    this.init(hex);
  }

  init(hex) {
    this.isHex(hex);

  }

  isHex(color) {
    const regExp = /(^#[0-9A-Fa-f]{6}$)|(^#[0-9A-Fa-f]{3}$)/i;
    return regExp.test(color);
  }

  getRgb = (hex) => {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    }
  }
  
  getHex = (r, g, b) => {
    const componentToHex = (current) => {
        const hex = current.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
    return `#${componentToHex(r) + componentToHex(g) + componentToHex(b)}`;
  }

  getColor(rgb, opacity) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }

  getVariant(rgb, num) {
    let newRgb = {};
    for (let key in rgb) {
      let newVal = rgb[key] + num;
      if (num < 0) {
        newRgb[key] = newVal >= 0 ? newVal : 0;
      } else {
        newRgb[key] = newVal <= 255 ? newVal : 255;
      }
    }
    return newRgb;
  }

  adjustColor(rgb) {
    let newRgb = {}
    let hsp = this.getHSP(rgb);
    let differece = parseInt(Math.abs(hsp - 127.5) / 2);
    console.log(this.is_dark)
    for (let key in rgb) {
      newRgb[key] = this.is_dark ? rgb[key] - differece : rgb[key] + differece;
    }
    return newRgb;
  }

  getHSP(rgb) {
    return Math.sqrt(0.299 * (rgb.r * rgb.r) + 0.587 * (rgb.g * rgb.g) + 0.114 * (rgb.b * rgb.b));
  }
  
}

class Loader {
  constructor(target, version) {
    this.target = target;
    this.content = target.innerHTML;
    this.loader = `<div class="loader loader-${version}"></div>`;
    this.disabled = false;
  }

  on() {
    this.target.innerHTML = this.loader;
    this.disabled = true;
  }

  off() {
    this.target.innerHTML = this.content;
    this.disabled = false;
  }
}

class Storage {
  constructor() {
    this.now = new Date();
    this.expiration = false;
    this.obj = {}
  }

  set() {

  }

  get() {

  }

  setExpiration() {
    this.expiration = new Date();
    if (this.min > 0) this.expiration.setMinutes( this.now.getMinutes() + this.min );
    if (this.hr > 0) this.expiration.setHours( this.now.getHours() + this.hr);
    if (this.day > 0) this.expiration.setHours( this.now.getHours() + (this.day * 24));
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

export { Color, Loader, Storage };