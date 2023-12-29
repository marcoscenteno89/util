import Form from './form.js';
import Limiter from './limiter.js';
import Color from './color.js';
import { CanvasManager, Rect, Ellipse, Line, Triangle, Polygon, Orbit, linearGradient, setColor } from 'https://cdn.jsdelivr.net/gh/marcoscenteno89/canvas@main/canvas.js';
import '../css/form.css';
import '../css/canvas.css';
import '../css/global.css';
import p5 from 'p5';


let color = new Color('#fff');
console.log(color)

const limiterCallback = (form, val) => {
  // Limiter requires 2 parameters
  // 1. Element to disable
  // 2. Element to display current status
  let limiter = new Limiter(form.next, form.status);
  // Form submit button has been disabled
  if (limiter.disabled) return false; 
  return new Promise( async (resolve) => {
    limiter.add();
    console.log(val);
    resolve(true);
  });
}
const limiterForm = document.querySelector('#limiter');
const limiter = new Form(limiterForm, limiterCallback, false);



// Callback function will run when last step is submitted
const contactInfoFormCallback = (form, val) => {
  return new Promise( async (resolve) => {
    console.log(val);
    resolve(true);
  });
}

// Callback will run whenver a tab changes, (does not run when going back)
const contactInfoChangeTabCallback = (form, val) => {
  return new Promise( async (resolve) => {
    console.log(val);
    resolve(true);
  });
}

const contactInfoForm = document.querySelector('#contact-info');
const contactInfo = new Form(contactInfoForm, contactInfoFormCallback, contactInfoChangeTabCallback);

const node = document.querySelector('#network');
const fr = document.querySelector('#framerate');

let canvas;


// const sketch = new p5((p) => {
//   p.setup = () => {
//     canvas = new CanvasManager(p5, p, node);
//     let bg = setColor(p, [
//       `rgb(${parseInt(p.random(0, 255))}, ${parseInt(p.random(0, 255))}, ${parseInt(p.random(0, 255))})`,
//       `rgb(${parseInt(p.random(0, 255))}, ${parseInt(p.random(0, 255))}, ${parseInt(p.random(0, 255))})`
//     ]);
//     let start = p.createVector(0, p.height / 2);
//     let end = p.createVector(p.width, p.height /2);
//     canvas.background = linearGradient(canvas.ctx, p, start, end, bg.fill, true);
//     let color = setColor(p, ['#ffffff']);
//     let colorb = setColor(p, ['rgba(255,255,255,0.5)']);
//     let circleSize = p.width * 2;
//     let mass = p.createVector(circleSize, circleSize);
//     let vel = p.createVector(0, 0);
//     let pos = p.createVector(p.width / 2, (p.height / 2) - (circleSize / 2));
//     canvas.objects.push(
//       new Rect(canvas, pos, vel, false, mass, color, [0, 1], false, circleSize * 0.45)
//     );
//     canvas.objects.push(
//       new Rect(canvas, pos, vel, false, mass, colorb, [0, 1], false, circleSize * 0.4)
//     );
//   };
//   p.draw = () => {
//     p.clear();
//     canvas.bg();
//     for (let i of canvas.objects) {
//       i.rotate();
//     }
//   };
// });

