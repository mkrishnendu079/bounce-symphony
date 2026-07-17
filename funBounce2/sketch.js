// ============================================================
//  Fun Bounce Symphony — balls between N eroding circles, some extra bouncy
//  Outermost circle: balls bounce off inner surface (inside collision)
//  All other circles: rings that bounce off either surface (both collision)
//  Circles listed in EX_BOUNCE_CIRCLES get a velocity boost on each bounce
// ============================================================

// ---------- Config ----------
const NUM_CIRCLES    = 10;      // 1–100 concentric eroding circle walls
const OUTERMOST_RADIUS     = 660;    // radius of the outermost circle
const INNERMOST_RADIUS     = 130;    // radius of the innermost circle (controls spacing between circles)
const NUM_BALLS      = 7;
const INITIAL_SPEED_MIN = 4;
const INITIAL_SPEED_MAX = 4;
const GRAVITY        = 0.03;
const RESTITUTION    = 0.97;
const ARC_SEGMENTS   = 360;
const EROSION_PER_HIT = 2;
const EX_BOUNCE_CIRCLES = '258';  // 1-based circle indices, each digit = a circle (e.g. '258' → 2nd, 5th, 8th)
const EX_BOUNCE_FACTOR = 1.1;    // extra-bouncy circles boost ball speed by this factor on each bounce
const NO_OF_BOUNCES   = 20;      // each ball starts with this many bounces; disappears at 0
const SCALE = [
  261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88,
  523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77
];
const BALL_COLORS = [
  [255,  99, 132],
  [ 99, 255, 162],
  [ 99, 172, 255],
  [255, 206,  86],
  [180,  99, 255],
  [255, 140,  60],
  [ 80, 255, 240],
  [255,  80, 200],
  [160, 255,  80],
  [255, 255, 100],
  [100, 200, 100],
  [200, 100, 100],
  [140, 200, 255],
  [255, 180, 200],
  [220, 220, 120],
  [120, 255, 120],
  [255, 120, 120],
  [120, 120, 255],
  [200, 255, 200],
  [255, 200, 150],
];

function getBallColor(index) {
  if (index < BALL_COLORS.length) return BALL_COLORS[index];
  const hue = (index * 137.508) % 360;
  return hsbToRgb(hue, 70, 100);
}

function hsbToRgb(h, s, b) {
  s /= 100; b /= 100;
  const c = b * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = b - c;
  let r, g, bl;
  if (h < 60)       { r = c; g = x; bl = 0; }
  else if (h < 120) { r = x; g = c; bl = 0; }
  else if (h < 180) { r = 0; g = c; bl = x; }
  else if (h < 240) { r = 0; g = x; bl = c; }
  else if (h < 300) { r = x; g = 0; bl = c; }
  else              { r = c; g = 0; bl = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((bl + m) * 255)];
}

// ---------- Globals ----------
let cx, cy;
let balls = [];
let boundaries = [];
let audioReady = false;
let frozen = false;  // when true, scene is paused after reset until 'J' is pressed

// ============================
//  AudioEngine
// ============================
class AudioEngine {
  constructor() { this.ctx = null; this.master = null; }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
    } catch (e) { console.warn('AudioContext failed:', e); }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  playNote(freq, velocity = 0.7) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.resume();
    const now = this.ctx.currentTime;
    const dur = 1.8;
    const partials = [
      { ratio: 1,    gain: 1.0,  type: 'sine'     },
      { ratio: 2,    gain: 0.35, type: 'sine'     },
      { ratio: 3,    gain: 0.12, type: 'triangle' },
      { ratio: 4,    gain: 0.06, type: 'sine'     },
    ];
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(velocity, now + 0.006);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);
    partials.forEach(p => {
      const osc = this.ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = freq * p.ratio;
      const g = this.ctx.createGain();
      g.gain.value = p.gain;
      osc.connect(g); g.connect(env);
      osc.start(now); osc.stop(now + dur + 0.1);
    });
    env.connect(this.master);
  }

  playPop() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.resume();
    const now = this.ctx.currentTime;
    const dur = 0.25;
    // Single pop helper: quick descending sine.
    const firePop = (t) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + dur);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(2.4, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(env);
      env.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    };
    // Fire a single loud pop.
    firePop(now);
  }
}
const audio = new AudioEngine();

