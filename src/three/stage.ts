import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AnimationMixer,
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  LoopOnce,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Raycaster,
  RectAreaLight,
  RingGeometry,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
  type AnimationClip,
  type Material,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import gsap from 'gsap';
import { ACCENT, ACCENT_COLORS, BODY_COLORS, GLOW_COLORS, type Move, type Personality } from '../data/content';
import type { Look, Screen } from '../state';
import { Face, type Expression } from './face';
import { buildProceduralRobot, type RobotParts } from './ProceduralRobot';
import { Accessories } from './accessories';
import { Props } from './props';
import { loadRobot } from './loadRobot';
import { Environments } from './environments';
import { EarDrag } from './drag';
import { DEG, HOVER, MOVE_FACE, moveTimeline, pokeTimeline, PX, revealTimeline, zero, type MoveCtx, type Pose } from './moves';

const FACE_FOR: Record<Personality, Expression> = { shy: 'shy', playful: 'playful', dramatic: 'dramatic', calm: 'calm' };
const RIM: Record<Personality | 'neutral', number> = { neutral: 0.6, shy: 0.5, playful: 1.0, dramatic: 1.2, calm: 0.7 };
const ENV_SCREENS: Screen[] = ['reveal', 'customize', 'share'];
const FOV = 28;
// camera framings: plain studio vs. looking down a little onto the diorama
const CAM_STUDIO = { y: 1.25, z: 8.2, ty: 1.12 };
const CAM_DIORAMA = { y: 2.6, z: 8.8, ty: 0.98 };
const SULK_MS = 120_000; // how long Roo gives you its back after being dragged
const SULK_LINES = ['Hmph.', '…', 'Not. Talking.', 'My ear still hurts.', 'I have NOTHING to say to you.', '*angry robot noises*', 'Go find another robot.', 'I can hear you breathing. Stop it.'];
const UPSET = ['HEY!', 'Put me DOWN!', 'Not the EAR!!', 'OW OW OW', "I'm telling!!", 'This is NOT a personality test!', 'I bite. (I don’t. But STILL.)'];

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

const isFx = (m: Material) => (m as MeshBasicMaterial).blending === AdditiveBlending || (m.transparent && m.opacity < 0.6) || (m as MeshBasicMaterial).isMeshBasicMaterial;

export class Stage {
  private renderer: WebGLRenderer;
  private layer = document.createElement('div');
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  private robot: RobotParts;
  private acc: Accessories;
  private props: Props;
  private envs: Environments;
  private drag = new EarDrag();
  private mixer: AnimationMixer | null = null;
  private clips = new Map<string, AnimationClip>();
  private clipAction: AnimationAction | null = null;
  private usedClip = false; // set by ctx() when the next timeline is backed by a baked clip
  private currentMove: Move | null = null;
  private face = new Face();
  // lights
  private key: DirectionalLight;
  private fill: RectAreaLight;
  private kicker: SpotLight;
  private hemi: HemisphereLight;
  private spot: SpotLight;
  private rim: PointLight;
  private level = { v: 1 }; // overall rig brightness (reveal dims it)
  private spotLevel = { v: 0 };
  private floorGlow: Mesh;
  private catcher: Mesh;
  private rings: Mesh[] = [];
  // camera
  private cam = { ...CAM_STUDIO };
  private dolly = { z: 0, y: 0 };
  private distK = 1;
  private anchor = new Vector2();
  // motion
  private add = zero(); // animated by GSAP (moves, pokes, sequences)
  private idle = zero();
  private idleFace: Expression | null = null;
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
  private shyHide = 0;
  private watched = 0;
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
  private talkTimer = 0;
  private sulkUntil = 0;
  private sulk = { v: 0 }; // 0 = facing you, 1 = back turned
  private steam: Mesh[] = [];
  private hoverCheck = 0;
  onPoke: (p: Personality | null) => void = () => {};
  onSay: (text: string, ms: number, color?: string) => void = () => {};
  onDrag: (active: boolean) => void = () => {};
  onSulk: (active: boolean) => void = () => {};

