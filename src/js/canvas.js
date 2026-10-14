/**
 * Canvas utilities for p5.js 1.x in instance mode.
 * Angles are always radians, regardless of p.angleMode().
 */

const toRgba = c => `rgba(${c.levels[0]}, ${c.levels[1]}, ${c.levels[2]}, ${c.levels[3] / 255})`;
const toHex = (r, g, b) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
const toVector = (p, v) => typeof v === 'number' ? p.createVector(v, v) : p.createVector(v.x, v.y);

/**
 * Runs the p5 draw loop only while `node` is in the viewport. Returns the observer.
 */
const canvasObserver = (p, node) => {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? p.loop() : p.noLoop());
  });
  observer.observe(node);
  return observer;
}

/**
 * Builds a style `{ fill: p5.Color[], stroke: p5.Color|null, weight }`.
 * `fill` is one color or an array of colors; several render as a radial gradient.
 * Each fill color gets a `hex` property.
 */
const createColor = (p, fill=[], { stroke=null, weight=1 } = {}) => ({
  fill: [].concat(fill).map(c => {
    const color = p.color(c);
    color.hex = toHex(...color.levels.slice(0, 3));
    return color;
  }),
  stroke: stroke === null ? null : p.color(stroke),
  weight
});

const addStops = (gradient, colors) => {
  colors.forEach((c, i) => {
    gradient.addColorStop(colors.length > 1 ? i / (colors.length - 1) : 0, toRgba(c));
  });
  return gradient;
}

const linearGradient = (ctx, start, end, colors) => {
  return addStops(ctx.createLinearGradient(start.x, start.y, end.x, end.y), colors);
}

/**
 * @param inner - inner radius as a fraction of `radius`; the first color fills it solid
 */
const radialGradient = (ctx, pos, radius, colors, inner=0.5) => {
  return addStops(ctx.createRadialGradient(pos.x, pos.y, radius * inner, pos.x, pos.y, radius), colors);
}

/**
 * Random position inside the canvas, at least `margin` px from the edges.
 */
const randomPosition = (manager, margin=0) => {
  const { p } = manager;
  return p.createVector(p.random(margin, p.width - margin), p.random(margin, p.height - margin));
}

class CanvasManager {
  /**
   * @param p - p5 instance
   * @param elem - container element the canvas fills (if a <canvas> is passed, its parent is used)
   * @param [o.background] - color, CanvasGradient, or null to leave trails
   * @param [o.collisions=false] - resolve collisions between objects on every update()
   * @param [o.autoResize=true] - follow the container's size
   * @param [o.pauseOffscreen=true] - stop the draw loop while the canvas is off screen
   */
  constructor(p, elem, { background=null, collisions=false, autoResize=true, pauseOffscreen=true } = {}) {
    this.p = p;
    this.container = elem.tagName === 'CANVAS' ? elem.parentElement : elem;
    this.canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
    this.canvas.parent(this.container);
    this.ctx = this.canvas.drawingContext;
    this.background = background;
    this.collisions = collisions;
    this.objects = [];
    this.flowfield = null;

    if (autoResize) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }
    if (pauseOffscreen) this.intersectionObserver = canvasObserver(p, this.container);
  }

  get width() { return this.p.width; }
  get height() { return this.p.height; }
  get center() { return this.p.createVector(this.p.width / 2, this.p.height / 2); }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h || (w === this.p.width && h === this.p.height)) return;
    this.p.resizeCanvas(w, h);
    this.flowfield?.build();
  }

  add(...objects) {
    this.objects.push(...objects);
    return objects[0];
  }

  remove(obj) {
    const i = this.objects.indexOf(obj);
    if (i >= 0) this.objects.splice(i, 1);
  }

  /**
   * Creates a flowfield sized to the canvas. See Flowfield for options.
   */
  setFlowfield(options) {
    this.flowfield = new Flowfield(this, options);
    return this.flowfield;
  }

  drawBackground() {
    const { background: bg, ctx, p } = this;
    if (bg === null) return;
    if (bg instanceof CanvasGradient) {
      ctx.save();
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, p.width, p.height);
      ctx.restore();
    } else {
      p.background(bg);
    }
  }

  bounceEdges() {
    for (const obj of this.objects) obj.bounceEdges?.();
  }

  /**
   * Resolves collisions between every pair of objects that support it.
   */
  collide() {
    const list = this.objects.filter(obj => obj.collide);
    for (let i = 0; i < list.length; i++) {
      for (let e = i + 1; e < list.length; e++) list[i].collide(list[e]);
    }
  }

  overlaps(obj) {
    return this.objects.some(other => other !== obj && other.overlaps?.(obj));
  }

  /**
   * Updates the flowfield and every object, removes dead objects, then resolves collisions.
   */
  update() {
    this.flowfield?.update();
    for (let i = this.objects.length - 1; i >= 0; i--) {
      this.objects[i].update();
      if (this.objects[i].dead) this.objects.splice(i, 1);
    }
    if (this.collisions) this.collide();
  }

  draw() {
    this.drawBackground();
    if (this.flowfield?.visible) this.flowfield.draw();
    for (const obj of this.objects) obj.draw();
  }

  /**
   * One frame: update() then draw(). Call from p.draw.
   */
  run() {
    this.update();
    this.draw();
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
  }
}