// ============================
//  ArcBoundary — erodable circle segment wall
//  collisionSide: 'inside'  → ball bounces off the inner surface (outer circle)
//                'outside' → ball bounces off the outer surface (inner circle)
//                'both'    → ring that bounces off either surface (inner circle)
// ============================
class ArcBoundary {
  constructor(cx, cy, radius, segments, collisionSide, hue, extraBouncy) {
    this.cx = cx;
    this.cy = cy;
    this.r = radius;
    this.segments = segments;
    this.collisionSide = collisionSide;  // 'inside', 'outside', or 'both'
    this.hue = hue;                      // 0–360, for display colour
    this.extraBouncy = !!extraBouncy;    // boost ball speed on bounce
    this.alive = new Array(segments).fill(true);
    this.segAngle = (Math.PI * 2) / segments;
  }

  erode(segIndex, halfSegExt) {
    if (isNaN(segIndex) || segIndex < 0 || segIndex >= this.segments) return;
    const half = Math.max(halfSegExt || 1, 1);
    for (let i = -half; i <= half; i++) {
      const idx = (segIndex + i + this.segments) % this.segments;
      this.alive[idx] = false;
    }
  }

  aliveCount() { return this.alive.filter(a => a).length; }

  // Check collision for one boundary.
  // Returns { angle, segIndex, nx, ny, penetration } or null.
  // nx/ny is the surface normal pointing TOWARD the side the ball should be on:
  //   inside  → normal points inward (toward centre)
  //   outside → normal points outward (away from centre)
  checkCollision(ball) {
    const dx = ball.pos.x - this.cx;
    const dy = ball.pos.y - this.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (isNaN(dist) || !isFinite(dist) || dist === 0) return null;

    // Determine whether the ball is overlapping the wall, depending on side.
    // For 'inside'  (outer circle): ball should be at dist < r; overlap when dist + radius > r
    // For 'outside' (inner circle): ball should be at dist > r; overlap when dist - radius < r
    // For 'both'    (ring):         overlap when |dist - r| < radius, i.e. the ball straddles the ring
    let overlapping = false;
    let penetration = 0;

    if (this.collisionSide === 'inside') {
      if (dist + ball.radius < this.r) return null;        // safely inside
      if (dist > this.r + ball.radius) return null;         // fully escaped outside
      overlapping = true;
      penetration = dist + ball.radius - this.r;          // how far the ball has crossed outward
    } else if (this.collisionSide === 'outside') {
      if (dist - ball.radius > this.r) return null;        // safely outside
      if (dist < this.r - ball.radius) return null;         // fully inside the inner circle (shouldn't normally happen)
      overlapping = true;
      penetration = this.r - (dist - ball.radius);         // how far the ball has crossed inward
    } else {
      // 'both' — a thin ring wall the ball must bounce off from either side.
      const surfaceDelta = dist - this.r;
      if (Math.abs(surfaceDelta) > ball.radius) return null;  // ball not touching the ring
      overlapping = true;
      penetration = ball.radius - Math.abs(surfaceDelta);     // how far the ball has crossed the wall
    }

    if (!overlapping) return null;

    // Compute the ball's angular position and the segment range it spans.
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;

    const centerSeg = Math.floor((angle / (Math.PI * 2)) * this.segments) % this.segments;

    const halfAngleExt = Math.asin(Math.min(1, ball.radius / this.r));
    const halfSegExt = Math.ceil(halfAngleExt / this.segAngle);

    // Scan all segments the ball physically overlaps.
    // If any is alive → hit. If all dead → gap, ball passes through.
    let hitSeg = -1;
    for (let i = -halfSegExt; i <= halfSegExt; i++) {
      const idx = (centerSeg + i + this.segments) % this.segments;
      if (this.alive[idx]) {
        hitSeg = idx;
        break;
      }
    }

    if (hitSeg === -1) return null;  // gap — no collision

    const erodeHalfSpan = Math.max(halfSegExt, Math.ceil(EROSION_PER_HIT / 2));

    // Surface normal points toward the side the ball should be on.
    // For 'inside'  (outer circle): normal points inward  → (-dx/dist, -dy/dist)
    // For 'outside' (inner circle): normal points outward → (+dx/dist, +dy/dist)
    // For 'both'    (ring):         push the ball back to whichever side it came from
    const ux = dx / dist;
    const uy = dy / dist;

    let nx, ny;
    if (this.collisionSide === 'inside') {
      nx = -ux;  // inward
      ny = -uy;
    } else if (this.collisionSide === 'outside') {
      nx = ux;   // outward
      ny = uy;
    } else {
      // 'both' — push back to the side the ball centre is on.
      // dist > r → ball is outside the ring, push outward (+u)
      // dist < r → ball is inside the ring, push inward  (-u)
      if (dist >= this.r) { nx = ux;  ny = uy; }
      else                { nx = -ux; ny = -uy; }
    }

    return { angle, segIndex: hitSeg, nx, ny, penetration, erodeHalfSpan };
  }

