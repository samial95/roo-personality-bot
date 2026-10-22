import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  AdditiveBlending,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { SLOTS, type Slot } from '../data/content';
import type { RobotParts } from './ProceduralRobot';

const mat = (color: string, o: Partial<{ rough: number; metal: number; emissive: string; ei: number }> = {}) =>
  new MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.5,
    metalness: o.metal ?? 0,
    emissive: o.emissive ? new Color(o.emissive) : undefined,
    emissiveIntensity: o.ei ?? 1,
  });

const mesh = (g: BufferGeometry, m: Material, x = 0, y = 0, z = 0) => {
  const o = new Mesh(g, m);
  o.position.set(x, y, z);
  return o;
};

function heartShape(s: number): Shape {
  const h = new Shape();
  h.moveTo(0, -s);
  h.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.9, s * 1.1, 0, s * 0.45);
  h.bezierCurveTo(s * 0.9, s * 1.1, s * 1.4, -s * 0.2, 0, -s);
  return h;
}

function starShape(r: number): Shape {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return s;
}

const extrude = (s: Shape, depth: number) => {
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 });
  g.center();
  return g;
};

type Anim = (t: number, dancing: boolean) => void;
interface Built {
  obj: Object3D;
  anim?: Anim;
}

function build(slot: Slot, id: string, accent: string): Built | null {
  const g = new Group();
  switch (`${slot}:${id}`) {
    // ---- head (at head_top) ----
    case 'head:party': {
      const cone = mesh(new ConeGeometry(0.2, 0.46, 32), mat('#FFB547'), 0, 0.23);
      const stripeM = mat('#FF5A6E');
      for (const y of [0.08, 0.22]) {
        const r = 0.2 * (1 - y / 0.46);
        const s = mesh(new TorusGeometry(r - 0.005, 0.018, 8, 32), stripeM, 0, y);
        s.rotation.x = Math.PI / 2;
        g.add(s);
      }
      g.add(cone, mesh(new SphereGeometry(0.06, 16, 12), mat('#FF8FB1'), 0, 0.49));
      g.position.set(0.12, -0.02, 0);
      g.rotation.z = -0.25;
      return { obj: g };
    }
    case 'head:crown': {
      const gold = mat('#E8C46A', { metal: 1, rough: 0.25 });
      const bandM = new MeshStandardMaterial({ color: '#E8C46A', metalness: 1, roughness: 0.25, side: DoubleSide });
      g.add(mesh(new CylinderGeometry(0.28, 0.28, 0.1, 32, 1, true), bandM, 0, 0.05));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const spike = mesh(new ConeGeometry(0.05, 0.14, 12), gold, Math.sin(a) * 0.27, 0.16, Math.cos(a) * 0.27);
        g.add(spike, mesh(new SphereGeometry(0.025, 10, 8), mat('#FF5A4E', { rough: 0.2 }), Math.sin(a) * 0.27, 0.24, Math.cos(a) * 0.27));
      }
      g.position.y = -0.04;
      return { obj: g };
    }
    case 'head:headphones': {
      const band = mesh(new TorusGeometry(0.62, 0.035, 12, 48, Math.PI), mat('#1d1d22', { rough: 0.4 }), 0, -0.36);
      const cupM = mat(accent, { rough: 0.35 });
      const cups = [-1, 1].map((s) => {
        const c = mesh(new CylinderGeometry(0.16, 0.16, 0.1, 28), cupM, s * 0.6, -0.4);
        c.rotation.z = Math.PI / 2;
        return c;
      });
      g.add(band, ...cups);
      return {
        obj: g,
        anim: (t, dancing) => {
          const k = dancing ? 1 + 0.12 * Math.abs(Math.sin(t * Math.PI * 2)) : 1;
          cups.forEach((c) => c.scale.set(k, k, k));
        },
      };
    }
    case 'head:beanie': {
      const knit = mat('#FF8FB1', { rough: 0.95 });
      const dome = new Mesh(new SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), knit);
      dome.scale.set(1.05, 0.7, 1);
      const cuff = mesh(new TorusGeometry(0.42, 0.06, 12, 40), mat('#F5E6D8', { rough: 0.95 }));
      cuff.rotation.x = Math.PI / 2;
      g.add(dome, cuff, mesh(new SphereGeometry(0.09, 16, 12), mat('#F5E6D8', { rough: 1 }), 0, 0.32));
      g.position.y = -0.06;
      return { obj: g };
    }
    case 'head:flower': {
      const petalM = mat('#FFFFFF', { rough: 0.6 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = mesh(new SphereGeometry(0.07, 16, 12), petalM, Math.cos(a) * 0.09, Math.sin(a) * 0.09);
        p.scale.z = 0.4;
        g.add(p);
      }
      g.add(mesh(new SphereGeometry(0.055, 16, 12), mat('#FFD43B'), 0, 0, 0.02));
      g.position.set(0.3, 0.02, 0.2);
      g.rotation.set(-0.4, 0.4, 0);
      return { obj: g };
    }
    // ---- face (at face_overlay) ----
    case 'face:glasses':
    case 'face:sunglasses': {
      const sun = id === 'sunglasses';
      const frame = mat(sun ? '#111114' : '#E8C46A', { metal: sun ? 0.2 : 1, rough: 0.3 });
      for (const s of [-1, 1]) {
        if (sun) {
          g.add(mesh(new RoundedBoxGeometry(0.3, 0.2, 0.03, 3, 0.07), mat('#08080a', { rough: 0.05, metal: 0.6 }), s * 0.18, 0.02));
        } else {
          g.add(mesh(new TorusGeometry(0.12, 0.015, 10, 32), frame, s * 0.17, 0.02));
          const lens = mesh(new CylinderGeometry(0.115, 0.115, 0.005, 32), new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0 }), s * 0.17, 0.02);
          lens.rotation.x = Math.PI / 2;
          g.add(lens);
        }
      }
      g.add(mesh(new CylinderGeometry(0.012, 0.012, 0.1, 8), frame, 0, 0.04));
      (g.children.at(-1) as Mesh).rotation.z = Math.PI / 2;
      g.position.z = 0.03;
      return { obj: g };
    }
    case 'face:eyebrows': {
      const m = mat('#1c1c20', { rough: 0.6 });
      for (const s of [-1, 1]) {
        const b = mesh(new RoundedBoxGeometry(0.16, 0.035, 0.03, 2, 0.015), m, s * 0.15, 0.24, 0.02);
        b.rotation.z = s * -0.18;
        g.add(b);
      }
      return { obj: g, anim: (t) => (g.position.y = Math.max(0, Math.sin(t * 1.3)) ** 8 * 0.04) };
    }
    // ---- hand (at hand_R) ----
    case 'hand:balloon': {
      const balloon = new Group();
      const ball = new Mesh(new SphereGeometry(0.26, 32, 24), new MeshStandardMaterial({ color: '#FF7A9C', roughness: 0.25 }));
      ball.scale.y = 1.15;
      balloon.add(ball, mesh(new ConeGeometry(0.04, 0.06, 12), ball.material, 0, -0.31));
      balloon.position.set(0.45, 1.25, 0);
      const pts = [new Vector3(0, 0, 0), new Vector3(0.15, 0.5, 0), new Vector3(0.45, 0.92, 0)];
      const string = new Line(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ color: '#e8e8e8' }));
      g.add(balloon, string);
      return {
        obj: g,
        anim: (t) => {
          balloon.position.x = 0.45 + Math.sin(t * 1.1) * 0.05;
          balloon.rotation.z = Math.sin(t * 1.1) * 0.08;
          const pos = string.geometry.attributes.position;
          pos.setXYZ(1, 0.15 + Math.sin(t * 1.4) * 0.04, 0.5, 0);
          pos.setXYZ(2, balloon.position.x, 0.92, 0);
          pos.needsUpdate = true;
        },
      };
    }
    case 'hand:coffee': {
      const cup = mesh(new CylinderGeometry(0.1, 0.08, 0.2, 24), mat('#F5E6D8', { rough: 0.6 }), 0, 0.06, 0.08);
      const sleeve = mesh(new CylinderGeometry(0.103, 0.093, 0.08, 24), mat('#B07A4A', { rough: 0.9 }), 0, 0.05, 0.08);
      const lid = mesh(new CylinderGeometry(0.105, 0.105, 0.03, 24), mat('#2B2B30'), 0, 0.17, 0.08);
      g.add(cup, sleeve, lid);
      return { obj: g };
    }
    case 'hand:flag': {
      const pole = mesh(new CylinderGeometry(0.012, 0.012, 0.7, 8), mat('#C9C9C9', { metal: 1, rough: 0.3 }), 0, 0.3, 0.05);
      const geo = new PlaneGeometry(0.34, 0.22, 12, 1);
      geo.translate(0.17, 0, 0);
      const cloth = mesh(geo, new MeshStandardMaterial({ color: accent, side: DoubleSide, roughness: 0.8 }), 0.01, 0.53, 0.05);
      const base = geo.attributes.position.array.slice();
      g.add(pole, cloth);
      return {
        obj: g,
        anim: (t) => {
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = base[i * 3];
            pos.setZ(i, Math.sin(x * 18 - t * 7) * 0.03 * (x / 0.34));
          }
          pos.needsUpdate = true;
        },
      };
    }
    case 'hand:mic': {
      g.add(
        mesh(new CylinderGeometry(0.035, 0.025, 0.24, 16), mat('#1d1d22', { rough: 0.4 }), 0, 0.05, 0.08),
        mesh(new SphereGeometry(0.075, 20, 16), mat('#9a9aa2', { metal: 0.9, rough: 0.45 }), 0, 0.2, 0.08),
      );
      g.rotation.z = 0.3;
      return { obj: g };
    }
    // ---- ground (at ground_L, on the floor) ----
    case 'ground:plant': {
      const pts = [new Vector2(0, 0), new Vector2(0.17, 0), new Vector2(0.22, 0.3), new Vector2(0.25, 0.32), new Vector2(0.25, 0.36), new Vector2(0, 0.36)];
      g.add(new Mesh(new LatheGeometry(pts, 28), mat('#C8693F', { rough: 0.85 })));
      const leafM = mat('#3FA46A', { rough: 0.6 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const leaf = mesh(new SphereGeometry(0.1, 12, 10), leafM, Math.cos(a) * 0.09, 0.5 + (i % 3) * 0.07, Math.sin(a) * 0.09);
        leaf.scale.set(0.6, 1.6, 0.35);
        leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        g.add(leaf);
      }
      return { obj: g, anim: (t) => (g.rotation.z = Math.sin(t * 0.9) * 0.03) };
    }
    case 'ground:speaker': {
      const box = mesh(new RoundedBoxGeometry(0.42, 0.62, 0.36, 4, 0.06), mat('#1d1d22', { rough: 0.5 }), 0, 0.31);
      const coneM = mat('#3A3A40', { rough: 0.3, metal: 0.4 });
      const woofer = mesh(new CylinderGeometry(0.13, 0.13, 0.02, 28), coneM, 0, 0.22, 0.18);
      const tweeter = mesh(new CylinderGeometry(0.06, 0.06, 0.02, 20), coneM, 0, 0.47, 0.18);
      woofer.rotation.x = tweeter.rotation.x = Math.PI / 2;
      g.add(box, woofer, tweeter);
      g.rotation.y = 0.5;
      return {
        obj: g,
        anim: (t) => {
          const k = 1 + 0.08 * Math.max(0, Math.sin(t * Math.PI * 4)) ** 4;
          woofer.scale.set(k, 1, k);
          box.scale.setScalar(1 + (k - 1) * 0.15);
        },
      };
    }
    case 'ground:spotlight': {
      const stand = mesh(new CylinderGeometry(0.015, 0.015, 0.7, 8), mat('#2B2B30'), 0, 0.35);
      const head = mesh(new CylinderGeometry(0.09, 0.13, 0.22, 20), mat('#1d1d22', { metal: 0.5, rough: 0.4 }), 0, 0.75);
      head.rotation.z = -1.0;
      const beam = new Mesh(
        new ConeGeometry(0.55, 1.8, 32, 1, true),
        new MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.08, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      );
      beam.position.set(0.82, 0.3, 0);
      beam.rotation.z = Math.PI / 2 + 0.55;
      g.add(stand, head, beam, mesh(new CylinderGeometry(0.12, 0.14, 0.03, 20), mat('#2B2B30'), 0, 0.015));
      return { obj: g };
    }
    case 'ground:rug': {
      const rug = mesh(new CylinderGeometry(1, 1, 0.02, 48), mat('#C4B5FD', { rough: 1 }), 1.25, 0.01, -0.3);
      rug.scale.set(1, 1, 0.62);
      const ring = mesh(new TorusGeometry(0.85, 0.025, 6, 48), mat('#F2F2F2', { rough: 1 }), 1.25, 0.025, -0.3);
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(1, 0.62, 1);
      g.add(rug, ring);
      return { obj: g };
    }
  }
  return null;
}

