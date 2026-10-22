import {
  Color,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ExtrudeGeometry,
  SphereGeometry,
  Vector2,
  type BufferGeometry,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Proportions from the reference sheet (units ≈ 100 mm). Shared with blender/make_robot.py via scripts/bake-clips.ts.
const W = 1.08;
const H = 1.58;
const D = 0.96;
export const DIMS = {
  body: { w: W, h: H, d: D, r: 0.3 },
  face: { w: 0.8, h: 0.66, r: 0.22, y: 1.1, z: D / 2 - 0.035, depth: 0.03, bevel: 0.025 },
  slot: { w: 0.34, h: 0.09, d: 0.03, r: 0.04, y: 0.56, z: D / 2 - 0.005 },
  base: { w: 0.34, h: 0.09, d: 0.3, r: 0.04, y: 0.02, z: D / 2 - 0.16 },
  antenna: { x: 0.31, y: H - 0.05, tilt: 0.3, collarR: 0.085, collarH: 0.05, stemR: 0.06, stemH: 0.24, capR: 0.17, capH: 0.2, capY: 0.2, tipY: 0.42 },
  arm: { x: W / 2 + 0.01, y: 0.9, z: 0.02, splay: 0.22, sx: 0.12, sy: 0.23, sz: 0.13, offX: 0.05, offY: -0.2 },
  hand: { x: 0.07, y: -0.42, z: 0.05 },
  groundL: { x: -1.25, z: 0.3 },
};
export const BODY_W = W;
export const BODY_H = H;
export const BODY_D = D;

/** Cylinder with rounded top/bottom edges (antenna caps). */
function roundedCylinder(r: number, h: number, b: number, seg = 4): LatheGeometry {
  const pts: Vector2[] = [new Vector2(0, 0)];
  for (let i = 0; i <= seg; i++) {
    const a = -Math.PI / 2 + (i / seg) * (Math.PI / 2);
    pts.push(new Vector2(r - b + Math.cos(a) * b, b + Math.sin(a) * b));
  }
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push(new Vector2(r - b + Math.cos(a) * b, h - b + Math.sin(a) * b));
  }
  pts.push(new Vector2(0, h));
  return new LatheGeometry(pts, 28);
}

function roundedRectShape(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Square UV space centred on the shape so the 512² face canvas keeps its aspect. */
function squareUVs(g: BufferGeometry, size: number) {
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / size + 0.5, pos.getY(i) / size + 0.5);
  }
  uv.needsUpdate = true;
}

export interface RobotParts {
  root: Group; // static, sits on the floor
  rig: Group; // receives idle + move transforms
  body: Mesh;
  face_screen: Mesh;
  antenna_L: Group;
  antenna_R: Group;
  arm_L: Group;
  arm_R: Group;
  base: Mesh;
  empties: Record<'head_top' | 'antenna_tip_L' | 'antenna_tip_R' | 'hand_R' | 'face_overlay' | 'ground_L', Object3D>;
  mats: { body: MeshPhysicalMaterial; screen: MeshPhysicalMaterial; joint: MeshStandardMaterial };
  caps: Mesh[];
}