  display() {
    push();
    noFill();
    strokeWeight(4);
    drawingContext.shadowBlur = 10;

    const lifeRatio = this.aliveCount() / this.segments;

    if (this.extraBouncy) {
      // Extra-bouncy circles — vivid green, thicker, stronger glow
      strokeWeight(6);
      drawingContext.shadowBlur = 20;
      const c = hsbToRgb(120, lerp(60, 90, lifeRatio), lerp(70, 100, lifeRatio));
      drawingContext.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.8)`;
      stroke(c[0], c[1], c[2], 255);
    } else {
      // Normal circles — colour flows from cool blue (outer) to warm amber (inner) via hue
      const c = hsbToRgb(this.hue, lerp(40, 80, lifeRatio), lerp(60, 100, lifeRatio));
      drawingContext.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.5)`;
      stroke(c[0], c[1], c[2], 230);
    }

    let i = 0;
    while (i < this.segments) {
      if (!this.alive[i]) { i++; continue; }
      let j = i;
      while (j < this.segments && this.alive[j]) j++;
      const a1 = i * this.segAngle;
      const a2 = j * this.segAngle;
      arc(this.cx, this.cy, this.r * 2, this.r * 2, a1, a2);
      i = j;
    }
    pop();
  }
}

// ============================
//  Ball
// ============================
class Ball {
  constructor(x, y, vx, vy, radius, colorIndex) {
    this.pos = { x: x, y: y };
    this.vel = { x: vx, y: vy };
    this.radius = radius;
    this.color = getBallColor(colorIndex);
    this.alive = true;
    this.trail = [];
    this.colorIndex = colorIndex;
    this.bounces = NO_OF_BOUNCES;  // countdown on each ball-ball collision
  }

  update(boundaries) {
    if (!this.alive) return;
    if (isNaN(this.pos.x) || isNaN(this.pos.y) || isNaN(this.vel.x) || isNaN(this.vel.y)) return;

    const maxSpeed = INITIAL_SPEED_MAX * EX_BOUNCE_FACTOR * 3;  // raised so extra-bounce boosts are visible
    const sp = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
    if (sp > maxSpeed) {
      this.vel.x = (this.vel.x / sp) * maxSpeed;
      this.vel.y = (this.vel.y / sp) * maxSpeed;
    }

    this.vel.y += GRAVITY;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    this.trail.push({ x: this.pos.x, y: this.pos.y });
    if (this.trail.length > 18) this.trail.shift();

    // Check collision against every boundary.
    // Process the first hit found (only one collision per frame keeps things stable).
    for (const boundary of boundaries) {
      const hit = boundary.checkCollision(this);
      if (hit) {
        // Push ball back to the side it should be on.
        // nx/ny already points toward the correct side.
        this.pos.x += hit.nx * hit.penetration;
        this.pos.y += hit.ny * hit.penetration;

        // Reflect velocity if moving toward the wall (against the normal).
        const dot = this.vel.x * hit.nx + this.vel.y * hit.ny;
        if (dot < 0) {
          const factor = (1 + RESTITUTION) * dot;
          this.vel.x -= factor * hit.nx;
          this.vel.y -= factor * hit.ny;

          // Extra-bouncy circles boost the ball's speed after bouncing.
          if (boundary.extraBouncy) {
            this.vel.x *= EX_BOUNCE_FACTOR;
            this.vel.y *= EX_BOUNCE_FACTOR;
          }
        }

        // Erode the boundary at impact point.
        boundary.erode(hit.segIndex, hit.erodeHalfSpan);

        // Play note mapped to impact angle.
        const normalizedAngle = hit.angle / (Math.PI * 2);
        const noteIdx = Math.floor(normalizedAngle * SCALE.length) % SCALE.length;
        const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
        const vel = constrain(map(speed, 0, 20, 0.3, 0.9), 0.3, 0.9);
        audio.playNote(SCALE[noteIdx], vel);

        break;  // one collision per frame
      }
    }

    // Check if ball has truly escaped (far outside the outermost circle).
    const dx = this.pos.x - cx;
    const dy = this.pos.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (isFinite(dist) && boundaries.length > 0) {
      const outerR = boundaries[0].r;
      if (dist > outerR + this.radius + 80) {
        this.alive = false;  // escaped outer boundary
      }
    }
  }

