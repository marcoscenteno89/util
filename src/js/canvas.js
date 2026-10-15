/**
 * Canvas utilities for p5.js 1.x in instance mode.
 *
 * Units: positions and sizes are px; velocities are px per frame at 60 fps. The scene scales
 * every update by the real frame time, so motion looks the same at 30, 60 or 120 Hz.
 * Angles are always radians, regardless of p.angleMode().
 */

// p5.Color.levels holds RGBA as 0-255; CSS rgba() wants alpha as 0-1.
const toRgba = c => `rgba(${c.levels[0]}, ${c.levels[1]}, ${c.levels[2]}, ${c.levels[3] / 255})`;
const toHex = (r, g, b) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;

// Accepts a number (square/uniform) or anything with x/y, and always returns a new p5.Vector,
// so shapes never share a vector with the caller.
const toVector = (p, v) => typeof v === 'number' ? p.createVector(v, v) : p.createVector(v.x, v.y);

/**
 * Pauses the p5 draw loop while `node` is scrolled out of view, so off-screen canvases cost no CPU.
 * Returns the IntersectionObserver so callers can disconnect it.
 */
const canvasObserver = (p, node) => {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? p.loop() : p.noLoop());
  });
  observer.observe(node);
  return observer;
}

/**
 * Builds the style object shapes use: `{ fill: p5.Color[], stroke: p5.Color|null, weight }`.
 * One fill color draws solid; two or more draw a radial gradient from center to edge.
 * Each fill color also gets a `hex` string for use outside p5 (CSS, logging).
 * @param fill - one color or an array of colors, in any format p.color() accepts
 * @param [o.stroke] - outline color, or null for no outline
 * @param [o.weight=1] - outline width in px
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

// Spreads colors evenly from offset 0 to 1; a single color sits at 0 and fills the whole gradient.
const addStops = (gradient, colors) => {
  colors.forEach((c, i) => {
    gradient.addColorStop(colors.length > 1 ? i / (colors.length - 1) : 0, toRgba(c));
  });
  return gradient;
}

/**
 * Canvas linear gradient between two points, usable as `scene.background` or any fillStyle.
 * @param colors - p5.Color[]
 */
const linearGradient = (ctx, start, end, colors) => {
  return addStops(ctx.createLinearGradient(start.x, start.y, end.x, end.y), colors);
}

/**
 * Canvas radial gradient centered on `pos`.
 * @param colors - p5.Color[], from the inner circle outward
 * @param [inner=0.5] - inner radius as a fraction of `radius`; the first color fills it solid
 */
const radialGradient = (ctx, pos, radius, colors, inner=0.5) => {
  return addStops(ctx.createRadialGradient(pos.x, pos.y, radius * inner, pos.x, pos.y, radius), colors);
}

/**
 * Random point inside the canvas, at least `margin` px from every edge.
 * Pass a shape's radius as the margin to spawn it fully on screen.
 */
const randomPosition = (scene, margin=0) => {
  const { p } = scene;
  return p.createVector(p.random(margin, p.width - margin), p.random(margin, p.height - margin));
}

/**
 * Owns the canvas and the list of objects in it, and runs one simulation step per frame.
 * Typical use: build objects in p.setup, call scene.run() in p.draw.
 */