// ADDING PHYSICS
// const sketch = new p5((p) => {
//   p.setup = () => {
//     canvas = new CanvasManager(p5, p, networkNode);
//     p.background(255);
//     for (let i = 0; i < 10; i++) {
//       let a = `rgb(${parseInt(p.random(0, 255))}, ${parseInt(p.random(0, 255))}, ${parseInt(p.random(0, 255))})`;
//       let color = setColor(p, [a]);
//       let width = p.random(20, 60);
//       let mass = p.createVector(width, width);
//       let pos = p.createVector(random(mass.x, p.width - mass.x), random(mass.y, p.height - mass.y));
//       let vel = p.createVector(p.random(-3, 3), p.random(-3, 3));
//       let acc = p.createVector(0, 0);
//       // Set unique location
//       while (canvas.overlaps({mass: mass, pos: pos}) === true) {
//         pos = p.createVector(random(mass.x, p.width - mass.x), random(mass.y, p.height - mass.y));
//       }
//       canvas.objects.push(new Rect(canvas, pos, vel, acc, mass, color, [0, 1]));
//     }
//   };
//   p.draw = () => {
//     let force = p.createVector(0, -0.1);
//     p.background(255);
//     canvas.bounceOfObject();
//     canvas.bounceOfBorder();
//     for (let item of canvas.objects) {
//       item.applyForce(force);
//       item.rotate(); // rotate() method cointains draw() method.
//     }
//   };
// });
// let image;
// const sketch = new p5((p) => {
//   p.preload = () => {
//     image = p.loadImage('src/js/cloud1.png');
//   }
//   p.setup = () => {
//     canvas = new CanvasManager(p5, p, node);
//     let start = p.createVector(p.width / 2, 0)
//     let end = p.createVector(p.width / 2, p.height);
//     let color = setColor(p, ['rgb(65,150,253)', 'rgb(126,182,250)', 'rgb(178,211,250)']);
//     canvas.background = linearGradient(canvas.ctx, p, start, end, color.fill);
//     canvas.bg();
//     p.image(image, 500,300);
//     // let yo = 0;
//     // let count = 0;
//     // for (let x = 100; x < 300; x++) {
//     //   let xo = 0;
//     //   for (let y = 100; y < 300; y++) {
//     //     let angle = p.noise(xo, yo) * p.TAU - p.cos(x / y) * 4;
//     //     let v = p5.Vector.fromAngle(angle);
//     //     let n = p.noise(xo, yo) * 255;
//     //     p.push();
//     //     p.translate(x + p.cos(y * 0.05) * 20, y);
//     //     p.rotate(v.heading());
//     //     p.strokeWeight(angle * 0.4);
//     //     p.stroke(n * 2, (n * 0.05) - (y * 0.01));
//     //     p.line(0, 0, 20, 0);
//     //     p.pop();
//     //     xo += 0.2;
//     //     count++;
//     //   }
//     //   yo += 0.02;
//     // }
//     // console.log(count)
//   };
//   p.draw = () => {
    
//   };
// });
// let mass;
// let num = 2;
// const sketch = new p5((p) => {
//   p.setup = () => {
//     canvas = new CanvasManager(p5, p, node);
//     let bg = setColor(p, [`#2ee7ff`, `#0249b8`]);
//     canvas.background = linearGradient(
//       canvas.ctx, p, p.createVector(p.width, p.height), canvas.center, bg.fill, true
//     );
//     canvas.setFlowfield(p.floor(p.width * 0.1), 0.1, 2);
//     p.noiseDetail(1);
//     canvas.ctx.globalCompositeOperation = "screen";
//     p.blendMode(p.ADD)
//     mass = p.createVector(2, 2);
//     for (let i = 0; i < 100; i++) {
//       let pos = p.createVector(p.random(mass.x, p.width - mass.x), p.random(mass.y, p.height - mass.y));
//       canvas.objects.push(new Ellipse(canvas, pos, false, false, mass, setColor(p, ['white'])));
//     }
//   };
//   p.draw = () => {
//     p.clear();
//     p.background(0)
//     canvas.applyGradient();
//     canvas.updateFlowfield();
//     // canvas.drawFlowfield();
//     for (let i = 0; i < num; i++) {
//       let pos = p.createVector(p.random(mass.x, p.width - mass.x), p.random(mass.y, p.height - mass.y));
//       canvas.objects.push(new Ellipse(canvas, pos, false, false, mass, setColor(p, ['white'])));
//     }
//     for (let i of canvas.objects) {
//       let zone = canvas.getFieldZone(i.pos);
//       i.applyForce(zone.vel, 3);
//       i.edges();
//       i.draw();
//     }  
//     if (canvas.objects.length > 2500) canvas.objects.splice(0, num);
//     fr.innerHTML = p.floor(p.frameRate());
//   };
// });

