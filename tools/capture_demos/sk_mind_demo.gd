extends Node
## Substitute King: play the mind-space scene (Sariel talking inside the hero's head) on its own.
## For tools/godot_capture.py --autoload, with game args  --start=morning --tour --autoplay .
## Lives in the TEMP COPY only; the game's own MindSpace does the work. The game runs inside
## PixelView's SubViewport, so the scene is not root's child: search the whole tree.

var t := 0.0
var done := false


func _process(dt: float) -> void:
	t += dt
	if done or t < 2.0:
		return
	for c in get_tree().root.find_children("*", "CanvasLayer", true, false):
		if "_sariel" in c and c.has_method("play"):
			done = true
			c.play("intro.sariel")
			return
