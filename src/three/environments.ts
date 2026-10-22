// Small diorama behind Roo on the reveal: one per personality, toy-like matte felt/wood on a
// stepped round base so each zone reads clearly. Built on demand, disposed when hidden.
import {
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  QuadraticBezierCurve3,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Light,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import type { Personality } from '../data/content';
import { extrude, heartShape, mat, mesh, starShape } from './accessories';

export interface EnvState {
  watched: number; // seconds the cursor has been near Roo
  beat: number; // 0..1 phase of a 120 BPM beat
}

export interface Env {
  root: Group;
  pieces: Object3D[]; // build order for the staggered reveal
  level: number; // how bright the rest of the rig should be (dramatic dims to 40%)
  update(t: number, s: EnvState): void;
}

const felt = (color: string, sheen = '#ffffff') =>
  new MeshPhysicalMaterial({ color, roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new Color(sheen) });

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

/** Stepped round base; the top surface sits at y = 0. */
function platform(top: Material, base: Material, rim?: Material): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(2.05, 2.15, 0.2, 64), base, 0, -0.18, 0), mesh(new CylinderGeometry(1.92, 1.95, 0.08, 64), top, 0, -0.04, 0));
  if (rim) {
    const r = mesh(new TorusGeometry(1.94, 0.035, 10, 80), rim, 0, -0.005, 0);
    r.rotation.x = Math.PI / 2;
    g.add(r);
  }
  return g;
}

const at = (o: Object3D, x: number, y: number, z: number, ry = 0) => {
  o.position.set(x, y, z);
  o.rotation.y = ry;
  return o;
};

function catenary(a: Vector3, b: Vector3, sag: number) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;
  return new QuadraticBezierCurve3(a, mid, b);
}

