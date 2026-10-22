// Loads the Blender-built robot (public/models/roo.glb) and maps it onto RobotParts.
import { Mesh, type AnimationClip, type Material, type Object3D, type Texture } from 'three';
import { makeMaterials, type RobotParts } from './ProceduralRobot';

export async function loadRobot(faceTex: Texture): Promise<{ parts: RobotParts; clips: AnimationClip[] }> {
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
  ]);
  const base = import.meta.env.BASE_URL;
  const draco = new DRACOLoader(); // three bundles its decoder (hashed by Vite)
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(`${base}models/roo.glb`);
  draco.dispose();

  const get = <T extends Object3D>(name: string) => {
    const o = gltf.scene.getObjectByName(name);
    if (!o) throw new Error(`roo.glb is missing node ${name}`);
    return o as T;
  };

  // Blender UVs are exported top-down, so the canvas face must not be flipped.
  faceTex.flipY = false;
  faceTex.needsUpdate = true;
  const mats = makeMaterials(faceTex);
  const byName: Record<string, Material> = { body_mat: mats.body, screen: mats.screen, joint_mat: mats.joint, base_mat: mats.dark };
  gltf.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const old = o.material as Material;
    o.material = byName[old.name] ?? old;
    if (o.material !== old) old.dispose();
  });

  const root = get('roo');
  const parts: RobotParts = {
    root,
    rig: get('rig'),
    body: get<Mesh>('body'),
    face_screen: get<Mesh>('face_screen'),
    antenna_L: get('antenna_L'),
    antenna_R: get('antenna_R'),
    arm_L: get('arm_L'),
    arm_R: get('arm_R'),
    base: get<Mesh>('base'),
    empties: {
      head_top: get('head_top'),
      antenna_tip_L: get('antenna_tip_L'),
      antenna_tip_R: get('antenna_tip_R'),
      hand_R: get('hand_R'),
      face_overlay: get('face_overlay'),
      ground_L: get('ground_L'),
    },
    mats,
    caps: [get<Mesh>('antenna_cap_L'), get<Mesh>('antenna_cap_R')],
  };
  root.removeFromParent(); // only after every node has been looked up in the scene
  return { parts, clips: gltf.animations };
}
