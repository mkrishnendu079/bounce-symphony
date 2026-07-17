# Double Bounce Symphony

Balls bounce between N concentric eroding circles. The outermost circle bounces balls off its inner surface; all other circles are rings that bounce off either surface.

## How to Run

```bash
python3 -m http.server 8766
```

Open `http://localhost:8766/`, click to start audio, and watch.

## Controls

- **Click** — start audio
- **R** — reset the scene

## How It Works

- **N concentric circles** — configurable from 1 to 100. Radii are linearly interpolated between `INNERMOST_RADIUS` and `OUTERMOST_RADIUS`.
- **Collision sides** — the outermost circle uses `'inside'` collision (balls bounce off the inner shell). Every other circle uses `'both'` collision (a ring — balls bounce off either shell).
- **Ball spawn** — balls start inside the innermost circle.
- **Erosion & escape** — each bounce erodes arc segments; once a gap is wide enough, balls pass through that circle.

## Configuration

All tunables live at the top of `sketch.js`:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `NUM_CIRCLES` | `10` | Number of concentric circle walls (1–100). |
| `OUTERMOST_RADIUS` | `660` | Radius of the outermost circle. |
| `INNERMOST_RADIUS` | `130` | Radius of the innermost circle; controls spacing between circles. |
| `NUM_BALLS` | `3` | Number of balls spawned on reset. |
| `INITIAL_SPEED_MIN` / `INITIAL_SPEED_MAX` | `4` / `4` | Random launch speed range. |
| `GRAVITY` | `0.03` | Downward acceleration per frame. |
| `RESTITUTION` | `0.97` | Wall bounciness. `1.0` = perfect bounce. |
| `ARC_SEGMENTS` | `360` | Resolution of each circle wall. |
| `EROSION_PER_HIT` | `2` | Segments eroded per bounce. |

## File Structure

- `index.html` — page shell, loads p5.js and `sketch.js`
- `sketch.js` — all logic, audio, and rendering

## License

Free to use and modify.
