// ============================================================
//  Bounce Symphony — balls in an eroding circle with piano tones
// ============================================================

// ---------- Config ----------
const CIRCLE_RADIUS = 260;
const NUM_BALLS = 7;
 const INITIAL_SPEED_MIN = 15;  // min random launch speed
 const INITIAL_SPEED_MAX = 15;  // max random launch speed
 const GRAVITY = 0.3;  // scales with speed so gravity doesn't overpower low speeds
 const RESTITUTION = 0.97;  // higher = bouncier walls (1.0 = perfect bounce, 0.0 = no bounce)
 const ARC_SEGMENTS = 360;
const EROSION_PER_HIT = 2;
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
let boundary;
let audioReady = false;

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
}
const audio = new AudioEngine();

// ============================
//  ArcBoundary — circle with erodable segments
// ============================
class ArcBoundary {
  constructor(cx, cy, radius, segments) {
    this.cx = cx;
    this.cy = cy;
    this.r = radius;
    this.segments = segments;
    this.alive = new Array(segments).fill(true);
    this.segAngle = (Math.PI * 2) / segments;
  }

  gapSizeAt(segIndex) {
    if (segIndex < 0 || segIndex >= this.segments || isNaN(segIndex)) return 0;
    if (this.alive[segIndex]) return 0;

    let count = 1;
    for (let i = 1; i < this.segments; i++) {
      const idx = (segIndex - i + this.segments) % this.segments;
      if (!this.alive[idx]) count++;
      else break;
    }
    for (let i = 1; i < this.segments; i++) {
      const idx = (segIndex + i) % this.segments;
      if (!this.alive[idx]) count++;
      else break;
    }
    return count;
  }