  display() {
    if (!this.alive) return;
    if (isNaN(this.pos.x) || isNaN(this.pos.y)) return;

    // Trail
    noFill();
    for (let i = 0; i < this.trail.length - 1; i++) {
      const a = map(i, 0, this.trail.length, 0, 120);
      stroke(this.color[0], this.color[1], this.color[2], a);
      strokeWeight(map(i, 0, this.trail.length, 1, this.radius * 0.8));
      line(this.trail[i].x, this.trail[i].y, this.trail[i + 1].x, this.trail[i + 1].y);
    }

    // Ball with glow
    push();
    drawingContext.shadowBlur = 25;
    drawingContext.shadowColor = `rgb(${this.color[0]},${this.color[1]},${this.color[2]})`;
    noStroke();
    fill(this.color[0], this.color[1], this.color[2], 240);
    circle(this.pos.x, this.pos.y, this.radius * 2);
    fill(255, 255, 255, 80);
    circle(this.pos.x - this.radius * 0.3, this.pos.y - this.radius * 0.3, this.radius * 0.8);

    // Bounce counter — black number centred on the ball
    fill(0, 0, 0);
    textAlign(CENTER, CENTER);
    textSize(this.radius * 1.1);
    textFont('monospace');
    textStyle(BOLD);
    text(this.bounces, this.pos.x, this.pos.y + 1);
    pop();
  }
}

// ============================
//  p5 lifecycle
// ============================
function setup() {
  createCanvas(windowWidth, windowHeight);
  cx = width / 2;
  cy = height / 2;
  resetScene();
}

function resetScene() {
  boundaries = [];
  const n = Math.max(1, Math.min(100, NUM_CIRCLES));
  // Hue flows from cool blue (210°, outermost) to warm amber (30°, innermost).
  const HUE_OUTER = 210;
  const HUE_INNER = 30;
  // Parse EX_BOUNCE_CIRCLES: each digit is a 1-based circle index.
  const exSet = new Set();
  for (const ch of String(EX_BOUNCE_CIRCLES)) {
    const idx = parseInt(ch, 10);
    if (idx >= 1 && idx <= n) exSet.add(idx);
  }

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const radius = lerp(OUTERMOST_RADIUS, INNERMOST_RADIUS, t);
    // Outermost circle contains the balls; all others are rings (bounce either side).
    const side = i === 0 ? 'inside' : 'both';
    const hue = lerp(HUE_OUTER, HUE_INNER, t);
    const extraBouncy = exSet.has(n - i);  // 1-based from innermost (innermost = 1)
    boundaries.push(new ArcBoundary(cx, cy, radius, ARC_SEGMENTS, side, hue, extraBouncy));
  }

  balls = [];
  // Place balls inside the innermost circle.
  const innermostRadius = boundaries[boundaries.length - 1].r;
  for (let i = 0; i < NUM_BALLS; i++) {
    const angle = (i / NUM_BALLS) * Math.PI * 2 + Math.PI / 4;
    const startRadius = innermostRadius * 0.5;
    const x = cx + Math.cos(angle) * startRadius;
    const y = cy + Math.sin(angle) * startRadius;
    const speed = random(INITIAL_SPEED_MIN, INITIAL_SPEED_MAX);
    const dir = random(Math.PI * 2);
    balls.push(new Ball(x, y, Math.cos(dir) * speed, Math.sin(dir) * speed, 14, i));
  }
}

