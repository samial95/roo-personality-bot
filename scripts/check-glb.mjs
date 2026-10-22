// Verifies public/models/roo.glb: required nodes, all 32 clips, Draco, size budget. Exits 1 on failure.
import { readFileSync, statSync } from 'node:fs';

const FILE = process.argv[2] ?? 'public/models/roo.glb';
const BUDGET = 3 * 1024 * 1024;
const NODES = ['body', 'face_screen', 'antenna_L', 'antenna_R', 'arm_L', 'arm_R', 'base', 'head_top', 'antenna_tip_L', 'antenna_tip_R', 'hand_R', 'face_overlay', 'ground_L'];
const PERSONALITIES = ['shy', 'playful', 'dramatic', 'calm'];
const CLIPS = ['dance', 'wave', 'spin', 'jump', 'nap', 'surprise', 'poke', 'reveal'];

const fail = [];
const buf = readFileSync(FILE);
if (buf.readUInt32LE(0) !== 0x46546c67) fail.push('not a GLB file');
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));

const names = new Set((gltf.nodes ?? []).map((n) => n.name));
for (const n of NODES) if (!names.has(n)) fail.push(`missing node ${n}`);

const anims = new Map((gltf.animations ?? []).map((a) => [a.name, a]));
for (const p of PERSONALITIES)
  for (const c of CLIPS) {
    const a = anims.get(`${p}_${c}`);
    if (!a) fail.push(`missing clip ${p}_${c}`);
    else if (!a.channels?.length) fail.push(`clip ${p}_${c} has no channels`);
  }

const mats = new Set((gltf.materials ?? []).map((m) => m.name));
for (const m of ['body_mat', 'screen', 'joint_mat']) if (!mats.has(m)) fail.push(`missing material ${m}`);
if (!(gltf.extensionsUsed ?? []).includes('KHR_draco_mesh_compression')) fail.push('Draco compression not used');

const size = statSync(FILE).size;
if (size > BUDGET) fail.push(`size ${(size / 1024).toFixed(0)} KB exceeds ${BUDGET / 1024} KB budget`);

if (fail.length) {
  console.error(`✗ ${FILE}\n  ${fail.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${FILE}: ${names.size} nodes, ${anims.size} clips, ${(size / 1024).toFixed(0)} KB, Draco`);
