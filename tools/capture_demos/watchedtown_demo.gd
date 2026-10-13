extends Node
## watchedTown: walk the camera through the town toward the Watcher, for tools/godot_capture.py --autoload.
## Lives in the TEMP COPY only. The game's own Watcher does the rest (stands up, tunnel vision, pounce, grab,
## black, respawn on the beach). User args:  --mode=approach (default) or --mode=tour.
##   approach: put the player on open ground ~26 m from the Watcher with a clear view of it, then walk at it.
##   tour:     hop between open spots at different distances and bearings, looking at the Watcher, so the
##             stills show the town and the creature from several sides. Exposure is reset on every hop.

var mode := "approach"
var t := 0.0
var root: Node
var player
var watcher
var spots: Array = []
var all_spots: Array = []
var _step := 0
var _hop := 0
var _next_hop := 0.0
var _w_down := false
var _log_t := 0.0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--mode="):
			mode = a.substr(7)


func _key(code: int, down: bool) -> void:
	var k := InputEventKey.new()
	k.keycode = code
	k.physical_keycode = code
	k.pressed = down
	Input.parse_input_event(k)


func _eye() -> Vector3:
	var sk: Skeleton3D = watcher.skeleton
	var pose := sk.get_bone_global_pose(watcher.head_bone)
	return (sk.global_transform * pose).origin


func _ray(a: Vector3, b: Vector3) -> Dictionary:
	var q := PhysicsRayQueryParameters3D.create(a, b, 1)
	return root.get_world_3d().direct_space_state.intersect_ray(q)


func _find_spots() -> void:
	var eye := _eye()
	var found: Array = []
	for r in [11.0, 17.0, 24.0, 30.0]:
		for deg in range(0, 360, 10):
			var a := deg_to_rad(float(deg))
			var p: Vector3 = eye + Vector3(cos(a), 0.0, sin(a)) * r
			var hit := _ray(p + Vector3.UP * 80.0, p + Vector3.DOWN * 80.0)
			if hit.is_empty():
				continue
			var g: Vector3 = hit["position"]
			if absf(g.y - eye.y) > 40.0:
				continue
			var head := g + Vector3.UP * 1.65
			if not _ray(eye, head).is_empty():
				continue
			# a clear walk toward the Watcher at waist height
			var flat := Vector3(eye.x, g.y + 1.0, eye.z)
			var dir := (flat - (g + Vector3.UP)).normalized()
			var clear := 0.0
			for d in [4.0, 8.0, 12.0, 16.0, 20.0, 24.0]:
				if d > r - 3.0:
					break
				if _ray(g + Vector3.UP, g + Vector3.UP + dir * d).is_empty():
					clear = d
				else:
					break
			found.append({"pos": g, "r": r, "deg": deg, "clear": clear})
	all_spots = found.duplicate()
	all_spots.sort_custom(func(x, y): return (int(x["deg"] / 10) * 37 + int(x["r"])) % 23 < (int(y["deg"] / 10) * 37 + int(y["r"])) % 23)
	# street level only for the approach: skip spots on rooftops and ledges
	var low := 1e9
	for f in found:
		low = minf(low, f["pos"].y)
	found = found.filter(func(f): return f["pos"].y <= low + 0.9)
	found.sort_custom(func(x, y): return x["clear"] > y["clear"] or (x["clear"] == y["clear"] and x["r"] > y["r"]))
	spots = found
	print("[wt_demo] eye ", eye, " open spots: ", spots.size())
	for i in mini(6, spots.size()):
		print("[wt_demo]   ", spots[i])


func _face(pos: Vector3, look_at_pos: Vector3) -> void:
	var d := look_at_pos - (pos + Vector3.UP * 1.65)
	var flat := Vector2(d.x, d.z).length()
	var yaw := atan2(-d.x, -d.z)
	var pitch := clampf(atan2(d.y, flat), -0.2, 0.55)
	player.respawn(pos + Vector3.UP * 0.1, yaw)
	player.head.rotation.x = pitch
	player._pitch = pitch


func _process(dt: float) -> void:
	t += dt
	if player == null:
		root = get_tree().current_scene
		if root == null:
			return
		var p = root.get("player")
		var w = root.get("watcher")
		if p == null or w == null:
			return
		player = p
		watcher = w
		return
	if _step == 0 and t > 1.2:
		_step = 1
		_find_spots()
		if spots.is_empty():
			print("[wt_demo] no open spots found")
			return
		if mode == "approach":
			var best = spots[0]
			print("[wt_demo] approach from ", best)
			_face(best["pos"], _eye())
			_next_hop = t + 0.8
	if mode == "approach":
		if _step == 1 and t > _next_hop:
			_step = 2
			_key(KEY_W, true)
			_w_down = true
		if _w_down and (int(watcher.state) != 0 or t > 5.5):
			_key(KEY_W, false)
			_w_down = false
		# the street route is full of cover: if it has not pounced by now, step out where it can see us
		if _step == 2 and t > 7.0 and int(watcher.state) == 0:
			_step = 3
			var near = spots[mini(1, spots.size() - 1)]
			print("[wt_demo] stepping out at ", near)
			_face(near["pos"], _eye())
	elif mode == "tour" and _step >= 1 and not spots.is_empty():
		if t >= _next_hop and int(watcher.state) == 0:
			# alternate near and far, spread around the compass
			var pick: Array = []
			for s in all_spots:
				var ok := true
				for q in pick:
					if absf(wrapf(float(s["deg"] - q["deg"]), -180.0, 180.0)) < 50.0:
						ok = false
				if ok and s["clear"] >= 4.0 and s["r"] >= 11.0:
					pick.append(s)
				if pick.size() >= 7:
					break
			var s2 = pick[_hop % pick.size()]
			_hop += 1
			watcher.exposure = 0.0
			_face(s2["pos"], _eye())
			_next_hop = t + 2.4
	_log_t += dt
	if _log_t >= 0.5 and watcher != null:
		_log_t = 0.0
		print("[wt_demo] t=%.1f state=%d exposure=%.2f dist=%.1f" % [t, int(watcher.state), watcher.exposure, player.global_position.distance_to(_eye())])