class Scene {
  /**
   * @param p - p5 instance
   * @param elem - element the canvas fills; if a <canvas> is passed, its parent is used
   * @param [o.background] - color, CanvasGradient, or null to skip clearing (leaves trails)
   * @param [o.gravity] - {x, y} acceleration applied to every moving shape, e.g. { x: 0, y: 0.2 }
   * @param [o.collisions=false] - resolve shape-to-shape collisions on every update()
   * @param [o.timeScale=1] - simulation speed; 0.5 is slow motion, 2 is double speed
   * @param [o.autoResize=true] - resize the canvas (and flowfield) when the container resizes
   * @param [o.pauseOffscreen=true] - stop the draw loop while the canvas is out of view
   */
  constructor(p, elem, {
    background=null, gravity=null, collisions=false, timeScale=1, autoResize=true, pauseOffscreen=true
  } = {}) {
    this.p = p;
    this.container = elem.tagName === 'CANVAS' ? elem.parentElement : elem;
    this.canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
    this.canvas.parent(this.container);
    this.ctx = this.canvas.drawingContext;
    this.background = background;
    this.gravity = gravity;
    this.collisions = collisions;
    this.timeScale = timeScale;
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

  /**
   * Time step for this frame, in 60 fps frames: 1 at 60 fps, 2 at 30 fps, 0.5 at 120 fps.
   * Capped at 3 so a long pause (background tab, debugger) can't launch shapes through walls.
   */
  get dt() {
    const ms = this.p.deltaTime || 1000 / 60;
    return Math.min(ms / (1000 / 60), 3) * this.timeScale;
  }

  // Matches the canvas to the container. Skips zero sizes (hidden container) and no-op resizes,
  // since resizeCanvas() clears the canvas and the flowfield rebuild allocates a new grid.
  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h || (w === this.p.width && h === this.p.height)) return;
    this.p.resizeCanvas(w, h);
    this.flowfield?.build();
  }

  /**
   * Adds objects to the scene. Returns the first one so you can write `const ball = scene.add(new Ellipse(...))`.
   */
  add(...objects) {
    this.objects.push(...objects);
    return objects[0];
  }

  remove(obj) {
    const i = this.objects.indexOf(obj);
    if (i >= 0) this.objects.splice(i, 1);
  }

  /**
   * Creates (or replaces) the scene's flowfield, sized to the canvas. See Flowfield for options.
   */
  setFlowfield(options) {
    this.flowfield = new Flowfield(this, options);
    return this.flowfield;
  }

  drawBackground() {
    const { background: bg, ctx, p } = this;
    if (bg === null) return;
    if (bg instanceof CanvasGradient) {
      // p.background() only takes colors, so paint gradients with the raw canvas API
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
   * Resolves collisions between all objects that have a collide() method.
   *
   * Uses a uniform grid (spatial hash) so each shape is only tested against shapes in its own and
   * the 8 neighboring cells, instead of every other shape. Cells are as wide as the largest shape,
   * so any two touching shapes are always in the same or adjacent cells. One very large shape makes
   * the cells large too, which falls back toward checking every pair.
   */
  collide() {
    const bodies = this.objects.filter(obj => obj.collide);
    if (bodies.length < 2) return;
    const cellSize = 2 * Math.max(...bodies.map(b => b.radius)) || 1;
    const keyOf = (cx, cy) => cx * 100003 + cy;

    const cells = new Map();
    const coords = bodies.map((body, i) => {
      const cx = Math.floor(body.pos.x / cellSize);
      const cy = Math.floor(body.pos.y / cellSize);
      const key = keyOf(cx, cy);
      if (cells.has(key)) cells.get(key).push(i);
      else cells.set(key, [i]);
      return [cx, cy];
    });

    // Only pair i with higher indexes (j > i) so each pair is resolved once
    bodies.forEach((body, i) => {
      const [cx, cy] = coords[i];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const j of cells.get(keyOf(cx + dx, cy + dy)) ?? []) {
            if (j > i) body.collide(bodies[j]);
          }
        }
      }
    });
  }

  overlaps(obj) {
    return this.objects.some(other => other !== obj && other.overlaps?.(obj));
  }

  /**
   * Advances the scene by one frame: flowfield, every object (with gravity), then collisions.
   * Objects whose life has run out are removed. The loop runs backwards so removing an object
   * doesn't skip the one after it.
   */
  update() {
    const dt = this.dt;
    this.flowfield?.update(dt);
    for (let i = this.objects.length - 1; i >= 0; i--) {
      this.objects[i].update(dt, this.gravity);
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
   * One full frame: update() then draw(). Call this from p.draw.
   */
  run() {
    this.update();
    this.draw();
  }

  /**
   * Stops watching the container. Call before removing the sketch to avoid leaking observers.
   */
  destroy() {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
  }
}

/**
 * A grid of unit-length direction vectors that change smoothly over space and time (Perlin noise).
 * Use it to steer shapes: shape.applyForce(field.lookup(shape.pos).vel).
 * @param [o.cellSize=20] - grid cell size in px; smaller is finer but costs more per frame
 * @param [o.step=0.1] - noise distance between neighboring cells; lower gives smoother, wider swirls
 * @param [o.speed=0.005] - how fast the field changes over time
 * @param [o.offset=0] - starting point in noise time; change it to get a different field
 * @param [o.visible=false] - draw the field as short lines in scene.draw() (handy for tuning)
 */
class Flowfield {
  constructor(scene, { cellSize=20, step=0.1, speed=0.005, offset=0, visible=false } = {}) {
    this.scene = scene;
    this.p = scene.p;
    Object.assign(this, { cellSize, step, speed, offset, visible });
    this.build();
  }

  // Allocates the grid. Cells are plain { pos, vel } objects; pos is the cell center.
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

  // Reuses each cell's vector instead of allocating new ones, so a large field doesn't create
  // garbage every frame. Noise (0-1) is mapped to 0-4 full turns so directions vary more.
  update(dt=1) {
    const { p, step } = this;
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        const angle = p.noise(x * step, y * step, this.offset) * Math.PI * 8;
        this.field[x][y].vel.set(Math.cos(angle), Math.sin(angle));
      }
    }
    this.offset += this.speed * dt;
  }

  /**
   * The cell under `pos`. Positions outside the canvas use the nearest edge cell.
   */
  lookup(pos) {
    const x = Math.min(this.cols - 1, Math.max(0, Math.floor(pos.x / this.cellSize)));
    const y = Math.min(this.rows - 1, Math.max(0, Math.floor(pos.y / this.cellSize)));
    return this.field[x][y];
  }

  // Draws each direction as a line from the cell center. Computes the end point directly rather
  // than push/translate/rotate/pop per cell, which is several times faster for large grids.
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
 * Base class for anything the scene updates and draws. Subclass it for custom objects:
 * override update(dt, gravity), draw(), and the `dead` getter if the object should be removed.
 */
