import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Raycaster,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { ACCENT, ACCENT_COLORS, BODY_COLORS, GLOW_COLORS, type Move, type Personality } from '../data/content';
import type { Look, Screen } from '../state';
import { Face, type Expression } from './face';
import { buildProceduralRobot, type RobotParts } from './ProceduralRobot';
import { Accessories } from './accessories';
import { DEG, HOVER, MOVE_FACE, moveTimeline, pokeTimeline, PX, revealTimeline, zero, type MoveCtx, type Pose } from './moves';

const FACE_FOR: Record<Personality, Expression> = {
  shy: 'shy',
  playful: 'playful',
  dramatic: 'dramatic',
  calm: 'calm',
};
const RIM: Record<Personality | 'neutral', number> = { neutral: 0.6, shy: 0.5, playful: 1.0, dramatic: 1.2, calm: 0.7 };

export interface StageSync {
  screen: Screen;
  personality: Personality | null;
  look: Look;
}

function radialTexture(inner: string, outer: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Stage {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(28, 1, 0.1, 50);
  private robot: RobotParts;
  private acc: Accessories;
  private currentMove: Move | null = null;
  private face = new Face();
  private rim: PointLight;
  private floorGlow: Mesh;
  private rings: Mesh[] = [];
  private add = zero(); // animated by GSAP (moves, pokes, sequences)
  private idle = zero();
  private restArm = { L: 0, R: 0 };
  private restAnt = { L: 0, R: 0 };
  private clock = 0;
  private last = performance.now();
  private pointer = new Vector2(0, 0); // −1..1 relative to the robot
  private pointerPx = new Vector2(-1e4, -1e4);
  private pointerSpeed = 0;
  private look = new Vector2();
  private nextBlink = 2000;
  private spring = { s: 0, v: 0, lastY: 0 };
  private accent = new Color(ACCENT.neutral);
  private accentTarget = new Color(ACCENT.neutral);
  private rimTarget = RIM.neutral;
  private moveTl: gsap.core.Timeline | null = null;
  private faceOverride: Expression | null = null;
  private previewing: Personality | null = null;
  private state: StageSync | null = null;
  private running = false;
  private bubbleEl: HTMLElement | null = null;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private ray = new Raycaster();
  private tmp = new Vector3();
  private lastActivity = performance.now();
  private glitch = { v: 0 };
  private blushOn = false;
  onPoke: (p: Personality | null) => void = () => {};

  constructor(private host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = SRGBColorSpace;
    host.appendChild(this.renderer.domElement);

    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    const key = new DirectionalLight('#ffffff', 2.4);
    key.position.set(-3, 5, 4);
    this.scene.add(key, new HemisphereLight('#ffffff', '#202024', 0.5));
    this.rim = new PointLight(ACCENT.neutral, 6, 8, 1.5);
    this.rim.position.set(0, 1.6, -1.6);
    this.scene.add(this.rim);

    this.robot = buildProceduralRobot(this.face.texture);
    this.robot.rig.position.y = HOVER;
    this.scene.add(this.robot.root);
    this.acc = new Accessories(this.robot, this.reduced);
    this.restArm = { L: this.robot.arm_L.rotation.z, R: this.robot.arm_R.rotation.z };
    this.restAnt = { L: this.robot.antenna_L.rotation.z, R: this.robot.antenna_R.rotation.z };

    // contact shadow, coloured floor glow and the faint floor rings
    const shadow = new Mesh(
      new PlaneGeometry(1.7, 1.7),
      new MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 0.55, 1);
    this.floorGlow = new Mesh(
      new PlaneGeometry(3, 3),
      new MeshBasicMaterial({
        map: radialTexture('rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        color: this.accent,
      }),
    );
    this.floorGlow.rotation.x = -Math.PI / 2;
    this.floorGlow.position.y = -0.36;
    this.scene.add(shadow, this.floorGlow);
    for (const [r, o] of [
      [0.82, 0.14],
      [1.22, 0.1],
    ]) {
      const ring = new Mesh(
        new RingGeometry(r, r + 0.012, 96),
        new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: o, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.38;
      ring.userData.base = o;
      this.rings.push(ring);
      this.scene.add(ring);
    }

    this.camera.position.set(0, 1.25, 8.2);
    this.camera.lookAt(0, 1.12, 0);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    this.start();
  }

  // ---------- public API ----------

  attachBubble(el: HTMLElement) {
    this.bubbleEl = el;
  }

  sync(next: StageSync) {
    const prev = this.state;
    this.state = { ...next, look: { ...next.look, acc: { ...next.look.acc } } };
    this.applyLook(prev?.look.acc.ground);
    if (prev?.screen !== next.screen || prev?.personality !== next.personality) this.enter(next, prev);
  }

  /** Hover preview of a personality (null clears it). */
  preview(p: Personality | null) {
    this.previewing = p;
    this.activity();
  }

  /** Plays a move; returns its length in seconds. */
  move(m: Move): number {
    this.activity();
    return this.playMove(m);
  }

  /** Look down at itself and wiggle — after a customization change. */
  react() {
    this.activity();
    if (this.reduced) return;
    this.runMove(
      gsap
        .timeline()
        .to(this.add, { rx: 14 * DEG, duration: 0.15, ease: 'power2.out' })
        .to(this.add, { rz: 5 * DEG, duration: 0.075, yoyo: true, repeat: 3, ease: 'sine.inOut' })
        .to(this.add, { rx: 0, rz: 0, duration: 0.15, ease: 'power2.inOut' }),
    );
  }

  /** Floor ring pulse — once per installing log line. */
  pulse() {
    for (const r of this.rings) {
      const m = r.material as MeshBasicMaterial;
      gsap.fromTo(m, { opacity: 0.6 }, { opacity: r.userData.base, duration: 0.6, ease: 'power2.out' });
      if (!this.reduced) gsap.fromTo(r.scale, { x: 0.92, y: 0.92 }, { x: 1, y: 1, duration: 0.6, ease: 'power2.out' });
    }
  }

  /** Renders one frame and returns the canvas (for PNG snapshots). */
  snapshot(): HTMLCanvasElement {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }

  // ---------- state enter sequences ----------

  private enter(next: StageSync, prev: StageSync | null) {
    const p = next.personality;
    this.accentTarget.set(p ? ACCENT[p] : ACCENT.neutral);
    this.rimTarget = RIM[p ?? 'neutral'];
    this.blushOn = false;
    if (next.screen === 'boot') return this.boot();
    if (next.screen === 'installing') return this.installing();
    if (next.screen === 'reveal' && (prev?.screen !== 'customize' && prev?.screen !== 'share' || prev?.personality !== p) && p)
      return this.reveal(p);
    if (next.screen === 'intro' && prev && prev.screen !== 'boot') this.resetPose();
  }

  private resetPose() {
    this.moveTl?.kill();
    this.faceOverride = null;
    this.glitch.v = 0;
    gsap.to(this.add, { ...zero(), duration: 0.4, ease: 'power2.out' });
  }

  private boot() {
    const f = this.face;
    const now = () => performance.now();
    this.faceOverride = 'off';
    Object.assign(this.add, zero(), { rx: 4 * DEG, antL: -0.5, antR: -0.5, y: -6 * PX });
    if (this.reduced) {
      this.faceOverride = null;
      Object.assign(this.add, zero());
      return;
    }
    const tl = gsap.timeline({ delay: 0.15 });
    for (let i = 0; i < 3; i++) {
      tl.call(() => (this.faceOverride = 'default'), [], '+=0.12').call(() => (this.faceOverride = 'off'), [], '+=0.06');
    }
    tl.call(() => (this.faceOverride = null), [], '+=0.12')
      .to(this.add, { rx: -1.5 * DEG, y: 0, duration: 0.35, ease: 'power2.out' })
      .to(this.add, { rx: 0, duration: 0.2, ease: 'sine.out' })
      .to(this.add, { antL: 0, duration: 0.45, ease: 'elastic.out(1.2,0.4)' }, '-=0.1')
      .to(this.add, { antR: 0, duration: 0.45, ease: 'elastic.out(1.2,0.4)' }, '-=0.3')
      .call(() => f.blink(now()))
      .call(() => f.blink(now()), [], '+=0.22')
      .to(this.add, { rz: 5 * DEG, duration: 0.25, ease: 'sine.inOut' })
      .to(this.add, { rz: 0, duration: 0.35, ease: 'sine.inOut' }, '+=0.3');
    this.runMove(tl);
  }

  private installing() {
    this.faceOverride = 'dizzy';
    if (this.reduced) return;
    const tl = gsap.timeline();
    tl.to(this.add, { ry: Math.PI * 2, duration: 2.8, ease: 'power1.inOut' }, 0);
    for (let i = 0; i < 10; i++) {
      tl.to(this.add, { antL: (Math.random() - 0.5) * 24 * DEG, antR: (Math.random() - 0.5) * 24 * DEG, duration: 0.14 }, i * 0.28);
    }
    tl.to(this.glitch, { v: 1, duration: 0.08, yoyo: true, repeat: 7 }, 0.2).set(this.add, { ry: 0, antL: 0, antR: 0 });
    this.runMove(tl);
  }

  private reveal(p: Personality) {
    this.faceOverride = null;
    if (this.reduced) {
      Object.assign(this.add, zero());
      return;
    }
    this.runMove(revealTimeline(p, this.ctx()));
  }

  /** Callbacks the shared move timelines use to drive face, floor and blush. */
  private ctx(): MoveCtx {
    return {
      pose: this.add,
      p: this.state?.personality ?? null,
      balloon: this.state?.look.acc.hand === 'balloon',
      face: (e) => (this.faceOverride = e),
      pulse: () => this.pulse(),
      blush: () => (this.blushOn = true),
      blink: (ms) => this.face.blink(performance.now(), ms),
    };
  }

  // ---------- moves & pokes ----------

  private runMove(tl: gsap.core.Timeline) {
    this.moveTl?.kill();
    this.currentMove = null;
    this.moveTl = tl;
    tl.eventCallback('onComplete', () => {
      if (this.moveTl !== tl) return;
      this.moveTl = null;
      this.currentMove = null;
      this.faceOverride = null;
      gsap.to(this.add, { ...zero(), duration: 0.25 });
    });
  }

  private playMove(m: Move): number {
    Object.assign(this.add, zero());
    if (this.reduced) {
      this.faceOverride = MOVE_FACE[m];
      this.runMove(gsap.timeline().to({}, { duration: 1.2 }));
      return 1.2;
    }
    const tl = moveTimeline(m, this.ctx());
    this.runMove(tl);
    this.currentMove = m;
    return tl.duration() / tl.timeScale();
  }

  private poke() {
    this.activity();
    this.onPoke(this.state?.personality ?? null);
    if (this.reduced) {
      this.faceOverride = 'surprised';
      return this.runMove(gsap.timeline().to({}, { duration: 0.8 }));
    }
    Object.assign(this.add, zero());
    this.runMove(pokeTimeline(this.ctx()));
  }

  // ---------- idle ----------

  private computeIdle(t: number): Pose {
    const o = zero();
    if (this.reduced) return o;
    const p = this.previewing ?? this.state?.personality ?? null;
    const amp = this.previewing ? 0.6 : 1;
    const TAU = Math.PI * 2;
    switch (p) {
      case null:
        o.y = Math.sin((t * TAU) / 2.4) * 6 * PX;
        o.armL = Math.sin((t * TAU) / 2.4) * 3 * DEG;
        o.armR = -o.armL;
        break;
      case 'shy': {
        const glance = Math.max(0, Math.sin((t * TAU) / 5) ** 24); // brief glance every 5 s
        o.ry = -0.3 * (1 - glance) * amp;
        o.y = Math.sin((t * TAU) / 3) * 3 * PX;
        o.antL = o.antR = 10 * DEG;
        o.armL = Math.sin(t * 7) * 2 * DEG - 0.12;
        o.armR = -0.12;
        const near = this.pointerPx.distanceTo(this.robotScreen()) < 150;
        o.x = near ? -0.12 : 0;
        o.rz = near ? 4 * DEG : 0;
        break;
      }
      case 'playful': {
        const beat = (t % 0.5) / 0.5;
        o.y = Math.abs(Math.sin(beat * Math.PI)) * 14 * PX * amp;
        o.armL = (Math.sin(t * Math.PI * 2) * 20 * DEG + 10 * DEG) * amp;
        o.armR = (-Math.sin(t * Math.PI * 2) * 20 * DEG + 10 * DEG) * amp;
        o.antX = Math.sin(t * Math.PI * 4) * 12 * DEG * amp;
        o.sq = beat < 0.08 ? 0.04 * amp : 0;
        break;
      }
      case 'dramatic': {
        const phase = Math.floor(t / 4);
        const r = (n: number) => Math.sin(phase * 12.9898 + n * 78.233) * 0.5 + 0.5;
        const ease = Math.min(1, (t % 4) / 0.6);
        const k = 1 - (1 - ease) ** 3;
        o.ry = (r(1) - 0.5) * 0.6 * k * amp;
        o.rz = (r(2) - 0.5) * 0.12 * k * amp;
        o.armL = r(3) * 1.4 * k * amp;
        o.armR = r(4) * 0.8 * k * amp;
        o.sq = -Math.sin((t * Math.PI * 2) / 4) * 0.015; // long sigh
        break;
      }
      case 'calm': {
        const b = Math.sin((t * Math.PI * 2) / 4);
        o.y = (24 + b * 10) * PX * amp;
        o.wide = (b * 0.5 + 0.5) * 0.03;
        o.armL = Math.sin((t * Math.PI * 2) / 4) * 5 * DEG + 0.1;
        o.armR = Math.sin((t * Math.PI * 2) / 4 + 1) * 5 * DEG + 0.1;
        break;
      }
    }
    return o;
  }

  // ---------- loop ----------

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  private stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private slowFrames = 0;

  /** Drop to 1× pixel ratio if frames stay slow (weaker laptops). */
  private adaptQuality(rawDt: number) {
    if (this.renderer.getPixelRatio() <= 1) return;
    this.slowFrames = rawDt > 0.024 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 90) {
      this.renderer.setPixelRatio(1);
      this.resize();
    }
  }

  private frame = () => {
    const now = performance.now();
    const rawDt = (now - this.last) / 1000;
    this.adaptQuality(rawDt);
    const dt = Math.min(0.05, rawDt);
    this.last = now;
    this.clock += dt;
    const r = this.robot;

    this.idle = this.computeIdle(this.clock);
    const a = this.add;
    const i = this.idle;
    const sq = Math.max(-0.12, Math.min(0.12, i.sq + a.sq));

    // cursor look-at with 0.3 s lag; body yaw up to 10°
    const k = 1 - Math.exp(-dt / 0.3);
    this.look.lerp(this.pointer, k);
    this.pointerSpeed *= Math.exp(-dt * 6);

    r.rig.position.set(i.x + a.x, HOVER + i.y + a.y, i.z + a.z);
    r.rig.rotation.set(i.rx + a.rx - this.look.y * 3 * DEG, i.ry + a.ry + this.look.x * 10 * DEG, i.rz + a.rz);
    r.body.scale.set(1 + sq * 0.5 + i.wide, 1 - sq, 1 + sq * 0.5 + i.wide);
    r.arm_L.rotation.z = this.restArm.L - (i.armL + a.armL);
    r.arm_R.rotation.z = this.restArm.R + (i.armR + a.armR);

    // antenna spring follow-through driven by vertical velocity
    const vy = (r.rig.position.y - this.spring.lastY) / Math.max(dt, 1e-3);
    this.spring.lastY = r.rig.position.y;
    this.spring.v += (-140 * this.spring.s - 9 * this.spring.v + vy * 6) * dt;
    this.spring.s += this.spring.v * dt;
    const whip = Math.max(-0.5, Math.min(0.5, this.spring.s * 0.12));
    r.antenna_L.rotation.z = this.restAnt.L + i.antL + a.antL;
    r.antenna_R.rotation.z = this.restAnt.R - (i.antR + a.antR);
    r.antenna_L.rotation.x = r.antenna_R.rotation.x = i.antX + a.antX + whip;

    // face
    if (now > this.nextBlink && !this.faceOverride) {
      const calm = (this.previewing ?? this.state?.personality) === 'calm';
      this.face.blink(now, calm ? 400 : 120);
      this.nextBlink = now + (calm ? 6000 : 3000 + Math.random() * 2000);
    }
    const p = this.previewing ?? this.state?.personality ?? null;
    this.face.set(this.faceOverride ?? (p ? FACE_FOR[p] : 'default'), now);
    this.face.glitch = this.glitch.v;
    this.face.update(
      {
        expr: this.face.expression,
        color: this.glowColor(),
        lookX: this.look.x,
        lookY: -this.look.y,
        blush: this.blushOn || this.state?.look.acc.face === 'blush' || (p === 'shy' && !this.previewing && this.state?.screen === 'reveal'),
      },
      now,
    );

    // light colour eases toward the personality (30% toward it while previewing)
    const target = this.previewing ? new Color(ACCENT.neutral).lerp(new Color(ACCENT[this.previewing]), 0.3) : this.accentTarget;
    this.accent.lerp(target, 1 - Math.exp(-dt * 4));
    this.rim.color.copy(this.accent);
    const pulse = p === 'playful' ? 1 + 0.2 * Math.abs(Math.sin(this.clock * Math.PI * 2)) : p === 'calm' ? 1 + 0.15 * Math.sin((this.clock * Math.PI * 2) / 4) : 1;
    this.rim.intensity += (this.rimTarget * 10 * pulse - this.rim.intensity) * Math.min(1, dt * 4);
    (this.floorGlow.material as MeshBasicMaterial).color.copy(this.accent);

    this.acc.update(this.clock, this.currentMove === 'dance' || this.state?.look.acc.ground === 'speaker');
    this.renderer.render(this.scene, this.camera);
    this.positionBubble();
    this.idleAttention(now);
  };

  /** After 20 s with no input, do a small personality-specific attention move. */
  private idleAttention(now: number) {
    if (now - this.lastActivity < 20000 || this.moveTl || !this.state) return;
    this.lastActivity = now;
    const p = this.state.personality;
    this.playMove(p === 'playful' ? 'jump' : p === 'dramatic' ? 'spin' : p === 'calm' ? 'wave' : p === 'shy' ? 'wave' : 'surprise');
  }

  private glowColor(): string {
    const id = this.state?.look.glow ?? 'auto';
    if (id !== 'auto') return GLOW_COLORS.find((g) => g.id === id)?.hex ?? '#ffffff';
    const p = this.state?.personality;
    return p ? ACCENT[p] : '#ffffff';
  }

  private applyLook(prevGround?: string) {
    const l = this.state!.look;
    const p = this.state!.personality;
    this.acc.apply(l.acc, p ? ACCENT[p] : ACCENT.neutral);
    // the speaker starts a dance as soon as it lands
    if (l.acc.ground === 'speaker' && prevGround !== undefined && prevGround !== 'speaker') setTimeout(() => this.playMove('dance'), 400);
    const m = this.robot.mats;
    m.body.color.set(BODY_COLORS.find((c) => c.id === l.body)?.hex ?? '#F2F2F2');
    m.joint.color.set(ACCENT_COLORS.find((c) => c.id === l.accent)?.hex ?? '#C9C9C9');
    const glossy = l.finish === 'glossy';
    m.body.roughness = glossy ? 0.22 : 0.55;
    m.body.clearcoat = glossy ? 1 : 0;
    m.body.clearcoatRoughness = 0.08;
  }

  private robotScreen(): Vector2 {
    this.robot.empties.face_overlay.getWorldPosition(this.tmp);
    this.tmp.project(this.camera);
    const { width, height } = this.host.getBoundingClientRect();
    const rect = this.host.getBoundingClientRect();
    return new Vector2(rect.left + ((this.tmp.x + 1) / 2) * width, rect.top + ((1 - this.tmp.y) / 2) * height);
  }

  private positionBubble() {
    if (!this.bubbleEl) return;
    this.robot.empties.head_top.getWorldPosition(this.tmp);
    this.tmp.project(this.camera);
    const { width, height } = this.host.getBoundingClientRect();
    // keep the bubble inside the stage (narrow phones)
    const bw = this.bubbleEl.offsetWidth;
    const x = Math.min(((this.tmp.x + 1) / 2) * width + 70, width - bw - 12);
    const y = Math.max(((1 - this.tmp.y) / 2) * height - 70, 64);
    this.bubbleEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  private activity() {
    this.lastActivity = performance.now();
  }

  private onPointerMove = (e: PointerEvent) => {
    this.activity();
    const c = this.robotScreen();
    const nx = Math.max(-1, Math.min(1, (e.clientX - c.x) / (innerWidth * 0.4)));
    const ny = Math.max(-1, Math.min(1, -(e.clientY - c.y) / (innerHeight * 0.4)));
    const dx = e.clientX - this.pointerPx.x;
    const dy = e.clientY - this.pointerPx.y;
    this.pointerSpeed = Math.max(this.pointerSpeed, Math.hypot(dx, dy));
    this.pointerPx.set(e.clientX, e.clientY);
    this.pointer.set(nx, ny);
    // Shy stops a move early if the cursor moves fast.
    if (this.state?.personality === 'shy' && this.moveTl && this.pointerSpeed > 120) this.moveTl.progress(1);
  };

  private onPointerDown = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    if (this.ray.intersectObject(this.robot.rig, true).length) this.poke();
  };

  private resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // keep the robot fully in frame on narrow stages
    this.camera.position.z = width / height < 0.8 ? 8.2 / Math.max(0.55, width / height / 0.8) : 8.2;
    this.camera.lookAt(0, 1.12, 0);
    this.camera.updateProjectionMatrix();
  }
}
