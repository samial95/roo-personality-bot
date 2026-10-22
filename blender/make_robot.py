"""Builds Roo in Blender from blender/robot.json and exports public/models/roo.glb.

Run headless:  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/make_robot.py
robot.json is produced by `npm run bake` (dimensions, rest pose and 32 baked clips),
so the Blender model and the procedural fallback share one source of truth.
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open(os.path.join(ROOT, "blender", "robot.json")))
DIMS = DATA["dims"]
OUT = os.path.join(ROOT, "public", "models", "roo.glb")


# three.js (Y-up, +Z toward camera) → Blender (Z-up, −Y toward camera)
def v3(p):
    return Vector((p[0], -p[2], p[1]))


def q3(q):  # w-first
    return Quaternion((q[0], q[1], -q[3], q[2]))


def s3(s):
    return Vector((s[0], s[2], s[1]))


# ---------------------------------------------------------------- scene setup
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = DATA["fps"]


def material(name, color, rough, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return m


def srgb(h):
    c = [int(h[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


MAT = {
    "body": material("body_mat", srgb("#F2F2F2"), 0.55),
    "screen": material("screen", srgb("#050506"), 0.15),
    "joint": material("joint_mat", srgb("#C9C9C9"), 0.35, 1.0),
    "dark": material("base_mat", srgb("#0B0B0D"), 0.4),
}


def to_object(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def empty(name):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = 0.05
    scene.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------- geometry helpers (Blender space)
def rounded_box(w, d, h, r, seg=5, center=(0, 0, 0)):
    """Box w (x) × d (y) × h (z) with every edge rounded by r."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(r, w / 2 - 1e-3, d / 2 - 1e-3, h / 2 - 1e-3), segments=seg, affect="EDGES", profile=0.5, clamp_overlap=True)
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    return bm


def rounded_cylinder(r, h, b, seg=4, sides=28):
    """Cylinder along +Z from 0 to h with rounded rims (antenna parts)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=r, radius2=r, depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    rims = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6 and e.verts[0].co.length > 1e-6]
    bmesh.ops.bevel(bm, geom=rims, offset=b, segments=seg, affect="EDGES", profile=0.5, clamp_overlap=True)
    return bm


def ellipsoid(sx, sy, sz, offset):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.translate(bm, vec=offset, verts=bm.verts)
    return bm


def face_screen_mesh(F):
    """Rounded-rect slab facing −Y; UVs are square-mapped so the 512² face canvas keeps its aspect."""
    depth = F["depth"] + 2 * F["bevel"]
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(F["w"], depth, F["h"]), verts=bm.verts)
    # round the four corners seen from the front (edges parallel to Y)
    corners = [e for e in bm.edges if abs(e.verts[0].co.x - e.verts[1].co.x) < 1e-6 and abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
    bmesh.ops.bevel(bm, geom=corners, offset=F["r"], segments=8, affect="EDGES", profile=0.5, clamp_overlap=True)
    # soften the front rim
    front = [e for e in bm.edges if all(v.co.y < -depth / 2 + 1e-6 for v in e.verts)]
    bmesh.ops.bevel(bm, geom=front, offset=0.02, segments=3, affect="EDGES", profile=0.5, clamp_overlap=True)
    # three.js extrudes from z=−bevel to z=depth+bevel; centre that span
    bmesh.ops.translate(bm, vec=(0, -(F["depth"] / 2), 0), verts=bm.verts)
    size = F["w"] + 0.04
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = (loop.vert.co.x / size + 0.5, loop.vert.co.z / size + 0.5)
    return bm


def foot_notch(body, B):
    """Arch-shaped notch under the body, front to back (as in the reference sheet)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.15, depth=B["d"] * 1.4, location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))
    cutter = bpy.context.active_object
    cutter.scale = (1.0, 0.75, 1.0)
    mod = body.modifiers.new("notch", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


# ---------------------------------------------------------------- build parts
B, F, S, BA, A, AR = DIMS["body"], DIMS["face"], DIMS["slot"], DIMS["base"], DIMS["antenna"], DIMS["arm"]
objs = {}


def make(name):
    if name in ("roo", "rig"):
        return empty(name)
    if name == "body":
        ob = to_object(name, rounded_box(B["w"], B["d"], B["h"], B["r"], 6, (0, 0, B["h"] / 2)), MAT["body"])
        foot_notch(ob, B)
        return ob
    if name == "face_screen":
        return to_object(name, face_screen_mesh(F), MAT["screen"])
    if name == "chest_slot":
        return to_object(name, rounded_box(S["w"], S["d"], S["h"], S["r"], 3), MAT["body"])
    if name == "base":
        return to_object(name, rounded_box(BA["w"], BA["d"], BA["h"], BA["r"], 3), MAT["dark"])
    if name.startswith("antenna_cap"):
        return to_object(name, rounded_cylinder(A["capR"], A["capH"], 0.06), MAT["body"])
    if name in ("antenna_L", "antenna_R"):
        bm = rounded_cylinder(A["collarR"], A["collarH"], 0.02)
        stem = rounded_cylinder(A["stemR"], A["stemH"], 0.01)
        me = bpy.data.meshes.new("tmp")
        stem.to_mesh(me)
        stem.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        return to_object(name, bm, MAT["joint"])
    if name in ("arm_L", "arm_R"):
        side = -1 if name.endswith("L") else 1
        return to_object(name, ellipsoid(AR["sx"], AR["sz"], AR["sy"], (side * AR["offX"], 0, AR["offY"])), MAT["body"])
    return empty(name)


for n in DATA["nodes"]:
    ob = make(n["name"])
    ob.rotation_mode = "QUATERNION"
    objs[n["name"]] = ob

for n in DATA["nodes"]:
    ob = objs[n["name"]]
    if n["parent"]:
        ob.parent = objs[n["parent"]]
        ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.location = v3(n["pos"])
    ob.rotation_quaternion = q3(n["quat"])
    ob.scale = s3(n["scale"])

# ---------------------------------------------------------------- baked clips → NLA tracks
for clip, c in DATA["clips"].items():
    for node, tr in c["tracks"].items():
        ob = objs[node]
        ad = ob.animation_data or ob.animation_data_create()
        act = bpy.data.actions.new(f"{clip}__{node}")
        channels = []
        if "pos" in tr:
            channels.append(("location", [v3(p) for p in tr["pos"]], 3))
        if "quat" in tr:
            channels.append(("rotation_quaternion", [q3(q) for q in tr["quat"]], 4))
        if "scale" in tr:
            channels.append(("scale", [s3(s) for s in tr["scale"]], 3))
        for path, values, size in channels:
            for i in range(size):
                fc = act.fcurves.new(path, index=i)
                fc.keyframe_points.add(len(values))
                for f, val in enumerate(values):
                    kp = fc.keyframe_points[f]
                    kp.co = (f + 1, val[i])
                    kp.interpolation = "LINEAR"
        track = ad.nla_tracks.new()
        track.name = clip
        track.strips.new(clip, 1, act)
        track.mute = True
        ad.action = None

# restore the rest pose after keyframing
for n in DATA["nodes"]:
    ob = objs[n["name"]]
    ob.location = v3(n["pos"])
    ob.rotation_quaternion = q3(n["quat"])
    ob.scale = s3(n["scale"])

tris = sum(len(p.vertices) - 2 for o in scene.objects if o.type == "MESH" for p in o.data.polygons)
print(f"[roo] objects={len(scene.objects)} triangles≈{tris} clips={len(DATA['clips'])}")

# ---------------------------------------------------------------- export
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_anim_single_armature=False,
    export_optimize_animation_size=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
)
print(f"[roo] wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)")
