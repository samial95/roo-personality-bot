// Tiny 3D scenes that appear while an answer is hovered: one per answer, minimal and silly.
import {
  AdditiveBlending,
  CanvasTexture,
  SRGBColorSpace,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  ExtrudeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { extrude, mat, mesh, starShape } from './accessories';
import type { RobotParts } from './ProceduralRobot';

type Anchor = 'hand' | 'handL' | 'head' | 'body' | 'floor';
interface Part {
  anchor: Anchor;
  obj: Object3D;
}
export interface Prop {
  parts: Part[];
  anim?: (t: number) => void;
  invisible?: boolean; // Q3 shy: Roo turns see-through except its eyes
}

const glow = (color: string, opacity = 0.9) => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });

function sparkles(n: number, color: string, spread: [number, number, number], y0: number): { g: Group; anim: (t: number) => void } {
  const g = new Group();
  const m = new MeshStandardMaterial({ color, emissive: new Color(color), emissiveIntensity: 1.2 });
  const stars = Array.from({ length: n }, (_, i) => {
    const s = mesh(extrude(starShape(0.06), 0.02), m, (Math.sin(i * 2.4) * spread[0]) / 2, y0 + ((i * 0.37) % 1) * spread[1], (Math.cos(i * 1.7) * spread[2]) / 2);
    g.add(s);
    return s;
  });
  return {
    g,
    anim: (t) =>
      stars.forEach((s, i) => {
        const k = Math.max(0, Math.sin(t * 3 + i * 1.9));
        s.scale.setScalar(0.3 + k);
        s.rotation.z = t + i;
      }),
  };
}

function book(): Group {
  const g = new Group();
  const cover = mat('#FF8FB1', { rough: 0.7 });
  const pages = mat('#FFF8EC', { rough: 0.9 });
  for (const s of [-1, 1]) {
    const half = new Group();
    half.add(mesh(new BoxGeometry(0.2, 0.28, 0.015), cover, s * 0.1, 0, 0), mesh(new BoxGeometry(0.18, 0.26, 0.02), pages, s * 0.1, 0, 0.012));
    half.rotation.y = s * -0.45;
    g.add(half);
  }
  g.position.set(-0.02, 0.06, 0.2);
  g.rotation.x = -0.5;
  g.scale.setScalar(1.5);
  return g;
}

function blanket(): Mesh {
  const geo = new PlaneGeometry(1.7, 1.1, 24, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 5) * 0.025 + Math.cos(y * 7 + x * 2) * 0.02); // a bit rumpled
  }
  geo.computeVertexNormals();
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFF1E0';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#FFB3C8';
  for (let i = 0; i < 64; i += 16) g.fillRect(i, 0, 7, 64);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(geo, new MeshStandardMaterial({ map: tex, roughness: 1, side: DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.03, 0.15);
  return m;
}

function crescent(): Mesh {
  const s = new Shape();
  s.absarc(0, 0, 0.32, Math.PI * 0.35, Math.PI * 1.65, false);
  s.absarc(0.14, 0, 0.26, Math.PI * 1.5, Math.PI * 0.5, true);
  const geo = new ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 });
  geo.center();
  return new Mesh(geo, mat('#FFF3C4', { emissive: '#FFE58A', ei: 0.9, rough: 0.6 }));
}

function mic(): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.035, 0.025, 0.24, 16), mat('#1d1d22', { rough: 0.4 }), 0, 0.05, 0.08), mesh(new SphereGeometry(0.075, 20, 16), mat('#9a9aa2', { metal: 0.9, rough: 0.45 }), 0, 0.2, 0.08));
  g.rotation.z = 0.3;
  return g;
}