function draw() {
  background(10, 10, 15);

  // Subtle center glow
  push();
  noStroke();
  for (let r = OUTERMOST_RADIUS; r > 0; r -= 6) {
    const a = map(r, 0, OUTERMOST_RADIUS, 6, 0);
    fill(30, 20, 50, a);
    circle(cx, cy, r * 2);
  }
  pop();

  for (const b of boundaries) b.display();

  for (const ball of balls) {
    if (!frozen) ball.update(boundaries);
    ball.display();
  }

  if (!frozen) {
    balls = balls.filter(b => b.alive || b.pos.y < height + 100);

    // Ball-to-ball collision
    for (let i = 0; i < balls.length; i++) {
      if (!balls[i].alive) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (!balls[j].alive) continue;
        ballCollide(balls[i], balls[j]);
      }
    }
  }

  // Audio prompt overlay
  if (!audioReady) {
    push();
    fill(0, 0, 0, 160);
    rect(0, 0, width, height);
    fill(200, 200, 220);
    textAlign(CENTER, CENTER);
    textSize(28);
    textFont('monospace');
    text('Click anywhere to start audio', width / 2, height / 2 - 10);
    textSize(16);
    fill(150, 150, 170);
    text(`R to reset  ·  ${NUM_CIRCLES} circles  ·  extra-bouncy: ${EX_BOUNCE_CIRCLES || 'none'} (${EX_BOUNCE_FACTOR}x)`, width / 2, height / 2 + 25);
    pop();
  }

  // All escaped message
  const aliveCount = balls.filter(b => b.alive).length;
  if (aliveCount === 0 && audioReady && !frozen) {
    push();
    fill(150, 150, 170, 200);
    textAlign(CENTER, CENTER);
    textSize(18);
    textFont('monospace');
    text('All balls escaped — press R to reset', width / 2, height / 2);
    pop();
  }
}

function ballCollide(a, b) {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.radius + b.radius;
  if (dist < minDist && dist > 0.001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = (minDist - dist) / 2;
    a.pos.x -= nx * overlap;
    a.pos.y -= ny * overlap;
    b.pos.x += nx * overlap;
    b.pos.y += ny * overlap;

    const dvx = b.vel.x - a.vel.x;
    const dvy = b.vel.y - a.vel.y;
    const dot = dvx * nx + dvy * ny;

    if (dot >= 0) return;

    const J = -(1 + RESTITUTION) * dot / 2;
    a.vel.x -= J * nx;
    a.vel.y -= J * ny;
    b.vel.x += J * nx;
    b.vel.y += J * ny;

    // Decrement bounce counters on both balls.
    a.bounces--;
    b.bounces--;

    // Pop and disappear when a ball's counter reaches 0.
    if (a.bounces <= 0 && a.alive) {
      a.alive = false;
      audio.playPop();
    }
    if (b.bounces <= 0 && b.alive) {
      b.alive = false;
      audio.playPop();
    }

    const mx = (a.pos.x + b.pos.x) / 2;
    const my = (a.pos.y + b.pos.y) / 2;
    const ang = Math.atan2(my - cy, mx - cx);
    let normAng = ang < 0 ? ang + Math.PI * 2 : ang;
    const noteIdx = Math.floor((normAng / (Math.PI * 2)) * SCALE.length) % SCALE.length;
    audio.playNote(SCALE[noteIdx], 0.35);
  }
}

// ---------- Input ----------
function ensureAudio() {
  if (!audioReady) {
    audio.init();
    audio.resume();
    audioReady = true;
  }
}

function mousePressed() { ensureAudio(); }
function touchStarted() { ensureAudio(); return false; }
function keyPressed() {
  ensureAudio();
  if (key === 'r' || key === 'R') { resetScene(); frozen = true; }
  if (key === 'j' || key === 'J') { frozen = false; }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cx = width / 2;
  cy = height / 2;
  for (const b of boundaries) { b.cx = cx; b.cy = cy; }
}