// ------------------------------------------------------------------ Shy: blanket fort nook
function shy(): Env {
  const root = new Group();
  const pieces: Object3D[] = [];
  const add = (o: Object3D) => (root.add(o), pieces.push(o), o);

  add(platform(felt('#F6C9D6', '#ffd9e6'), felt('#FBEDE3'), felt('#FFFFFF')));

  const rugTex = canvasTex(256, (g, s) => {
    g.fillStyle = '#FFF4EA';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#FFB3C8';
    g.lineWidth = 10;
    for (let r = 30; r < s / 2; r += 34) {
      g.beginPath();
      g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
      g.stroke();
    }
  });
  add(at(mesh(new CylinderGeometry(1.05, 1.05, 0.025, 48), new MeshStandardMaterial({ map: rugTex, roughness: 1 })), 0, 0.012, 0.2));

  // blanket fort: two droopy cloth panels on an A-frame, opening toward the camera
  const stripes = canvasTex(
    128,
    (g, s) => {
      g.fillStyle = '#FFF1E0';
      g.fillRect(0, 0, s, s);
      g.fillStyle = '#FFB3C8';
      for (let i = 0; i < s; i += 32) g.fillRect(i, 0, 14, s);
    },
    2,
  );
  const cloth = new MeshPhysicalMaterial({ map: stripes, roughness: 1, sheen: 1, sheenColor: new Color('#ffd0de'), side: DoubleSide });
  const fort = new Group();
  const RIDGE = 1.95;
  const FOOT = 1.15;
  const L = Math.hypot(RIDGE, FOOT);
  const slope = Math.atan2(RIDGE, FOOT);
  for (const side of [-1, 1]) {
    // panel in local XZ: x runs from the ridge (0) down to the floor (L), z along the ridge
    const geo = new PlaneGeometry(L, 1.7, 16, 16);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 4) * 0.04 + Math.cos(y * 5 + x) * 0.03); // soft folds
    }
    geo.translate(L / 2, 0, 0);
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    const panel = new Mesh(geo, cloth);
    panel.position.set(0, RIDGE, -0.75);
    panel.rotation.z = side > 0 ? -slope : Math.PI + slope;
    fort.add(panel);
  }
  // back wall closes the fort so it reads from the front as a cosy striped tent
  const backShape = new Shape();
  backShape.moveTo(-FOOT, 0);
  backShape.lineTo(FOOT, 0);
  backShape.lineTo(0, RIDGE);
  backShape.closePath();
  const back = new Mesh(new ShapeGeometry(backShape), cloth);
  back.position.z = -1.58;
  fort.add(back);
  // front flaps tied open
  for (const side of [-1, 1]) {
    const flap = new Shape();
    flap.moveTo(0, RIDGE);
    flap.lineTo(side * FOOT, 0);
    flap.lineTo(side * (FOOT - 0.32), 0);
    flap.quadraticCurveTo(side * 0.5, 0.9, 0, RIDGE);
    const f = new Mesh(new ShapeGeometry(flap), cloth);
    f.position.z = 0.1;
    fort.add(f);
  }
  const ridge = mesh(new CylinderGeometry(0.03, 0.03, 1.8, 8), mat('#C8A27A', { rough: 0.8 }), 0, RIDGE + 0.02, -0.75);
  ridge.rotation.x = Math.PI / 2;
  fort.add(ridge);
  add(fort);

  // fairy lights across the front of the fort
  const bulbM = new MeshStandardMaterial({ color: '#FFF3C4', emissive: new Color('#FFC86B'), emissiveIntensity: 2.2 });
  const curve = catenary(new Vector3(-1.75, 1.75, -0.2), new Vector3(1.75, 1.85, -0.2), 0.45);
  const lights = new Group();
  lights.add(new Mesh(new TubeGeometry(curve, 40, 0.008, 6), mat('#3a2f2a')));
  const bulbs: Mesh[] = [];
  for (let i = 1; i < 14; i++) {
    const b = mesh(new SphereGeometry(0.045, 10, 8), bulbM.clone());
    b.position.copy(curve.getPoint(i / 14));
    b.position.y -= 0.05;
    bulbs.push(b);
    lights.add(b);
  }
  add(lights);

  // floor lamp with a warm practical light
  const lamp = new Group();
  lamp.add(
    mesh(new CylinderGeometry(0.16, 0.18, 0.04, 24), mat('#3a2f2a'), 0, 0.02, 0),
    mesh(new CylinderGeometry(0.015, 0.015, 1.5, 8), mat('#3a2f2a'), 0, 0.77, 0),
    mesh(new CylinderGeometry(0.18, 0.3, 0.32, 24, 1, true), new MeshStandardMaterial({ color: '#FFE2C2', emissive: new Color('#FFB56B'), emissiveIntensity: 0.9, side: DoubleSide }), 0, 1.58, 0),
  );
  const warm = new PointLight('#FFB56B', 5, 4.5, 1.6);
  warm.position.set(0, 1.45, 0.1);
  lamp.add(warm);
  add(at(lamp, 1.45, 0, -0.5));

  // knitted blanket pile at ground_L, books + mug at the right
  const knit = felt('#FFB3C8', '#ffe0ea');
  const cream = felt('#FFF1E0');
  const pile = new Group();
  [knit, cream, knit].forEach((m, i) => {
    const b = mesh(new RoundedBoxGeometry(0.62, 0.09, 0.42, 3, 0.04), m, 0, 0.05 + i * 0.085, 0);
    b.rotation.y = (i - 1) * 0.18;
    pile.add(b);
  });
  add(at(pile, -1.25, 0, 0.35, 0.3));
  const books = new Group();
  ['#8EC5FF', '#C4B5FD', '#FF8FB1'].forEach((c, i) => {
    const b = mesh(new RoundedBoxGeometry(0.42, 0.08, 0.3, 2, 0.015), mat(c, { rough: 0.7 }), 0, 0.04 + i * 0.08, 0);
    b.rotation.y = (i - 1) * 0.2;
    books.add(b);
  });
  books.add(mesh(new CylinderGeometry(0.06, 0.05, 0.11, 16), mat('#FFF8EC', { rough: 0.5 }), 0.05, 0.3, 0));
  add(at(books, 1.15, 0, 0.55, -0.4));
  for (const [x, c] of [
    [-0.75, '#FFB3C8'],
    [0.8, '#FFF1E0'],
  ] as const) {
    const pillow = mesh(new RoundedBoxGeometry(0.5, 0.22, 0.45, 4, 0.1), felt(c), x, 0.11, -0.35);
    pillow.rotation.set(0.1, x * 0.4, x * -0.15);
    add(pillow);
  }

  // hearts float up after Roo has been watched for 3 s
  const heartM = new MeshStandardMaterial({ color: '#FF8FB1', emissive: new Color('#FF5A8C'), emissiveIntensity: 0.6, transparent: true });
  const hearts = [0, 1, 2, 3].map(() => {
    const h = mesh(extrude(heartShape(0.07), 0.03), heartM.clone());
    h.visible = false;
    root.add(h);
    return h;
  });

  return {
    root,
    pieces,
    level: 0.75,
    update: (t, s) => {
      bulbs.forEach((b, i) => ((b.material as MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(t * 2 + i * 1.3) * 0.7));
      warm.intensity = 5 + Math.sin(t * 9) * 0.15;
      hearts.forEach((h, i) => {
        const k = (t * 0.45 + i / hearts.length) % 1;
        h.visible = s.watched > 3;
        h.position.set(0.45 + Math.sin(k * 7 + i) * 0.15, 1.9 + k * 1.1, 0.3);
        h.scale.setScalar(0.6 + k * 0.6);
        (h.material as MeshStandardMaterial).opacity = 1 - k;
      });
    },
  };
}