  checkCollision(ball) {
    const dx = ball.pos.x - this.cx;
    const dy = ball.pos.y - this.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (isNaN(dist) || !isFinite(dist)) {
      return null;
    }
    if (dist === 0) return null;

    if (dist + ball.radius < this.r) return null;

    // Ball centre can be up to one radius past the wall and still be
    // physically overlapping it.  Beyond that the ball has fully escaped.
    // (This also prevents tunneling: a fast ball can jump from dist < r to
    // dist > r in a single frame — we still need to catch that here.)
    if (dist > this.r + ball.radius) return null;

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;

    const centerSeg = Math.floor((angle / (Math.PI * 2)) * this.segments) % this.segments;

    // Angular half-width the ball subtends at the boundary radius.
    // Use the ball's actual radius (not a doubled value) so the gap
    // threshold matches the physical ball size.
    const halfAngleExt = Math.asin(Math.min(1, ball.radius / this.r));
    const halfSegExt = Math.ceil(halfAngleExt / this.segAngle);

    // Scan every segment the ball physically overlaps.
    // If any of those segments is alive, the ball is hitting real wall.
    let hitSeg = -1;
    for (let i = -halfSegExt; i <= halfSegExt; i++) {
      const idx = (centerSeg + i + this.segments) % this.segments;
      if (this.alive[idx]) {
        hitSeg = idx;
        break;
      }
    }

    if (hitSeg === -1) {
      // The entire angular span is a gap — ball escapes through.
      return null;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const penetrated = dist + ball.radius - this.r;
    return { angle, segIndex: hitSeg, nx, ny, penetration: penetrated };
  }

  erode(segIndex) {
    if (isNaN(segIndex) || segIndex < 0 || segIndex >= this.segments) return;
    const half = Math.floor(EROSION_PER_HIT / 2);
    for (let i = -half; i <= half; i++) {
      const idx = (segIndex + i + this.segments) % this.segments;
      this.alive[idx] = false;
    }
  }

  aliveCount() { return this.alive.filter(a => a).length; }

  display() {
    push();
    noFill();
    strokeWeight(4);
    drawingContext.shadowBlur = 10;
    drawingContext.shadowColor = 'rgba(100,200,255,0.5)';

    const lifeRatio = this.aliveCount() / this.segments;
    const r = lerp(70, 120, lifeRatio);
    const g = lerp(70, 200, lifeRatio);
    const b = lerp(100, 255, lifeRatio);
    stroke(r, g, b, 230);

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
//  Ball — uses plain {x, y} objects, NOT p5.Vector
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
  }

  update(boundary) {
    if (!this.alive) return;

    // Log if NaN detected (do NOT self-heal, so we can see the real issue)
    if (isNaN(this.pos.x) || isNaN(this.pos.y) || isNaN(this.vel.x) || isNaN(this.vel.y)) {
      return;
    }

    // Cap speed — scales with INITIAL_SPEED_MAX so the cap tracks your speed setting
     const maxSpeed = INITIAL_SPEED_MAX * 1.2;
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

    const hit = boundary.checkCollision(this);
    if (hit) {
      // Push ball back inside the circle
      this.pos.x -= hit.nx * hit.penetration;
      this.pos.y -= hit.ny * hit.penetration;

      // Reflect velocity if moving outward
      const dot = this.vel.x * hit.nx + this.vel.y * hit.ny;
      if (dot > 0) {
        const factor = (1 + RESTITUTION) * dot;
        this.vel.x -= factor * hit.nx;
        this.vel.y -= factor * hit.ny;
      }


      // Erode the boundary at impact point
      boundary.erode(hit.segIndex);

      // Play note mapped to impact angle
      const normalizedAngle = hit.angle / (Math.PI * 2);
      const noteIdx = Math.floor(normalizedAngle * SCALE.length) % SCALE.length;
      const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
      const vel = constrain(map(speed, 0, 20, 0.3, 0.9), 0.3, 0.9);
      audio.playNote(SCALE[noteIdx], vel);
    }

    // Check if ball has truly escaped (far outside circle)
    const dx = this.pos.x - boundary.cx;
    const dy = this.pos.y - boundary.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (isFinite(dist) && dist > boundary.r + this.radius + 80) {
      this.alive = false;
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
  boundary = new ArcBoundary(cx, cy, CIRCLE_RADIUS, ARC_SEGMENTS);
  balls = [];
  for (let i = 0; i < NUM_BALLS; i++) {
    const angle = (i / NUM_BALLS) * Math.PI * 2 + Math.PI / 4;
    const x = cx + Math.cos(angle) * CIRCLE_RADIUS * 0.4;
    const y = cy + Math.sin(angle) * CIRCLE_RADIUS * 0.4;
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
  for (let r = CIRCLE_RADIUS; r > 0; r -= 6) {
    const a = map(r, 0, CIRCLE_RADIUS, 6, 0);
    fill(30, 20, 50, a);
    circle(cx, cy, r * 2);
  }
  pop();

  boundary.display();

  for (const ball of balls) {
    ball.update(boundary);
    ball.display();
  }

  balls = balls.filter(b => b.alive || b.pos.y < height + 100);

  // Ball-to-ball collision
  for (let i = 0; i < balls.length; i++) {
    if (!balls[i].alive) continue;
    for (let j = i + 1; j < balls.length; j++) {
      if (!balls[j].alive) continue;
      ballCollide(balls[i], balls[j]);
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
    text('R to reset  ·  balls bounce, erode, and play piano tones', width / 2, height / 2 + 25);
    pop();
  }

  // All escaped message
  const aliveCount = balls.filter(b => b.alive).length;
  if (aliveCount === 0 && audioReady) {
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

    // Correct impulse: J = -(1+e) * v_rel . n / 2  (equal mass)
    // dot < 0 (approaching), so -dot > 0, J > 0
    const J = -(1 + RESTITUTION) * dot / 2;
    // a gets pushed in -n direction (away from b), b in +n direction (away from a)
    a.vel.x -= J * nx;
    a.vel.y -= J * ny;
    b.vel.x += J * nx;
    b.vel.y += J * ny;

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
  if (key === 'r' || key === 'R') resetScene();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cx = width / 2;
  cy = height / 2;
  if (boundary) { boundary.cx = cx; boundary.cy = cy; }
}