class CanvasObject {
  static #nextId = 1;

  constructor(scene) {
    this.scene = scene;
    this.p = scene.p;
    this.ctx = scene.ctx;
    this.id = CanvasObject.#nextId++;
  }

  get dead() { return false; }
  update() {}
  draw() {}

  /**
   * Applies a createColor() style to the p5 drawing state.
   * @param [gradient] - CanvasGradient that replaces the solid fill
   */
  applyStyle(style, gradient=null) {
    const { p } = this;
    if (style.stroke) {
      p.strokeWeight(style.weight);
      p.stroke(style.stroke);
    } else {
      p.noStroke();
    }
    if (!style.fill.length) return p.noFill();
    // p.fill() turns filling on and sets ctx.fillStyle; p5 then fills with whatever ctx.fillStyle
    // holds, so overwriting it afterwards swaps the solid color for the gradient.
    p.fill(style.fill[0]);
    if (gradient) this.ctx.fillStyle = gradient;
  }
}

/**
 * A moving, colliding body. Collisions treat every shape as a circle of `radius`.
 * Subclasses only implement shape(), drawing centered at (0, 0); position and rotation are
 * already applied when it is called.
 *
 * Per frame: applyForce() any number of times, then update() moves it, then draw().
 * scene.run() calls update() and draw() for you.
 *
 * @param o.pos - {x, y} center
 * @param o.size - number, or {x, y} for width and height
 * @param [o.vel] - {x, y} in px per frame
 * @param [o.acc] - {x, y} starting acceleration (reset to 0 after each update)
 * @param [o.mass] - defaults to size.x, so bigger shapes are heavier
 * @param [o.isStatic=false] - never moves; other shapes bounce off it (walls, floors, pegs)
 * @param [o.bounce=1] - restitution, 0-1: 1 keeps all speed on impact, 0 doesn't bounce at all
 * @param [o.friction=0] - fraction of velocity lost per frame, 0-1, e.g. 0.02 for air drag
 * @param [o.maxSpeed=Infinity] - speed cap in px per frame
 * @param [o.color='#fff'] - createColor() style, or any p5 color / array of colors
 * @param [o.angle=0] - rotation in radians
 * @param [o.spin=0] - radians added per frame
 * @param [o.life] - frames until removed by the scene
 * @param [o.shrink=false] - scale down to 0 over its life
 * @param [o.fade=false] - fade out over the second half of its life
 */