  constructor(private host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    // full-viewport canvas so Roo can be dragged anywhere; the .stage box only sets the framing
    this.layer.className = 'canvas-layer';
    this.layer.appendChild(this.renderer.domElement);
    host.after(this.layer);

    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // ---- cinematic three-point rig ----
    RectAreaLightUniformsLib.init();
    this.key = new DirectionalLight('#FFF1E0', 3.2); // warm key, soft real shadows
    this.key.position.set(-3.5, 6.5, 5);
    this.key.target.position.set(0, 0.8, 0);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -3.4, right: 3.4, top: 4.6, bottom: -1.6, near: 1, far: 22 });
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.03;
    this.key.shadow.radius = 5;
    this.fill = new RectAreaLight('#CFE0FF', 2.4, 4, 4); // cool soft fill from front-right
    this.fill.position.set(4.5, 2.5, 5);
    this.fill.lookAt(0, 1, 0);
    this.kicker = new SpotLight('#ffffff', 45, 14, 0.5, 1, 1.5); // edge separation from behind
    this.kicker.position.set(2.8, 4.5, -3.5);
    this.kicker.target.position.set(0, 1, 0);
    this.hemi = new HemisphereLight('#ffffff', '#1a1a20', 0.35);
    this.spot = new SpotLight('#FFE9C2', 0, 16, 0.34, 0.55, 1.2); // reveal / theatre spotlight
    this.spot.position.set(0, 7.5, 1.8);
    this.spot.target.position.set(0, 0.8, 0);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.bias = -0.0005;
    this.spot.shadow.normalBias = 0.03;
    this.spot.shadow.radius = 4;
    this.rim = new PointLight(ACCENT.neutral, 6, 8, 1.5); // personality colour from behind
    this.rim.position.set(0, 1.6, -1.6);
    this.scene.add(this.key, this.key.target, this.fill, this.kicker, this.kicker.target, this.hemi, this.spot, this.spot.target, this.rim);

    this.robot = buildProceduralRobot(this.face.texture);
    this.robot.rig.position.y = HOVER;
    this.scene.add(this.robot.root);
    this.acc = new Accessories(this.robot, this.reduced);
    this.props = new Props(this.robot, this.reduced);
    this.envs = new Environments(this.scene, this.reduced);
    this.restArm = { L: this.robot.arm_L.rotation.z, R: this.robot.arm_R.rotation.z };
    this.restAnt = { L: this.robot.antenna_L.rotation.z, R: this.robot.antenna_R.rotation.z };
    this.makeSteam();
    this.shadowify();

    // floor: real shadow catcher + soft contact blob, coloured glow, faint rings
    this.catcher = new Mesh(new PlaneGeometry(14, 14), new ShadowMaterial({ opacity: 0.45 }));
    this.catcher.rotation.x = -Math.PI / 2;
    this.catcher.position.y = 0.001;
    this.catcher.receiveShadow = true;
    const blob = new Mesh(new PlaneGeometry(1.7, 1.7), new MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.6)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.003;
    blob.scale.set(1, 0.55, 1);
    this.floorGlow = new Mesh(
      new PlaneGeometry(3, 3),
      new MeshBasicMaterial({ map: radialTexture('rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: AdditiveBlending, color: this.accent }),
    );
    this.floorGlow.rotation.x = -Math.PI / 2;
    this.floorGlow.position.y = -0.36;
    this.scene.add(this.catcher, blob, this.floorGlow);
    for (const [r, o] of [
      [0.82, 0.14],
      [1.22, 0.1],
    ]) {
      const ring = new Mesh(new RingGeometry(r, r + 0.012, 96), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: o, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.38;
      ring.userData.base = o;
      this.rings.push(ring);
      this.scene.add(ring);
    }

    new ResizeObserver(() => this.resize()).observe(host);
    addEventListener('resize', () => this.resize());
    this.resize();
    addEventListener('pointermove', this.onPointerMove);
    addEventListener('pointerup', this.onPointerUp);
    addEventListener('pointercancel', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    this.drag.onLand = () => {
      // stomps, shakes with rage
      gsap.fromTo(this.add, { sq: 0.12 }, { sq: 0, duration: 0.5, ease: 'elastic.out(1,0.4)' });
      gsap.fromTo(this.add, { rz: 0.12 }, { rz: 0, duration: 0.9, ease: 'elastic.out(1.4,0.15)' });
      this.sulkUntil = performance.now() + SULK_MS; // steam starts right away
      this.onSay('HOW. DARE. YOU.', 2000, '#FF5A4E');
    };
    this.drag.onHome = () => this.startSulk();
    this.start();
    void this.swapToGLB();
  }

  /** Replace the procedural placeholder with the Blender robot and its baked clips. */
  private async swapToGLB() {
    try {
      const { parts, clips } = await loadRobot(this.face.texture);
      const old = this.robot.root;
      old.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      Object.values(this.robot.mats).forEach((m) => m.dispose());
      this.scene.remove(old);
      this.robot = parts;
      this.scene.add(parts.root);
      this.restArm = { L: parts.arm_L.rotation.z, R: parts.arm_R.rotation.z };
      this.restAnt = { L: parts.antenna_L.rotation.z, R: parts.antenna_R.rotation.z };
      this.props.clear();
      this.props = new Props(parts, this.reduced);
      this.acc = new Accessories(parts, this.reduced);
      if (this.state) this.applyLook();
      this.makeSteam();
      this.shadowify();
      this.mixer = new AnimationMixer(parts.root);
      this.mixer.addEventListener('finished', (e) => (e.action as AnimationAction).fadeOut(0.25));
      for (const c of clips) this.clips.set(c.name, c);
    } catch (err) {
      console.warn('Roo: keeping the procedural robot', err);
    }
  }

  /** Robot, accessories and props cast and receive real shadows; glows and beams don't. */
  private shadowify() {
    this.robot.root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const fx = isFx(o.material as Material);
      o.castShadow = !fx;
      o.receiveShadow = !fx;
    });
  }

  /** Plays a baked Blender clip with a 0.25 s crossfade; false if unavailable. */
  private playClip(name: string): boolean {
    const clip = this.clips.get(name);
    if (!this.mixer || !clip || this.reduced) return false;
    const action = this.mixer.clipAction(clip);
    if (this.clipAction && this.clipAction !== action) this.clipAction.fadeOut(0.25);
    action.reset().setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(0.25).play();
    this.clipAction = action;
    return true;
  }

  private stopClip() {
    this.clipAction?.fadeOut(0.25);
    this.clipAction = null;
  }

  // ---------- public API ----------

  attachBubble(el: HTMLElement) {
    this.bubbleEl = el;
  }

  sync(next: StageSync) {
    const prev = this.state;
    this.state = { ...next, look: { ...next.look, acc: { ...next.look.acc } } };
    this.applyLook(prev?.look.acc.ground);
    this.shadowify();
    if (prev?.screen !== next.screen || prev?.personality !== next.personality) this.enter(next, prev);
  }

  /** Hover preview of a personality, with the answer's prop scene (null clears both). */
  preview(p: Personality | null, propKey?: string) {
    this.previewing = p;
    this.props.show(p ? (propKey ?? null) : null);
    this.shadowify();
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

  /** Renders one frame; returns the canvas plus a square crop (device px) centred on Roo. */
  snapshot(): { canvas: HTMLCanvasElement; x: number; y: number; size: number } {
    this.renderer.render(this.scene, this.camera);
    const dpr = this.renderer.getPixelRatio();
    const r = this.host.getBoundingClientRect();
    const size = Math.min(r.height, r.width * 1.2) * 0.95 * dpr;
    return { canvas: this.renderer.domElement, x: this.anchor.x * dpr - size / 2, y: this.anchor.y * dpr - size / 2, size };
  }

  // ---------- state enter sequences ----------

  private enter(next: StageSync, prev: StageSync | null) {
    const p = next.personality;
    this.accentTarget.set(p ? ACCENT[p] : ACCENT.neutral);
    this.rimTarget = RIM[p ?? 'neutral'];
    this.blushOn = false;
    if (next.screen !== 'intro' && this.drag.phase === 'held') this.drag.release();
    if (next.screen !== 'intro' && this.sulkUntil) this.endSulk('Fine. Let’s just get this over with.');
    if (!/^q[123]$/.test(next.screen)) this.props.clear();

    const diorama = !!p && ENV_SCREENS.includes(next.screen);
    this.frame3d(diorama);
    if (!diorama) {
      this.envs.hide();
      gsap.to(this.level, { v: 1, duration: 0.6 });
      gsap.to(this.spotLevel, { v: 0, duration: 0.6 });
    }

    if (next.screen === 'boot') return this.boot();
    if (next.screen === 'installing') return this.installing();
    const fromEditing = (prev?.screen === 'customize' || prev?.screen === 'share') && prev.personality === p;
    if (next.screen === 'reveal' && p && !fromEditing) return this.reveal(p);
    if (diorama && p && this.envs.current !== p) this.envs.show(p, false);
    if (next.screen === 'intro' && prev && prev.screen !== 'boot') this.resetPose();
  }

  /** Eases the camera between the studio framing and the diorama framing. */
  private frame3d(diorama: boolean) {
    const to = diorama ? CAM_DIORAMA : CAM_STUDIO;
    gsap.to(this.cam, { ...to, duration: this.reduced ? 0 : 1.1, ease: 'power2.inOut' });
    for (const o of [this.floorGlow, ...this.rings]) o.visible = !diorama;
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

  /**
   * The big reveal: lights out → spotlight snaps on → Roo's reveal → the diorama builds piece by
   * piece around it while the camera pulls back and the lights come up on the scene.
   */
  private reveal(p: Personality) {
    this.faceOverride = null;
    if (this.reduced) {
      Object.assign(this.add, zero());
      this.envs.show(p, false);
      this.level.v = this.envs.level;
      this.spotLevel.v = p === 'dramatic' ? 1 : 0.25;
      return;
    }
    this.envs.show(p, true, 0.6);
    gsap.killTweensOf([this.level, this.spotLevel, this.dolly]);
    gsap
      .timeline()
      .to(this.level, { v: 0.04, duration: 0.18, ease: 'power2.in' })
      .to(this.spotLevel, { v: 1.6, duration: 0.06 }, 0.38) // *clunk*
      .to(this.level, { v: this.envs.level, duration: 1.5, ease: 'power2.inOut' }, 1.1)
      .to(this.spotLevel, { v: p === 'dramatic' ? 1.1 : 0.25, duration: 1.2, ease: 'sine.inOut' }, 1.8);
    gsap.fromTo(this.dolly, { z: -3.0, y: -0.9 }, { z: 0, y: 0, duration: 2.8, delay: 0.25, ease: 'power3.inOut' });
    this.runMove(revealTimeline(p, this.ctx(`${p}_reveal`)));
  }

  /** Callbacks the shared move timelines use to drive face, floor and blush. */
  private ctx(clip?: string): MoveCtx {
    return {
      pose: clip && (this.usedClip = this.playClip(clip)) ? zero() : this.add,
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
    if (!this.usedClip) this.stopClip();
    this.usedClip = false;
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
    if (this.drag.active) return 0;
    Object.assign(this.add, zero());
    if (this.reduced) {
      this.faceOverride = MOVE_FACE[m];
      this.runMove(gsap.timeline().to({}, { duration: 1.2 }));
      return 1.2;
    }
    const p = this.state?.personality;
    const tl = moveTimeline(m, this.ctx(p ? `${p}_${m}` : undefined));
    this.runMove(tl);
    this.currentMove = m;
    return tl.duration() / tl.timeScale();
  }

  private poke() {
    this.activity();
    if (this.sulkUntil) {
      gsap.fromTo(this.add, { sq: 0.06 }, { sq: 0, duration: 0.4 });
      return this.onSay('Don’t. Touch. Me.', 1800, '#FF5A4E');
    }
    this.onPoke(this.state?.personality ?? null);
    if (this.reduced) {
      this.faceOverride = 'surprised';
      return this.runMove(gsap.timeline().to({}, { duration: 0.8 }));
    }
    Object.assign(this.add, zero());
    const p = this.state?.personality;
    this.runMove(pokeTimeline(this.ctx(p ? `${p}_poke` : undefined)));
  }

  // ---------- ear drag (intro only) ----------

  private earUnder(e: PointerEvent): Object3D | null {
    const hit = this.hit(e);
    for (let o: Object3D | null = hit; o; o = o.parent) {
      if (o === this.robot.antenna_L || o === this.robot.antenna_R) return o;
      if (o === this.robot.rig) break;
    }
    return null;
  }

  private hit(e: PointerEvent): Object3D | null {
    const v = new Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    return this.ray.intersectObject(this.robot.rig, true)[0]?.object ?? null;
  }

  private pointerOnPlane(e: PointerEvent, z: number): Vector3 {
    const v = new Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    return this.ray.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), -z), new Vector3()) ?? new Vector3(0, HOVER, 0);
  }

  private startDrag(ear: Object3D, e: PointerEvent) {
    const r = this.robot;
    const tipObj = ear === r.antenna_L ? r.empties.antenna_tip_L : r.empties.antenna_tip_R;
    const tipWorld = tipObj.getWorldPosition(new Vector3());
    r.rig.updateMatrixWorld();
    const tipLocal = r.rig.worldToLocal(tipWorld.clone());
    this.moveTl?.kill();
    this.moveTl = null;
    this.stopClip();
    Object.assign(this.add, zero());
    this.faceOverride = 'angry';
    gsap.killTweensOf(this.sulk);
    this.sulk.v = 0;
    this.drag.grab(tipLocal, new Vector3(0, 0.8, 0), r.rig.rotation.z, new Vector3(0, HOVER, 0), this.pointerOnPlane(e, tipWorld.z));
    this.dragZ = tipWorld.z;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.renderer.domElement.style.cursor = 'grabbing';
    this.onDrag(true);
    this.talkTimer = 0;
  }
  private dragZ = 0;

  // ---------- sulking (after being dragged by the ear) ----------

  private startSulk() {
    this.sulkUntil = performance.now() + SULK_MS;
    this.faceOverride = 'angry';
    this.talkTimer = 4;
    gsap.to(this.sulk, { v: 1, duration: 0.9, ease: 'power2.inOut' });
    this.onDrag(false);
    this.onSulk(true);
    this.onSay('I’m NOT talking to you.', 2600, '#FF5A4E');
  }

  private endSulk(line: string) {
    this.sulkUntil = 0;
    this.faceOverride = null;
    gsap.to(this.sulk, { v: 0, duration: 1.4, ease: 'power2.inOut' });
    this.onSulk(false);
    this.onSay(line, 3000);
  }

  private updateSulk(now: number, dt: number) {
    const angry = this.sulkUntil > 0 || this.drag.active;
    this.steam.forEach((p, i) => {
      const k = (this.clock * 0.9 + i / this.steam.length) % 1;
      const side = i % 2 ? 1 : -1;
      p.visible = angry && !this.reduced;
      p.position.set(side * (0.33 + k * 0.12), 0.45 + k * 0.6, 0);
      p.scale.setScalar(0.5 + k * 1.3);
      (p.material as MeshBasicMaterial).opacity = 0.5 * (1 - k);
    });
    if (!this.sulkUntil || this.drag.active || this.sulk.v < 1) return;
    if (now > this.sulkUntil) return this.endSulk('…fine. I forgive you. A little.');
    if ((this.talkTimer -= dt) <= 0) {
      this.talkTimer = 9 + Math.random() * 6;
      this.onSay(SULK_LINES[Math.floor(Math.random() * SULK_LINES.length)], 2200, '#FF5A4E');
    }
  }

  /** Little steam puffs from both ears while Roo is furious. */
  private makeSteam() {
    this.steam.forEach((p) => p.removeFromParent());
    const m = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
    this.steam = Array.from({ length: 8 }, () => {
      const p = new Mesh(new SphereGeometry(0.07, 10, 8), m);
      p.visible = false;
      this.robot.empties.head_top.add(p);
      return p;
    });
  }

  // ---------- idle ----------

  private computeIdle(t: number): Pose {
    const o = zero();
    this.idleFace = null;
    if (this.reduced) return o;
    if (this.sulk.v > 0) {
      const s = this.sulk.v;
      const huff = Math.max(0, Math.sin((t * Math.PI * 2) / 5)) ** 16; // a big huff every 5 s
      o.ry = Math.PI * s + Math.sin(t * 0.8) * 0.06 * s;
      o.armL = o.armR = -0.6 * s; // arms crossed
      o.sq = huff * 0.07 * s;
      o.y = huff * 6 * PX;
      o.antL = o.antR = -0.12 * s; // antennas stiff with rage
      return o;
    }
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
        // closed posture: turned 35° away, hunched, head down, arms tucked, trembling, tiny.
        const glance = Math.max(0, Math.sin((t * TAU) / 5)) ** 30; // a terrified peek every 5 s
        const hide = this.shyHide;
        o.ry = -0.62 * (1 - glance) * amp;
        o.rx = (0.14 + 0.16 * hide) * (1 - glance) * amp;
        o.sq = 0.05 * amp;
        o.wide = -0.03 * amp;
        o.x = ((-0.18 - 0.3 * hide) * amp + Math.sin(t * 47) * 1.4 * PX) * (1 - glance * 0.5);
        o.z = -0.25 * hide;
        o.rz = Math.sin(t * 39) * 0.7 * DEG;
        o.y = Math.sin((t * TAU) / 3) * 2 * PX - 8 * PX;
        o.armL = (-0.32 - 0.62 * hide) * amp + Math.sin(t * 6) * 2 * DEG;
        o.armR = (-0.32 - 0.62 * hide) * amp;
        o.antL = o.antR = 0.45 * amp;
        this.idleFace = glance > 0.5 ? 'default' : hide > 0.5 ? 'wink' : 'shy';
        break;
      }
      case 'playful': {
        // can't. stop. bouncing.
        const beat = (t % 0.5) / 0.5;
        o.y = Math.abs(Math.sin(beat * Math.PI)) * 26 * PX * amp;
        o.sq = (beat < 0.1 ? 0.08 : beat > 0.4 && beat < 0.6 ? -0.04 : 0) * amp;
        o.armL = (Math.sin(t * TAU) * 35 * DEG + 15 * DEG) * amp;
        o.armR = (-Math.sin(t * TAU) * 35 * DEG + 15 * DEG) * amp;
        o.antX = Math.sin(t * Math.PI * 4) * 25 * DEG * amp;
        o.rz = Math.sin(t * TAU) * 6 * DEG * amp;
        const ph = t % 4; // a trick every 4 s
        if (ph > 3.2) {
          const k = (ph - 3.2) / 0.8;
          o.ry = TAU * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
          this.idleFace = 'wink';
        }
        break;
      }
      case 'dramatic': {
        // grand poses, held, with a gasp on every change
        const phase = Math.floor(t / 4);
        const r = (n: number) => Math.sin(phase * 12.9898 + n * 78.233) * 0.5 + 0.5;
        const into = (t % 4) / 0.7;
        const k = 1 - (1 - Math.min(1, into)) ** 3;
        o.ry = (r(1) - 0.5) * 1.0 * k * amp;
        o.rz = (r(2) - 0.5) * 0.4 * k * amp;
        o.rx = -(0.05 + r(5) * 0.15) * k * amp; // lean back
        o.armL = (0.8 + r(3) * 1.6) * k * amp;
        o.armR = (r(4) > 0.5 ? 2.3 : 0.4) * k * amp; // back of the hand to the forehead
        o.sq = -Math.sin((t * TAU) / 4) * 0.04; // loooong sigh
        if (into < 0.4) this.idleFace = 'surprised';
        break;
      }
      case 'calm': {
        // floats higher, breathes slower, eyes closed
        const b = Math.sin((t * TAU) / 6);
        o.y = (40 + b * 14) * PX * amp;
        o.wide = (b * 0.5 + 0.5) * 0.04;
        o.rz = Math.sin((t * TAU) / 9) * 2 * DEG;
        o.armL = 0.25 + Math.sin((t * TAU) / 6) * 10 * DEG;
        o.armR = 0.25 + Math.sin((t * TAU) / 6 + 1) * 10 * DEG;
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
    const p = this.previewing ?? this.state?.personality ?? null;

    // being looked at (shy hides, hearts appear after 3 s)
    const dist = this.pointerPx.distanceTo(this.robotScreen());
    this.shyHide += ((dist < 260 ? 1 : 0) - this.shyHide) * Math.min(1, dt * 5);
    this.watched = dist < 420 ? this.watched + dt : 0;

    this.idle = this.computeIdle(this.clock);
    const a = this.add;
    const i = this.idle;
    const sq = Math.max(-0.12, Math.min(0.12, i.sq + a.sq));

    // cursor look-at with 0.3 s lag; body yaw up to 10°
    const k = 1 - Math.exp(-dt / 0.3);
    this.look.lerp(this.pointer, k);
    this.pointerSpeed *= Math.exp(-dt * 6);

    if (this.drag.active) {
      // dangling from an ear, furious
      this.drag.step(dt, HOVER);
      const held = this.drag.phase === 'held';
      const squirm = held ? Math.sin(this.clock * 21) * 0.07 : 0;
      r.rig.position.copy(this.drag.pos);
      r.rig.rotation.set(0, held ? Math.sin(this.clock * 9) * 0.15 : 0, this.drag.rotZ + squirm + a.rz);
      r.body.scale.set(1 + a.sq * 0.5, 1 - a.sq, 1 + a.sq * 0.5);
      const flail = held ? 1 : 0.15;
      r.arm_L.rotation.z = this.restArm.L - (0.9 + Math.sin(this.clock * 26) * 0.7) * flail;
      r.arm_R.rotation.z = this.restArm.R + (0.9 + Math.sin(this.clock * 26 + Math.PI) * 0.7) * flail;
      if (held && (this.talkTimer -= dt) <= 0) {
        this.talkTimer = 1.3;
        this.onSay(UPSET[Math.floor(Math.random() * UPSET.length)], 1250, '#FF5A4E');
      }
    } else {
      r.rig.position.set(i.x + a.x, HOVER + i.y + a.y, i.z + a.z);
      const lookK = 1 - this.sulk.v;
      r.rig.rotation.set(i.rx + a.rx - this.look.y * 3 * DEG * lookK, i.ry + a.ry + this.look.x * 10 * DEG * lookK, i.rz + a.rz);
      r.body.scale.set(1 + sq * 0.5 + i.wide, 1 - sq, 1 + sq * 0.5 + i.wide);
      r.arm_L.rotation.z = this.restArm.L - (i.armL + a.armL);
      r.arm_R.rotation.z = this.restArm.R + (i.armR + a.armR);
    }

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
      const calm = p === 'calm';
      this.face.blink(now, calm ? 400 : 120);
      this.nextBlink = now + (calm ? 6000 : 3000 + Math.random() * 2000);
    }
    this.face.set(this.faceOverride ?? this.idleFace ?? (p ? FACE_FOR[p] : 'default'), now);
    this.face.glitch = this.glitch.v;
    this.face.update(
      {
        expr: this.face.expression,
        color: this.glowColor(),
        lookX: this.look.x,
        lookY: p === 'shy' ? -0.8 : -this.look.y,
        blush: this.blushOn || this.state?.look.acc.face === 'blush' || p === 'shy',
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
    const L = this.level.v;
    this.key.intensity = 3.2 * L;
    this.fill.intensity = 2.4 * L;
    this.kicker.intensity = 45 * Math.max(L, 0.3);
    this.hemi.intensity = 0.35 * L;
    this.scene.environmentIntensity = 0.45 * L;
    this.spot.intensity = 260 * this.spotLevel.v;
    this.host.style.setProperty('--stage-level', L.toFixed(3));

    // camera: framing + reveal dolly, centred on the .stage box via the view offset
    this.camera.position.set(0, this.cam.y + this.dolly.y, (this.cam.z + this.dolly.z) * this.distK);
    this.camera.lookAt(0, this.cam.ty, 0);

    this.updateSulk(now, dt);
    this.mixer?.update(dt); // baked clips override idle on the nodes they animate
    this.props.update(this.clock);
    this.envs.update(this.clock, { watched: this.watched, beat: (this.clock % 0.5) / 0.5 });
    this.fadeBody(this.props.invisible ? 0.15 : 1, dt);
    this.acc.update(this.clock, this.currentMove === 'dance' || this.state?.look.acc.ground === 'speaker');
    this.renderer.render(this.scene, this.camera);
    this.positionBubble();
    this.idleAttention(now);
  };

  /** Q3 "Invisibility": everything but the eyes fades out. */
  private fadeBody(target: number, dt: number) {
    for (const m of [this.robot.mats.body, this.robot.mats.joint]) {
      if (m.opacity === target) continue;
      m.opacity = Math.abs(target - m.opacity) < 0.01 ? target : m.opacity + (target - m.opacity) * Math.min(1, dt * 8);
      const see = m.opacity < 1;
      if (m.transparent !== see) {
        m.transparent = see;
        m.depthWrite = !see;
        m.needsUpdate = true;
      }
    }
  }

  /** After 20 s with no input, do a small personality-specific attention move. */
  private idleAttention(now: number) {
    if (now - this.lastActivity < 20000 || this.moveTl || !this.state || this.drag.active) return;
    this.lastActivity = now;
    const p = this.state.personality;
    if (this.sulkUntil) return;
    this.playMove(p === 'playful' ? 'jump' : p === 'dramatic' ? 'spin' : p === 'calm' ? 'wave' : p === 'shy' ? 'wave' : 'surprise');
  }

  private glowColor(): string {
    if (this.faceOverride === 'angry') return '#FF5A4E';
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

  /** Roo's face in viewport pixels (the canvas covers the viewport). */
  private robotScreen(): Vector2 {
    this.robot.empties.face_overlay.getWorldPosition(this.tmp);
    this.tmp.project(this.camera);
    return new Vector2(((this.tmp.x + 1) / 2) * innerWidth, ((1 - this.tmp.y) / 2) * innerHeight);
  }

  private positionBubble() {
    if (!this.bubbleEl) return;
    this.robot.empties.head_top.getWorldPosition(this.tmp);
    this.tmp.project(this.camera);
    const bw = this.bubbleEl.offsetWidth;
    const x = Math.max(12, Math.min(((this.tmp.x + 1) / 2) * innerWidth + 70, innerWidth - bw - 12));
    const y = Math.max(((1 - this.tmp.y) / 2) * innerHeight - 70, 64);
    this.bubbleEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  private activity() {
    this.lastActivity = performance.now();
  }

  private onPointerMove = (e: PointerEvent) => {
    this.activity();
    if (this.drag.phase === 'held') return this.drag.move(this.pointerOnPlane(e, this.dragZ));
    const c = this.robotScreen();
    const nx = Math.max(-1, Math.min(1, (e.clientX - c.x) / (innerWidth * 0.4)));
    const ny = Math.max(-1, Math.min(1, -(e.clientY - c.y) / (innerHeight * 0.4)));
    const dx = e.clientX - this.pointerPx.x;
    const dy = e.clientY - this.pointerPx.y;
    this.pointerSpeed = Math.max(this.pointerSpeed, Math.hypot(dx, dy));
    this.pointerPx.set(e.clientX, e.clientY);
    this.pointer.set(nx, ny);
    // Shy stops a move early if the cursor moves fast.
    if (this.state?.personality === 'shy' && this.moveTl && this.pointerSpeed > 120) {
      this.moveTl.progress(1);
      this.stopClip();
    }
    // grab cursor over the ears on the intro
    if (e.target === this.renderer.domElement && performance.now() > this.hoverCheck) {
      this.hoverCheck = performance.now() + 60;
      const intro = this.state?.screen === 'intro' && !this.drag.active;
      this.renderer.domElement.style.cursor = intro && this.earUnder(e) ? 'grab' : this.hit(e) ? 'pointer' : 'default';
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.drag.active) return;
    const ear = this.state?.screen === 'intro' && !this.reduced ? this.earUnder(e) : null;
    if (ear) {
      e.preventDefault();
      return this.startDrag(ear, e);
    }
    if (this.hit(e)) this.poke();
  };

  private onPointerUp = () => {
    if (this.drag.phase !== 'held') return;
    this.drag.release();
    this.renderer.domElement.style.cursor = 'default';
  };

  /** Full-viewport canvas; the view offset puts the look-at point at the centre of the .stage box. */
  private resize() {
    const W = innerWidth;
    const H = innerHeight;
    const r = this.host.getBoundingClientRect();
    if (!W || !H || !r.height) return;
    this.renderer.setSize(W, H, false);
    // keep Roo's on-screen size tied to the .stage box height, as before the full-screen canvas
    const s = r.height / H;
    this.camera.fov = (2 * Math.atan(Math.tan((FOV * DEG) / 2) / s)) / DEG;
    this.camera.aspect = W / H;
    const aspect = r.width / r.height;
    this.distK = aspect < 0.8 ? 1 / Math.max(0.55, aspect / 0.8) : 1;
    this.anchor.set(r.left + r.width / 2, r.top + r.height / 2);
    this.camera.setViewOffset(W, H, W / 2 - this.anchor.x, H / 2 - this.anchor.y, W, H);
    this.camera.updateProjectionMatrix();
  }
}
