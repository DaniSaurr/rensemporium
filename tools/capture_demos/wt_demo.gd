extends Node
## Fly-through for Whitethorn's test scene, for tools/godot_capture.py --autoload.
## Lives in the TEMP COPY only. The player's own noclip (C) is switched on, the body rises a
## little, tilts the view down, then glides forward turning in a slow S-curve, so the camera
## looks over the land instead of sitting in the mud where the test scene spawns you.

var t := 0.0
var p: Node3D
var _step := 0


func _key(code: int, down: bool) -> void:
	var k := InputEventKey.new()
	k.keycode = code
	k.physical_keycode = code
	k.pressed = down
	Input.parse_input_event(k)


func _process(dt: float) -> void:
	t += dt
	if p == null:
		p = get_tree().get_first_node_in_group("player")
		return
	if _step == 0 and t > 0.4:
		_step = 1
		_key(KEY_C, true)
	elif _step == 1 and t > 0.8:
		_step = 2
		_key(KEY_C, false)
		_key(KEY_SPACE, true)
	elif _step == 2 and t > 4.0:
		_step = 3
		_key(KEY_SPACE, false)
		_key(KEY_W, true)
	if _step >= 2:
		p.head.rotation.x = lerpf(p.head.rotation.x, -0.28, 2.0 * dt)
		p._pitch = p.head.rotation.x
	if _step >= 3:
		p.rotation.y += sin((t - 4.0) * 0.35) * 0.5 * dt
