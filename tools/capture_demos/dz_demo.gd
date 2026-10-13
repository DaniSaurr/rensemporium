extends Node
## Demo bot for DungeonZoo's net-catching loop. Used by tools/godot_capture.py --autoload,
## which copies it into the TEMP COPY of the project only. Nothing here touches the original.
##
## Drops into floor 1, then repeats: bring the nearest wild pet in front (the game's own
## _cheat_ring), hit the closing ring at its best frame, step or turn, go again.

var g: Node
var t := 0.0
var started := false
var next_act := 0.0


func _process(dt: float) -> void:
	t += dt
	if g == null:
		var s := get_tree().current_scene
		if s != null and "catching" in s:
			g = s
		return
	if t < 1.6:
		return
	if not started:
		started = true
		g.carry_override = 10   # the dev setting for "pets you can carry", so the line keeps growing
		g._enter_floor(1, "down")
		next_act = t + 1.2
		return
	if g.catching:
		_ring(dt)
	elif t >= next_act and not g.busy and g.show_cur.is_empty():
		g._cheat_ring()
		next_act = t + 0.9
		if not g.catching:
			_wander()


func _ring(dt: float) -> void:
	var r: float = 190.0 * (1.0 - g.catch_t / g.catch_len)
	var rn: float = 190.0 * (1.0 - (g.catch_t + dt) / g.catch_len)
	var band: float = g._ring_band()
	if absf(r - 70.0) <= band * 0.5 and absf(r - 70.0) <= absf(rn - 70.0):
		var ev := InputEventKey.new()
		ev.keycode = KEY_SPACE
		ev.pressed = true
		g._unhandled_key_input(ev)


func _wander() -> void:
	var ahead: Vector2i = g.pos + g._dir(g.facing)
	if not g._solid(ahead) and g._free(ahead):
		g._step(g._dir(g.facing))
	else:
		g._turn(1)