// ------------------------------------------------------------------ Playful: ball-pit party
function playful(): Env {
  const root = new Group();
  const pieces: Object3D[] = [];
  const add = (o: Object3D) => (root.add(o), pieces.push(o), o);
  const COLORS = ['#FF8FB1', '#5EEAD4', '#FFD43B', '#C4B5FD', '#8EC5FF', '#FFFFFF'];

  add(platform(mat('#FFD43B', { rough: 0.6 }), mat('#5EEAD4', { rough: 0.6 }), mat('#FFFFFF', { rough: 0.5 })));

  // ball-pit wall around the back half, stripy
  const wallTex = canvasTex(256, (g, s) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = COLORS[i % 5];
      g.fillRect((i * s) / 8, 0, s / 8, s);
    }
  });
  wallTex.repeat.set(3, 1);
  add(mesh(new CylinderGeometry(1.75, 1.75, 0.42, 64, 1, true, Math.PI * 0.5, Math.PI), new MeshStandardMaterial({ map: wallTex, roughness: 0.6, side: DoubleSide }), 0, 0.21, 0));

  // balls: instanced, heaped at the back, a few strays
  const ballGeo = new SphereGeometry(0.1, 14, 10);
  const balls = new InstancedMesh(ballGeo, new MeshStandardMaterial({ roughness: 0.35 }), 90);
  const m4 = new Matrix4();
  const col = new Color();
  for (let i = 0; i < 90; i++) {
    const back = i < 78;
    const a = back ? Math.PI * (0.55 + Math.random() * 0.9) : Math.random() * Math.PI * 2;
    const r = back ? 0.9 + Math.random() * 0.75 : 0.7 + Math.random() * 1.1;
    const y = back ? 0.1 + Math.random() * 0.25 : 0.1;
    m4.makeTranslation(Math.cos(a) * r, y, -Math.abs(Math.sin(a) * r) * (back ? 1 : -0.6));
    balls.setMatrixAt(i, m4);
    balls.setColorAt(i, col.set(COLORS[i % COLORS.length]));
  }
  add(balls);

  // balloons on strings
  const balloons: Group[] = [];
  [
    [-1.3, '#FF8FB1'],
    [1.25, '#5EEAD4'],
    [1.55, '#C4B5FD'],
  ].forEach(([x, c], i) => {
    const g = new Group();
    const b = mesh(new SphereGeometry(0.22, 24, 18), new MeshPhysicalMaterial({ color: c as string, roughness: 0.2, clearcoat: 1 }), 0, 0, 0);
    b.scale.y = 1.15;
    g.add(b, mesh(new CylinderGeometry(0.004, 0.004, 1.3, 4), mat('#ddd'), 0, -0.9, 0));
    g.position.set(x as number, 2.0 + i * 0.25, -0.7);
    balloons.push(g);
    add(g);
  });

  // bouncy ball at ground_L
  const ballTex = canvasTex(128, (g, s) => {
    g.fillStyle = '#FFD43B';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#FF5A4E';
    g.fillRect(0, s * 0.4, s, s * 0.2);
  });
  const bouncy = mesh(new SphereGeometry(0.2, 28, 20), new MeshPhysicalMaterial({ map: ballTex, roughness: 0.3, clearcoat: 0.6 }));
  add(at(bouncy, -1.25, 0.2, 0.4));

  // R-O-O toy blocks
  const blocks = new Group();
  'ROO'.split('').forEach((ch, i) => {
    const tex = canvasTex(128, (g, s) => {
      g.fillStyle = COLORS[i + 1];
      g.fillRect(0, 0, s, s);
      g.fillStyle = '#ffffff';
      g.font = `bold ${s * 0.7}px Geist, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ch, s / 2, s * 0.55);
    });
    const b = mesh(new RoundedBoxGeometry(0.28, 0.28, 0.28, 3, 0.04), new MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    b.position.set(i === 2 ? 0.15 : i * 0.3, i === 2 ? 0.42 : 0.14, 0);
    b.rotation.y = (i - 1) * 0.25;
    blocks.add(b);
  });
  add(at(blocks, 0.95, 0, 0.6, -0.5));

  // 60 confetti pieces, always falling
  const conf = new InstancedMesh(new PlaneGeometry(0.06, 0.1), new MeshStandardMaterial({ side: DoubleSide, roughness: 0.6 }), 60);
  const seeds = Array.from({ length: 60 }, (_, i) => ({ x: (Math.random() - 0.5) * 3.6, z: (Math.random() - 0.5) * 2 - 0.2, sp: 0.3 + Math.random() * 0.4, ph: Math.random(), c: COLORS[i % 5] }));
  seeds.forEach((sd, i) => conf.setColorAt(i, col.set(sd.c)));
  conf.userData.noShadow = true;
  root.add(conf);

  // two sweeping disco lights
  const disco = (['#FF8FB1', '#5EEAD4'] as const).map((c, i) => {
    const l = new SpotLight(c, 18, 9, 0.35, 0.8, 1.4);
    l.position.set(i ? 2.2 : -2.2, 3.6, 1.5);
    root.add(l, l.target);
    return l;
  });

  const o = new Object3D();
  return {
    root,
    pieces,
    level: 1,
    update: (t, s) => {
      balloons.forEach((b, i) => {
        b.position.y += Math.sin(t * 1.3 + i) * 0.0015;
        b.rotation.z = Math.sin(t * 1.1 + i * 2) * 0.08;
      });
      bouncy.position.y = 0.2 + Math.abs(Math.sin(t * Math.PI)) * 0.5;
      bouncy.scale.set(1, s.beat < 0.06 ? 0.85 : 1, 1);
      seeds.forEach((sd, i) => {
        const k = (t * sd.sp + sd.ph) % 1;
        o.position.set(sd.x + Math.sin(t * 2 + i) * 0.1, 3.2 - k * 3.2, sd.z);
        o.rotation.set(t * 3 + i, t * 2 + i, 0);
        o.updateMatrix();
        conf.setMatrixAt(i, o.matrix);
      });
      conf.instanceMatrix.needsUpdate = true;
      disco.forEach((l, i) => l.target.position.set(Math.sin(t * 1.4 + i * Math.PI) * 1.5, 0, Math.cos(t * 1.1 + i) * 0.8));
    },
  };
}

// ------------------------------------------------------------------ Dramatic: theatre stage
function dramatic(): Env {
  const root = new Group();
  const pieces: Object3D[] = [];
  const add = (o: Object3D) => (root.add(o), pieces.push(o), o);

  const planks = canvasTex(256, (g, s) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#7A4A2A' : '#6B3E22';
      g.fillRect(0, (i * s) / 8, s, s / 8);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, (i * s) / 8, s, 2);
    }
  }, 2);
  add(platform(new MeshStandardMaterial({ map: planks, roughness: 0.55 }), mat('#2a0a10', { rough: 0.8 }), mat('#C9A24A', { metal: 1, rough: 0.35 })));

  // backdrop
  add(mesh(new PlaneGeometry(5.2, 4.2), mat('#1a070c', { rough: 1 }), 0, 2.0, -1.6));

  // footlights along the front edge
  const foot = new Group();
  const bulbM = new MeshStandardMaterial({ color: '#FFF3C4', emissive: new Color('#FFD27A'), emissiveIntensity: 2.5 });
  for (let i = 0; i < 9; i++) {
    const a = Math.PI / 2 + (i - 4) * 0.17;
    foot.add(mesh(new SphereGeometry(0.05, 10, 8), bulbM, Math.cos(a) * 1.82, 0.04, Math.sin(a) * 1.82));
  }
  add(foot);

  // gold walk-of-fame star under Roo
  const star = mesh(extrude(starShape(0.42), 0.02), mat('#E8C46A', { metal: 1, rough: 0.3 }));
  star.rotation.x = -Math.PI / 2;
  add(at(star, 0, 0.02, 0.15));

  // rose at ground_L
  const rose = new Group();
  const stem = mesh(new CylinderGeometry(0.012, 0.012, 0.55, 6), mat('#2E6B3A'), 0, 0.02, 0);
  stem.rotation.z = Math.PI / 2;
  rose.add(stem);
  const petalM = mat('#C8102E', { rough: 0.5 });
  for (let i = 0; i < 6; i++) {
    const p = mesh(new SphereGeometry(0.06, 12, 10), petalM, 0.3 + Math.cos(i) * 0.03, 0.06, Math.sin(i * 2) * 0.03);
    p.scale.set(1, 0.7, 1.2);
    rose.add(p);
  }
  add(at(rose, -1.25, 0, 0.45, 0.6));

  // velvet curtains: in front of Roo, closed at first; the reveal opens them
  const velvet = new MeshPhysicalMaterial({ color: '#8E0F1F', roughness: 0.75, sheen: 1, sheenRoughness: 0.4, sheenColor: new Color('#ff6a6a'), side: DoubleSide });
  const curtain = (side: -1 | 1) => {
    const geo = new PlaneGeometry(1.3, 3.8, 48, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 15) * 0.07);
    geo.computeVertexNormals();
    const c = new Mesh(geo, velvet);
    c.position.set(side * 2.05, 1.9, 0.95);
    c.userData.open = side * 2.05;
    c.userData.closed = side * 0.62;
    return c;
  };
  const cL = curtain(-1);
  const cR = curtain(1);
  root.add(cL, cR);
  const valance = new Mesh(new PlaneGeometry(5.2, 0.6, 60, 1), velvet);
  const vp = valance.geometry.attributes.position;
  for (let i = 0; i < vp.count; i++) vp.setZ(i, Math.sin(vp.getX(i) * 10) * 0.05);
  valance.geometry.computeVertexNormals();
  valance.position.set(0, 3.75, 0.9);
  root.add(valance);

  // visible spotlight cone (the real SpotLight lives in the stage rig)
  const beam = new Mesh(
    new CylinderGeometry(0.05, 1.0, 4.2, 40, 1, true),
    new MeshBasicMaterial({ color: '#FFE9C2', transparent: true, opacity: 0.09, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
  );
  beam.position.set(0, 2.1, 0.1);
  add(beam);

  // twinkling sparkles around Roo for held poses
  const spM = new MeshStandardMaterial({ color: '#FFE58A', emissive: new Color('#FFD43B'), emissiveIntensity: 1.5 });
  const sparkles = Array.from({ length: 7 }, (_, i) => {
    const s = mesh(extrude(starShape(0.07), 0.02), spM, Math.cos(i * 0.9) * 1.0, 0.8 + (i % 4) * 0.45, 0.4 + Math.sin(i) * 0.3);
    root.add(s);
    return s;
  });

  return {
    root,
    pieces,
    level: 0.4,
    update: (t) => {
      sparkles.forEach((s, i) => {
        s.scale.setScalar(Math.max(0, Math.sin(t * 2.2 + i * 1.7)) ** 3 * 1.2 + 0.001);
        s.rotation.z = t + i;
      });
    },
  };
}

// ------------------------------------------------------------------ Calm: zen garden
function calm(): Env {
  const root = new Group();
  const pieces: Object3D[] = [];
  const add = (o: Object3D) => (root.add(o), pieces.push(o), o);

  const rake = canvasTex(512, (g, s) => {
    g.fillStyle = '#E9DDC4';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(150,125,90,0.55)';
    g.lineWidth = 3;
    for (let r = 14; r < s * 0.75; r += 14) {
      g.beginPath();
      g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
      g.stroke();
    }
  });
  const sand = new MeshStandardMaterial({ map: rake, bumpMap: rake, bumpScale: 2, roughness: 1 });
  add(platform(sand, mat('#3A4A48', { rough: 0.9 }), mat('#5C6E6A', { rough: 0.9 })));

  // smooth stones
  [
    [-0.95, -0.5, 0.36, '#8B9592'],
    [1.05, 0.35, 0.22, '#A8B0AC'],
    [1.3, 0.1, 0.14, '#6E7976'],
  ].forEach(([x, z, r, c]) => {
    const s = mesh(new SphereGeometry(r as number, 28, 18), mat(c as string, { rough: 0.7 }), x as number, (r as number) * 0.4, z as number);
    s.scale.y = 0.55;
    add(s);
  });

  // moss mounds
  for (const [x, z] of [
    [-1.45, 0.1],
    [0.55, -1.2],
  ]) {
    const m = mesh(new SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), felt('#5E8F4E', '#a6d68e'), x, 0, z);
    m.scale.y = 0.5;
    add(m);
  }

  // bonsai in a dark ceramic pot (back right)
  const bonsai = new Group();
  bonsai.add(mesh(new RoundedBoxGeometry(0.62, 0.18, 0.4, 3, 0.05), mat('#2B2B30', { rough: 0.35 }), 0, 0.09, 0));
  const trunkCurve = new CatmullRomCurve3([new Vector3(0, 0.15, 0), new Vector3(0.12, 0.45, 0), new Vector3(-0.1, 0.75, 0.02), new Vector3(0.05, 1.0, 0)]);
  bonsai.add(new Mesh(new TubeGeometry(trunkCurve, 24, 0.045, 8), mat('#5B3A29', { rough: 0.9 })));
  const leaf = felt('#4E8F5E', '#9fdcae');
  for (const [x, y, r] of [
    [0.05, 1.05, 0.26],
    [-0.25, 0.82, 0.2],
    [0.28, 0.7, 0.18],
  ]) {
    const f = mesh(new SphereGeometry(r, 20, 14), leaf, x, y, 0);
    f.scale.y = 0.6;
    bonsai.add(f);
  }
  add(at(bonsai, 1.15, 0, -0.85, -0.3));

  // paper lantern (back left) with a soft warm glow
  const lantern = new Group();
  lantern.add(
    mesh(new CylinderGeometry(0.02, 0.02, 1.0, 6), mat('#3a2f2a'), 0, 0.5, 0),
    mesh(new SphereGeometry(0.22, 20, 14), new MeshStandardMaterial({ color: '#FFF4E0', emissive: new Color('#FFC27A'), emissiveIntensity: 1.3, roughness: 0.9 }), 0, 1.12, 0),
  );
  (lantern.children[1] as Mesh).scale.y = 1.25;
  const glow = new PointLight('#FFC27A', 3, 3.5, 1.8);
  glow.position.set(0, 1.12, 0.2);
  lantern.add(glow);
  add(at(lantern, -1.35, 0, -0.75));

  // bamboo
  const bamboo = new Group();
  const bM = mat('#7FAF5A', { rough: 0.6 });
  for (let i = 0; i < 4; i++) {
    const h = 2.2 + i * 0.35;
    const stalk = new Group();
    stalk.add(mesh(new CylinderGeometry(0.045, 0.05, h, 10), bM, 0, h / 2, 0));
    for (let y = 0.4; y < h; y += 0.45) {
      const n = mesh(new TorusGeometry(0.05, 0.012, 6, 14), bM, 0, y, 0);
      n.rotation.x = Math.PI / 2;
      stalk.add(n);
    }
    stalk.position.set(-0.35 + i * 0.18, 0, -1.35 - (i % 2) * 0.12);
    stalk.rotation.z = (i - 1.5) * 0.04;
    bamboo.add(stalk);
  }
  add(bamboo);

  // terracotta potted plant at ground_L
  const pot = new Group();
  pot.add(new Mesh(new LatheGeometry([new Vector2(0, 0), new Vector2(0.14, 0), new Vector2(0.18, 0.24), new Vector2(0.2, 0.28), new Vector2(0, 0.28)], 24), mat('#C8693F', { rough: 0.85 })));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = mesh(new SphereGeometry(0.08, 12, 10), leaf, Math.cos(a) * 0.08, 0.4, Math.sin(a) * 0.08);
    l.scale.set(0.5, 1.6, 0.3);
    l.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    pot.add(l);
  }
  add(at(pot, -1.25, 0, 0.45));

  // 14 floating bokeh orbs
  const orbM = new MeshBasicMaterial({ color: '#5EEAD4', transparent: true, opacity: 0.32, blending: AdditiveBlending, depthWrite: false });
  const orbs = Array.from({ length: 14 }, (_, i) => {
    const o = mesh(new SphereGeometry(0.06 + (i % 3) * 0.03, 12, 10), orbM, Math.sin(i * 2.3) * 1.9, 0.6 + (i % 5) * 0.45, Math.cos(i * 1.7) * 0.9);
    o.userData.y = o.position.y;
    root.add(o);
    return o;
  });

  return {
    root,
    pieces,
    level: 0.8,
    update: (t) => {
      orbs.forEach((o, i) => {
        o.position.y = o.userData.y + Math.sin(t * 0.5 + i) * 0.18;
        o.scale.setScalar(1 + Math.sin(t * 0.8 + i * 2) * 0.25);
      });
      glow.intensity = 3 + Math.sin(t * 0.7) * 0.4;
    },
  };
}

const BUILD: Record<Personality, () => Env> = { shy, playful, dramatic, calm };

const isFx = (m: Material) => (m as MeshBasicMaterial).blending === AdditiveBlending || m.transparent;

/** Owns the current diorama: staged build-in, update, disposal. */
export class Environments {
  private env: Env | null = null;
  private key: Personality | null = null;

  constructor(
    private parent: Object3D,
    private reduced: boolean,
  ) {}

  get level() {
    return this.env?.level ?? 1;
  }

  get current() {
    return this.key;
  }

  /** Builds and shows the diorama. With `animate`, pieces drop in one by one after `delay` s. */
  show(p: Personality, animate: boolean, delay = 0) {
    if (this.key === p) return;
    this.hide();
    const env = BUILD[p]();
    this.env = env;
    this.key = p;
    env.root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const fx = isFx(o.material as Material);
      o.castShadow = !fx && !o.userData.noShadow;
      o.receiveShadow = !fx;
    });
    this.parent.add(env.root);

    const curtains = env.root.children.filter((c) => c.userData.open !== undefined);
    if (!animate || this.reduced) return;
    env.pieces.forEach((piece, i) => {
      const y = piece.position.y;
      const s = piece.scale.clone();
      piece.scale.multiplyScalar(0.001);
      piece.position.y = y + (i === 0 ? -0.6 : 1.2);
      const d = delay + (i === 0 ? 0 : 0.25 + i * 0.09);
      gsap.to(piece.position, { y, duration: i === 0 ? 0.7 : 0.55, delay: d, ease: i === 0 ? 'power3.out' : 'bounce.out' });
      gsap.to(piece.scale, { x: s.x, y: s.y, z: s.z, duration: 0.35, delay: d, ease: 'back.out(2)' });
    });
    // dramatic: curtains start closed in front of Roo and sweep open
    for (const c of curtains) {
      c.position.x = c.userData.closed;
      gsap.to(c.position, { x: c.userData.open, duration: 1.4, delay: delay + 0.1, ease: 'power3.inOut' });
    }
  }

  hide() {
    if (!this.env) return;
    const root = this.env.root;
    gsap.killTweensOf(root.children.map((c) => c.position).concat(root.children.map((c) => c.scale)));
    root.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m: Material) => {
          for (const v of Object.values(m)) if (v && (v as CanvasTexture).isTexture) (v as CanvasTexture).dispose();
          m.dispose();
        });
      }
      if ((o as Light).isLight) (o as Light).dispose();
    });
    root.removeFromParent();
    this.env = null;
    this.key = null;
  }

  update(t: number, s: EnvState) {
    this.env?.update(t, s);
  }
}