// import('https://cdn.jsdelivr.net/gh/marcoscenteno89/canvas@main/canvas.js').then(i => {
  const sketch = new p5((p) => {
    p.setup = () => {
      canvas = new CanvasManager(p5, p, node);
      let color = setColor(p, ['#2ee7ff'], '#2ee7ff');
      for (let i = 0; i < 20; i++) {
        let mass = p.createVector(1, 1);
        let pos = p.createVector(p.random(10, p.width - 10), p.random(10, p.height - 10));
        let vel = p.createVector(p.random(-1), p.random(1));
        canvas.objects.push(new Ellipse(canvas, pos, vel, false, mass, color));
      }
    };
    p.draw = () => {
      let limit = p.width / 3;
      p.background(0);
      for (let outer of canvas.objects) {
        outer.bounceOfBorder();
        let linesConnected = 0;
        for (let inner of canvas.objects) {
          if (outer !== inner) {
            let dist = p5.Vector.dist(outer.pos, inner.pos);
            if (dist < limit && dist > 1 ) {
              linesConnected++;
              let alpha = p.map(dist, limit, 0, 0, 1);
              outer.color.fill[0].setAlpha(p.map(alpha, 0, 1, 0, 255))
              outer.color.weight = alpha;
              new Line(canvas, outer.pos, inner.pos, false, outer.color);
            }
          }
          let newMass = p.map(linesConnected, 0, canvas.objects.length, 0, 7);
          outer.mass.set(p.createVector(newMass, newMass));
          outer.draw();
        }
      }
    };
  });
// }).catch(error => console.log(error));


// const sketch = new p5((p) => {
//   p.setup = () => {
//     canvas = new CanvasManager(p5, p, node);
//     let w = 5;
//     let color = setColor(p, [`rgba(255, 255, 255, 0.${p.random(1,9).toFixed(0)})`]);
//     color.stroke = `rgba(255, 255, 255, 0.${p.random(1,9).toFixed(0)})`;
//     for (let i = 0; i < 200; i++) {
//       let end = p.createVector(
//         p.random(canvas.center.x - w, canvas.center.x + w), 
//         p.random(canvas.center.y - w, canvas.center.y + w)
//       );
//       let start = p.createVector(canvas.center.x, canvas.center.y);
//       let vel = p.random(6, 15);
//       canvas.objects.push(new Line(canvas, start, end, vel, color, p.random(0.2, 3)));
//     }
//   };
//   p.draw = () => {
//     p.background(0);
//     for (let i of canvas.objects) {
//       let displacement = i.getDisplacement();
//       let lengthFromCenter = p.dist(i.original.start.x, i.original.start.y, i.end.x, i.end.y);
//       let length = p.dist(i.start.x, i.start.y, i.end.x, i.end.y);
//       if (length > canvas.center.x) i.start.sub(displacement);
//       if (lengthFromCenter > canvas.center.x) {
//         i.start.set(i.original.start.x, i.original.start.y);
//         i.end.set(i.original.end.x, i.original.end.y);
//       }
//       i.end.sub(displacement);
//       i.draw();
//     }
//   };
// });

// let count = 0;
// const sketch = new p5((p) => {
//   p.setup = () => {
//     canvas = new CanvasManager(p5, p, node);
//     canvas.setFlowfield(p.floor(p.width * 0.1), 0.1, 2);
//     p.noiseDetail(1);
//     canvas.ctx.globalCompositeOperation = "screen";
//     p.blendMode(p.ADD)
//     let color = setColor(p, ['white'], 'white')
//     for (let i = 0; i < 1; i++) {
//       let start = p.createVector(0, 0);
//       let end = p.createVector(p.random(0, 100), p.random(0, 100));
//       canvas.objects.push(new Line(canvas, start, end, false, color));
//     }
//     console.log(canvas.objects)
//   };
//   p.draw = () => {
//     p.clear();
//     p.background(0)
//     canvas.applyGradient();
//     canvas.updateFlowfield();
//     // canvas.drawFlowfield();
//     for (let i of canvas.objects) {
//       let noise = p.noise(i.start.x, i.end.x, count);
//       // console.log(noise)
//       // let x = p.map(noise, 0, 1, 1, 10);
//       // let y = p.map(noise, 0, 1, 1, 10);
//       let ran = p.random(1, 10);
//       let vec = p.createVector(i.end.x + noise, i.end.y + noise);
//       console.log(p.floor(vec.x), p.floor(vec.y))
//       i.add(vec);
//       i.draw();
//     }

//     fr.innerHTML = p.floor(p.frameRate());
//   };
// });