/**
 * Grid of unit vectors driven by Perlin noise.
 * @param [o.cellSize=20] - cell size in px
 * @param [o.step=0.1] - noise step between neighboring cells (lower = smoother)
 * @param [o.speed=0.005] - noise z-offset added per frame (higher = changes faster)
 * @param [o.offset=0] - starting noise z-offset
 * @param [o.visible=false] - draw the field in manager.draw()
 */
class Flowfield {
  constructor(manager, { cellSize=20, step=0.1, speed=0.005, offset=0, visible=false } = {}) {
    this.manager = manager;
    this.p = manager.p;
    Object.assign(this, { cellSize, step, speed, offset, visible });
    this.build();
  }

  build() {
    const { p, cellSize } = this;
    const half = cellSize / 2;
    this.cols = Math.ceil(p.width / cellSize);
    this.rows = Math.ceil(p.height / cellSize);
    this.field = Array.from({ length: this.cols }, (_, x) =>
      Array.from({ length: this.rows }, (_, y) => ({
        pos: p.createVector(x * cellSize + half, y * cellSize + half),
        vel: p.createVector(1, 0)
      }))
    );
  }

  update() {
    const { p, step } = this;
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        const angle = p.noise(x * step, y * step, this.offset) * Math.PI * 8;
        this.field[x][y].vel.set(Math.cos(angle), Math.sin(angle));
      }
    }
    this.offset += this.speed;
  }

  /**
   * Cell under `pos`, clamped to the grid.
   */
  lookup(pos) {
    const x = Math.min(this.cols - 1, Math.max(0, Math.floor(pos.x / this.cellSize)));
    const y = Math.min(this.rows - 1, Math.max(0, Math.floor(pos.y / this.cellSize)));
    return this.field[x][y];
  }

  draw(color=255) {
    const { p } = this;
    const len = this.cellSize / 2;
    p.push();
    p.stroke(color);
    for (const col of this.field) {
      for (const { pos, vel } of col) p.line(pos.x, pos.y, pos.x + vel.x * len, pos.y + vel.y * len);
    }
    p.pop();
  }
}

/**
 * Base for anything the manager updates and draws.
 */
class CanvasObject {
  static #nextId = 1;

  constructor(manager) {
    this.manager = manager;
    this.p = manager.p;
    this.ctx = manager.ctx;
    this.id = CanvasObject.#nextId++;
  }

  get dead() { return false; }
  update() {}
  draw() {}

  applyStyle(style, gradient=null) {
    const { p } = this;
    if (style.stroke) {
      p.strokeWeight(style.weight);
      p.stroke(style.stroke);
    } else {
      p.noStroke();
    }
    if (!style.fill.length) return p.noFill();
    p.fill(style.fill[0]);
    // p5 fills with ctx.fillStyle, so the gradient must be set after p.fill()
    if (gradient) this.ctx.fillStyle = gradient;
  }
}

/**
 * Base for moving shapes. Subclasses implement `shape()`, drawing centered at (0, 0).
 * @param o.pos - {x, y}
 * @param o.size - number or {x, y} (width, height)
 * @param [o.vel] [o.acc] - {x, y}
 * @param [o.mass] - defaults to size.x
 * @param [o.color='#fff'] - createColor() style, or any p5 color / array of colors
 * @param [o.angle=0] - rotation in radians
 * @param [o.spin=0] - rotation added per frame
 * @param [o.maxSpeed=Infinity]
 * @param [o.life] - frames until the shape is removed
 * @param [o.shrink=false] - shrink to 0 over its life
 * @param [o.fade=false] - fade out over the second half of its life
 */
class Shape extends CanvasObject {
  constructor(manager, {
    pos, size, vel={ x: 0, y: 0 }, acc={ x: 0, y: 0 }, mass, color='#fff',
    angle=0, spin=0, maxSpeed=Infinity, life=null, shrink=false, fade=false
  }) {
    super(manager);
    const { p } = this;
    this.pos = toVector(p, pos);
    this.size = toVector(p, size);
    this.vel = toVector(p, vel);
    this.acc = toVector(p, acc);
    this.mass = mass ?? this.size.x;
    this.angle = angle;
    this.spin = spin;
    this.maxSpeed = maxSpeed;
    this.life = life ? { total: life, remaining: life, shrink, fade } : null;

    // Own copies of the colors so fading one shape never changes another
    const style = Array.isArray(color.fill) ? color : createColor(p, color);
    this.color = { ...style, fill: style.fill.map(c => Object.assign(p.color(toRgba(c)), { hex: c.hex })) };
    this.alpha = this.color.fill.map(c => c.levels[3]);

    this.original = { pos: this.pos.copy(), size: this.size.copy(), vel: this.vel.copy(), angle };
    this.gradient = null;
    this.gradientKey = null;
  }

