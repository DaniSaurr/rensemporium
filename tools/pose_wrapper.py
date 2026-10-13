"""Blender-side wrapper: apply a single-frame pose action to an armature, then run render_piece.py.

blender -b <copy.blend> --python tools/pose_wrapper.py -- --action NAME [--armature root] <render_piece args>

Used for files whose poses are stored as one-frame actions (the watched town's Watcher: perch_idle, perch_alert,
pounce, get). Never saves anything; render_batch-style drivers hand it a temp copy.
"""
import sys, os
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
action, arm_name, rest, i = None, "root", [], 0
while i < len(argv):
    if argv[i] == "--action":
        action = argv[i + 1]; i += 2
    elif argv[i] == "--armature":
        arm_name = argv[i + 1]; i += 2
    else:
        rest.append(argv[i]); i += 1

arm = bpy.data.objects[arm_name]
act = bpy.data.actions[action]
arm.animation_data_create()
arm.animation_data.action = act
try:
    if not arm.animation_data.action_slot and act.slots:
        arm.animation_data.action_slot = act.slots[0]
except Exception as e:
    print("slot note:", e, flush=True)
fr = int(act.frame_range[0])
bpy.context.scene.frame_set(fr)
bpy.context.view_layer.update()
print("POSE", action, "applied to", arm_name, "frame", fr, flush=True)

sys.argv = [sys.argv[0], "--"] + rest
here = os.path.dirname(os.path.abspath(__file__))
rp = os.path.join(here, "render_piece.py")
exec(compile(open(rp, encoding="utf-8").read(), rp, "exec"), {"__name__": "__main__", "__file__": rp})
