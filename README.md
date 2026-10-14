## Utility README

### This project contains a list of utility classes

#### Multi-step web form class
#### List of classes to interact with HTML5 canvas
#### Loader class
#### Limiter class (disables certain element after event hits a limit)
#### Time utilities (durations, dates, stopwatch, countdown timer)



### Canvas utility (p5.js 1.x)

Helpers for p5.js in instance mode. Angles are always radians, whatever `angleMode()` the sketch uses.

#### Scene
Creates a canvas that fills a container element, follows its size, and pauses the draw loop while off screen. Motion is scaled by real frame time, so it runs at the same speed at 30, 60 or 120 Hz; speeds are in px per frame at 60 fps. It owns a list of objects and runs them each frame: `update()` (forces, movement, life, collisions, removing dead objects) then `draw()`.

``` js
import { Scene, Ellipse, Rect, Polygon, Orbit, createColor } from '@marccent/util/canvas';

new p5(p => {
  let scene;
  p.setup = () => {
    scene = new Scene(p, document.querySelector('#canvas'), {
      background: 20,             // color, CanvasGradient, or null to leave trails
      collisions: true,           // shapes bounce off each other
      gravity: { x: 0, y: 0.2 },  // optional, applied to every moving shape
      timeScale: 1                // 0.5 = slow motion, 2 = double speed
    });

    // Optional flowfield (Perlin noise vectors)
    scene.setFlowfield({ cellSize: 20, step: 0.1, speed: 0.005, visible: true });

    scene.add(new Ellipse(scene, {
      pos: { x: 100, y: 100 },
      size: 40,                                   // number or { x, y }
      vel: { x: 2, y: 1 },
      color: createColor(p, ['#fff', '#01a3b0'], { stroke: '#fff' })  // 2+ colors = radial gradient
    }));
    scene.add(new Rect(scene, { pos: scene.center, size: { x: 80, y: 40 }, corner: 8, color: '#f4748f', spin: 0.02 }));
  };

  p.draw = () => {
    for (const shape of scene.objects) {
      shape.applyForce?.(scene.flowfield.lookup(shape.pos).vel);  // forces only accumulate
      shape.bounceEdges?.();                                   // or wrapEdges()
    }
    scene.run();  // update() + draw()
  };
});
```

#### Shapes
`Ellipse`, `Rect`, `Triangle` and `Polygon` extend `Shape`. All take `(scene, options)`:

| Option | Default | |
|---|---|---|
| `pos` | required | `{ x, y }` |
| `size` | required | number or `{ x, y }` |
| `vel`, `acc` | `{ x: 0, y: 0 }` | |
| `mass` | `size.x` | used by forces and collisions |
| `isStatic` | `false` | never moves; other shapes bounce off it (walls, floors) |
| `bounce` | `1` | 0-1, how much speed is kept on impact |
| `friction` | `0` | 0-1, fraction of velocity lost per frame |
| `color` | `'#fff'` | `createColor()` style, a p5 color, or an array of colors |
| `angle`, `spin` | `0` | rotation and rotation per frame, radians |
| `maxSpeed` | `Infinity` | |
| `life` | `null` | frames until removed; add `shrink: true` / `fade: true` to animate |
| `corner` | `0` | `Rect` only, corner radius |
| `sides` | `6` | `Polygon` only |

Methods: `applyForce(force)`, `attract(other, G, softening)`, `update(dt, gravity)`, `draw()`, `bounceEdges()`, `wrapEdges()`, `collide(other)`, `overlaps(other)`, `reset()`.

Collisions treat every shape as a circle covering its longer side.

For a custom shape, extend `Shape` and implement `shape()`, drawing centered at `(0, 0)`.

#### Orbit
Moves shapes in a circle around a point or another shape. Orbit children are updated and drawn by the orbit, so don't also add them to the scene.

``` js
const sun = scene.add(new Ellipse(scene, { pos: scene.center, size: 30 }));
const orbit = scene.add(new Orbit(scene, { center: sun, radius: 60 }));
orbit.add(new Ellipse(scene, { pos: { x: 0, y: 0 }, size: 10 }), { angle: 0, speed: 0.03 });
```

#### Other exports
`Line`, `Flowfield`, `CanvasObject` (base class), `createColor`, `linearGradient`, `radialGradient`, `randomPosition`, `canvasObserver`.

### Time utilities