  get radius() { return Math.max(this.size.x, this.size.y) / 2; }
  get dead() { return this.life !== null && this.life.remaining <= 0; }

  reset() {
    this.pos.set(this.original.pos);
    this.size.set(this.original.size);
    this.vel.set(this.original.vel);
    this.acc.set(0, 0);
    this.angle = this.original.angle;
    if (this.life) this.life.remaining = this.life.total;
    this.color.fill.forEach((c, i) => c.setAlpha(this.alpha[i]));
  }

  /**
   * Adds a force for the next update(). Does not move the shape.
   */
  applyForce(force) {
    this.acc.add(force.x / this.mass, force.y / this.mass);
  }

  /**
   * Pulls `other` toward this shape.
   */
  attract(other, G=1) {
    const force = this.pos.copy().sub(other.pos);
    const distanceSq = this.p.constrain(force.magSq(), 100, 1000);
    force.setMag((G * this.mass * other.mass) / distanceSq);
    other.applyForce(force);
  }

  update() {
    this.vel.add(this.acc).limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
    this.angle += this.spin;
    if (this.life) this.updateLife();
  }

  updateLife() {
    const life = this.life;
    life.remaining = Math.max(0, life.remaining - 1);
    const ratio = life.remaining / life.total;
    if (life.shrink) this.size.set(this.original.size.x * ratio, this.original.size.y * ratio);
    if (life.fade) {
      const fade = Math.min(1, ratio * 2);
      this.color.fill.forEach((c, i) => c.setAlpha(this.alpha[i] * fade));
    }
  }

  /**
   * Keeps the shape inside the canvas, reversing velocity at the edges.
   */
  bounceEdges() {
    const { width, height } = this.p;
    const hx = this.size.x / 2;
    const hy = this.size.y / 2;
    if (this.pos.x < hx) { this.pos.x = hx; this.vel.x = Math.abs(this.vel.x); }
    else if (this.pos.x > width - hx) { this.pos.x = width - hx; this.vel.x = -Math.abs(this.vel.x); }
    if (this.pos.y < hy) { this.pos.y = hy; this.vel.y = Math.abs(this.vel.y); }
    else if (this.pos.y > height - hy) { this.pos.y = height - hy; this.vel.y = -Math.abs(this.vel.y); }
  }

  /**
   * Moves the shape to the opposite side when it leaves the canvas.
   */
  wrapEdges() {
    const { width, height } = this.p;
    const hx = this.size.x / 2;
    const hy = this.size.y / 2;
    if (this.pos.x > width - hx) this.pos.x = hx;
    else if (this.pos.x < hx) this.pos.x = width - hx;
    if (this.pos.y > height - hy) this.pos.y = hy;
    else if (this.pos.y < hy) this.pos.y = height - hy;
  }

  overlaps(other) {
    return this.pos.dist(other.pos) <= this.radius + other.radius;
  }

  /**
   * Elastic collision treating both shapes as circles. Returns true if they touched.
   */
  collide(other) {
    const normal = other.pos.copy().sub(this.pos);
    const dist = normal.mag();
    const overlap = this.radius + other.radius - dist;
    if (overlap <= 0) return false;
    if (dist === 0) normal.set(1, 0);
    else normal.div(dist);

    // Push apart, heavier shapes move less
    const total = this.mass + other.mass;
    this.pos.sub(normal.x * overlap * other.mass / total, normal.y * overlap * other.mass / total);
    other.pos.add(normal.x * overlap * this.mass / total, normal.y * overlap * this.mass / total);

    // Exchange momentum along the normal, unless already separating
    const approach = this.vel.dot(normal) - other.vel.dot(normal);
    if (approach > 0) {
      const impulse = (2 * approach) / total;
      this.vel.sub(normal.x * impulse * other.mass, normal.y * impulse * other.mass);
      other.vel.add(normal.x * impulse * this.mass, normal.y * impulse * this.mass);
    }
    return true;
  }

  // Cached; rebuilt only when size or colors change
  getGradient() {
    if (this.color.fill.length < 2) return null;
    const key = `${this.size.x}|${this.color.fill.map(toRgba).join()}`;
    if (key !== this.gradientKey) {
      this.gradient = radialGradient(this.ctx, { x: 0, y: 0 }, this.size.x / 2, this.color.fill);
      this.gradientKey = key;
    }
    return this.gradient;
  }