class Shape extends CanvasObject {
  constructor(scene, {
    pos, size, vel={ x: 0, y: 0 }, acc={ x: 0, y: 0 }, mass, isStatic=false, bounce=1, friction=0,
    maxSpeed=Infinity, color='#fff', angle=0, spin=0, life=null, shrink=false, fade=false
  }) {
    super(scene);
    const { p } = this;
    this.pos = toVector(p, pos);
    this.size = toVector(p, size);
    this.vel = toVector(p, vel);
    this.acc = toVector(p, acc);
    this.mass = mass ?? this.size.x;
    this.isStatic = isStatic;
    this.bounce = bounce;
    this.friction = friction;
    this.maxSpeed = maxSpeed;
    this.angle = angle;
    this.spin = spin;
    this.life = life ? { total: life, remaining: life, shrink, fade } : null;

    // Copy the colors so fading this shape never changes another shape using the same style.
    // Arrays have a built-in .fill() method, so check for an array rather than truthiness.
    const style = Array.isArray(color.fill) ? color : createColor(p, color);
    this.color = { ...style, fill: style.fill.map(c => Object.assign(p.color(toRgba(c)), { hex: c.hex })) };
    this.alpha = this.color.fill.map(c => c.levels[3]);

    this.original = { pos: this.pos.copy(), size: this.size.copy(), vel: this.vel.copy(), angle };
    this.gradient = null;
    this.gradientKey = null;
  }

  // Radius of the circle used for collisions and overlaps; covers the longer side.
  get radius() { return Math.max(this.size.x, this.size.y) / 2; }

  // 0 for static shapes, which makes forces and collision impulses unable to move them.
  get invMass() { return this.isStatic || this.mass === Infinity ? 0 : 1 / this.mass; }

  get dead() { return this.life !== null && this.life.remaining <= 0; }

  /**
   * Restores position, size, velocity, angle, life and opacity to their starting values.
   */
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
   * Queues a force for the next update(). Heavier shapes accelerate less (a = F / m).
   * Does not move the shape by itself, so it can be called many times per frame.
   */
  applyForce(force) {
    const inv = this.invMass;
    this.acc.add(force.x * inv, force.y * inv);
  }

  /**
   * Pulls `other` toward this shape with gravity-like force: G * m1 * m2 / (distance² + softening²).
   * Softening stops the force from exploding when the two are very close.
   * Only `other` is pulled; call other.attract(this) as well for mutual attraction.
   */
  attract(other, G=1, softening=10) {
    const force = this.pos.copy().sub(other.pos);
    const strength = (G * this.mass * other.mass) / (force.magSq() + softening * softening);
    other.applyForce(force.setMag(strength));
  }

  /**
   * Moves the shape one step (semi-implicit Euler: velocity first, then position).
   * @param [dt=1] - time step in 60 fps frames; the scene passes the real value
   * @param [gravity] - {x, y} acceleration added this step, independent of mass
   */
  update(dt=1, gravity=null) {
    if (!this.isStatic) {
      if (gravity) this.acc.add(gravity.x, gravity.y);
      this.vel.add(this.acc.x * dt, this.acc.y * dt);
      // Friction is per 60 fps frame, so raise it to the power of dt to match at any frame rate
      if (this.friction) this.vel.mult(Math.pow(1 - this.friction, dt));
      this.vel.limit(this.maxSpeed);
      this.pos.add(this.vel.x * dt, this.vel.y * dt);
    }
    this.acc.set(0, 0);
    this.angle += this.spin * dt;
    if (this.life) this.updateLife(dt);
  }

  updateLife(dt=1) {
    const life = this.life;
    life.remaining = Math.max(0, life.remaining - dt);
    const ratio = life.remaining / life.total;
    if (life.shrink) this.size.set(this.original.size.x * ratio, this.original.size.y * ratio);
    if (life.fade) {
      // Stays fully opaque for the first half of its life, then fades linearly to 0
      const fade = Math.min(1, ratio * 2);
      this.color.fill.forEach((c, i) => c.setAlpha(this.alpha[i] * fade));
    }
  }

