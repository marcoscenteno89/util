const toRgba = (c) => `rgba(${c.levels[0]}, ${c.levels[1]}, ${c.levels[2]}, ${c.levels[3]})`;
const toHex = (...rgb) => `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;

/**
 * Calls p5 `loop()` while `node` is in the viewport and `noLoop()` when it leaves.
 */
const canvasObserver = (obj, node) => {
  new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? obj.loop() : obj.noLoop());
  }).observe(node);
}

/**
 * Builds a color config `{ fill: p5.Color[], stroke, weight }`. Each fill color gets a `hex` property.
 */
const setColor = (p, colorList, stroke=false, weight=1) => {
  const fill = colorList.map(color => {
    const colorObj = p.color(color);
    colorObj.hex = toHex(...colorObj.levels.slice(0, 3));
    return colorObj;
  });
  return { fill, stroke: stroke ? p.color(stroke) : false, weight };
}

const linearGradient = (ctx, p, start, end, colorList) => {
  try {
    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    colorList.forEach((item, i) => {
      gradient.addColorStop(parseFloat(p.map(i, 0, colorList.length - 1, 0, 1)), toRgba(item));
    });
    return gradient;
  } catch (error) {
    console.log(colorList, 'start', start, 'end', end);
    console.log(error);
  }
}

// `p` is unused; kept so the signature matches linearGradient.
const radialGradient = (ctx, p, mass, pos, colorList) => {
  try {
    const radius = mass.x / 2;
    const gradient = ctx.createRadialGradient(pos.x, pos.y, radius / 2, pos.x, pos.y, radius);
    colorList.forEach((item, i) => {
      gradient.addColorStop(parseFloat((i / colorList.length).toFixed(1)), toRgba(item));
    });
    return gradient;
  } catch (error) {
    console.log(colorList, 'pos', pos, 'mass', mass);
    console.log(error);
  }
}

/**
 * Random vector inside the canvas, keeping `size` px away from the edges.
 */
const ranVector = (canvas, size) => {
  const { p } = canvas;
  return p.createVector(p.random(size, p.width - size), p.random(size, p.height - size));
}

class CanvasManager {
  constructor(p5, p, elem) {
    this.canvas = p.createCanvas(elem.offsetWidth, elem.offsetHeight, elem);
    this.p5 = p5;
    this.p = p;
    this.center = p.createVector(p.width / 2, p.height / 2);
    this.avg = parseInt((p.width + p.height) / 2);
    this.ctx = this.canvas.drawingContext;
    this.flowfield = {};
    this.objects = [];
  }

  getFieldZone(pos) {
    const x = this.p.floor(pos.x / this.flowfield.width);
    const y = this.p.floor(pos.y / this.flowfield.width);
    return this.flowfield.field[x][y];
  }

  /**
   * Points each flowfield cell along Perlin noise.
   */
  updateFlowfield() {
    this.p.angleMode(this.p.RADIANS);
    let yoff = 0;
    for (const col of this.flowfield.field) {
      let xoff = 0;
      for (const cell of col) {
        const angle = this.p.noise(xoff, yoff, this.flowfield.offset) * this.p.TWO_PI * 4;
        cell.vel.set(this.p5.Vector.fromAngle(angle).setMag(1));
        xoff += this.flowfield.multiplier;
      }
      yoff += this.flowfield.multiplier;
      this.flowfield.offset += 0.0001;
    }
  }

  drawFlowfield() {
    this.p.stroke(255);
    for (const col of this.flowfield.field) {
      for (const cell of col) {
        this.p.push();
        this.p.translate(cell.pos.x, cell.pos.y);
        this.p.rotate(cell.vel.heading());
        this.p.line(0, 0, this.flowfield.width / 2, 0);
        this.p.pop();
      }
    }
  }

  /**
   * Creates a grid of `num` px cells.
   * @param num - cell size in px
   * @param offset - starting noise z-offset
   * @param multiplier - noise step between cells
   */
  setFlowfield(num, offset, multiplier) {
    Object.assign(this.flowfield, { width: num, offset, multiplier, field: [] });
    for (let x = 0; x < this.p.width / num; x++) {
      const col = [];
      for (let y = 0; y < this.p.height / num; y++) {
        const mass = this.p.createVector(num, num);
        const pos = this.p.createVector(x * num + num / 2, y * num + num / 2);
        col.push(new Rect(this, pos, false, false, mass, setColor(this.p, ['pink'])));
      }
      this.flowfield.field.push(col);
    }
  }

  bg() {
    this.p.rectMode(this.p.CORNER);
    this.ctx.fillStyle = this.background;
    this.p.rect(0, 0, this.p.width, this.p.height);
    this.p.rectMode(this.p.CENTER);
  }

  applyGradient() {
    this.ctx.fillStyle = this.background;
  }

  bounceOfBorder() {
    for (const obj of this.objects) obj.bounceOfBorder();
  }

  overlaps(obj) {
    return this.objects.some(i => i.madeContact(obj));
  }

  /**
   * Resolves collisions between every pair of objects.
   */
  bounceOfObject() {
    for (let i = 0; i < this.objects.length; i++) {
      for (let e = i + 1; e < this.objects.length; e++) {
        this.objects[i].collide(this.objects[e]);
      }
    }
  }
}

/**
 * Base class for canvas objects. Does not draw; subclasses implement `draw(pos)`.
 * @param angle - [initialAngle, angularVelocity?]
 * @param life - frames until the object is removed (false = immortal)
 */
class Shape {
  constructor(canvas, pos, vel=false, acc=false, mass, color=false, angle=[0], life=false) {
    this.p5 = canvas.p5;
    this.canvas = canvas.canvas;
    this.p = canvas.p;
    this.objects = canvas.objects;
    this.ctx = canvas.ctx;
    this.id = this.objects.length + 1;
    this.pos = pos;
    this.mass = mass;
    this.vel = vel || this.p.createVector(0, 0);
    this.acc = acc || this.p.createVector(0, 0);
    this.color = color;
    this.original = {
      pos: { ...pos },
      mass: { ...mass },
      vel: { ...vel },
      acc: { ...acc },
      color: { ...color }
    };
    this.init(angle, life);
    this.setColor(this.color);
  }

  init(angle, life) {
    this.angle = { angle: angle[0], vel: angle[1] ?? 0 };
    this.original.angle = { ...this.angle };

    if (life) {
      const unit = this.mass.x - this.p.map(life - 1, 0, life, 0, this.mass.x);
      this.life = { time: life, unit, vector: this.p.createVector(unit, unit) };
      this.original.life = { ...this.life };
    }
  }

  sizeLife() {
    if (this.life.time > 0) this.mass.sub(this.life.vector);
  }

  colorLife() {
    if (this.life.time > 0) {
      const alpha = this.p.map(this.life.time, 0, this.original.life.time / 2, 0, 255);
      this.color.setAlpha(parseInt(alpha));
    }
  }

  updateLife(index) {
    if (this.life.time > 0) {
      this.life.time--;
    } else {
      this.objects.splice(index, 1);
    }
  }

  applyForce(force, speedLimit) {
    this.acc.add(this.p5.Vector.div(force, this.mass.x));
    this.vel.add(this.acc);
    this.vel.limit(speedLimit);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
  }

  attract(mover) {
    const force = this.p5.Vector.sub(this.pos, mover.pos);
    const distanceSq = this.p.constrain(force.magSq(), 100, 1000);
    const G = 1;
    force.setMag((G * this.mass.x * mover.mass.x) / distanceSq);
    mover.applyForce(force);
  }

  bounceOfBorder() {
    const halfX = this.mass.x / 2;
    const halfY = this.mass.y / 2;
    const x = this.pos.x + this.vel.x;
    const y = this.pos.y + this.vel.y;

    if (y < halfY)                       this.vel.y = -this.vel.y;   // Top
    if (x > this.canvas.width - halfX)   this.vel.x = -this.vel.x;   // Right
    if (y > this.canvas.height - halfY)  this.vel.y = -this.vel.y;   // Bottom
    if (x < halfX)                       this.vel.x = -this.vel.x;   // Left

    this.pos.add(this.vel);
  }

  /**
   * Wraps the object to the opposite side when it leaves the canvas.
   */
  edges() {
    const halfX = this.mass.x / 2;
    const halfY = this.mass.y / 2;

    if (this.pos.x > this.p.width - halfX) this.pos.x = halfX;
    if (this.pos.x < halfX) this.pos.x = this.p.width - halfX;
    if (this.pos.y > this.p.height - halfY) this.pos.y = halfY;
    if (this.pos.y < halfY) this.pos.y = this.p.height - halfY;
  }

  /**
   * Separates overlapping objects and exchanges velocity along the collision normal.
   */
  collide(other) {
    const relative = this.p5.Vector.sub(other.pos, this.pos);
    const dist = relative.mag() - (this.mass.x / 2 + other.mass.x / 2);
    if (dist < 0) {
      const movement = relative.copy().setMag(this.p.abs(dist / 2));
      this.pos.sub(movement);
      other.pos.add(movement);
      const normal = relative.copy().normalize();
      const approachSpeed = this.vel.dot(normal) - other.vel.dot(normal);
      const approachVector = normal.copy().setMag(approachSpeed);
      this.vel.sub(approachVector);
      other.vel.add(approachVector);
    }
  }

  madeContactX(obj) {
    return this.p5.Vector.dist(this.pos, obj.pos) <= this.mass.x / 2 + obj.mass.y / 2;
  }

  madeContactY(obj) {
    return this.p5.Vector.dist(this.pos, obj.pos) <= this.mass.y / 2 + obj.mass.y / 2;
  }

  madeContact(obj) {
    const distance = this.p5.Vector.dist(this.pos, obj.pos);
    return distance <= this.mass.x / 2 + obj.mass.x / 2
        || distance <= this.mass.y / 2 + obj.mass.y / 2;
  }

  /**
   * Applies stroke/fill from a `setColor()` config. Multiple fills render as a radial gradient.
   */
  setColor(color) {
    if (!color) {
      this.p.noStroke();
      return false;
    }
    if (color.stroke) {
      this.p.strokeWeight(color.weight);
      this.p.stroke(color.stroke);
    } else {
      this.p.noStroke();
    }

    if (color.fill.length > 1) {
      this.ctx.fillStyle = radialGradient(this.ctx, this.p, this.mass, this.pos, color.fill);
      this.ctx.fill();
    } else if (color.fill.length === 1) {
      this.p.fill(color.fill[0]);
    } else {
      this.p.noFill();
    }
  }

  /**
   * Rotates by `angle` (defaults to angular velocity) and draws at the origin of the rotated frame.
   */
  rotate(angle=false) {
    this.angle.angle += angle || this.angle.vel;
    this.p.push();
    this.p.translate(this.pos.x, this.pos.y);
    this.p.rotate(this.angle.angle);
    this.draw(this.p.createVector(0, 0));
    this.p.pop();
  }
}

class Ellipse extends Shape {
  constructor(canvas, pos, vel, acc, mass, color, angle, life) {
    super(canvas, pos, vel, acc, mass, color, angle, life);
    this.p.ellipseMode(this.p.CENTER);
  }

  draw(pos=false) {
    this.setColor(this.color);
    const { x, y } = pos || this.pos;
    this.p.ellipse(x, y, this.mass.x, this.mass.y);
  }
}

class Rect extends Shape {
  constructor(canvas, pos, vel, acc, mass, color, angle, life, radius=0) {
    super(canvas, pos, vel, acc, mass, color, angle, life);
    this.radius = radius;
    this.p.rectMode(this.p.CENTER);
  }

  draw(pos=false) {
    this.setColor(this.color);
    const { x, y } = pos || this.pos;
    this.p.rect(x, y, this.mass.x, this.mass.y, this.radius);
  }
}

// TO-DO draw() not implemented
class Triangle extends Shape {
  draw() {
    this.setColor(this.color);
  }
}

class Polygon extends Shape {
  constructor(canvas, pos, vel, acc, mass, color, angle, life, sides) {
    super(canvas, pos, vel, acc, mass, color, angle, life);
    this.sides = sides;
  }

  draw(pos=false) {
    this.setColor(this.color);
    const { x, y } = pos || this.pos;
    const radius = this.mass.x / 2;
    const angle = 360 / this.sides;
    this.p.beginShape();
    for (let i = 0; i < this.sides; i++) {
      this.p.vertex(x + radius * this.p.cos(angle * i), y + radius * this.p.sin(angle * i));
    }
    this.p.endShape(this.p.CLOSE);
  }
}

class Line {
  constructor(canvas, start, end, vel=false, color=false) {
    this.p5 = canvas.p5;
    this.canvas = canvas.canvas;
    this.p = canvas.p;
    this.objects = canvas.objects;
    this.id = this.objects.length + 1;
    this.start = start;
    this.end = end;
    this.vel = vel || this.p.createVector(0, 0);
    this.color = color;
    this.original = {
      start: { ...start },
      end: { ...end },
      vel: { ...vel },
      color: { ...color }
    };
    this.draw();
  }

  getDisplacement() {
    return this.p5.Vector.sub(this.start, this.end).normalize().mult(this.vel);
  }

  setColor(color) {
    if (!color) return false;
    if (color.stroke) {
      this.p.strokeWeight(color.weight);
      this.p.stroke(color.stroke);
    } else {
      this.p.noStroke();
    }
  }

  updatePrev() {
    this.start.x = this.end.x;
    this.start.y = this.end.y;
  }

  /**
   * Wraps the end point to the opposite side when it leaves the canvas.
   */
  edges() {
    const { width, height } = this.p;
    if (this.end.x > width) { this.end.x = 0; this.updatePrev(); }
    if (this.end.x < 0) { this.end.x = width; this.updatePrev(); }
    if (this.end.y > height) { this.end.y = 0; this.updatePrev(); }
    if (this.end.y < 0) { this.end.y = height; this.updatePrev(); }
  }

  add(pos) {
    this.start.set(this.end);
    this.end.set(pos);
  }

  remove(pos) {
    this.end.set(this.start);
    this.start.set(pos);
  }

  draw() {
    this.setColor(this.color);
    this.p.line(this.start.x, this.start.y, this.end.x, this.end.y);
  }
}

/**
 * Rotates `children` around `orbit.pos` at radius `orbit.mass.x / 2`.
 */
class Orbit {
  constructor(canvas, orbit) {
    this.p5 = canvas.p5;
    this.canvas = canvas.canvas;
    this.p = canvas.p;
    this.orbit = orbit;
    this.objects = canvas.objects;
    this.id = this.objects.length + 1;
    this.children = [];
  }

  rotate() {
    const r = this.orbit.mass.x / 2;
    this.p.push();
    this.p.translate(this.orbit.pos.x, this.orbit.pos.y);
    for (const child of this.children) {
      child.pos.x = r * this.p.cos(child.angle.angle);
      child.pos.y = r * this.p.sin(child.angle.angle);
      child.draw();
      child.angle.angle += child.angle.vel;
    }
    this.p.pop();
  }
}

export {
  Ellipse, Rect, Line, canvasObserver, CanvasManager,
  Triangle, Polygon, Orbit, radialGradient, linearGradient,
  setColor, ranVector
}
