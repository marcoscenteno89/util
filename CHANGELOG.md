# Changelog

All notable changes to this project. Versions follow [semantic versioning](https://semver.org/):
MAJOR for breaking changes, MINOR for new features, PATCH for fixes.

Install a specific version from GitHub:

```json
"@marccent/util": "github:marcoscenteno89/util#semver:^2.0.0"
```

## 2.0.0

### Breaking changes

**Canvas** (`@marccent/util/canvas`) was rewritten:
- `CanvasManager(p5, p, elem)` is now `Scene(p, elem, options)`. The `p5` argument is gone.
- Shapes take an options object: `new Ellipse(scene, { pos, size, vel, color })` instead of positional arguments. `mass` is now separate from `size`.
- `setColor()` is now `createColor(p, fill, { stroke, weight })`.
- `bounceOfBorder()` is now `bounceEdges()`, and `edges()` is now `wrapEdges()`. Neither moves the shape anymore; `update()` does.
- `applyForce()` only queues a force; call `scene.run()` (or `update()`) to move.
- `ranVector()` is now `randomPosition()`. `madeContactX/Y()` were removed; use `overlaps()`.
- `Rect` corner radius option is `corner`. `Polygon` takes `sides` in options.
- `attract()` now falls off with distance squared.
- Angles are always radians, regardless of `angleMode()`.
- Targets p5.js 1.x.

**Utilities** (`@marccent/util`):
- `get()` now sends its headers and settings, no longer forces `mode: 'no-cors'`, and resolves to `{ ok: false, error }` on failure instead of `undefined`. Replace `if (!data)` checks with `if (!data.ok)`.

**Color** (`@marccent/util/class`):
- `lighter` and `darker` can hold fewer than 5 colors, because repeated colors are skipped (e.g. `#fff` has no lighter variants).

**Limiter** (`@marccent/util/limiter`):
- Saves under `limiter_<id>` instead of `agile_<id>`, so existing saved limits reset once.
- `add()` returns uses left (or `false` when locked). Use `limiter.locked` instead of `limiter.disabled`. Internal helpers (`dataExists`, `setExpiration`, `disableTarget`, `currentlyDisabled`) were removed.

**Form styles** (`@marccent/util/css/form`):
- No longer imports Bootstrap. Pages that relied on it for other elements need to load it themselves.
- Theme variables moved from `:root` (`--primary`, `--dark`, ...) to `.step-form` (`--sf-primary`, `--sf-text`, ...).
- Removed unused classes: `.generic`, `.important`, `.msg`, `.flex-center`. `.warning` and `.success` only apply inside `.step-form`.
- Error messages use `class="alert"` instead of Bootstrap's `alert alert-danger`.

### Added
- `@marccent/util/time`: `MS`, `duration`, `formatDuration`, `timeAgo`, `formatDate`, `parseDate`, `Stopwatch`, `Timer`, `every`.
- Canvas: `Flowfield` class, `CanvasObject` base class, `life` with `shrink`/`fade`, `reset()`, gravity, `bounce`, `friction`, `isStatic`, `maxSpeed`, `timeScale`, auto resize, pause off screen, frame-rate independent motion, a working `Triangle`, and `Orbit` that can follow a moving shape.
- `Color` accepts hex (3/4/6/8 digits), `rgb()`, `hsl()`, `{ r, g, b }` objects, and named colors in the browser. Transparency is in `color.alpha`.
- `Limiter` unlocks automatically when time is up, and works when localStorage is blocked.

### Fixed
- Canvas: polygon and orbit angles, `colorLife` crash, gradient fill and position, `reset` snapshots, skipped objects when removing, out-of-bounds flowfield lookups, gradient stops and transparency, duplicate ids.
- `Limiter` locks as soon as the limit is reached, adds minutes, hours and days correctly, and shows a clean message.
- `Storage` treats corrupt entries or a missing expiry as expired instead of keeping them forever.
- `Form`: clicking during the loader no longer reads the wrong step.
- Form CSS: warning and success colors (typo'd variables), narrow-layout button spacing.

### Removed
- Unused `shapes.js` and `circle.css`.

## 1.0.0

Initial version: multi-step `Form`, canvas classes, `Color`, `Loader`, `Storage`, `Limiter`, and `get`/`post` helpers.