/** Antenna toppers replace the default caps. */
function buildTopper(id: string, accent: string): Object3D | null {
  switch (id) {
    case 'bulbs': {
      const g = new Group();
      g.add(
        mesh(new CylinderGeometry(0.07, 0.07, 0.08, 16), mat('#C9C9C9', { metal: 1, rough: 0.3 }), 0, -0.1),
        mesh(new SphereGeometry(0.13, 24, 16), mat('#FFF4C2', { emissive: '#FFD43B', ei: 0.9, rough: 0.1 }), 0, 0.04),
      );
      return g;
    }
    case 'hearts':
      return mesh(extrude(heartShape(0.13), 0.06), mat('#FF5A6E', { rough: 0.3 }));
    case 'stars':
      return mesh(extrude(starShape(0.16), 0.06), mat('#FFD43B', { rough: 0.3, emissive: '#FFB547', ei: 0.25 }));
    case 'glow':
      return mesh(new SphereGeometry(0.13, 24, 16), mat(accent, { emissive: accent, ei: 1.6, rough: 0.2 }));
  }
  return null;
}

const SLOT_ANCHOR: Record<Slot, keyof RobotParts['empties']> = {
  head: 'head_top',
  antennas: 'antenna_tip_L',
  face: 'face_overlay',
  hand: 'hand_R',
  ground: 'ground_L',
};