Built on the browser's `Intl` APIs: no dependencies, and text follows the visitor's language unless you pass a `locale`.

``` js
import { MS, duration, formatDuration, timeAgo, formatDate, parseDate, Stopwatch, Timer, every } from '@marccent/util/time';

// Constants and splitting
MS.DAY                                          // 86400000
duration(93784005)                              // { days: 1, hours: 2, minutes: 3, seconds: 4, milliseconds: 5, negative: false }

// Durations as text
formatDuration(93784005)                        // "1 day, 2 hours, 3 minutes, and 4 seconds"
formatDuration(93784005, { smallest: 'minute' }) // "1 day, 2 hours, and 3 minutes"
formatDuration(93784005, { style: 'short' })    // "1d 2h 3m 4s"
formatDuration(65420, { style: 'clock', fraction: 2 }) // "00:01:05.42"

// Relative time
timeAgo(Date.now() - 5 * MS.MINUTE)             // "5 minutes ago"
timeAgo(Date.now() + 2 * MS.HOUR)               // "in 2 hours"

// Dates
formatDate(new Date(), 'weekday')               // "Wed, Oct 14, 3:05 PM"  (also 'date', 'long', 'time', 'clock', 'datetime', 'iso')
formatDate(new Date(), 'time', { timeZone: 'America/Denver' })
parseDate('2026-10-14')                         // local midnight (plain JS would give UTC, often the day before)
parseDate('2026-10-14 21:00:00', { utc: true }) // API strings without a zone, e.g. OpenWeather dt_txt
parseDate(1792008000)                           // epoch seconds or milliseconds

// Stopwatch: accurate in background tabs, pause/resume, laps
const sw = new Stopwatch().start();
sw.lap();                                       // { total, split }
sw.stop();
sw.toString();                                  // "00:01:05.42"

// Countdown timer: works past setTimeout's 24.8 day limit, survives reloads via JSON
const timer = new Timer(10 * MS.MINUTE, () => console.log('done'));
timer.toString({ smallest: 'minute' });         // "10 minutes"
localStorage.setItem('t', JSON.stringify(timer)); // later: Timer.from(JSON.parse(localStorage.getItem('t')), onEnd)

// Ticks lined up with the clock; returns a stop function
const stop = every(MS.SECOND, now => render(now), { immediate: true });
```

### Multi-step form

##### Form class will generate a multi-step form. If no multi-step needed, simply run a form with one tab.
##### The class takes 3 parameters, 
1. Form element (required)
  - Form must contain these html elements
  ``` html
  <div class="steps"></div>
  <div class="tab" data-name="Tab 1"></div>
  <div class="status"></div>
  <div class="controller"></div>
  ```
  - input elements must go inside the .tab element & form will only recognize input fields with the class .form-input, .next button is required, prev is only required if multiple tabs. User can also add custom buttons or links in the controller area, they must have the .btn class. 


``` html
<form action="sales-entry" class="step-form" id="contact-info">
  <div class="steps"></div>
  <div class="tab" data-name="Tab 1">
    <input type="text" class="form-input" name="field_1" placeholder="Field #1">
  </div>
  <div class="tab" data-name="Tab 2">
    <input type="text" class="form-input" name="field_2" placeholder="Field #2">
  </div>
  <div class="tab" data-name="Tab 3">
    <input required type="text" class="form-input" name="field_3" placeholder="Field #3">
  </div>
  <div class="status"></div>
  <div class="controller">
    <!-- Insert your custom buttons or links here -->
    <button name="prev" type="button" class="btn">Go Back</button>
    <a href="https://google.com" class="btn">Custom button</a>
    <button name="next" type="button" class="btn">Check Now</button>
  </div>
</form>
```
2. Tab change callback function (optional)
  If callback is not passed, form will pass values to value object and move on to next tab.
``` js
// Callback will run whenver a tab changes, (does not run when going back)
const contactInfoChangeTabCallback = (form, val) => {
  return new Promise( async (resolve) => {
    console.log(val);
    resolve(true);
  });
}
```
3. Form submition callback function (optional)
  If callback is not passed, form will default to form action, if the action is a different url, user must use a protocol (https & http).
``` js
// Callback function will run when last step is submitted
const contactInfoFormCallback = (form, val) => {
  return new Promise( async (resolve) => {
    console.log(val);
    resolve(true);
  });
}
```