function plant(): Group {
  const g = new Group();
  const pts = [new Vector2(0, 0), new Vector2(0.14, 0), new Vector2(0.18, 0.24), new Vector2(0.2, 0.26), new Vector2(0.2, 0.3), new Vector2(0, 0.3)];
  g.add(new Mesh(new LatheGeometry(pts, 24), mat('#C8693F', { rough: 0.85 })));
  const leafM = mat('#3FA46A', { rough: 0.6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = mesh(new SphereGeometry(0.08, 12, 10), leafM, Math.cos(a) * 0.07, 0.4 + (i % 2) * 0.06, Math.sin(a) * 0.07);
    leaf.scale.set(0.6, 1.5, 0.35);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(leaf);
  }
  return g;
}

function foamHand(color: string): Group {
  const g = new Group();
  const m = mat(color, { rough: 0.85 });
  g.add(mesh(new RoundedBoxGeometry(0.24, 0.2, 0.08, 3, 0.04), m, 0, 0.12, 0.06));
  for (let i = 0; i < 4; i++) g.add(mesh(new CylinderGeometry(0.03, 0.03, 0.14, 10), m, -0.08 + i * 0.054, 0.28, 0.06));
  const thumb = mesh(new CylinderGeometry(0.03, 0.03, 0.12, 10), m, -0.15, 0.15, 0.06);
  thumb.rotation.z = 0.9;
  g.add(thumb);
  g.scale.setScalar(1.8); // comically oversized foam hand
  return g;
}

function bird(): Group {
  const g = new Group();
  const blue = mat('#8EC5FF', { rough: 0.6 });
  g.add(mesh(new SphereGeometry(0.1, 20, 16), blue), mesh(new ConeGeometry(0.03, 0.07, 10), mat('#FFB547'), 0.11, 0.01, 0));
  (g.children[1] as Mesh).rotation.z = -Math.PI / 2;
  const wing = mesh(new SphereGeometry(0.07, 12, 10), blue, -0.02, 0.07, 0.05);
  wing.scale.set(1, 0.3, 0.6);
  wing.rotation.z = 0.7; // frozen mid-flap
  g.add(wing, mesh(new SphereGeometry(0.015, 8, 6), mat('#111'), 0.07, 0.04, 0.07));
  return g;
}

export function buildProp(key: string): Prop | null {
  switch (key) {
    // ---- Q1: Friday night ----
    case 'q1_shy': {
      const b = book();
      return { parts: [{ anchor: 'floor', obj: blanket() }, { anchor: 'hand', obj: b }], anim: (t) => (b.rotation.z = Math.sin(t * 1.5) * 0.05) };
    }
    case 'q1_playful': {
      const ball = new Mesh(new IcosahedronGeometry(0.22, 1), new MeshStandardMaterial({ color: '#dddddd', metalness: 1, roughness: 0.15, flatShading: true }));
      const string = mesh(new CylinderGeometry(0.004, 0.004, 0.5, 4), mat('#999'), 0, 0.45);
      const disco = new Group();
      disco.add(ball, string);
      disco.position.set(0, 0.55, 0);
      const floor = new Group();
      const tiles = ['#FFD43B', '#FF8FB1', '#5EEAD4'].map((c) => glow(c, 0.5));
      const cells: Mesh[] = [];
      for (let i = 0; i < 9; i++) {
        const tile = mesh(new PlaneGeometry(0.38, 0.38), tiles[i % 3], ((i % 3) - 1) * 0.4, 0.01, (Math.floor(i / 3) - 1) * 0.4);
        tile.rotation.x = -Math.PI / 2;
        cells.push(tile);
        floor.add(tile);
      }
      return {
        parts: [
          { anchor: 'head', obj: disco },
          { anchor: 'floor', obj: floor },
        ],
        anim: (t) => {
          ball.rotation.y = t * 1.5;
          cells.forEach((c, i) => (c.material = tiles[(i + Math.floor(t * 4)) % 3]));
        },
      };
    }
    case 'q1_dramatic': {
      const moon = crescent();
      moon.position.set(-1.0, 2.1, -0.4);
      moon.rotation.z = -0.4;
      const sp = sparkles(4, '#FFF3C4', [1.2, 0.6, 0.4], 1.7);
      sp.g.position.x = -0.9;
      return {
        parts: [
          { anchor: 'floor', obj: moon },
          { anchor: 'floor', obj: sp.g },
          { anchor: 'hand', obj: mic() },
        ],
        anim: (t) => {
          moon.position.y = 2.1 + Math.sin(t) * 0.04;
          sp.anim(t);
        },
      };
    }
    case 'q1_calm': {
      const can = new Group();
      const canM = mat('#5EEAD4', { rough: 0.4, metal: 0.2 });
      can.add(mesh(new CylinderGeometry(0.1, 0.12, 0.18, 20), canM, 0, 0.08, 0.1));
      const spout = mesh(new CylinderGeometry(0.015, 0.025, 0.24, 10), canM, 0.16, 0.12, 0.1);
      spout.rotation.z = -1.0;
      const handle = mesh(new TorusGeometry(0.07, 0.015, 8, 20, Math.PI), canM, -0.04, 0.17, 0.1);
      can.add(spout, handle);
      can.rotation.z = -0.35;
      const pot = plant();
      pot.position.set(0.9, 0, 0.35);
      const dropM = mat('#8EC5FF', { rough: 0.1 });
      const drops = [0, 1, 2].map(() => mesh(new SphereGeometry(0.025, 8, 6), dropM));
      const rain = new Group();
      rain.add(...drops);
      rain.position.set(0.86, 0, 0.35);
      return {
        parts: [
          { anchor: 'hand', obj: can },
          { anchor: 'floor', obj: pot },
          { anchor: 'floor', obj: rain },
        ],
        anim: (t) => drops.forEach((d, i) => (d.position.y = 0.95 - ((t * 0.8 + i / 3) % 1) * 0.55)),
      };
    }
    // ---- Q2: someone says hi ----
    case 'q2_shy': {
      const hole = new Group();
      const disc = mesh(new CircleGeometry(0.42, 40), new MeshBasicMaterial({ color: '#000000' }), 0, 0.012, 0);
      const rim = mesh(new TorusGeometry(0.42, 0.03, 8, 40), mat('#3a2a22', { rough: 1 }), 0, 0.015, 0);
      disc.rotation.x = rim.rotation.x = -Math.PI / 2;
      hole.add(disc, rim);
      hole.position.set(0.95, 0, 0.3);
      hole.scale.set(1, 1, 0.6);
      const drop = new Group();
      const dropM = mat('#8EC5FF', { rough: 0.05, emissive: '#5aa8ff', ei: 0.2 });
      drop.add(mesh(new SphereGeometry(0.06, 16, 12), dropM), mesh(new ConeGeometry(0.052, 0.09, 16), dropM, 0, 0.07));
      drop.position.set(0.45, -0.1, 0.3);
      return {
        parts: [
          { anchor: 'floor', obj: hole },
          { anchor: 'head', obj: drop },
        ],
        anim: (t) => (drop.position.y = -0.1 - ((t * 0.5) % 1) * 0.15),
      };
    }
    case 'q2_playful': {
      const r = foamHand('#FFD43B');
      const l = foamHand('#FFD43B');
      l.scale.x = -1;
      const conf = sparkles(6, '#FF8FB1', [1.6, 0.8, 0.6], 1.2);
      return {
        parts: [
          { anchor: 'hand', obj: r },
          { anchor: 'handL', obj: l },
          { anchor: 'floor', obj: conf.g },
        ],
        anim: conf.anim,
      };
    }
    case 'q2_dramatic': {
      const carpet = mesh(new BoxGeometry(0.8, 0.02, 2.4), mat('#B3122E', { rough: 0.9 }), 0, 0.01, 0.9);
      const posts = new Group();
      for (const x of [-0.6, 0.6]) {
        posts.add(
          mesh(new CylinderGeometry(0.025, 0.025, 0.45, 10), mat('#E8C46A', { metal: 1, rough: 0.3 }), x, 0.22, 1.2),
          mesh(new SphereGeometry(0.045, 12, 10), mat('#E8C46A', { metal: 1, rough: 0.3 }), x, 0.47, 1.2),
        );
      }
      const flashes = sparkles(5, '#ffffff', [2.4, 1.2, 0.5], 0.8);
      return {
        parts: [
          { anchor: 'floor', obj: carpet },
          { anchor: 'floor', obj: posts },
          { anchor: 'floor', obj: flashes.g },
        ],
        anim: (t) => flashes.anim(t * 2),
      };
    }
    case 'q2_calm': {
      const cup = new Group();
      cup.add(
        mesh(new CylinderGeometry(0.08, 0.06, 0.1, 20), mat('#F5E6D8', { rough: 0.5 }), 0, 0.06, 0.1),
        mesh(new CylinderGeometry(0.12, 0.12, 0.012, 24), mat('#F5E6D8', { rough: 0.5 }), 0, 0.005, 0.1),
        mesh(new TorusGeometry(0.03, 0.01, 6, 12), mat('#F5E6D8'), 0.09, 0.06, 0.1),
      );
      const steam = [0, 1, 2].map(() => mesh(new SphereGeometry(0.03, 8, 6), new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.4 })));
      cup.add(...steam);
      const stones = new Group();
      [0.16, 0.12, 0.08].reduce((y, r) => {
        const s = mesh(new SphereGeometry(r, 20, 12), mat('#9a9aa2', { rough: 0.9 }), 0, y + r * 0.45, 0);
        s.scale.y = 0.45;
        stones.add(s);
        return y + r * 0.9;
      }, 0);
      stones.position.set(-0.95, 0, 0.3);
      return {
        parts: [
          { anchor: 'hand', obj: cup },
          { anchor: 'floor', obj: stones },
        ],
        anim: (t) =>
          steam.forEach((s, i) => {
            const k = (t * 0.6 + i / 3) % 1;
            s.position.set(Math.sin(k * 6 + i) * 0.02, 0.14 + k * 0.25, 0.1);
            (s.material as MeshStandardMaterial).opacity = 0.4 * (1 - k);
          }),
      };
    }
    // ---- Q3: superpower ----
    case 'q3_shy': {
      const sp = sparkles(5, '#ffffff', [1.4, 1.4, 0.6], 0.5);
      return { parts: [{ anchor: 'floor', obj: sp.g }], anim: sp.anim, invisible: true };
    }
    case 'q3_playful': {
      const tramp = new Group();
      const frame = mesh(new TorusGeometry(0.62, 0.04, 10, 40), mat('#5EEAD4', { rough: 0.4 }), 0, 0.14, 0);
      frame.rotation.x = -Math.PI / 2;
      const matM = new Mesh(new CircleGeometry(0.6, 40), mat('#1d1d22', { rough: 0.6 }));
      matM.rotation.x = -Math.PI / 2;
      matM.position.y = 0.13;
      tramp.add(frame, matM);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        tramp.add(mesh(new CylinderGeometry(0.02, 0.02, 0.14, 8), mat('#3A3A40'), Math.cos(a) * 0.55, 0.07, Math.sin(a) * 0.55));
      }
      return { parts: [{ anchor: 'floor', obj: tramp }], anim: (t) => (matM.position.y = 0.13 - Math.max(0, -Math.cos(t * Math.PI * 2 * 2)) * 0.05) };
    }
    case 'q3_dramatic': {
      const beam = new Mesh(new ConeGeometry(0.95, 4, 40, 1, true), new MeshBasicMaterial({ color: '#FFE9C2', transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
      beam.position.y = 2;
      const pool = mesh(new CircleGeometry(0.95, 40), glow('#FFE9C2', 0.25), 0, 0.012, 0);
      pool.rotation.x = -Math.PI / 2;
      const sp = sparkles(5, '#FFE58A', [1.6, 1, 0.5], 1.0);
      return {
        parts: [
          { anchor: 'floor', obj: beam },
          { anchor: 'floor', obj: pool },
          { anchor: 'floor', obj: sp.g },
        ],
        anim: sp.anim,
      };
    }
    case 'q3_calm': {
      const btn = new Group();
      const disc = mesh(new CylinderGeometry(0.28, 0.28, 0.06, 40), mat('#F2F2F2', { rough: 0.4 }));
      disc.rotation.x = Math.PI / 2;
      const barM = mat('#2B2B30');
      btn.add(disc, mesh(new RoundedBoxGeometry(0.06, 0.2, 0.03, 2, 0.02), barM, -0.06, 0, 0.035), mesh(new RoundedBoxGeometry(0.06, 0.2, 0.03, 2, 0.02), barM, 0.06, 0, 0.035));
      btn.position.set(-1.0, 1.6, 0.2);
      const b = bird();
      b.position.set(0.95, 1.55, 0.2);
      return {
        parts: [
          { anchor: 'floor', obj: btn },
          { anchor: 'floor', obj: b },
        ],
        anim: (t) => (btn.position.y = 1.6 + Math.sin(t * 1.2) * 0.04),
      };
    }
  }
  return null;
}

/** Shows one prop at a time with the accessory pop-in; caches built props. */
export class Props {
  private cache = new Map<string, Prop>();
  private active: string | null = null;
  private handL = new Object3D();
  invisible = false;

  constructor(
    private robot: RobotParts,
    private reduced: boolean,
  ) {
    this.handL.position.set(-0.07, -0.42, 0.05);
    robot.arm_L.add(this.handL);
  }

  private anchor(a: Anchor): Object3D {
    const e = this.robot.empties;
    return { hand: e.hand_R, handL: this.handL, head: e.head_top, body: this.robot.body, floor: this.robot.root }[a];
  }

  show(key: string | null) {
    if (key === this.active) return;
    if (this.active) {
      const old = this.cache.get(this.active);
      old?.parts.forEach(({ obj }) => {
        gsap.killTweensOf(obj.scale);
        if (this.reduced) obj.visible = false;
        else gsap.to(obj.scale, { x: obj.scale.x * 0.001, y: obj.scale.y * 0.001, z: obj.scale.z * 0.001, duration: 0.15, ease: 'power2.in', onComplete: () => void (obj.visible = false) });
      });
    }
    this.active = key;
    this.invisible = false;
    if (!key) return;
    let prop = this.cache.get(key);
    if (!prop) {
      const built = buildProp(key);
      if (!built) return;
      prop = built;
      for (const { anchor, obj } of prop.parts) {
        obj.userData.base = obj.scale.clone(); // pop relative to the part's own (maybe mirrored) scale
        this.anchor(anchor).add(obj);
      }
      this.cache.set(key, prop);
    }
    this.invisible = !!prop.invisible;
    for (const { obj } of prop.parts) {
      const b = obj.userData.base as Vector3;
      gsap.killTweensOf(obj.scale);
      obj.visible = true;
      if (this.reduced) {
        obj.scale.copy(b);
        continue;
      }
      obj.scale.copy(b).multiplyScalar(0.001);
      gsap
        .timeline()
        .to(obj.scale, { x: b.x * 1.1, y: b.y * 1.1, z: b.z * 1.1, duration: 0.22, ease: 'power2.out' })
        .to(obj.scale, { x: b.x, y: b.y, z: b.z, duration: 0.13 });
    }
  }

  update(t: number) {
    if (!this.active || this.reduced) return;
    this.cache.get(this.active)?.anim?.(t);
  }

  /** Free everything (e.g. once the quiz is over). */
  clear() {
    this.show(null);
    for (const p of this.cache.values())
      for (const { obj } of p.parts) {
        obj.traverse((c) => {
          if (c instanceof Mesh) {
            c.geometry.dispose();
            (Array.isArray(c.material) ? c.material : [c.material]).forEach((m: Material) => m.dispose());
          }
        });
        obj.removeFromParent();
      }
    this.cache.clear();
  }
}
