import { storageAvailable } from "./util.js";

class Color {
  constructor(hex) {
    this.lighter = [];
    this.darker = [];
    this.init(hex);
  }

  init(hex) {
    if (!this.isHex(hex)) {
      console.log('invalid hex');
      return;
    }
    this.rgb = this.getRgb(hex);
    this.hex = this.getHex(this.rgb.r, this.rgb.g, this.rgb.b);

    // 5 LIGHTER AND 5 DARKER VARIATIONS IN STEPS OF 20
    for (let i = 1; i <= 5; i++) {
      this.lighter.push(this.getItem(i * 20));
      this.darker.push(this.getItem(i * -20));
    }
  }

  getItem(num) {
    const rgb = this.getVariant(this.rgb, num);
    return { rgb, hex: this.getHex(rgb.r, rgb.g, rgb.b) };
  }

  isHex(color) {
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(color);
  }

  getRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    }
  }

  getHex(r, g, b) {
    return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }

  getColor(rgb, opacity) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }

  getVariant(rgb, num) {
    const newRgb = {};
    for (const key in rgb) {
      newRgb[key] = Math.min(255, Math.max(0, rgb[key] + num));
    }
    return newRgb;
  }

  adjustColor(rgb) {
    const newRgb = {};
    const difference = parseInt(Math.abs(this.getHSP(rgb) - 127.5) / 2);
    for (const key in rgb) {
      newRgb[key] = this.is_dark ? rgb[key] - difference : rgb[key] + difference;
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
  // ttl defaults to 14 days
  set(key, value, ttl=1000*60*60*24*14) {
    localStorage.setItem(key, JSON.stringify({ value, exp: Date.now() + ttl }));
  }

  get(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    const item = JSON.parse(itemStr);
    if (Date.now() > item.exp) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  }

  storageAvailable = storageAvailable;
}

export { Color, Loader, Storage };