  /**
   * Keeps the shape inside the canvas. Pushes it back inside and points its velocity inward,
   * scaled by `bounce`. Pointing inward (instead of flipping) avoids getting stuck at the edge.
   */
  bounceEdges() {
    if (this.isStatic) return;
    const { width, height } = this.p;
    const hx = this.size.x / 2;
    const hy = this.size.y / 2;
    if (this.pos.x < hx) { this.pos.x = hx; this.vel.x = Math.abs(this.vel.x) * this.bounce; }
    else if (this.pos.x > width - hx) { this.pos.x = width - hx; this.vel.x = -Math.abs(this.vel.x) * this.bounce; }
    if (this.pos.y < hy) { this.pos.y = hy; this.vel.y = Math.abs(this.vel.y) * this.bounce; }
    else if (this.pos.y > height - hy) { this.pos.y = height - hy; this.vel.y = -Math.abs(this.vel.y) * this.bounce; }
  }

  /**
   * Moves the shape to the opposite edge when it leaves the canvas, like classic Asteroids.
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
   * Resolves a collision with `other`, treating both as circles. Returns true if they touched.
   *
   * 1. Separates them along the line between centers. Each moves in proportion to its inverse
   *    mass, so a light shape moves more than a heavy one and a static shape doesn't move.
   * 2. If they are moving toward each other, applies an impulse along that line. The impulse
   *    conserves momentum; `bounce` (the lower of the two) sets how much speed survives.
   */
  collide(other) {
    const invA = this.invMass;
    const invB = other.invMass;
    const invSum = invA + invB;
    const normal = other.pos.copy().sub(this.pos);
    const dist = normal.mag();
    const overlap = this.radius + other.radius - dist;
    if (overlap <= 0) return false;
    if (invSum === 0) return true;
    // Exactly on top of each other: there's no direction between them, so pick one
    if (dist === 0) normal.set(1, 0);
    else normal.div(dist);

    this.pos.sub(normal.x * overlap * invA / invSum, normal.y * overlap * invA / invSum);
    other.pos.add(normal.x * overlap * invB / invSum, normal.y * overlap * invB / invSum);

    // Closing speed along the normal; zero or negative means they're already moving apart
    const approach = this.vel.dot(normal) - other.vel.dot(normal);
    if (approach > 0) {
      const restitution = Math.min(this.bounce, other.bounce);
      const impulse = ((1 + restitution) * approach) / invSum;
      this.vel.sub(normal.x * impulse * invA, normal.y * impulse * invA);
      other.vel.add(normal.x * impulse * invB, normal.y * impulse * invB);
    }
    return true;
  }

  // Builds the radial gradient once and reuses it until the size or colors change (shrink/fade).
  // It's built around (0, 0) because draw() has already translated to the shape's center.
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
    // ctx.rotate always takes radians; p.rotate would follow the sketch's angleMode
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
 * Rectangle. Collides as a circle covering its longer side.
 * @param [o.corner=0] - corner radius in px
 */
class Rect extends Shape {
  constructor(scene, options) {
    super(scene, options);
    this.corner = options.corner ?? 0;
  }

