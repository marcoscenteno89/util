import { storageAvailable } from "./util.js";
import { MS } from "./time.js";

class Color {
  constructor(hex) {
    this.lighter = [];
    this.darker = [];
    this.init(hex);
  }

  init(color) {
    const parsed = this.parse(color);
    if (!parsed) {
      console.log('invalid color', color);
      return;
    }
    const { a, ...rgb } = parsed;
    this.rgb = rgb;
    this.alpha = a;
    this.hex = this.getHex(rgb.r, rgb.g, rgb.b);

    // UP TO 5 LIGHTER AND 5 DARKER VARIATIONS IN STEPS OF 20
    for (let i = 1; i <= 5; i++) {
      this.addVariant(this.lighter, i * 20);
      this.addVariant(this.darker, i * -20);
    }
  }

  // SKIP VARIANTS THAT MATCH THE BASE COLOR OR AN EXISTING VARIANT (E.G. LIGHTER THAN #FFF)
  addVariant(list, num) {
    const item = this.getItem(num);
    if (item.hex !== this.hex && !list.some(v => v.hex === item.hex)) list.push(item);
  }

  getItem(num) {
    const rgb = this.getVariant(this.rgb, num);
    return { rgb, hex: this.getHex(rgb.r, rgb.g, rgb.b) };
  }

  /**
   * Accepts hex (#rgb, #rgba, #rrggbb, #rrggbbaa), rgb()/rgba(), hsl()/hsla(), {r, g, b, a?},
   * and in the browser any other CSS color (named colors, hwb(), lab(), ...).
   * @returns {{r, g, b, a}} or null if invalid
   */
  parse(color, useCanvas=true) {
    if (color && typeof color === 'object') {
      return this.normalize([color.r, color.g, color.b], color.a ?? 1);
    }
    if (typeof color !== 'string') return null;
    const str = color.trim().toLowerCase();

    let match = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.exec(str);
    if (match) {
      let hex = match[1];
      if (hex.length <= 4) hex = [...hex].map(c => c + c).join('');
      const [r, g, b, a = 255] = hex.match(/../g).map(c => parseInt(c, 16));
      return this.normalize([r, g, b], a / 255);
    }

    match = /^(rgba?|hsla?)\((.*)\)$/.exec(str);
    if (match) {
      const [x, y, z, a] = match[2].trim().split(/\s*[\s,\/]\s*/);
      if (z === undefined) return null;
      const alpha = a === undefined ? 1 : this.unit(a, 1);
      if (match[1].startsWith('rgb')) {
        return this.normalize([x, y, z].map(v => this.unit(v, 255)), alpha);
      }
      return this.normalize(this.hslToRgb(this.hue(x), parseFloat(y), parseFloat(z)), alpha);
    }

    // BROWSER FALLBACK: LET CANVAS NORMALIZE NAMED AND OTHER CSS COLORS
    if (useCanvas && typeof document !== 'undefined') {
      const ctx = document.createElement('canvas').getContext('2d');
      for (const sentinel of ['#000000', '#ffffff']) {
        ctx.fillStyle = sentinel;
        ctx.fillStyle = str;
        if (ctx.fillStyle !== sentinel) return this.parse(ctx.fillStyle, false);
      }
      // UNCHANGED FROM BOTH SENTINELS ONLY IF INVALID
    }
    return null;
  }

  // "50%" -> 50% of max, "128" -> 128 (alpha uses max = 1)
  unit(value, max) {
    return value.endsWith('%') ? parseFloat(value) / 100 * max : parseFloat(value);
  }

  hue(value) {
    const h = parseFloat(value);
    if (value.endsWith('turn')) return h * 360;
    if (value.endsWith('grad')) return h * 0.9;
    if (value.endsWith('rad')) return h * 180 / Math.PI;
    return h;
  }

  hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    l /= 100;
    const amp = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      return (l - amp * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
    };
    return [f(0), f(8), f(4)];
  }

  // CLAMP AND ROUND; NULL IF ANY CHANNEL IS NOT A NUMBER
  normalize(rgb, a) {
    const [r, g, b] = rgb.map(v => Math.round(Math.min(255, Math.max(0, Number(v)))));
    a = Math.min(1, Math.max(0, Number(a)));
    return [r, g, b, a].some(Number.isNaN) ? null : { r, g, b, a };
  }

  isHex(color) {
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(color);
  }

  getRgb(hex) {
    // EXPAND SHORT HEX: #abc -> #aabbcc
    hex = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, '#$1$1$2$2$3$3');
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
  /**
   * Saves `value` (anything JSON can hold) for `ttl` ms, 14 days by default.
   */
  set(key, value, ttl=14 * MS.DAY) {
    localStorage.setItem(key, JSON.stringify({ value, exp: Date.now() + ttl }));
  }

  /**
   * The saved value, or null if missing or expired. Unreadable entries, or ones with a missing or
   * invalid expiry (which would otherwise never expire), are deleted and treated as missing.
   */
  get(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    let item;
    try {
      item = JSON.parse(itemStr);
    } catch {
      item = null;
    }
    if (!Number.isFinite(item?.exp) || Date.now() > item.exp) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  }

  storageAvailable = storageAvailable;
}

export { Color, Loader, Storage };
