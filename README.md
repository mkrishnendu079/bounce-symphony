# Bounce Symphony

A generative audiovisual toy — colorful balls bounce inside an eroding circular wall, play piano tones on every impact, and gradually break holes through which they eventually escape. No frameworks beyond [p5.js](https://p5js.org/) and the Web Audio API.

## How to Run

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/` in your browser, click anywhere to start audio, and watch the symphony unfold.

## Controls

- **Click** — start audio
- **R** — reset the scene (new balls, fresh wall)

## How It Works

- **Eroding circular boundary** — the circle is divided into 360 arc segments. Each ball-wall impact erodes a few segments, slowly opening a visible hole.
- **Bounce or escape** — when a ball reaches the wall, the code checks how wide the dead gap is at that point. If the gap is smaller than the ball, it bounces off (with restitution). If the gap is large enough, the ball passes through and escapes.
- **Piano tones** — every wall bounce plays a note from a C-major scale, mapped by the impact angle around the circle. Ball-to-ball collisions also play a softer note.
- **Ball-to-ball collisions** — balls collide elastically with each other, exchanging momentum based on the collision normal.

## Configuration

All tunables live at the top of `sketch.js`:

| Variable             | Default | Description                                                        |
| -------------------- | ------- | ------------------------------------------------------------------ |
| `CIRCLE_RADIUS`      | `260`   | Radius of the circular wall in pixels.                             |
| `NUM_BALLS`          | `5`     | Number of balls spawned on reset.                                  |
| `GRAVITY`            | `0.48`  | Downward acceleration per frame. Lower = balls stay airborne longer. |
| `RESTITUTION`        | `0.97`  | Bounciness of walls. `1.0` = perfect bounce, `0.0` = no bounce.   |
| `INITIAL_SPEED_MIN`  | `31`    | Minimum random launch speed.                                       |
| `INITIAL_SPEED_MAX`  | `31`    | Maximum random launch speed. Set both equal for fixed speed.       |
| `ARC_SEGMENTS`       | `360`   | Resolution of the circular wall (more = smoother erosion).        |
| `EROSION_PER_HIT`    | `2`     | Segments eroded per bounce. Higher = holes open faster.            |

## Colors

The first 20 balls get hand-picked distinct colors from the `BALL_COLORS` palette — no repeats. Beyond 20, colors are generated dynamically using golden-angle hue spacing (137.508°) to remain visually distinguishable.

## File Structure

- `index.html` — page shell, loads p5.js and `sketch.js`
- `sketch.js` — all game logic, audio, and rendering

## Classes & Functions

- **`AudioEngine`** — Web Audio synthesizer; plays multi-partialsine piano tones with an ADSR-style envelope.
- **`ArcBoundary`** — the eroding circle. Tracks per-segment alive/dead state, checks collisions, measures gap sizes, and renders alive arcs.
- **`Ball`** — position, velocity, trail, and color. Handles wall collision response, erosion triggering, note playing, and escape detection.
- **`ballCollide(a, b)`** — elastic ball-to-ball collision with positional correction.
- **`getBallColor(index)`** / **`hsbToRgb(h, s, b)`** — color palette lookup and HSB-to-RGB conversion for dynamic color generation.

## License

Free to use and modify.
