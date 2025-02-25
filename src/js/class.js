import { post } from "./util.js";

class Color {
  constructor(hex) {
    this.hex;
    this.rgb;
    this.lighter = [],
    this.darker = []
    this.init(hex);
  }

  init(hex) {
    if (this.isHex(hex)) {
      this.rgb = this.getRgb(hex);
      this.hex = this.getHex(this.rgb.r, this.rgb.g, this.rgb.b);
      
      // RUN 3 TIMES TO GET 3 LIGHTER VARIATIONS
      let lightCount = 20;
      for (let i = 0; i < 5; i++) {
        let item = {};
        item.rgb = this.getVariant(this.rgb, lightCount);
        item.hex = this.getHex(item.rgb.r, item.rgb.g, item.rgb.b);
        this.lighter.push(item);
        lightCount += 20;
      }

      // RUN 3 TIMES TO GET 3 DARKER VARIATIONS
      let darkCount = -20;
      for (let i = 0; i < 5; i++) {
        let item = {};
        item.rgb = this.getVariant(this.rgb, darkCount);
        item.hex = this.getHex(item.rgb.r, item.rgb.g, item.rgb.b);
        this.darker.push(item);
        darkCount -= 20;
      }

    } else {
      console.log('invalid hex');
    }

  }

  isHex(color) {
    const regExp = /(^#[0-9A-Fa-f]{6}$)|(^#[0-9A-Fa-f]{3}$)/i;
    return regExp.test(color);
  }

  getRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    }
  }
  
  getHex(r, g, b) {
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
    for (let key in rgb) {
      newRgb[key] = this.is_dark ? rgb[key] - differece : rgb[key] + differece;
    }
    return newRgb;
  }

  getHSP(rgb) {
    return Math.sqrt(0.299 * (rgb.r*rgb.r) + 0.587 * (rgb.g*rgb.g) + 0.114 * (rgb.b*rgb.b));
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
  set(key, value, ttl=1000*60*60*24*14) {
    const now = new Date();
    const item = {
      value: value, // `item` is an object which contains the original value
      exp: now.getTime() + ttl, // as well as the time when it's supposed to expire
    };
    localStorage.setItem(key, JSON.stringify(item));
  }

  get(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null; // if the item doesn't exist, return null
    const item = JSON.parse(itemStr);
    const now = new Date();
    if (now.getTime() > item.exp) { // compare the exp time of the item with the current time
      localStorage.removeItem(key); // If the item is expired, delete it from the storage
      return null; // and return null
    }
    return item.value;
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