export function buildProceduralRobot(faceTex: Texture): RobotParts {
  const mats = {
    body: new MeshPhysicalMaterial({ name: 'body_mat', color: '#F2F2F2', roughness: 0.55 }),
    screen: new MeshPhysicalMaterial({
      name: 'screen',
      color: '#ffffff',
      map: faceTex,
      emissive: new Color('#ffffff'),
      emissiveMap: faceTex,
      emissiveIntensity: 1.1,
      roughness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
    joint: new MeshStandardMaterial({ name: 'joint_mat', color: '#C9C9C9', metalness: 1, roughness: 0.35 }),
  };
  const dark = new MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.4 });

  const root = new Group();
  root.name = 'pip';
  const rig = new Group();
  rig.name = 'rig';
  root.add(rig);

  const { body: B, face: F, slot: S, base: BA, antenna: A, arm: AR, hand: HA, groundL: GL } = DIMS;

  // body — pivot at bottom centre
  const bodyGeo = new RoundedBoxGeometry(B.w, B.h, B.d, 6, B.r);
  bodyGeo.translate(0, B.h / 2, 0);
  const body = new Mesh(bodyGeo, mats.body);
  body.name = 'body';
  rig.add(body);

  // face_screen — glossy inset that bulges slightly
  const faceGeo = new ExtrudeGeometry(roundedRectShape(F.w, F.h, F.r), {
    depth: F.depth,
    bevelEnabled: true,
    bevelThickness: F.bevel,
    bevelSize: 0.02,
    bevelSegments: 4,
    curveSegments: 10,
  });
  squareUVs(faceGeo, F.w + 0.04);
  const face_screen = new Mesh(faceGeo, mats.screen);
  face_screen.name = 'face_screen';
  face_screen.position.set(0, F.y, F.z);
  body.add(face_screen);

  // chest slot below the face
  const slot = new Mesh(new RoundedBoxGeometry(S.w, S.h, S.d, 3, S.r), mats.body);
  slot.name = 'chest_slot';
  slot.position.set(0, S.y, S.z);
  body.add(slot);

  // base — dark foot pad with the notch facing forward
  const base = new Mesh(new RoundedBoxGeometry(BA.w, BA.h, BA.d, 3, BA.r), dark);
  base.name = 'base';
  base.position.set(0, BA.y, BA.z);
  body.add(base);

  // antennas — pivot at the metal joint
  const caps: Mesh[] = [];
  const makeAntenna = (side: -1 | 1) => {
    const g = new Group();
    g.name = side < 0 ? 'antenna_L' : 'antenna_R';
    g.position.set(side * A.x, A.y, 0);
    g.rotation.z = -side * A.tilt;
    const collar = new Mesh(roundedCylinder(A.collarR, A.collarH, 0.02), mats.joint);
    const stem = new Mesh(roundedCylinder(A.stemR, A.stemH, 0.01), mats.joint);
    const cap = new Mesh(roundedCylinder(A.capR, A.capH, 0.06), mats.body);
    cap.name = side < 0 ? 'antenna_cap_L' : 'antenna_cap_R';
    cap.position.y = A.capY;
    caps.push(cap);
    const tip = new Object3D();
    tip.name = side < 0 ? 'antenna_tip_L' : 'antenna_tip_R';
    tip.position.y = A.tipY;
    g.add(collar, stem, cap, tip);
    body.add(g);
    return { g, tip };
  };
  const aL = makeAntenna(-1);
  const aR = makeAntenna(1);

  // arms — pivot at the shoulder
  const makeArm = (side: -1 | 1) => {
    const g = new Group();
    g.name = side < 0 ? 'arm_L' : 'arm_R';
    g.position.set(side * AR.x, AR.y, AR.z);
    g.rotation.z = side * AR.splay;
    const m = new Mesh(new SphereGeometry(1, 24, 16), mats.body);
    m.scale.set(AR.sx, AR.sy, AR.sz);
    m.position.set(side * AR.offX, AR.offY, 0);
    g.add(m);
    body.add(g);
    return g;
  };
  const arm_L = makeArm(-1);
  const arm_R = makeArm(1);

  const hand_R = new Object3D();
  hand_R.name = 'hand_R';
  hand_R.position.set(HA.x, HA.y, HA.z);
  arm_R.add(hand_R);

  const head_top = new Object3D();
  head_top.name = 'head_top';
  head_top.position.set(0, B.h, 0);
  body.add(head_top);

  const face_overlay = new Object3D();
  face_overlay.name = 'face_overlay';
  face_overlay.position.set(0, F.y, B.d / 2 + 0.03);
  body.add(face_overlay);

  const ground_L = new Object3D();
  ground_L.name = 'ground_L';
  ground_L.position.set(GL.x, 0, GL.z);
  root.add(ground_L);

  return {
    root,
    rig,
    body,
    face_screen,
    antenna_L: aL.g,
    antenna_R: aR.g,
    arm_L,
    arm_R,
    base,
    empties: {
      head_top,
      antenna_tip_L: aL.tip,
      antenna_tip_R: aR.tip,
      hand_R,
      face_overlay,
      ground_L,
    },
    mats,
    caps,
  };
}
