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

// Proportions from the reference sheet (units ≈ 100 mm).
export const BODY_W = 1.16;
export const BODY_H = 1.58;
export const BODY_D = 0.96;
const BODY_R = 0.3;
const FACE_W = 0.84;
const FACE_H = 0.66;
const FACE_Y = 1.1;

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
  root.add(rig);

  // body — pivot at bottom centre
  const bodyGeo = new RoundedBoxGeometry(BODY_W, BODY_H, BODY_D, 6, BODY_R);
  bodyGeo.translate(0, BODY_H / 2, 0);
  const body = new Mesh(bodyGeo, mats.body);
  body.name = 'body';
  rig.add(body);

  // face_screen — glossy inset that bulges slightly
  const faceGeo = new ExtrudeGeometry(roundedRectShape(FACE_W, FACE_H, 0.22), {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 4,
    curveSegments: 10,
  });
  squareUVs(faceGeo, FACE_W + 0.04);
  const face_screen = new Mesh(faceGeo, mats.screen);
  face_screen.name = 'face_screen';
  face_screen.position.set(0, FACE_Y, BODY_D / 2 - 0.035);
  body.add(face_screen);

  // chest slot below the face
  const slot = new Mesh(new RoundedBoxGeometry(0.34, 0.09, 0.03, 3, 0.04), mats.body);
  slot.name = 'chest_slot';
  slot.position.set(0, 0.56, BODY_D / 2 - 0.005);
  body.add(slot);

  // base — dark foot pad with the notch facing forward
  const base = new Mesh(new RoundedBoxGeometry(0.34, 0.09, 0.3, 3, 0.04), dark);
  base.name = 'base';
  base.position.set(0, 0.02, BODY_D / 2 - 0.16);
  body.add(base);

  // antennas — pivot at the metal joint
  const caps: Mesh[] = [];
  const makeAntenna = (side: -1 | 1) => {
    const g = new Group();
    g.name = side < 0 ? 'antenna_L' : 'antenna_R';
    g.position.set(side * 0.33, BODY_H - 0.05, 0);
    g.rotation.z = -side * 0.3;
    const collar = new Mesh(roundedCylinder(0.085, 0.05, 0.02), mats.joint);
    const stem = new Mesh(roundedCylinder(0.06, 0.24, 0.01), mats.joint);
    const cap = new Mesh(roundedCylinder(0.17, 0.2, 0.06), mats.body);
    cap.position.y = 0.2;
    caps.push(cap);
    const tip = new Object3D();
    tip.name = side < 0 ? 'antenna_tip_L' : 'antenna_tip_R';
    tip.position.y = 0.42;
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
    g.position.set(side * (BODY_W / 2 + 0.01), 0.9, 0.02);
    g.rotation.z = side * 0.22;
    const m = new Mesh(new SphereGeometry(1, 24, 16), mats.body);
    m.scale.set(0.12, 0.23, 0.13);
    m.position.set(side * 0.05, -0.2, 0);
    g.add(m);
    body.add(g);
    return g;
  };
  const arm_L = makeArm(-1);
  const arm_R = makeArm(1);

  const hand_R = new Object3D();
  hand_R.name = 'hand_R';
  hand_R.position.set(0.07, -0.42, 0.05);
  arm_R.add(hand_R);

  const head_top = new Object3D();
  head_top.name = 'head_top';
  head_top.position.set(0, BODY_H, 0);
  body.add(head_top);

  const face_overlay = new Object3D();
  face_overlay.name = 'face_overlay';
  face_overlay.position.set(0, FACE_Y, BODY_D / 2 + 0.03);
  body.add(face_overlay);

  const ground_L = new Object3D();
  ground_L.name = 'ground_L';
  ground_L.position.set(-1.25, 0, 0.3);
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
