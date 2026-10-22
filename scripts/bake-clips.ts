// Samples the shared GSAP move timelines into keyframes for Blender.
// Run: node --experimental-strip-types scripts/bake-clips.ts   →  blender/robot.json
import gsap from 'gsap';
import { Euler, Quaternion, Texture, type Object3D } from 'three';
import { writeFileSync, mkdirSync } from 'node:fs';
import { MOVES, PERSONALITIES } from '../src/data/content.ts';
import { clipTimeline, HOVER, PX, zero, type ClipKind, type Pose } from '../src/three/moves.ts';
import { buildProceduralRobot, DIMS } from '../src/three/ProceduralRobot.ts';

const FPS = 30;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const q4 = (q: Quaternion) => [q.w, q.x, q.y, q.z].map(r4); // w-first, three.js (Y-up) space

const robot = buildProceduralRobot(new Texture());
const NAMED = ['roo', 'rig', 'body', 'face_screen', 'chest_slot', 'base', 'antenna_L', 'antenna_R', 'antenna_cap_L', 'antenna_cap_R', 'arm_L', 'arm_R'];
const EMPTIES = ['head_top', 'antenna_tip_L', 'antenna_tip_R', 'hand_R', 'face_overlay', 'ground_L'];

// rest pose of every named node, in three.js space
const nodes: unknown[] = [];
robot.root.traverse((o: Object3D) => {
  const kind = NAMED.includes(o.name) ? 'node' : EMPTIES.includes(o.name) ? 'empty' : null;
  if (!kind) return;
  nodes.push({
    name: o.name,
    parent: o.parent?.name || null,
    kind,
    pos: o.position.toArray().map(r4),
    quat: q4(o.quaternion),
    scale: o.scale.toArray().map(r4),
  });
});

const rest = {
  armL: robot.arm_L.rotation.z,
  armR: robot.arm_R.rotation.z,
  antL: robot.antenna_L.rotation.z,
  antR: robot.antenna_R.rotation.z,
};

/** Same mapping as Stage.frame (minus idle, look-at and springs). */
function sample(p: Pose, hover: number) {
  const sq = Math.max(-0.12, Math.min(0.12, p.sq));
  const e = new Euler();
  const q = (x: number, y: number, z: number) => new Quaternion().setFromEuler(e.set(x, y, z));
  return {
    rig: { pos: [p.x, HOVER + hover + p.y, p.z].map(r4), quat: q(p.rx, p.ry, p.rz) },
    body: { scale: [1 + sq * 0.5 + p.wide, 1 - sq, 1 + sq * 0.5 + p.wide].map(r4) },
    arm_L: { quat: q(0, 0, rest.armL - p.armL) },
    arm_R: { quat: q(0, 0, rest.armR + p.armR) },
    antenna_L: { quat: q(p.antX, 0, rest.antL + p.antL) },
    antenna_R: { quat: q(p.antX, 0, rest.antR - p.antR) },
  };
}

type Track = { pos?: number[][]; quat?: number[][]; scale?: number[][] };
const clips: Record<string, { duration: number; frames: number; tracks: Record<string, Track> }> = {};
const KINDS: ClipKind[] = [...MOVES, 'poke', 'reveal'];

for (const p of PERSONALITIES) {
  for (const kind of KINDS) {
    const pose = zero();
    const tl = clipTimeline(kind, { pose, p, balloon: false }).pause(0);
    const duration = tl.duration() / tl.timeScale();
    const frames = Math.max(2, Math.ceil(duration * FPS) + 1);
    const hover = p === 'calm' ? 40 * PX : 0; // matches the calm idle float in Stage.computeIdle
    const tracks: Record<string, Track> = {};
    const prevQ: Record<string, Quaternion> = {};
    for (let i = 0; i < frames; i++) {
      tl.progress(Math.min(1, i / (frames - 1)), true);
      for (const [node, ch] of Object.entries(sample(pose, hover))) {
        const t = (tracks[node] ??= {});
        if ('pos' in ch) (t.pos ??= []).push(ch.pos);
        if ('scale' in ch) (t.scale ??= []).push(ch.scale);
        if ('quat' in ch) {
          // keep quaternions on one hemisphere so Blender's per-component interpolation is smooth
          if (prevQ[node] && prevQ[node].dot(ch.quat) < 0) ch.quat.set(-ch.quat.x, -ch.quat.y, -ch.quat.z, -ch.quat.w);
          prevQ[node] = ch.quat.clone();
          (t.quat ??= []).push(q4(ch.quat));
        }
      }
    }
    tl.kill();
    clips[`${p}_${kind}`] = { duration: r4(duration), frames, tracks };
  }
}

mkdirSync('blender', { recursive: true });
writeFileSync('blender/robot.json', JSON.stringify({ fps: FPS, hover: HOVER, dims: DIMS, nodes, clips }));
console.log(`baked ${Object.keys(clips).length} clips, ${nodes.length} nodes → blender/robot.json`);
gsap.ticker.sleep();
process.exit(0);
