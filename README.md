# Bounce Symphony

A collection of generative audiovisual toys built with [p5.js](https://p5js.org/) and the Web Audio API. Colorful balls bounce inside eroding circular walls, play piano tones on every impact, and gradually break holes through which they eventually escape.

## Variants

| Folder | Port | Description |
| ------ | ---- | ----------- |
| `basicBounce/`  | 8765 | Original single-circle version. Balls bounce inside one eroding wall. |
| `doubleBounce/` | 8766 | N concentric eroding circles (1–100). Balls bounce between rings. |
| `funBounce/`    | 8767 | Like doubleBounce, but selected circles are extra bouncy (speed boost on impact). |
| `funBounce2/`   | 8768 | Like funBounce, plus a ball-to-ball bounce countdown — balls disappear with a pop sound when their counter hits 0. |

## How to Run

Each folder is a standalone static site. Pick a variant, start a server, and open the URL:

```bash
cd doubleBounce
python3 -m http.server 8766
```

Then open `http://localhost:8766/` in your browser and click anywhere to start audio.

## Controls

- **Click** — start audio
- **R** — reset the scene (new balls, fresh walls)

## Shared Concepts

- **Eroding arc boundaries** — each circle is divided into 360 arc segments. Ball-wall impacts erode a few segments, slowly opening visible holes.
- **Bounce or escape** — when a ball reaches a wall, the code checks the dead-gap width at that point. Small gap → bounce. Large gap → ball passes through and escapes.
- **Piano tones** — every wall bounce plays a note from a C-major scale, mapped by the impact angle. Ball-to-ball collisions play a softer note.
- **Ball-to-ball collisions** — balls collide elastically, exchanging momentum along the collision normal.

See each folder's `README.md` for variant-specific configuration and mechanics.

## License

Free to use and modify.
