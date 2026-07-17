# Fun Bounce 2 Symphony

Like funBounce, plus a **ball-to-ball bounce countdown**. Each ball carries a number (shown in black). Every time two balls collide, both counters decrement by 1. When a ball's counter reaches 0, it disappears with a loud pop sound.

## How to Run

```bash
python3 -m http.server 8768
```

Open `http://localhost:8768/`, click to start audio, and watch.

## Controls

- **Click** — start audio
- **R** — reset the scene

## How It Works

- **N concentric circles** with extra-bouncy circles — same as funBounce.
- **Bounce countdown** — each ball starts with `NO_OF_BOUNCES` remaining, displayed as a bold black number on the ball.
- **Ball-to-ball collisions** — on collision, both balls' counters decrement by 1.
- **Pop on zero** — when a counter hits 0, the ball disappears and `AudioEngine.playPop()` fires a single loud descending sine pop (800 Hz → 80 Hz over 0.25 s, gain `2.4`).

## Configuration

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `NUM_CIRCLES` | `10` | Number of concentric circle walls (1–100). |
| `OUTERMOST_RADIUS` | `660` | Radius of the outermost circle. |
| `INNERMOST_RADIUS` | `130` | Radius of the innermost circle; controls spacing. |
| `NUM_BALLS` | `7` | Number of balls spawned on reset. |
| `INITIAL_SPEED_MIN` / `INITIAL_SPEED_MAX` | `4` / `4` | Random launch speed range. |
| `GRAVITY` | `0.03` | Downward acceleration per frame. |
| `RESTITUTION` | `0.97` | Wall bounciness. |
| `EX_BOUNCE_CIRCLES` | `'258'` | 1-based circle indices (from innermost) that are extra bouncy. |
| `EX_BOUNCE_FACTOR` | `1.1` | Speed multiplier on bounce from extra-bouncy circles. |
| `NO_OF_BOUNCES` | `20` | Starting bounce counter for each ball; ball pops and disappears at 0. |
| `ARC_SEGMENTS` | `360` | Resolution of each circle wall. |
| `EROSION_PER_HIT` | `2` | Segments eroded per bounce. |

## File Structure

- `index.html` — page shell, loads p5.js and `sketch.js`
- `sketch.js` — all logic, audio, and rendering

## License

Free to use and modify.
