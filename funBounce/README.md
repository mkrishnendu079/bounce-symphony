# Fun Bounce Symphony

Like doubleBounce, but selected circles are **extra bouncy** — bouncing off them gives the ball a speed boost. Extra-bouncy circles render as vivid green with a thicker stroke and stronger glow.

## How to Run

```bash
python3 -m http.server 8767
```

Open `http://localhost:8767/`, click to start audio, and watch.

## Controls

- **Click** — start audio
- **R** — reset the scene

## How It Works

- **N concentric circles** — same as doubleBounce (1–100, radii interpolated between innermost and outermost).
- **Extra-bouncy circles** — the circles whose 1-based index (counting from the innermost) appears in `EX_BOUNCE_CIRCLES` boost the ball's speed by `EX_BOUNCE_FACTOR` on each bounce. They are drawn in vivid green with a thicker stroke.
- **Circle numbering** — innermost = 1. `EX_BOUNCE_CIRCLES = '258'` means the 2nd, 5th, and 8th circles from the inside are extra bouncy.
- **Max speed cap** — raised to `INITIAL_SPEED_MAX * EX_BOUNCE_FACTOR * 3` so boosted balls don't fly out of control instantly.

## Configuration

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `NUM_CIRCLES` | `10` | Number of concentric circle walls (1–100). |
| `OUTERMOST_RADIUS` | `660` | Radius of the outermost circle. |
| `INNERMOST_RADIUS` | `130` | Radius of the innermost circle; controls spacing. |
| `NUM_BALLS` | `10` | Number of balls spawned on reset. |
| `INITIAL_SPEED_MIN` / `INITIAL_SPEED_MAX` | `4` / `4` | Random launch speed range. |
| `GRAVITY` | `0.03` | Downward acceleration per frame. |
| `RESTITUTION` | `0.97` | Wall bounciness. |
| `EX_BOUNCE_CIRCLES` | `'258'` | 1-based circle indices (from innermost), each digit = a circle. |
| `EX_BOUNCE_FACTOR` | `1.2` | Speed multiplier applied on bounce from extra-bouncy circles. |
| `ARC_SEGMENTS` | `360` | Resolution of each circle wall. |
| `EROSION_PER_HIT` | `2` | Segments eroded per bounce. |

## File Structure

- `index.html` — page shell, loads p5.js and `sketch.js`
- `sketch.js` — all logic, audio, and rendering

## License

Free to use and modify.
