// game-world.js — HFFC scenes: arrival, reception (hidden quiz), lobby,
// hallways (MYST x street view), elevator ritual, stairwells, Room 0, night.

(function () {
  const { ctx, W, H } = G;

  // ------------------------------------------------------ occupancy model
  // Identity travels; the room is computed. room <= night -> kaino.
  // paleo identity = room - night (stable under the shuffle).
  // kaino identity = 900000 + (night - room + 1) (stable as both shift).
  G.occupantOfRoom = function (room) {
    const S = G.S;
    if (room === 0) return { type: "player" };
    if (S.emptyRooms[room] === G.day()) return { type: "empty" };
    if (room <= S.night) return { type: "kaino", identity: 900000 + (S.night - room + 1) };
    return { type: "paleo", identity: room - S.night };
  };

  const ROOMS_PER_FLOOR = 5; // 2 left, 2 right, 1 beside the stairwell door
  G.ROOMS_PER_FLOOR = ROOMS_PER_FLOOR;
  G.roomsOnFloor = function (floor) {
    const base = (floor - 1) * ROOMS_PER_FLOOR;
    return [base + 1, base + 2, base + 3, base + 4, base + 5];
  };

  // ROYGBIV floor colour, lighter each cycle, trending to white.
  G.floorColour = function (floor) {
    const hues = [0, 30, 55, 120, 210, 245, 280];
    const cycle = Math.floor((floor - 1) / 7);
    const hue = hues[(floor - 1) % 7];
    const sat = Math.max(6, 46 - cycle * 9);
    const light = Math.min(88, 30 + cycle * 9);
    return { hue, sat, light,
      wall: `hsl(${hue}, ${sat}%, ${light}%)`,
      wallDark: `hsl(${hue}, ${sat}%, ${Math.max(8, light - 14)}%)`,
      carpet: `hsl(${hue}, ${Math.max(4, sat - 12)}%, ${Math.max(6, light - 20)}%)` };
  };

  // ------------------------------------------------------ cast portraits
  // Hilbert: canonical look — white rabbit, floppy ears, dot eyes, glum mouth,
  // black overalls/suspenders, dark red bow tie, peach hand-pads.
  G.drawHilbert = function (x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineJoin = "round";
    // ears
    ctx.fillStyle = "#f6f4ef";
    ctx.beginPath(); ctx.ellipse(-46, -66, 26, 44, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(46, -66, 26, 44, 0.7, 0, Math.PI * 2); ctx.fill();
    // body blob
    ctx.beginPath(); ctx.ellipse(0, 0, 74, 84, 0, 0, Math.PI * 2); ctx.fill();
    // arms
    ctx.beginPath(); ctx.ellipse(-66, 30, 22, 40, 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(66, 30, 22, 40, -0.35, 0, Math.PI * 2); ctx.fill();
    // trousers / overalls
    ctx.fillStyle = "#151515";
    ctx.beginPath();
    ctx.moveTo(-46, 40); ctx.lineTo(46, 40); ctx.lineTo(52, 108); ctx.lineTo(20, 108);
    ctx.lineTo(12, 66); ctx.lineTo(-12, 66); ctx.lineTo(-20, 108); ctx.lineTo(-52, 108);
    ctx.closePath(); ctx.fill();
    // suspenders
    ctx.strokeStyle = "#151515"; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(-30, 44); ctx.lineTo(-40, -34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, 44); ctx.lineTo(40, -34); ctx.stroke();
    // suspender buttons
    ctx.fillStyle = "#efc9a5";
    ctx.beginPath(); ctx.arc(-30, 46, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, 46, 8, 0, Math.PI * 2); ctx.fill();
    // bow tie
    ctx.fillStyle = "#a3252b";
    ctx.beginPath(); ctx.moveTo(-4, 30); ctx.lineTo(-22, 20); ctx.lineTo(-22, 40); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, 30); ctx.lineTo(22, 20); ctx.lineTo(22, 40); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 30, 6, 0, Math.PI * 2); ctx.fill();
    // face
    ctx.fillStyle = "#151515";
    ctx.beginPath(); ctx.arc(-24, -34, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(24, -34, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -18, 5, 0, Math.PI * 2); ctx.fill();
    // glum mouth
    ctx.strokeStyle = "#151515"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-16, 4); ctx.lineTo(0, -4); ctx.lineTo(16, 4); ctx.stroke();
    ctx.restore();
  };

  G.drawB = function (x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // wings
    ctx.fillStyle = "rgba(230,240,255,0.75)";
    ctx.beginPath(); ctx.ellipse(-40, -34, 26, 16, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(40, -34, 26, 16, 0.5, 0, Math.PI * 2); ctx.fill();
    // striped body
    ctx.fillStyle = "#e8b73a";
    ctx.beginPath(); ctx.ellipse(0, 0, 52, 62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, 52, 62, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#241f18";
    ctx.fillRect(-60, -10, 120, 16);
    ctx.fillRect(-60, 22, 120, 16);
    ctx.restore();
    // face
    ctx.fillStyle = "#241f18";
    ctx.beginPath(); ctx.arc(-16, -26, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(16, -26, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#241f18"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, -16, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // antennae
    ctx.beginPath(); ctx.moveTo(-10, -52); ctx.quadraticCurveTo(-16, -74, -26, -76); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -52); ctx.quadraticCurveTo(16, -74, 26, -76); ctx.stroke();
    ctx.restore();
  };

  const DAY_HOSTS = {
    sunday: { name: "Hilbert", line: "the week begins by beginning. do inform the desk of any irregularities you cause.", colour: "#f6f4ef" },
    monday: { name: "Lunae Dies & Miss Elainea", line: "the moon keeps the books tonight, dear. we both do.", colour: "#cdd4ea" },
    tuesday: { name: "Tiernan", line: "you WILL admire the shield. it cost more than your room.", colour: "#c34a35" },
    wednesday: { name: "Melody", line: "oh, you noticed the hallway too. most people only use it.", colour: "#e5d76b" },
    thursday: { name: "Thor", line: "BIG day. all days are big if you hold them properly.", colour: "#7f9dc4" },
    friday: { name: "Friday", line: "you're welcome here. that's all hospitality is, said slowly.", colour: "#d99bc0" },
    saturday: { name: "B", line: "end of my shift soon. the hotel behaves itself on saturdays, mostly.", colour: "#e8b73a" }
  };
  G.DAY_HOSTS = DAY_HOSTS;

  // =================================================================== TITLE
  G.registerScene("title", {
    enter() { G.hideWorld(); G.stopHum(); },
    draw() {
      G.clear("#0e0d14");
      // snow
      const rng = G.createRng(99);
      for (let i = 0; i < 90; i++) {
        const sx = rng.next() * W;
        const sy = (rng.next() * H + G.sceneTime * (14 + rng.next() * 30)) % H;
        ctx.fillStyle = "rgba(235,238,245,0.7)";
        ctx.fillRect(sx, sy, 2.5, 2.5);
      }
      G.text("HOTEL FOR FANCY CREATURES", W / 2, 300, { size: 46, align: "center", colour: "#efece2" });
      G.text("an infinite hotel. one vacancy.", W / 2, 350, { size: 20, align: "center", colour: "#948e7f" });
      const hasSave = G.S.startedDay && !G.S.ended;
      G.simpleButton("begin", W / 2 - 130, 470, 260, () => {
        G.wipe(); G.save();
        G.go("bus");
      });
      if (hasSave) {
        G.simpleButton("continue (night " + G.S.night + ")", W / 2 - 130, 540, 260, () => {
          G.go(G.S.currentFloor === 0 ? "lobby" : "hallway", { floor: G.S.currentFloor });
        });
      }
      G.text("v0.1 — placeholder-rich, faithfully janky", W / 2, 960, { size: 14, align: "center", colour: "#4d4a44" });
    }
  });

  // ==================================================================== BUS
  G.registerScene("bus", {
    enter() { G.hideWorld(); },
    draw() {
      const t = G.sceneTime;
      const bob = Math.sin(t * 7) * 4 + Math.sin(t * 13.7) * 2;
      G.clear("#1a1d24");
      // window view: dark snowy blur
      ctx.save();
      ctx.translate(0, bob);
      ctx.fillStyle = "#252b36"; ctx.fillRect(80, 200, 864, 420);
      const rng = G.createRng(7);
      for (let i = 0; i < 60; i++) {
        const sx = (rng.next() * 900 - t * 160 * (0.4 + rng.next())) % 900;
        ctx.fillStyle = "rgba(228,232,240,0.5)";
        ctx.fillRect(80 + ((sx % 864) + 864) % 864, 210 + rng.next() * 400, 3, 3);
      }
      // window frame
      ctx.strokeStyle = "#0d0f13"; ctx.lineWidth = 26;
      ctx.strokeRect(80, 200, 864, 420);
      ctx.beginPath(); ctx.moveTo(512, 200); ctx.lineTo(512, 620); ctx.stroke();
      // seatback
      ctx.fillStyle = "#30272b"; ctx.fillRect(0, 640, W, 400);
      ctx.restore();
      G.text("the bus rumbles. the heating hums. nobody speaks.", W / 2, 760, { size: 20, align: "center", colour: "#9d968a", alpha: Math.min(1, t) });
      if (t > 3.2) G.go("exterior");
    }
  });

  // =============================================================== EXTERIOR
  G.registerScene("exterior", {
    enter() { G.hideWorld(); this.walk = 0; },
    draw(c, dt) {
      const t = G.sceneTime;
      this.walk = Math.min(1, t / 5);
      const zoom = 1 + this.walk * 2.1;
      G.clear("#dfe5ec");
      ctx.save();
      ctx.translate(W / 2, H * 0.62);
      ctx.scale(zoom, zoom);
      ctx.translate(0, Math.sin(t * 6) * 3 / zoom);
      // ground snow with ice stalagmites
      ctx.fillStyle = "#eef1f5"; ctx.fillRect(-600, 40, 1200, 400);
      // hotel: daunting red brick
      ctx.fillStyle = "#7e3229"; ctx.fillRect(-190, -420, 380, 470);
      ctx.fillStyle = "#6d2a22";
      for (let fy = 0; fy < 10; fy++)
        for (let fx = 0; fx < 7; fx++)
          ctx.fillRect(-180 + fx * 52 + (fy % 2) * 14, -410 + fy * 44, 40, 18);
      // windows
      ctx.fillStyle = "#2c2417";
      for (let wy = 0; wy < 6; wy++)
        for (let wx = 0; wx < 4; wx++)
          ctx.fillRect(-150 + wx * 82, -380 + wy * 62, 34, 40);
      // snowy roofline
      ctx.fillStyle = "#f4f6f9"; ctx.fillRect(-200, -434, 400, 18);
      // icicles meeting stalagmites
      ctx.fillStyle = "#cfe0ea";
      for (let i = 0; i < 8; i++) {
        const ix = -170 + i * 48;
        ctx.beginPath(); ctx.moveTo(ix, -416); ctx.lineTo(ix + 7, -416); ctx.lineTo(ix + 3, -382 - (i % 3) * 12); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ix + 10, 46); ctx.lineTo(ix + 20, 46); ctx.lineTo(ix + 15, 16 + (i % 3) * 8); ctx.closePath(); ctx.fill();
      }
      // door
      const doorHover = this.walk >= 1 && Math.abs(G.mouse.x - W / 2) < 90 * zoom / 2 && G.mouse.y > 380 && G.mouse.y < 820;
      ctx.fillStyle = doorHover ? "#c8a24a" : "#3a2c1c";
      ctx.fillRect(-42, -60, 84, 112);
      ctx.fillStyle = "#d8c890"; ctx.beginPath(); ctx.arc(24, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // falling snow
      const rng = G.createRng(3);
      for (let i = 0; i < 120; i++) {
        const sx = rng.next() * W;
        const sy = (rng.next() * H + t * (20 + rng.next() * 40)) % H;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(sx, sy, 3, 3);
      }
      if (this.walk >= 1) {
        G.text("the door", W / 2, 900, { size: 18, align: "center", colour: "#5c554a" });
        G.hotspot(W / 2 - 120, 380, 240, 440, () => G.go("reception"));
      } else {
        G.text("shuffling footsteps. the hotel gets bigger.", W / 2, 940, { size: 18, align: "center", colour: "#5c554a" });
      }
    }
  });

  // ============================================================== RECEPTION
  // Bead string: fixed lines + 5 hidden quiz choices. B and Hilbert continue
  // regardless of what you pick. Choices record hidden values only.
  const receptionSequence = [
    { type: "line", speaker: "B", text: "welcome to the hilbert hotel. sorry about the weather. or perhaps thank you for it — it does make the place look nice." },
    { type: "line", speaker: "Hilbert", text: "good evening. i am hilbert, acting resident liaison. i regret to inform you that despite the hotel possessing an infinite number of rooms, it is at present full." },
    { type: "line", speaker: "Hilbert", text: "accordingly, you will need to leave." },
    { type: "choice", options: [
      { text: "how can an infinite hotel be full?", effects: { probe: 2, engagement: 1 } },
      { text: "that's alright. i don't want to cause trouble.", effects: { empathy: 1, neutral: 1 } },
      { text: "then make space.", effects: { control: 2, resistance: 1 } },
      { text: "no.", effects: { force: 2, resistance: 1 } }
    ] },
    { type: "line", speaker: "B", text: "while you two were doing this, i checked the manual. there is a procedure." },
    { type: "line", speaker: "Hilbert", text: "there is a procedure for any event which occurs." },
    { type: "line", speaker: "B", text: "we just ask everyone to move one room over. then the first room becomes free. easy." },
    { type: "choice", options: [
      { text: "does everyone really agree to that?", effects: { probe: 2 } },
      { text: "that seems like a lot to ask of them.", effects: { empathy: 2 } },
      { text: "fine. do it.", effects: { control: 2 } },
      { text: "this place is ridiculous.", effects: { force: 2 } }
    ] },
    { type: "line", speaker: "Hilbert", text: "ridiculous things remain fully possible. in order for something to be done, someone must do it." },
    { type: "tannoy", speaker: "B (tannoy)", text: "attention guests. evening shuffle, please. if you are currently in room n, proceed to room n plus one. thank you for your flexibility, your patience, and your feet." },
    { type: "line", speaker: "Hilbert", text: "there. space has been made." },
    { type: "choice", options: [
      { text: "you say that like this happens often.", effects: { probe: 2 } },
      { text: "i hope they're not upset.", effects: { empathy: 2 } },
      { text: "show me my room.", effects: { control: 2 } },
      { text: "i could still just leave.", effects: { neutral: 2, resistance: 1 } }
    ] },
    { type: "line", speaker: "B", text: "you could. i mean. yes. in theory. it is a hotel, not a pit." },
    { type: "line", speaker: "B", text: "still, since you're here, you should probably introduce yourself around a bit. the elevator's out tonight, so it's just the first floor." },
    { type: "choice", options: [
      { text: "who's going to fix the elevator?", effects: { probe: 2 } },
      { text: "can i say hi to the other guests?", effects: { empathy: 1, compliance: 1 } },
      { text: "can't you just tell me what i need to know?", effects: { control: 2 } },
      { text: "do i have to?", effects: { neutral: 2 } }
    ] },
    { type: "line", speaker: "Hilbert", text: "no one is required to participate beyond the extent of their participation." },
    { type: "line", speaker: "B", text: "he means “not really,” but people usually do." },
    { type: "line", speaker: "Hilbert", text: "would you prefer a room near the stairs, away from the stairs, or as assigned?" },
    { type: "choice", options: [
      { text: "what difference would it make?", effects: { probe: 2 } },
      { text: "whichever causes the least inconvenience.", effects: { empathy: 1, neutral: 1 } },
      { text: "near the stairs.", effects: { control: 2 } },
      { text: "just give me a room.", effects: { force: 1, neutral: 1 } }
    ] },
    { type: "line", speaker: "B", text: "right then. come on. room 0. it's not far, unless you count it properly." }
  ];

  G.registerScene("reception", {
    enter() {
      G.hideWorld();
      this.idx = 0;
      this.bead = receptionSequence[0];
    },
    advance() {
      this.idx++;
      if (this.idx >= receptionSequence.length) {
        // quiz done — derive the special flags
        const m = G.S.playerModel;
        G.S.pureNeutralQuiz = m.neutral >= 5 && m.probe <= 2 && m.control <= 2 && m.force <= 2;
        G.S.startedDay = true;
        G.save();
        G.go("room0", { firstTime: true });
        return;
      }
      this.bead = receptionSequence[this.idx];
      if (this.bead.type === "tannoy") G.tannoyChime();
    },
    draw() {
      G.clear("#241c1a");
      // warm reception backdrop
      ctx.fillStyle = "#3a2b23"; ctx.fillRect(0, 0, W, 620);
      ctx.fillStyle = "#4d3a2c"; ctx.fillRect(0, 560, W, 90); // desk
      ctx.fillStyle = "#2b211c"; ctx.fillRect(0, 640, W, 400);
      // wall lamps
      for (let i = 0; i < 4; i++) {
        const lx = 140 + i * 250;
        ctx.fillStyle = "rgba(255,220,150,0.12)";
        ctx.beginPath(); ctx.arc(lx, 240, 90, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#d9b46a"; ctx.fillRect(lx - 8, 220, 16, 26);
      }
      G.drawB(330, 470, 0.9);
      G.drawHilbert(690, 440, 0.9);
      G.text("B", 330, 580, { size: 16, align: "center", colour: "#b7a67c" });
      G.text("HILBERT", 690, 580, { size: 16, align: "center", colour: "#b7a67c" });

      const bead = this.bead;
      if (!bead) return;
      if (bead.type === "line" || bead.type === "tannoy") {
        G.panel(80, 700, 864, 200);
        G.text(bead.speaker, 110, 738, { size: 17, colour: "#b7a67c" });
        G.wrapText(bead.text, 110, 775, 800, 30, { size: 22 });
        G.text("▸", 918, 880, { size: 24, colour: "#8d887c" });
        G.hotspot(80, 700, 864, 200, () => this.advance());
      } else if (bead.type === "choice") {
        G.panel(80, 640, 864, 330, { alpha: 0.86 });
        const opts = bead.options.map((o) => ({
          text: o.text,
          cb: () => { G.applyEffects(o.effects); this.advance(); }
        }));
        G.optionButtons(opts, 120, 670, 784, { noDrift: true });
      }
    }
  });

  // ================================================================= LOBBY
  G.registerScene("lobby", {
    enter() {
      G.hideWorld();
      G.S.currentFloor = 0;
      G.save();
    },
    draw() {
      G.clear("#241c1a");
      ctx.fillStyle = "#3a2b23"; ctx.fillRect(0, 0, W, 640);
      ctx.fillStyle = "#2b211c"; ctx.fillRect(0, 640, W, 400);
      // front door (left)
      ctx.fillStyle = "#20303c"; ctx.fillRect(70, 240, 150, 380);
      ctx.fillStyle = "#a9c2d4"; ctx.fillRect(86, 260, 118, 200); // snowy glass
      const rng = G.createRng(11);
      for (let i = 0; i < 30; i++) ctx.fillRect(86 + rng.next() * 112, 260 + rng.next() * 194, 3, 3);
      G.text("the front doors", 145, 650, { size: 15, align: "center", colour: "#8d887c" });
      G.hotspot(70, 240, 150, 380, () => G.frontDoorAttempt());

      // reception desk + host of the day
      ctx.fillStyle = "#4d3a2c"; ctx.fillRect(330, 480, 360, 140);
      const host = DAY_HOSTS[G.weekday()];
      if (G.weekday() === "sunday") G.drawHilbert(510, 400, 0.7);
      else if (G.weekday() === "saturday") G.drawB(510, 420, 0.75);
      else {
        // placeholder cameo blob for the weekday cast
        ctx.fillStyle = host.colour;
        ctx.beginPath(); ctx.ellipse(510, 410, 58, 66, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1c1a17";
        ctx.beginPath(); ctx.arc(492, 396, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(528, 396, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(498, 424, 24, 5);
      }
      G.text("reception — " + host.name + " (" + G.weekday() + ")", 510, 650, { size: 15, align: "center", colour: "#8d887c" });
      G.hotspot(330, 300, 360, 320, () => G.go("deskTalk"));

      // elevator (right)
      ctx.fillStyle = "#5a5245"; ctx.fillRect(790, 260, 160, 360);
      ctx.fillStyle = "#332e27"; ctx.fillRect(806, 280, 128, 300);
      ctx.fillStyle = "#c9c0a8"; ctx.beginPath(); ctx.arc(870, 250, 8, 0, Math.PI * 2); ctx.fill();
      G.text(G.day() >= 2 ? "the elevator" : "the elevator (out of order)", 870, 650, { size: 15, align: "center", colour: "#8d887c" });
      G.hotspot(790, 260, 160, 360, () => {
        if (G.day() >= 2) G.go("elevator");
        else G.toastMsg = { t: 3, text: "a paper sign: “out of order. the stairs remain in order.”" };
      });

      // stairs to floor 1
      ctx.fillStyle = "#413428";
      for (let i = 0; i < 6; i++) ctx.fillRect(300 + i * 18, 900 - i * 22, 180, 14);
      G.text("stairs — floor 1", 400, 940, { size: 15, align: "center", colour: "#8d887c" });
      G.hotspot(290, 760, 210, 170, () => G.go("hallway", { floor: 1 }));

      // room 0 door
      ctx.fillStyle = "#3a2c1c"; ctx.fillRect(600, 720, 120, 240);
      ctx.fillStyle = "#c9c0a8"; ctx.font = "22px Georgia"; ctx.textAlign = "center";
      ctx.fillText("0", 660, 760);
      G.text("room 0 — yours", 660, 985, { size: 15, align: "center", colour: "#8d887c" });
      G.hotspot(600, 720, 120, 240, () => G.go("room0"));

      G.drawCounterHUD();
      G.drawToast();
      G.drawControlPanelToggles();
    }
  });

  // desk small talk: B's counter-reassurance + weekday host line
  G.registerScene("deskTalk", {
    enter() { G.hideWorld(); this.stage = 0; },
    draw() {
      G.clear("#241c1a");
      ctx.fillStyle = "#3a2b23"; ctx.fillRect(0, 0, W, 620);
      ctx.fillStyle = "#4d3a2c"; ctx.fillRect(0, 560, W, 90);
      ctx.fillStyle = "#2b211c"; ctx.fillRect(0, 640, W, 400);
      const host = DAY_HOSTS[G.weekday()];
      if (G.weekday() === "sunday") G.drawHilbert(512, 430, 0.95);
      else if (G.weekday() === "saturday") G.drawB(512, 450, 0.95);
      else {
        ctx.fillStyle = host.colour;
        ctx.beginPath(); ctx.ellipse(512, 430, 80, 92, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1c1a17";
        ctx.beginPath(); ctx.arc(486, 410, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(538, 410, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(496, 450, 32, 6);
      }
      const lines = [];
      lines.push([host.name, host.line]);
      lines.push(["B", G.counterReassurance()]);
      if (G.weekday() === "sunday") {
        const rng = G.createRng(G.deriveSeed(G.day(), "axiom"));
        lines.push(["Hilbert", rng.pick(G.HILBERT_AXIOMS) + "."]);
        lines.push(["B", "he means... hm. actually i'm not sure what he means by that one."]);
      }
      const cur = lines[Math.min(this.stage, lines.length - 1)];
      G.panel(80, 700, 864, 200);
      G.text(cur[0], 110, 738, { size: 17, colour: "#b7a67c" });
      G.wrapText(cur[1], 110, 775, 800, 30, { size: 22 });
      G.hotspot(80, 700, 864, 200, () => {
        this.stage++;
        if (this.stage >= lines.length) G.go("lobby");
      });
      G.drawCounterHUD();
    }
  });

  // ================================================================ HALLWAY
  // MYST x street view: one static fake-perspective shot per floor.
  // Click a door -> that room. Click the floor -> back toward the lobby/elevator.
  G.registerScene("hallway", {
    enter(params) {
      G.hideWorld();
      const S = G.S;
      S.currentFloor = params.floor || 1;
      G.save();
      // pending Vigilant threshold?
      this.floor = S.currentFloor;
    },
    draw() {
      const floor = this.floor;
      const col = G.floorColour(floor);
      G.clear(col.wallDark);
      const cx = W / 2, horizonY = 430;

      // fake perspective corridor: same trick as a room, just "longer"
      // back wall
      ctx.fillStyle = col.wall;
      ctx.fillRect(cx - 130, horizonY - 130, 260, 260);
      // side walls (trapezoids)
      ctx.fillStyle = `hsl(${col.hue}, ${col.sat}%, ${Math.max(6, col.light - 8)}%)`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cx - 130, horizonY - 130); ctx.lineTo(cx - 130, horizonY + 130); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(cx + 130, horizonY - 130); ctx.lineTo(cx + 130, horizonY + 130); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      // ceiling + floor
      ctx.fillStyle = `hsl(${col.hue}, ${Math.max(4, col.sat - 10)}%, ${Math.min(92, col.light + 12)}%)`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(cx + 130, horizonY - 130); ctx.lineTo(cx - 130, horizonY - 130); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col.carpet;
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(cx + 130, horizonY + 130); ctx.lineTo(cx - 130, horizonY + 130); ctx.closePath(); ctx.fill();
      // carpet runner
      ctx.fillStyle = `hsl(${col.hue}, ${col.sat + 8}%, ${Math.max(10, col.light - 26)}%)`;
      ctx.beginPath(); ctx.moveTo(cx - 40, horizonY + 130); ctx.lineTo(cx + 40, horizonY + 130); ctx.lineTo(cx + 300, H); ctx.lineTo(cx - 300, H); ctx.closePath(); ctx.fill();

      const rooms = G.roomsOnFloor(floor);
      const doorDefs = [
        { room: rooms[0], side: -1, depth: 0.22 },
        { room: rooms[1], side: -1, depth: 0.62 },
        { room: rooms[2], side: 1, depth: 0.22 },
        { room: rooms[3], side: 1, depth: 0.62 },
        { room: rooms[4], side: -1, depth: 0.9 }
      ];
      const day = G.day();
      doorDefs.forEach((d) => {
        const scale = 1 - d.depth * 0.72;
        const dx = cx + d.side * (130 + (1 - d.depth) * 360);
        const dw = 120 * scale, dh = 300 * scale;
        const dy = horizonY + 130 - dh + (1 - d.depth) * 240 * 0.55;
        const occ = G.occupantOfRoom(d.room);
        const locked = G.S.lockedRooms[d.room] === day;
        ctx.fillStyle = locked ? "#33302b" : (occ.type === "kaino" ? "#3d3844" : "#4a3a26");
        ctx.fillRect(dx - dw / 2, dy, dw, dh);
        ctx.fillStyle = "#d8cfae";
        ctx.font = Math.round(22 * scale + 8) + "px Georgia";
        ctx.textAlign = "center";
        ctx.fillText(String(d.room), dx, dy + 34 * scale + 8);
        if (locked) {
          ctx.fillStyle = "rgba(20,18,16,0.45)"; ctx.fillRect(dx - dw / 2, dy, dw, dh);
        }
        G.hotspot(dx - dw / 2, dy, dw, dh, () => G.enterRoom(d.room));
      });

      // stairwell door, dead centre at the vanishing wall
      ctx.fillStyle = "#2e2a24";
      ctx.fillRect(cx - 46, horizonY - 42, 92, 172);
      ctx.fillStyle = "#c9c0a8"; ctx.font = "15px Georgia"; ctx.textAlign = "center";
      const stairNames = ["stairs", "stair", "stairwell", "down", "continue"];
      ctx.fillText(stairNames[(floor + G.day()) % stairNames.length], cx, horizonY - 54);
      G.hotspot(cx - 46, horizonY - 42, 92, 172, () => G.go("stairwell", { floor }));

      // click the floor to go back
      G.hotspot(0, horizonY + 260, W, H - (horizonY + 260), () => {
        if (floor === 1 && G.day() === 1) G.go("lobby");
        else G.go("elevator");
      }, { cursor: "s-resize" });
      G.text("floor " + floor + " — " + ["red","orange","yellow","green","blue","indigo","violet"][(floor-1)%7] + " (cycle " + (Math.floor((floor-1)/7)+1) + ")", cx, 60, { size: 16, align: "center", colour: "rgba(240,238,230,0.55)" });
      G.text("click a door to knock. click the floor to go back.", cx, 990, { size: 14, align: "center", colour: "rgba(240,238,230,0.4)" });

      G.drawCounterHUD();
      G.drawToast();
      G.drawControlPanelToggles();
    }
  });

  // ================================================================ ELEVATOR
  // Friction engine: one floor at a time; timing minigame that quietly decays.
  G.registerScene("elevator", {
    enter() {
      G.hideWorld();
      this.phase = "panel"; // panel -> timing -> riding
      this.target = null;
      this.pulse = 0;
      this.failFlash = 0;
      this.rideT = 0;
    },
    draw(c, dt) {
      const S = G.S;
      G.clear("#26221c");
      ctx.fillStyle = "#332e27"; ctx.fillRect(160, 80, 704, 860);
      ctx.fillStyle = "#1e1b16"; ctx.fillRect(200, 120, 624, 700);
      G.text("floor " + S.currentFloor, W / 2, 200, { size: 40, align: "center", colour: "#d8cfae" });

      if (this.phase === "panel") {
        G.text("the elevator moves one floor at a time. it is very proud of this.", W / 2, 260, { size: 17, align: "center", colour: "#8d887c" });
        G.simpleButton("deeper  (floor " + (S.currentFloor + 1) + ")", W / 2 - 160, 400, 320, () => this.begin(S.currentFloor + 1));
        if (S.currentFloor > 1)
          G.simpleButton("back up  (floor " + (S.currentFloor - 1) + ")", W / 2 - 160, 480, 320, () => this.begin(S.currentFloor - 1));
        if (S.currentFloor <= 1)
          G.simpleButton("lobby", W / 2 - 160, 480, 320, () => G.go("lobby"));
        G.simpleButton("step out", W / 2 - 160, 590, 320, () => {
          if (S.currentFloor === 0) G.go("lobby");
          else G.go("hallway", { floor: S.currentFloor });
        });
        // quick recall: skip the one-floor-at-a-time ritual entirely, at the
        // cost of one long, slightly ominous ride instead of many short ones.
        if (S.currentFloor > 1) {
          G.simpleButton("recall the lift home (one long ride, straight to the lobby)", W / 2 - 240, 700, 480, () => this.recallHome());
        }
      }

      if (this.phase === "timing") {
        const rides = S.elevatorRides;
        const showBar = rides < 5; // decay arc: the bar disappears entirely
        this.pulse += dt * (2.2 - Math.min(1.4, rides * 0.18));
        const p = (Math.sin(this.pulse * Math.PI) + 1) / 2;
        if (showBar) {
          G.text("hit it just right.", W / 2, 300, { size: 18, align: "center", colour: "#8d887c" });
          ctx.fillStyle = "#111"; ctx.fillRect(272, 420, 480, 26);
          const windowW = 60 + rides * 40; // more generous every ride
          ctx.fillStyle = "#4b5f3e"; ctx.fillRect(512 - windowW / 2, 420, windowW, 26);
          ctx.fillStyle = "#d8cfae"; ctx.fillRect(272 + p * 470, 414, 10, 38);
        } else {
          G.text("it no longer marks the moment for you.", W / 2, 300, { size: 17, align: "center", colour: "#8d887c" });
          G.text("· · ·", W / 2, 440, { size: 30, align: "center", colour: "#524d44" });
          G.text("that does not mean it stopped working. press when it feels right.", W / 2, 470, { size: 14, align: "center", colour: "#5c574c" });
        }
        if (this.failFlash > 0) {
          this.failFlash -= dt;
          G.text("it didn't catch. try again.", W / 2, 500, { size: 16, align: "center", colour: "#a3564d" });
        }
        G.simpleButton("〇", W / 2 - 60, 560, 120, () => {
          const rides2 = S.elevatorRides;
          const windowFrac = Math.min(0.95, 0.18 + rides2 * 0.14);
          const centered = Math.abs(p - 0.5) < windowFrac / 2;
          // bias success so careful and sloppy clicks both mostly work;
          // the player remembers the careful one.
          const graceRng = Math.random();
          const neutralGrace = G.S.playerModel.neutral >= 5;
          const ok = centered || graceRng < (0.3 + rides2 * 0.1) || neutralGrace || !showBar;
          if (ok) { this.phase = "riding"; this.rideT = 0; this.startRide(); }
          else { this.failFlash = 1.2; G.clickSound(false); }
        }, { h: 60 });
        G.simpleButton("never mind", W / 2 - 90, 700, 180, () => { this.phase = "panel"; });
      }

      if (this.phase === "riding") {
        this.rideT += dt;
        const dur = this.rideDur;
        G.text("…", W / 2, 470, { size: 40, align: "center", colour: "#524d44" });
        ctx.fillStyle = "rgba(8,8,10," + Math.min(0.85, this.rideT / dur) + ")";
        ctx.fillRect(0, 0, W, H);
        if (this.rideT >= dur) {
          G.stopHum();
          S.currentFloor = this.target;
          S.elevatorRides++;
          G.save();
          if (S.currentFloor === 0) G.go("lobby");
          else G.go("hallway", { floor: S.currentFloor });
          this.phase = "panel";
        }
      }
    },
    begin(target) {
      this.target = target;
      this.phase = "timing";
      this.pulse = 0;
      // occasional instant transition, no explanation
      if (Math.random() < 0.06) { this.phase = "riding"; this.rideT = 0; this.startRide(); }
    },
    recallHome() {
      // no timing game — a single long, honest ride straight to the lobby.
      this.target = 0;
      this.phase = "riding";
      this.rideT = 0;
      const S = G.S;
      this.rideDur = 2.4 + Math.min(4, S.currentFloor * 0.12);
      G.startHum(Math.min(1, G.day() / 8) * 0.7);
    },
    startRide() {
      const S = G.S;
      // fade lengthens over the game; eases for neutral players
      const neutral = S.playerModel.neutral >= 6;
      let dur = 1.2 + Math.min(6, G.day() * 0.7 + S.elevatorRides * 0.15);
      if (neutral) dur = Math.max(0.9, dur * 0.45);
      // occasionally inconsistent, so it can't be tuned out
      dur *= (0.85 + Math.random() * 0.4);
      this.rideDur = dur;
      if (neutral && G.day() > 5) { /* silence — a relief they won't place */ }
      else G.startHum(Math.min(1, G.day() / 8));
    }
  });

  // =============================================================== STAIRWELL
  // Power-of-two floors carry authored art; the rest generate graffiti.
  function isAuthoredFloor(floor) { return floor > 0 && (floor & (floor - 1)) === 0 && floor !== 1; }

  const AUTHORED_STAIRWELLS = {
    2: { title: "a framed print", body: "a painting of a corridor. at the end of the corridor, a painting of a corridor. the frame is the same frame.", note: "“tasks conclude when completed” — engraved, confident, wrong." },
    4: { title: "a floor plan", body: "a floor plan of this floor. it shows six rooms. you have only ever found five. the sixth is labelled in a hand that gives up halfway.", note: "room 0 is not listed." },
    8: { title: "a photograph", body: "a photograph of the reception desk, empty. the suspenders hang on their hook. handwritten underneath: ‘the room belongs to the role.’", note: "you do not recognise the handwriting. it is neat." },
    16: { title: "a notice", body: "NOTICE: guests are reminded that the hallway remembers them in sections. management cannot be held responsible for the order of the sections.", note: "someone has underlined ‘order’ twice." },
    32: { title: "a small plaque", body: "you do not have to continue.", note: "" },
    64: { title: "nothing", body: "a clean rectangle on the wall where something used to hang.", note: "the wall is brighter there." }
  };

  const GRAFFITI_BITS = ["the room remembers", "not this one", "you moved", "again", "stop counting", "it was closer before", "floor doesn't matter", "the first room is always behind you", "you heard it too", "don't pull. notice."];

  G.registerScene("stairwell", {
    enter(params) { G.hideWorld(); this.floor = params.floor; },
    draw() {
      const floor = this.floor;
      const col = G.floorColour(floor);
      G.clear("#191713");
      ctx.fillStyle = `hsl(${col.hue}, ${Math.max(4, col.sat - 16)}%, ${Math.max(10, col.light - 12)}%)`;
      ctx.fillRect(120, 100, 784, 700);
      // stairs suggestion
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (let i = 0; i < 7; i++) ctx.fillRect(660 + i * 12, 640 - i * 26, 200, 16);
      G.text("stairwell — floor " + floor, W / 2, 160, { size: 22, align: "center", colour: "#d8cfae" });

      if (isAuthoredFloor(floor) && AUTHORED_STAIRWELLS[floor]) {
        const art = AUTHORED_STAIRWELLS[floor];
        G.panel(220, 240, 580, 360, { fill: "#221f1a", stroke: "#8b8474" });
        G.text(art.title, 250, 290, { size: 20, colour: "#b7a67c" });
        G.wrapText(art.body, 250, 330, 520, 30, { size: 21 });
        if (art.note) G.wrapText(art.note, 250, 500, 520, 26, { size: 16, colour: "#77705f" });
      } else if (isAuthoredFloor(floor)) {
        G.text("you feel like something should be here.", W / 2, 400, { size: 20, align: "center", colour: "#77705f" });
      } else {
        // generated graffiti / shapes
        const rng = G.createRng(G.deriveSeed(floor, "stairart"));
        const n = rng.int(1, 3);
        for (let i = 0; i < n; i++) {
          const gx = 240 + rng.next() * 460;
          const gy = 280 + rng.next() * 320;
          if (rng.chance(0.55)) {
            const bits = [];
            const count = rng.int(1, 2);
            for (let b = 0; b < count; b++) bits.push(rng.pick(GRAFFITI_BITS));
            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate((rng.next() - 0.5) * 0.2);
            ctx.font = "italic " + rng.int(16, 26) + "px Georgia";
            ctx.fillStyle = "rgba(220,210,190," + (0.35 + rng.next() * 0.4) + ")";
            ctx.fillText(bits.join(" "), 0, 0);
            ctx.restore();
          } else {
            // almost-symbol
            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate(rng.next() * Math.PI);
            ctx.strokeStyle = "rgba(200,190,160,0.4)";
            ctx.lineWidth = 3;
            const sides = rng.int(3, 6);
            ctx.beginPath();
            for (let v = 0; v <= sides; v++) {
              const a = (Math.PI * 2 * v) / sides + (v === sides ? 0.2 : 0);
              const r = 30 + rng.next() * 20;
              const px = Math.cos(a) * r, py = Math.sin(a) * r;
              if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      G.maybeHingebird(floor);
      // the stairs are the quiet, unritualised route: no timing game, but you
      // still climb one flight at a time and land in that floor's hallway.
      G.simpleButton("climb up", 160, 840, 210, () => {
        if (floor <= 1) G.go("lobby");
        else G.go("hallway", { floor: floor - 1 });
      });
      G.simpleButton("back to this hallway", W / 2 - 130, 840, 260, () => G.go("hallway", { floor }));
      G.simpleButton("climb down", 794, 840, 210, () => G.go("hallway", { floor: floor + 1 }));
    }
  });

  // ================================================================= ROOM 0
  G.registerScene("room0", {
    enter(params) {
      G.hideWorld();
      this.firstTime = !!(params && params.firstTime);
      this.msg = this.firstTime ? "room 0. the number on the door is painted, not engraved." : null;
      G.S.currentFloor = 0;
      // Clockcourse Hound in room 0?
      this.houndHere = G.houndRoom() === 0 && G.S.frames.hound && G.S.frames.hound.state !== "relieved";
      G.save();
    },
    draw() {
      const S = G.S;
      G.clear("#221f26");
      // an uncommitted room: one wall doesn't quite close
      ctx.fillStyle = "#37323d"; ctx.fillRect(0, 0, W, 660);
      const grad = ctx.createLinearGradient(880, 0, W, 0);
      grad.addColorStop(0, "#37323d"); grad.addColorStop(1, "#221f26");
      ctx.fillStyle = grad; ctx.fillRect(880, 0, 144, 660);
      ctx.fillStyle = "#2a2630"; ctx.fillRect(0, 660, W, 380);

      // bed-like surface
      ctx.fillStyle = "#4b4456"; ctx.fillRect(120, 560, 340, 200);
      ctx.fillStyle = "#6d6478"; ctx.fillRect(120, 540, 340, 44);
      G.text("a surface that is probably the bed", 290, 800, { size: 14, align: "center", colour: "#77705f" });
      G.hotspot(120, 540, 340, 220, () => G.bedInteract());

      // door out
      ctx.fillStyle = "#3a2c1c"; ctx.fillRect(830, 300, 120, 320);
      G.text("out", 890, 650, { size: 14, align: "center", colour: "#77705f" });
      G.hotspot(830, 300, 120, 320, () => G.go("lobby"));

      // pet corner
      G.drawPetCorner(620, 640);

      // the window (control players earn a window; the hotel obliges)
      if (S.controlAffinity >= 8 || S.playerModel.control >= 10) {
        ctx.fillStyle = "#131b24"; ctx.fillRect(560, 180, 180, 220);
        ctx.strokeStyle = "#77705f"; ctx.lineWidth = 4; ctx.strokeRect(560, 180, 180, 220);
        const rng = G.createRng(5);
        ctx.fillStyle = "rgba(230,235,245,0.7)";
        for (let i = 0; i < 20; i++) ctx.fillRect(566 + rng.next() * 168, 186 + rng.next() * 208, 2, 2);
        G.text("the window has noticed you", 650, 430, { size: 13, align: "center", colour: "#77705f" });
        G.hotspot(560, 180, 180, 220, () => G.windowAttempt());
      }

      if (this.houndHere) {
        G.drawHoundSmall(760, 820);
        G.hotspot(690, 740, 150, 130, () => G.houndRoomZeroScene());
      }

      if (this.msg) {
        G.panel(120, 180, 784, 100);
        G.wrapText(this.msg, 150, 218, 720, 26, { size: 18 });
        G.hotspot(120, 180, 784, 100, () => { this.msg = null; });
      } else if (this.firstTime) {
        this.firstTime = false;
        this.msg = "maybe you should introduce yourself to your neighbours before sleeping. (guests greeted: 0 / 5)";
      }

      G.drawCounterHUD();
      G.drawToast();
    }
  });

  // ============================================================== NIGHT / SLEEP
  G.bedInteract = function () {
    const S = G.S;
    if (G.day() === 1 && S.greetedToday < 5 && !S._warnedSleep) {
      S._warnedSleep = true;
      G.toastMsg = { t: 3.5, text: "the bed is patient. B suggested introductions first. (you can sleep anyway.)" };
      return;
    }
    G.go("night");
  };

  G.registerScene("night", {
    enter() {
      G.hideWorld();
      this.stage = 0;
      G.tannoyChime();
      const S = G.S;
      // store hound position before the world shifts
      this.houndWasHome = G.houndRoom() === 0;
      S.night += 1;
      S.greetedToday = 0;
      S.lockedRooms = {};
      S.emptyRooms = {};
      S.thresholdChurn = 0;
      S._warnedSleep = false;
      if (this.houndWasHome) S.sleptWithHound += 1;
      G.save();
    },
    draw() {
      G.clear("#060608");
      const lines = [
        "somewhere nearby, furniture is being moved with great politeness.",
        "tannoy: “attention guests. evening shuffle. if you are in room n, proceed to room n plus one. thank you.”",
        "a new guest arrives at the front of the hotel. you do not hear them knock.",
        "morning."
      ];
      const idx = Math.min(this.stage, lines.length - 1);
      G.wrapText(lines[idx], W / 2 - 350, H / 2, 700, 32, { size: 22, align: "left", colour: "#b9b2a2" });
      G.text("night " + G.S.night + " — " + G.weekday() + " begins", W / 2, H / 2 + 120, { size: 15, align: "center", colour: "#57524a" });
      G.hotspot(0, 0, W, H, () => {
        this.stage++;
        if (this.stage >= lines.length) {
          if (this.houndWasHome) G.hardGo("houndMorning");
          else G.go("room0");
        }
      });
    }
  });

  // toast + HUD helpers used across scenes
  G.toastMsg = null;
  G.drawToast = function () {
    if (!G.toastMsg) return;
    G.toastMsg.t -= 1 / 60;
    if (G.toastMsg.t <= 0) { G.toastMsg = null; return; }
    G.panel(112, 130, 800, 74, { alpha: 0.94 });
    G.wrapText(G.toastMsg.text, 140, 168, 744, 24, { size: 17, colour: "#cfc7b4" });
  };
})();