  shape() {
    this.p.rectMode(this.p.CENTER);
    this.p.rect(0, 0, this.size.x, this.size.y, this.corner);
  }
}

/**
 * Triangle filling the size box, pointing in the direction of its angle (right at angle 0).
 * Rotating it toward vel.heading() makes it face where it's going.
 */
class Triangle extends Shape {
  shape() {
    const hx = this.size.x / 2;
    const hy = this.size.y / 2;
    this.p.triangle(-hx, -hy, -hx, hy, hx, 0);
  }
}

/**
 * Regular polygon fitted to the size box (stretched if size.x and size.y differ).
 * @param [o.sides=6]
 */
class Polygon extends Shape {
  constructor(scene, options) {
    super(scene, options);
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
 * A line segment. Mostly used for trails: call add(pos) each frame and the line follows,
 * with the previous end becoming the new start.
 * @param o.start o.end - {x, y}
 * @param [o.color=255] - any p5 color
 * @param [o.weight=1] - line width in px
 * @param [o.speed=1] - length of the vector returned by getDisplacement()
 */
class Line extends CanvasObject {
  constructor(scene, { start, end, color=255, weight=1, speed=1 }) {
    super(scene);
    this.start = toVector(this.p, start);
    this.end = toVector(this.p, end);
    this.color = this.p.color(color);
    this.weight = weight;
    this.speed = speed;
  }

  /**
   * Vector pointing from end back toward start, `speed` px long.
   */
  getDisplacement() {
    return this.start.copy().sub(this.end).setMag(this.speed);
  }

  /**
   * Extends the line forward to `pos`: the old end becomes the start.
   */
  add(pos) {
    this.start.set(this.end);
    this.end.set(pos.x, pos.y);
  }

  /**
   * The reverse of add(): the old start becomes the end, and `pos` becomes the start.
   */
  remove(pos) {
    this.end.set(this.start);
    this.start.set(pos.x, pos.y);
  }

  /**
   * Moves the end to the opposite edge when it leaves the canvas. The start jumps with it,
   * otherwise the next draw would streak a line across the whole canvas.
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
 * Moves shapes around a center point (or another shape, which they follow as it moves).
 * Children are updated and drawn by the orbit, so don't also add them to the scene.
 * Children ignore gravity and collisions; they still spin, shrink and fade.
 * @param o.center - {x, y} or a Shape
 * @param o.radius - distance from the center in px
 */
class Orbit extends CanvasObject {
  constructor(scene, { center, radius }) {
    super(scene);
    this.center = center;
    this.radius = radius;
    this.children = [];
  }

  /**
   * Adds a shape to the orbit and moves it into position. Returns the shape.
   * @param [o.angle=0] - starting position in radians (0 = right of center)
   * @param [o.speed=0.01] - radians per frame; negative goes counterclockwise
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

  update(dt=1) {
    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      child.shape.update(dt);
      if (child.shape.dead) {
        this.children.splice(i, 1);
        continue;
      }
      child.angle += child.speed * dt;
      this.place(child);
    }
  }

  draw() {
    for (const { shape } of this.children) shape.draw();
  }
}

/**
 * Pre-draws a round glow on its own small canvas: `color` solid out to half the radius, then fading to `clear`
 * at the edge. Stamp it with ctx.drawImage(sprite, x, y, w, h) to draw many glows cheaply: one gradient built
 * once instead of one per glow per frame. Under ctx.globalCompositeOperation = 'lighter', overlaps add up.
 * @param color - any CSS color
 * @param [clear] - the edge color, usually the background's color at alpha 0 so the fade doesn't go grey
 * @param [size=128] - sprite size in px; it is scaled when drawn, so only needs to look smooth at its largest
 */
const glowSprite = (color, clear='rgba(0, 0, 0, 0)', size=128) => {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext('2d');
  const r = size / 2;
  const gradient = ctx.createRadialGradient(r, r, r * 0.5, r, r, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, clear);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return sprite;
}

/**
 * A random smooth path for wander(): per axis, two sine waves of unrelated frequencies and random phases.
 * @param [random=Math.random] - a 0-1 random function, e.g. () => p.random() to follow p.randomSeed()
 */
const randomWanderPath = (random=Math.random) => {
  const axis = () => ({
    f1: 0.6 + random() * 0.4, f2: 1.3 + random() * 0.8,
    p1: random() * Math.PI * 2, p2: random() * Math.PI * 2
  });
  return { x: axis(), y: axis() };
}

/**
 * Position along one axis of a randomWanderPath() at `time`, always 0-1: multiply by the canvas width or height.
 * Slow and organic, never quite repeating, with a fixed range (p.noise's range is shared by every p5 instance,
 * so a noiseDetail() call in another sketch changes it). One loop takes roughly 2π / 0.8 ≈ 8 time units.
 */
const wander = (axis, time) => 0.5 + 0.3 * Math.sin(axis.f1 * time + axis.p1) + 0.2 * Math.sin(axis.f2 * time + axis.p2);

// Grid buffer reused between metaballPath() calls (they run one at a time).
let metaballGrid = new Float32Array(0);

/**
 * Adds the merged outline of circles (metaballs, "goo") to ctx's current path; fill it once afterwards, e.g.
 * with a gradient. Each circle adds (r² / d²)³ to a field sampled on a grid, and the outline is where the sum
 * reaches 1: a lone circle is its exact outline, and two bridge once their gap is under about a quarter of
 * their radius. Cells are traced with marching squares; runs of fully inside cells become one rect.
 * Much cheaper than an SVG blur + threshold filter over the whole canvas, and needs no filter support.
 * @param blobs - [{ pos: { x, y }, radius }]; Shapes work as they are
 * @param [o.cell] - grid step in px; smaller is smoother and slower. Defaults to 1/90 of the average side,
 *   between 4 and 14, so small canvases keep round edges
 * @param [o.reach=3] - a circle only adds to grid points within this many radii (beyond 3 it adds under 0.1%)
 */
const metaballPath = (ctx, blobs, width, height, { cell, reach=3 } = {}) => {
  const step = cell ?? Math.min(14, Math.max(4, Math.round((width + height) / 2 / 90)));
  const cols = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;
  if (metaballGrid.length < cols * rows) metaballGrid = new Float32Array(cols * rows);
  const values = metaballGrid;
  values.fill(0, 0, cols * rows);
  for (const blob of blobs) {
    const r2 = blob.radius * blob.radius;
    const far = blob.radius * reach;
    const i0 = Math.max(0, Math.floor((blob.pos.x - far) / step));
    const i1 = Math.min(cols - 1, Math.ceil((blob.pos.x + far) / step));
    const j0 = Math.max(0, Math.floor((blob.pos.y - far) / step));
    const j1 = Math.min(rows - 1, Math.ceil((blob.pos.y + far) / step));
    for (let j = j0; j <= j1; j++) {
      const dy = j * step - blob.pos.y;
      for (let i = i0; i <= i1; i++) {
        const dx = i * step - blob.pos.x;
        const ratio = r2 / (dx * dx + dy * dy || 1e-6);
        values[j * cols + i] += ratio * ratio * ratio;
      }
    }
  }
  // Where an edge crosses the outline. Interpolates sum^(1/6), which is r / d for a lone circle: nearly
  // linear across the edge, so the crossing lands where it should.
  const crossing = (sa, sb) => {
    const a = Math.sqrt(Math.cbrt(sa));
    const b = Math.sqrt(Math.cbrt(sb));
    return (1 - a) / (b - a);
  };
  const xs = [ 0, 0, 0, 0, 0, 0, 0, 0 ];
  const ys = [ 0, 0, 0, 0, 0, 0, 0, 0 ];
  for (let j = 0; j < rows - 1; j++) {
    const y = j * step;
    let run = -1; // first column of the current run of fully inside cells
    for (let i = 0; i < cols - 1; i++) {
      const x = i * step;
      // Corners clockwise: top-left, top-right, bottom-right, bottom-left.
      const s0 = values[j * cols + i];
      const s1 = values[j * cols + i + 1];
      const s2 = values[(j + 1) * cols + i + 1];
      const s3 = values[(j + 1) * cols + i];
      if (s0 >= 1 && s1 >= 1 && s2 >= 1 && s3 >= 1) { if (run < 0) run = i; continue; }
      if (run >= 0) { ctx.rect(run * step, y, (i - run) * step, step); run = -1; }
      if (s0 < 1 && s1 < 1 && s2 < 1 && s3 < 1) continue;
      const s = [ s0, s1, s2, s3 ];
      const cx = [ x, x + step, x + step, x ];
      const cy = [ y, y, y + step, y + step ];
      let n = 0;
      for (let k = 0; k < 4; k++) {
        const next = (k + 1) & 3;
        const inside = s[k] >= 1;
        if (inside) { xs[n] = cx[k]; ys[n] = cy[k]; n++; }
        if (inside !== (s[next] >= 1)) {
          const t = crossing(s[k], s[next]);
          xs[n] = cx[k] + (cx[next] - cx[k]) * t;
          ys[n] = cy[k] + (cy[next] - cy[k]) * t;
          n++;
        }
      }
      ctx.moveTo(xs[0], ys[0]);
      for (let k = 1; k < n; k++) ctx.lineTo(xs[k], ys[k]);
      ctx.closePath();
    }
    if (run >= 0) ctx.rect(run * step, y, (cols - 1 - run) * step, step);
  }
}

export {
  Scene, Flowfield, CanvasObject, Shape, Ellipse, Rect, Triangle, Polygon, Line, Orbit,
  createColor, linearGradient, radialGradient, randomPosition, canvasObserver,
  glowSprite, randomWanderPath, wander, metaballPath
}