  draw() {
    const { p } = this;
    p.push();
    p.translate(this.pos.x, this.pos.y);
    if (this.angle) this.ctx.rotate(this.angle);
    this.applyStyle(this.color, this.getGradient());
    this.shape();
    p.pop();
  }

  shape() {}
}

class Ellipse extends Shape {
  shape() {
    this.p.ellipseMode(this.p.CENTER);
    this.p.ellipse(0, 0, this.size.x, this.size.y);
  }
}

/**
 * @param [o.corner=0] - corner radius
 */
class Rect extends Shape {
  constructor(manager, options) {
    super(manager, options);
    this.corner = options.corner ?? 0;
  }

  shape() {
    this.p.rectMode(this.p.CENTER);
    this.p.rect(0, 0, this.size.x, this.size.y, this.corner);
  }
}

/**
 * Triangle inside the size box, pointing along the shape's angle.
 */
class Triangle extends Shape {
  shape() {
    const hx = this.size.x / 2;
    const hy = this.size.y / 2;
    this.p.triangle(-hx, -hy, -hx, hy, hx, 0);
  }
}

/**
 * Regular polygon inside the size box.
 * @param [o.sides=6]
 */
class Polygon extends Shape {
  constructor(manager, options) {
    super(manager, options);
    this.sides = options.sides ?? 6;
  }

  shape() {
    const step = (Math.PI * 2) / this.sides;
    this.p.beginShape();
    for (let i = 0; i < this.sides; i++) {
      this.p.vertex(Math.cos(step * i) * this.size.x / 2, Math.sin(step * i) * this.size.y / 2);
    }
    this.p.endShape(this.p.CLOSE);
  }
}

/**
 * Line segment, e.g. for trails.
 * @param o.start o.end - {x, y}
 * @param [o.color=255] [o.weight=1]
 * @param [o.speed=1] - length of getDisplacement()
 */
class Line extends CanvasObject {
  constructor(manager, { start, end, color=255, weight=1, speed=1 }) {
    super(manager);
    this.start = toVector(this.p, start);
    this.end = toVector(this.p, end);
    this.color = this.p.color(color);
    this.weight = weight;
    this.speed = speed;
  }

  getDisplacement() {
    return this.start.copy().sub(this.end).setMag(this.speed);
  }

  /**
   * Moves the line forward: the old end becomes the start.
   */
  add(pos) {
    this.start.set(this.end);
    this.end.set(pos.x, pos.y);
  }

  remove(pos) {
    this.end.set(this.start);
    this.start.set(pos.x, pos.y);
  }

  /**
   * Moves the end to the opposite side when it leaves the canvas, without drawing across.
   */
  wrapEdges() {
    const { width, height } = this.p;
    let wrapped = false;
    if (this.end.x > width) { this.end.x = 0; wrapped = true; }
    else if (this.end.x < 0) { this.end.x = width; wrapped = true; }
    if (this.end.y > height) { this.end.y = 0; wrapped = true; }
    else if (this.end.y < 0) { this.end.y = height; wrapped = true; }
    if (wrapped) this.start.set(this.end);
  }

  draw() {
    this.p.strokeWeight(this.weight);
    this.p.stroke(this.color);
    this.p.line(this.start.x, this.start.y, this.end.x, this.end.y);
  }
}

/**
 * Moves child shapes in a circle around a center.
 * Children are updated and drawn by the orbit, so don't also add them to the manager.
 * @param o.center - {x, y} or a Shape to follow
 * @param o.radius
 */
class Orbit extends CanvasObject {
  constructor(manager, { center, radius }) {
    super(manager);
    this.center = center;
    this.radius = radius;
    this.children = [];
  }

  /**
   * @param [o.angle=0] - starting position in radians
   * @param [o.speed=0.01] - radians per frame
   */
  add(shape, { angle=0, speed=0.01 } = {}) {
    this.children.push({ shape, angle, speed });
    this.place(this.children.at(-1));
    return shape;
  }

  place(child) {
    const c = this.center.pos ?? this.center;
    child.shape.pos.set(c.x + Math.cos(child.angle) * this.radius, c.y + Math.sin(child.angle) * this.radius);
  }

  update() {
    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      child.shape.update();
      if (child.shape.dead) {
        this.children.splice(i, 1);
        continue;
      }
      child.angle += child.speed;
      this.place(child);
    }
  }

  draw() {
    for (const { shape } of this.children) shape.draw();
  }
}

export {
  CanvasManager, Flowfield, CanvasObject, Shape, Ellipse, Rect, Triangle, Polygon, Line, Orbit,
  createColor, linearGradient, radialGradient, randomPosition, canvasObserver
}