function dispose(o: Object3D) {
  o.traverse((c) => {
    if (c instanceof Mesh || c instanceof Line) {
      c.geometry.dispose();
      (Array.isArray(c.material) ? c.material : [c.material]).forEach((m: Material) => m.dispose());
    }
  });
  o.removeFromParent();
}

const pop = (o: Object3D, reduced: boolean) => {
  if (reduced) return;
  o.scale.setScalar(0.001);
  gsap.timeline().to(o.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.22, ease: 'power2.out' }).to(o.scale, { x: 1, y: 1, z: 1, duration: 0.13, ease: 'sine.inOut' });
};

export class Accessories {
  private current: Record<Slot, string> = { head: 'none', antennas: 'caps', face: 'none', hand: 'none', ground: 'none' };
  private items: Partial<Record<Slot, Object3D[]>> = {};
  private anims: Partial<Record<Slot, Anim>> = {};
  private accent = '';

  constructor(
    private robot: RobotParts,
    private reduced: boolean,
  ) {}

  /** Applies a look; only changed slots are rebuilt (and pop in). */
  apply(acc: Record<Slot, string>, accent: string) {
    const accentChanged = accent !== this.accent;
    this.accent = accent;
    for (const slot of SLOTS) {
      const id = acc[slot];
      // accent-coloured items follow the personality colour
      const tinted = (slot === 'antennas' && id === 'glow') || (slot === 'hand' && id === 'flag') || (slot === 'head' && id === 'headphones');
      if (id === this.current[slot] && !(accentChanged && tinted)) continue;
      const animate = id !== this.current[slot];
      this.current[slot] = id;
      this.items[slot]?.forEach(dispose);
      this.items[slot] = [];
      delete this.anims[slot];

      if (slot === 'antennas') {
        this.robot.caps.forEach((c) => (c.visible = id === 'caps'));
        for (const tip of [this.robot.empties.antenna_tip_L, this.robot.empties.antenna_tip_R]) {
          const t = buildTopper(id, accent);
          if (!t) continue;
          t.position.y = -0.14;
          tip.add(t);
          this.items[slot]!.push(t);
          if (animate) pop(t, this.reduced);
        }
        continue;
      }
      const b = build(slot, id, accent);
      if (!b) continue;
      this.robot.empties[SLOT_ANCHOR[slot]].add(b.obj);
      this.items[slot]!.push(b.obj);
      if (b.anim) this.anims[slot] = b.anim;
      if (animate) pop(b.obj, this.reduced);
    }
  }

  update(t: number, dancing: boolean) {
    if (this.reduced) return;
    for (const a of Object.values(this.anims)) a?.(t, dancing);
  }
}
