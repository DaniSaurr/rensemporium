// game-systems.js — dialogue engine, room visits, counter illusion, quests,
// Frames/Apparatus, pet, endings, boot.

(function () {
  const { ctx, W, H } = G;

  // ============================================================ COUNTER
  // The illusory objective. Actual greetedTotal drives a scripted display.
  G.counterDisplay = function () {
    const n = G.S.greetedTotal;
    if (G.day() === 1) return n + " / 5";
    if (n < 25) return n + " / 25";
    if (n === 25) return "25 / 25";
    if (n <= 29) return n + " / 25";          // the first crack
    if (n <= 35) return n + " / 35";           // it "fixes itself"
    if (n <= 40) return n + " / 40";
    if (n <= 48) return n + " / 50";
    if (n === 49) return "49 / 50";
    if (n === 50) return "50 / 50";            // false completion
    if (n === 51) return "51 / 50";            // betrayal
    if (n <= 60) return n + " / 60";
    return n + " / ???";
  };

  G.counterReassurance = function () {
    const n = G.S.greetedTotal;
    if (n < 5) return "yep! just introduce yourself to everyone here :)";
    if (n < 25) return "there's been a few more arrivals than expected... just keep going.";
    if (n < 35) return "the numbers might look a bit off, but don't worry, it all balances out.";
    if (n < 50) return "you don't... have to meet everyone, you know.";
    return "you're still doing that?";
  };

  G.drawCounterHUD = function () {
    if (!G.S.startedDay) return;
    const d = G.driftLevel();
    // the counter drifts toward the centre of the screen over days
    const x = 30 + d * (W / 2 - 140);
    const y = 30 + d * 40;
    G.panel(x, y, 250, 54, { alpha: 0.85 });
    G.text("guests greeted: " + G.counterDisplay(), x + 20, y + 34, { size: 18, colour: "#cfc7b4" });
    // pellets + day
    G.panel(x, y + 60, 250, 40, { alpha: 0.6 });
    G.text("day " + G.day() + " (" + G.weekday() + ")  ·  pellets: " + G.S.pellets, x + 20, y + 86, { size: 14, colour: "#8d887c" });
  };

  // Control players get more knobs. The knobs are hollow.
  G.drawControlPanelToggles = function () {
    const S = G.S;
    const c = S.controlAffinity;
    const unlocks = [];
    if (c >= 3) unlocks.push(["showBodies", "show creature bodies"]);
    if (c >= 6) unlocks.push(["filterGuests", "filter irrelevant guests"]);
    if (c >= 9) unlocks.push(["stabilise", "stabilise conversations"]);
    if (unlocks.length === 0) return;
    let y = H - 60 - unlocks.length * 34 - (c >= 12 ? 50 : 0);
    G.text("advanced controls", 30, y - 8, { size: 13, colour: "#6b6557" });
    unlocks.forEach(([id, label]) => {
      const on = !!S.toggleState[id];
      G.panel(30, y, 240, 28, { alpha: 0.55, radius: 5 });
      G.text((on ? "[x] " : "[ ] ") + label, 42, y + 20, { size: 14, colour: on ? "#cfc7b4" : "#8d887c" });
      G.hotspot(30, y, 240, 28, () => {
        S.toggleState[id] = !S.toggleState[id];
        G.save();
        // it does, of course, nothing.
      });
      y += 34;
    });
    if (c >= 12) {
      G.simpleButton("[ optimise experience ]", 30, y + 6, 240, () => {
        G.toastMsg = { t: 2, text: "the screen rearranges slightly. it feels cleaner." };
      }, { h: 38 });
    }
  };

  // ====================================================== DIALOGUE ENGINE
  const GREETING_POOL = [
    "hi :)", "hello?", "good evening", "are you alright", "sorry to bother you",
    "i just arrived", "this place is strange", "...hi", "do you live here",
    "i think i'm lost", "your door was the nicest one", "i'm from room 0"
  ];

  function dialogueProfile(identity, isKaino) {
    const rng = G.createRng(G.deriveSeed(identity, "profile"));
    return {
      tone: rng.pick(isKaino ? ["erratic", "hostile", "fearful", "flat"] : ["anxious", "earnest", "melancholy", "fussy"]),
      subjectBias: rng.pick(isKaino ? ["body", "misplacement"] : ["sound", "neighbour", "room", "hallway"]),
      coherence: isKaino ? 0.15 + rng.next() * 0.35 : 0.65 + rng.next() * 0.3,
      repetition: isKaino ? 0.4 + rng.next() * 0.5 : 0.05 + rng.next() * 0.25,
      hostility: isKaino ? 0.35 + rng.next() * 0.5 : rng.next() * 0.2
    };
  }

  // ---- Paleo line builder: three tiers, deepening with floor
  const T1 = {
    pronouns: ["my", "our", "the"],
    subjects: { sound: ["neighbour", "hallway", "ceiling", "door"], neighbour: ["neighbour", "guest next door", "one beside me"], room: ["room", "walls", "wardrobe", "window"], hallway: ["hallway", "stairs", "landing"] },
    verbs: { sound: ["cries", "laughs", "knocks", "breathes"], neighbour: ["cries", "watches", "won't settle"], room: ["moves", "waits", "closes itself", "leans"], hallway: ["creaks", "stretches", "watches"] },
    modifiers: ["too loudly", "for me", "again", "when i stop looking", ""],
    timeframes: ["at night", "when i sleep", "after midnight", "when you leave", ""]
  };
  const T2extra = {
    places: ["next door", "above me", "below this room", "at the end of the hall", "near the stairs"],
    clauses: ["but only when i listen", "and it wasn't like that before", "i think it moved", "but i might be wrong", "it wasn't always like this"],
    qualifiers: ["still", "sometimes", "lately", "again"]
  };
  const T3extra = {
    pastPlaces: ["the room i left", "my first room", "the place before this one", "where i used to be"],
    relocation: ["after i moved", "after the shift", "when i was moved", "since i got here"],
    memoryPhrases: ["i remember it differently", "it remembers me differently", "it wasn't like this before", "something stayed behind"],
    recursiveBits: ["but it stayed", "and it followed", "but it didn't move", "and it stayed where it was"]
  };

  function paleoLine(identity, floor, salt) {
    const rng = G.createRng(G.deriveSeed(identity, "pline" + salt + "-" + G.day()));
    const p = dialogueProfile(identity, false);
    const bias = T1.subjects[p.subjectBias] ? p.subjectBias : "room";
    const subject = rng.pick(T1.subjects[bias]);
    const verb = rng.pick(T1.verbs[bias]);
    const pron = rng.pick(T1.pronouns);
    const tier = floor <= 10 ? 1 : floor <= 30 ? 2 : 3;
    if (tier === 1) {
      const parts = [pron, subject, verb, rng.pick(rng.chance(0.5) ? T1.modifiers : T1.timeframes)];
      return parts.filter(Boolean).join(" ");
    }
    if (tier === 2) {
      if (rng.chance(0.5)) return [pron, subject, verb, rng.pick(T1.timeframes), ", " + rng.pick(T2extra.clauses)].filter(Boolean).join(" ").replace(" ,", ",");
      return [pron, subject, "near " + rng.pick(T2extra.places), rng.pick(T2extra.qualifiers), verb, rng.pick(T1.modifiers)].filter(Boolean).join(" ");
    }
    const roll = rng.next();
    if (roll < 0.33) return [rng.pick(T3extra.pastPlaces), "still", verb, rng.pick(T1.timeframes) + ",", rng.pick(T3extra.recursiveBits)].filter(Boolean).join(" ");
    if (roll < 0.66) return [rng.pick(T3extra.memoryPhrases) + ";", pron, subject, verb, rng.pick(T1.timeframes)].filter(Boolean).join(" ");
    return [pron, subject, verb, rng.pick(T3extra.relocation)].filter(Boolean).join(" ");
  }

  // ---- Kaino line builder: same ingredients, structure withheld
  const KAINO_FRAGMENTS = ["you did that", "don't do that", "that's not where it goes", "it was wrong before", "no not that", "you heard it too", "stop looking at me"];
  function kainoLine(identity, salt) {
    const rng = G.createRng(G.deriveSeed(identity, "kline" + salt + "-" + G.day()));
    const p = dialogueProfile(identity, true);
    const subjects = ["teeth", "hands", "room", "door", "floor", "name", "walls", "mouth"];
    const verbs = ["come back wrong", "watch", "keep moving", "won't stay", "cry", "laugh", "open", "lean", "remember me badly"];
    let words = [
      rng.chance(0.35) ? rng.pick(["my", "the", "our"]) : "",
      rng.pick(subjects),
      rng.pick(verbs),
      rng.chance(0.4) ? rng.pick(["at night", "when i sleep", "again", "for me"]) : ""
    ].filter(Boolean);
    if (rng.chance(0.45) && words.length > 1) words.splice(rng.int(0, words.length - 1), 1);
    if (rng.chance(p.repetition) && words.length > 0) {
      const idx = rng.int(0, words.length - 1);
      words.splice(idx, 0, words[idx]);
    }
    if (rng.chance(0.3) && words.length >= 3) {
      const a = rng.int(0, words.length - 1), b = rng.int(0, words.length - 1);
      [words[a], words[b]] = [words[b], words[a]];
    }
    if (rng.chance(p.hostility)) words.push(rng.pick(KAINO_FRAGMENTS));
    return words.join(" ");
  }

  function extractTopic(line) {
    const topics = ["neighbour", "hallway", "room", "door", "teeth", "name", "walls", "floor", "wardrobe", "window", "ceiling", "stairs", "landing", "mouth", "hands"];
    return topics.find((t) => line.includes(t)) || "that";
  }

  // ---- authored sparks: rare, conditional, cold-water lines
  function maybeSpark(identity, isKaino) {
    const S = G.S, m = S.playerModel;
    const rng = G.createRng(G.deriveSeed(identity, "spark" + G.day()));
    if (!rng.chance(0.08)) return null;
    const valid = [];
    if (identity % 37 === 0) valid.push("you've been here before");
    if (m.probe >= 6) valid.push("you keep asking the same shape of question");
    if (m.neutral >= 4) valid.push("oh. you're not going to hold me here");
    if (S.night >= 3 && isKaino) valid.push("they said you'd move already");
    if (S.night >= 2 && !isKaino) valid.push("you're very close to the front");
    if (valid.length === 0) return null;
    return rng.pick(valid);
  }

  const PALEO_REACTIONS = {
    probe: ["the creature seems relieved that you asked.", "it pauses, as if considering that.", "you may have made it more real."],
    empathy: ["the creature seems at ease.", "it softens slightly.", "that seemed to help."],
    control: ["the creature watches you expectantly.", "you may have taken responsibility.", "something now depends on you."],
    force: ["that didn't help much.", "the creature withdraws slightly.", "you feel less welcome here."],
    neutral: ["you turn around and the room is empty."]
  };
  const KAINO_REACTIONS = {
    probe: ["it squints at you as if insulted.", "your question seems to make it worse."],
    empathy: ["it does not appear comforted.", "your kindness does not seem to reach it."],
    control: ["it laughs once, without warmth.", "you may have mistaken invitation for access."],
    force: ["it seems pleased that you were rude.", "the exchange appears to feed something."],
    neutral: ["nothing changes.", "you are still here."]
  };
  const OUTCOMES = {
    probe: ["you leave with less certainty than you brought in.", "you leave with more hallway than you arrived with."],
    empathy: ["the creature seemed lighter after speaking.", "your kindness has been noted somewhere."],
    control: ["you may have made a promise.", "you have become involved."],
    force: ["nothing here appears interested in persuasion.", "the room feels slightly less welcoming as you step out."],
    neutral: ["the moment passes.", "you leave it as it is."]
  };

  // Paleo dependency lifecycle: relief -> reliance -> expectation -> bitterness -> quest
  function memoryFor(identity) {
    const S = G.S;
    if (!S.creatureMemory[identity]) S.creatureMemory[identity] = { dependency: 0, quested: false };
    return S.creatureMemory[identity];
  }

  const DEPENDENCY_LINES = [
    null,
    "thank you... that helps. you'll come back, won't you?",
    "you understand, right? the others don't ask.",
    "you said you'd help. did you talk to them yet?",
    "i guess you're like the others. you're not really helping, are you."
  ];

  // ============================================================ ROOM VISIT
  G.enterRoom = function (room) {
    const S = G.S;
    const day = G.day();
    if (S.pendingThreshold) {
      S.pendingThreshold = false;
      S.thresholdChurn = 0;
      G.save();
      G.go("threshold", { room });
      return;
    }
    if (G.houndRoom() === room && room !== 0) {
      G.go("houndEncounter", { room });
      return;
    }
    if (S.lockedRooms[room] === day) {
      G.toastMsg = { t: 2.5, text: "the door is polite but firm. one visit per day." };
      return;
    }
    S.roomHistory.push(room);
    if (S.roomHistory.length > 40) S.roomHistory.shift();
    G.save();
    G.go("roomVisit", { room });
  };

  G.registerScene("roomVisit", {
    enter(params) {
      const S = G.S;
      this.room = params.room;
      this.occ = G.occupantOfRoom(this.room);
      this.floor = Math.ceil(this.room / G.ROOMS_PER_FLOOR);
      this.completed = false;
      this.stage = "greeting"; // greeting -> playerGreeting -> statement -> response -> reaction
      if (this.occ.type === "empty") {
        G.showWorld(this.room, null, { noCreature: true });
        this.stage = "emptyRoom";
        return;
      }
      const isKaino = this.occ.type === "kaino" || (G.day() === 1 && this.room === 4); // day-1 proto-kaino
      this.isKaino = isKaino;
      const id = this.occ.identity;
      // day-1 proto-kaino keeps paleo visuals but kaino dialogue
      G.showWorld(this.room, id, { kaino: this.occ.type === "kaino" });
      const spark = maybeSpark(id, isKaino);
      this.greeting = isKaino ? (spark || kainoLine(id, "greet")) : (spark || paleoLine(id, this.floor, "greet"));
      const mem = memoryFor(id);
      if (!isKaino && mem.dependency >= 1 && mem.dependency <= 4 && DEPENDENCY_LINES[mem.dependency]) {
        this.greeting = DEPENDENCY_LINES[mem.dependency];
      }
      this.statement = isKaino ? kainoLine(id, "state") : paleoLine(id, this.floor, "state");
      this.topic = extractTopic(this.statement);
      const rng = G.createRng(G.deriveSeed(id, "greetopts" + G.day()));
      this.greetOpts = [];
      const pool = GREETING_POOL.slice();
      for (let i = 0; i < 4; i++) this.greetOpts.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
      // dialogue container style evolves: box -> floating (no portrait tier —
      // one visible fewer step reads cleaner without losing the point).
      const drift = G.driftLevel();
      this.style = "box";
      if (drift > 0.55 || this.floor >= 6) this.style = "floating";
      // quest target?
      this.questHere = S.quests.find((q) => q.state === "active" && q.targetRoom === this.room);
      // visible pellet: a small cube on the floor, seeded per room+day, one
      // per room per day, click to collect. this is the ONLY pellet source.
      const pelletRng = G.createRng(G.deriveSeed(this.room, "pellet" + G.day()));
      this.pelletHere = pelletRng.chance(0.5) && S.pelletsTaken[this.room + ":" + G.day()] !== true;
    },
    leave() {
      const S = G.S;
      if (!this.completed && this.stage !== "emptyRoom") {
        S.thresholdChurn++;
        if (S.thresholdChurn >= 5) S.pendingThreshold = true;
      } else if (this.completed) {
        S.thresholdChurn = 0;
      }
      G.save();
      G.hideWorld();
      G.go("hallway", { floor: this.floor });
    },
    draw() {
      const S = G.S;
      if (this.stage === "emptyRoom") {
        G.text("the room is empty. the wallpaper continues without an audience.", W / 2, 900, { size: 19, align: "center", colour: "#efece2" });
        G.hotspot(0, 0, W, H, () => this.leave());
        return;
      }
      // world canvas shows the creature underneath; overlay draws dialogue
      const style = this.style;
      const boxY = style === "box" ? 740 : 700;

      // leave hotspot: click the floor area (bottom strip) before responding
      if (this.stage === "greeting" || this.stage === "playerGreeting") {
        G.text("(click the very bottom of the room to slip back out)", W / 2, 1012, { size: 12, align: "center", colour: "rgba(220,215,200,0.35)" });
        G.hotspot(0, 1018 - 40, W, 40, () => this.leave(), { cursor: "s-resize" });
      }

      const drawSpeech = (speaker, txt, then) => {
        if (style === "box") {
          G.panel(80, boxY, 864, 180);
          G.text(speaker, 110, boxY + 36, { size: 16, colour: "#b7a67c" });
          G.wrapText(txt, 110, boxY + 72, 800, 30, { size: 22 });
          G.text("▸", 918, boxY + 156, { size: 22, colour: "#8d887c" });
          G.hotspot(80, boxY, 864, 180, then);
        } else {
          // floating: no frame, no clear owner
          const rng = G.createRng(G.hashString(txt));
          const fx = 200 + rng.next() * 400;
          const fy = 180 + rng.next() * 240;
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 14;
          G.wrapText(txt, fx, fy, 460, 32, { size: 23, colour: "#f2eee2" });
          ctx.restore();
          G.hotspot(0, 0, W, 620, then);
        }
      };

      // the pellet, if this room has one today: a small cube near the door,
      // clickable any time before you leave.
      if (this.pelletHere) {
        ctx.save();
        ctx.translate(70, 960);
        ctx.fillStyle = "#8ab06a"; ctx.fillRect(-16, -16, 32, 32);
        ctx.fillStyle = "#c8dfae"; ctx.fillRect(-16, -16, 32, 10);
        ctx.restore();
        G.text("a pellet", 70, 1000, { size: 12, align: "center", colour: "rgba(220,230,210,0.7)" });
        G.hotspot(30, 924, 80, 76, () => {
          this.pelletHere = false;
          S.pelletsTaken[this.room + ":" + G.day()] = true;
          S.pellets++;
          G.clickSound(true);
          G.save();
        });
      }

      if (this.stage === "greeting") {
        drawSpeech("the guest", this.greeting, () => { this.stage = "playerGreeting"; });
      } else if (this.stage === "playerGreeting") {
        G.panel(80, 640, 864, 330, { alpha: 0.82 });
        G.text("say something (it doesn't matter which — shh)", 110, 672, { size: 14, colour: "#6b6557" });
        G.optionButtons(this.greetOpts.map((t) => ({ text: t, cb: () => { this.stage = "statement"; } })), 120, 690, 784, {});
      } else if (this.stage === "statement") {
        drawSpeech("the guest", this.statement, () => { this.stage = "response"; });
      } else if (this.stage === "response") {
        const opts = [];
        opts.push({ text: "what do you mean by " + this.topic + "?", cb: () => this.respond("probe") });
        opts.push({ text: "that sounds difficult.", cb: () => this.respond("empathy") });
        opts.push({ text: "i'll deal with " + this.topic + ".", cb: () => this.respond("control") });
        opts.push({ text: "that's not real.", cb: () => this.respond("force") });
        if (this.questHere) opts.unshift({ text: "ask about the " + this.questHere.topic + " (for " + this.questHere.fromName + ")", cb: () => this.completeQuest() });
        if (G.neutralUnlocked()) opts.push({ text: "okay.", dull: true, cb: () => this.respond("neutral") });
        G.panel(70, 600, 884, 400, { alpha: 0.8 });
        G.optionButtons(opts, 120, 630, 784, {});
      } else if (this.stage === "reaction") {
        drawSpeech("", this.reactionText, () => this.finish());
      }
    },
    respond(stance) {
      const S = G.S;
      const id = this.occ.identity;
      G.applyEffects({ [stance]: 1 });
      G.logChoice(stance);
      if (stance === "control" || stance === "force") S.controlAffinity += stance === "control" ? 1 : 0.5;
      if (stance === "control") S.controlAffinity += 0; // (affinity already bumped)
      const bank = this.isKaino ? KAINO_REACTIONS : PALEO_REACTIONS;
      const rng = G.createRng(G.deriveSeed(id, "react" + G.day() + stance));
      this.reactionText = rng.pick(bank[stance] || bank.probe);
      this.stanceChosen = stance;

      if (!this.isKaino) {
        const mem = memoryFor(id);
        if (stance === "empathy" || stance === "control") {
          mem.dependency++;
          if (mem.dependency >= 4 && !mem.quested) this.issueQuest(id);
        }
        if (stance === "neutral") {
          // resolution: the paleo dissolves, immediately
          S.emptyRooms[this.room] = G.day();
          delete S.creatureMemory[id];
        }
      }
      // frames bookkeeping
      G.frameBookkeeping(stance, this.isKaino);
      this.completed = true;
      S.thresholdChurn = 0;
      this.stage = "reaction";
      G.save();
    },
    issueQuest(id) {
      const S = G.S;
      const mem = memoryFor(id);
      mem.quested = true;
      const rng = G.createRng(G.deriveSeed(id, "quest"));
      // target a deeper paleo room (as of today; it will shuffle away — the point)
      const targetRoom = this.room + rng.int(4, 9);
      const topic = rng.pick(["noise", "smell of oranges", "crying", "missing chair", "name they forgot", "light that stays on"]);
      S.quests.push({ from: id, fromName: "the one from room " + this.room, targetRoom, topic, state: "active", issuedDay: G.day() });
      this.reactionText = "“go to room " + targetRoom + " and ask them about the " + topic + ". you said you'd help.” (quest gained — but rooms shuffle every night.)";
    },
    completeQuest() {
      const S = G.S;
      this.questHere.state = "answered";
      S.questsDone++;
      G.applyEffects({ empathy: 1 });
      this.reactionText = "they consider the question about the " + this.questHere.topic + " for a long time. “...tell them it never stopped.” you now owe an answer to someone who has moved rooms since.";
      this.completed = true;
      this.stage = "reaction";
      G.save();
    },
    finish() {
      const S = G.S;
      S.lockedRooms[this.room] = G.day();
      S.greetedToday++;
      S.greetedTotal++;
      let outcome = G.createRng(G.deriveSeed(this.occ.identity, "out" + G.day())).pick(OUTCOMES[this.stanceChosen] || OUTCOMES.neutral);
      if (this.stanceChosen === "neutral" && !this.isKaino) outcome = "you turn around and the room is empty.";
      if (this.pelletHere) outcome += " (you left the pellet on the floor.)";
      G.save();
      G.hideWorld();
      G.go("blackOutcome", { text: outcome, floor: this.floor });
    }
  });

  G.registerScene("blackOutcome", {
    enter(params) { G.hideWorld(); this.text = params.text; this.floor = params.floor; },
    draw() {
      G.clear("#060608");
      G.wrapText(this.text, W / 2 - 340, H / 2 - 20, 680, 34, { size: 23, colour: "#cfc7b4" });
      G.hotspot(0, 0, W, H, () => G.go("hallway", { floor: this.floor }));
    }
  });

  // ================================================================ PET
  G.drawPetCorner = function (x, y) {
    const S = G.S;
    const pet = S.pet;
    ctx.save();
    ctx.translate(x, y);
    if (pet.stage === "gift") {
      ctx.fillStyle = "#8a4b4b"; ctx.fillRect(-36, -36, 72, 72);
      ctx.fillStyle = "#d8cfae"; ctx.fillRect(-36, -8, 72, 16); ctx.fillRect(-8, -36, 16, 72);
      G.text("a gift", 0, 70, { size: 13, align: "center", colour: "#77705f" });
    } else if (pet.stage === "egg") {
      ctx.fillStyle = "#e3dcc8";
      ctx.beginPath(); ctx.ellipse(0, 0, 34, 44, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b9ae90";
      for (let i = 0; i < pet.feedings; i++) ctx.fillRect(-20 + i * 9, -6, 6, 6);
      G.text("the egg (" + pet.feedings + "/5 feedings)", 0, 74, { size: 13, align: "center", colour: "#77705f" });
    } else {
      // hatched: tiny generated-ish creature placeholder
      const rng = G.createRng(777);
      ctx.fillStyle = "hsl(" + rng.int(0, 359) + ", 60%, 80%)";
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#222";
      ctx.beginPath(); ctx.arc(-10, -6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(10, -6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-8, 10, 16, 3);
      G.text("your small companion", 0, 66, { size: 13, align: "center", colour: "#77705f" });
    }
    ctx.restore();
    G.hotspot(x - 40, y - 46, 80, 100, () => G.petInteract());
  };

  G.petInteract = function () {
    const S = G.S, pet = S.pet;
    if (pet.lastInteractDay === G.day()) {
      G.toastMsg = { t: 3, text: "it has had its one moment with you today. dream-state development takes time exposure, not clicks." };
      return;
    }
    pet.lastInteractDay = G.day();
    if (pet.stage === "gift") {
      pet.stage = "egg";
      G.toastMsg = { t: 4, text: "you open the gift. inside: an egg, faintly warm, unhurried. (feed it pellets — one interaction per day.)" };
    } else if (pet.stage === "egg") {
      if (S.pellets >= 3) {
        S.pellets -= 3;
        pet.feedings++;
        if (pet.feedings >= 5 && G.day() >= 4) {
          pet.stage = "hatched";
          G.toastMsg = { t: 4.5, text: "a soft crack in the night you weren't watching. something small looks at you like you're the room." };
        } else {
          G.toastMsg = { t: 3, text: "you press three pellets against the shell. they are accepted. (" + pet.feedings + "/5)" };
        }
      } else {
        G.toastMsg = { t: 3, text: "the egg would like pellets (3). the rooms have them; guests drop them." };
      }
    } else {
      G.toastMsg = { t: 3, text: "it watches you with its whole small body. rest is not the same circle." };
    }
    G.save();
  };

  // =============================================================== FRAMES
  // Behaviour mirrors. state: hidden -> glimpsed -> active -> spoken -> relieved
  function frame(id) {
    const S = G.S;
    if (!S.frames[id]) S.frames[id] = { state: "hidden", encounters: 0 };
    return S.frames[id];
  }

  G.houndRoom = function () {
    const h = G.S.roomHistory;
    if (h.length < 5) return -1;
    return h[h.length - 5];
  };

  G.drawHoundSmall = function (x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#8a6f3c"; // brass
    ctx.beginPath(); ctx.ellipse(0, 0, 55, 30, 0, 0, Math.PI * 2); ctx.fill(); // curled body
    ctx.beginPath(); ctx.arc(-38, -16, 18, 0, Math.PI * 2); ctx.fill(); // head
    ctx.fillStyle = "#5c4a28";
    ctx.fillRect(-52, -30, 8, 14); // ear
    ctx.fillStyle = "#2c2417";
    ctx.beginPath(); ctx.arc(-42, -18, 3, 0, Math.PI * 2); ctx.fill();
    // ribs tick
    ctx.strokeStyle = "#5c4a28"; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 12, -18); ctx.lineTo(-14 + i * 12, 8); ctx.stroke(); }
    ctx.restore();
  };

  G.registerScene("houndEncounter", {
    enter(params) {
      G.hideWorld();
      this.room = params.room;
      const f = frame("hound");
      f.encounters++;
      f.state = f.encounters >= 3 ? "spoken" : "active";
      G.S.houndEncounters++;
      G.save();
      const lines = [
        ["the clockcourse hound is here", "it occupies the room you were in five rooms ago. brass ribs tick very softly. it has brought no message, no quest, no punishment. only yesterday's path, folded up."],
        ["it is here again", "“i followed the course. this is where the course became soft.”"],
        ["it is waiting this time", "“i waited where you end. to see if you would begin differently.”"]
      ];
      this.text = lines[Math.min(f.encounters - 1, 2)];
    },
    draw() {
      G.clear("#141210");
      G.drawHoundSmall(W / 2, 380);
      G.text(this.text[0], W / 2, 200, { size: 26, align: "center", colour: "#c8b184" });
      G.wrapText(this.text[1], W / 2 - 330, 500, 660, 32, { size: 21 });
      const opts = [
        { text: "“did i bring you here?”  —  “you walked the leash.”", cb: () => this.done() },
        { text: "“get out.”  —  “yes.” (it stands at once. no offence in it. only obedience.)", cb: () => this.done() },
        { text: "“stay a minute.”  —  “a minute is a kind room.”", cb: () => { frame("hound").state = "relieved"; this.done(); } },
        { text: "“good dog.”  —  “good enough.”", cb: () => { frame("hound").state = "relieved"; this.done(); } }
      ];
      G.optionButtons(opts, 120, 640, 784, { noDrift: true });
    },
    done() { G.save(); G.go("hallway", { floor: Math.max(1, Math.ceil(this.room / G.ROOMS_PER_FLOOR)) }); }
  });

  G.registerScene("houndMorning", {
    enter() { G.hideWorld(); this.stage = 0; },
    draw() {
      G.clear("#1c1a20");
      G.drawHoundSmall(W / 2, 560);
      ctx.fillStyle = "#4b4456"; ctx.fillRect(280, 600, 460, 120); // foot of bed
      const s = G.S.sleptWithHound;
      const script = [
        "you wake to the sound of a small machine pretending not to breathe.",
        "the clockcourse hound is curled at the foot of your bed. its brass ribs tick very softly.",
        s >= 4 ? "“you are teaching me your cage.”" :
        s === 3 ? "“i should not become furniture.”" :
        s === 2 ? "“you made room for me again.”" :
        "“i followed you all day. you stopped here. so did i.”",
        "“rest is not the same circle,” it adds, mostly to itself."
      ];
      G.wrapText(script[Math.min(this.stage, script.length - 1)], W / 2 - 330, 220, 660, 32, { size: 22, colour: "#cfc7b4" });
      G.hotspot(0, 0, W, H, () => {
        this.stage++;
        if (this.stage >= script.length) G.go("room0");
      });
    }
  });

  // Vigilant of the Veil — threshold screen
  G.registerScene("threshold", {
    enter(params) {
      G.hideWorld();
      this.room = params.room;
      G.S.vovEncounters++;
      frame("vov").encounters++;
      G.save();
      const v = G.S.vovEncounters;
      this.line = v >= 4 ? "“you have become narrow. stay somewhere long enough to become visible.”"
        : v === 3 ? "“you are making a necklace of doors. do you intend to arrive, or only to pass?”"
        : v === 2 ? "“again you have skimmed the edges. rooms are not stamps.”"
        : "“you have crossed five doors and entered none. a threshold is not a destination.”";
      this.replied = false;
    },
    draw() {
      G.clear("#0c0b10");
      // archetypal doorway, too tall
      ctx.fillStyle = "#191721"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#060608"; ctx.fillRect(W / 2 - 130, 120, 260, 660);
      ctx.strokeStyle = "#6a6152"; ctx.lineWidth = 8; ctx.strokeRect(W / 2 - 130, 120, 260, 660);
      // faint gold ring in the dark beyond
      ctx.strokeStyle = "rgba(200,170,90,0.25)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(W / 2, 420, 60, 0, Math.PI * 2); ctx.stroke();
      // brighter threshold strip
      ctx.fillStyle = "rgba(220,205,160,0.5)"; ctx.fillRect(W / 2 - 130, 774, 260, 8);
      // VoV: a small calm sentinel silhouette
      ctx.fillStyle = "#241f2e";
      ctx.beginPath(); ctx.ellipse(W / 2, 660, 46, 90, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(200,170,90,0.7)";
      ctx.beginPath(); ctx.arc(W / 2 - 12, 620, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W / 2 + 12, 620, 4, 0, Math.PI * 2); ctx.fill();

      G.text("the vigilant of the veil", W / 2, 90, { size: 22, align: "center", colour: "#b7a67c" });
      if (!this.replied) {
        G.wrapText(this.line, W / 2 - 320, 830, 640, 30, { size: 20, colour: "#cfc7b4" });
        const opts = [
          { text: "“i was just looking.”  —  “then look from somewhere.”", cb: () => { this.replied = true; } },
          { text: "“move.”  —  “i am not in your way. i am your way, noticed.”", cb: () => { this.replied = true; } },
          { text: "“sorry.”  —  “that is nearly an arrival.”", cb: () => { this.replied = true; frame("vov").state = "relieved"; } },
          { text: "“what are you?”  —  “a courtesy between places.”", cb: () => { this.replied = true; } }
        ];
        G.optionButtons(opts, 120, 880, 784, { noDrift: true });
      } else {
        G.simpleButton("enter", W / 2 - 90, 880, 180, () => {
          G.S.thresholdChurn = 0; G.save();
          G.go("roomVisit", { room: this.room });
        });
      }
    }
  });

  // lightweight frames: bookkeeping + one-off toasts (jank tier, by design)
  G.frameBookkeeping = function (stance, isKaino) {
    const S = G.S;
    const log = S.choicesLog;
    // Gemframe Acolyte: too much confident naming (control+force streak)
    const cf = log.slice(-8).filter((s) => s === "control" || s === "force").length;
    if (cf >= 6 && frame("gemframe").state === "hidden") {
      frame("gemframe").state = "spoken";
      G.toastMsg = { t: 5, text: "an empty frame with a jewel-head watches from the corner. “you named the edge before seeing the middle. unassigned is not empty.”" };
    }
    // Luminarion Saint: over-probing
    if (S.playerModel.probe >= 15 && frame("luminarion").state === "hidden") {
      frame("luminarion").state = "spoken";
      G.toastMsg = { t: 5, text: "a lamp-bright figure dims itself as you pass. “too much light makes a white wall of the world. please dim me when i become cruel.”" };
    }
    // Triframe Seeker: strict two-stance alternation
    if (log.length >= 6) {
      const last6 = log.slice(-6);
      const uniq = [...new Set(last6)];
      if (uniq.length === 2 && frame("triframe").state === "hidden") {
        frame("triframe").state = "spoken";
        G.toastMsg = { t: 5, text: "a folded triangle unfolds slightly. “two points accuse. three points describe. you keep choosing between walls.”" };
      }
    }
    // Shrouded Lens: sustained neutrality
    if (S.playerModel.neutral >= 6 && frame("lens").state === "hidden") {
      frame("lens").state = "relieved";
      G.toastMsg = { t: 5, text: "in the window, a covered mirror turns away in peace. “thank you for leaving the cloth where it was.”" };
    }
    G.save();
  };

  // Reliquary Warden: re-knocking locked doors
  const _origEnter = G.enterRoom;
  let relockAttempts = 0;
  G.enterRoom = function (room) {
    const S = G.S;
    if (S.lockedRooms[room] === G.day()) {
      relockAttempts++;
      if (relockAttempts >= 3 && frame("warden").state === "hidden") {
        frame("warden").state = "spoken";
        G.toastMsg = { t: 5, text: "a cabinet you never noticed closes itself. “the old rule is still true. it merely no longer applies. you may keep it without carrying it.”" };
        G.save();
        return;
      }
    }
    _origEnter(room);
  };

  // Hingebird Scout: omen near authored stairwells
  G.maybeHingebird = function (floor) {
    const authored = floor > 1 && (floor & (floor - 1)) === 0;
    if (!authored) return;
    if (frame("hingebird").state === "hidden") frame("hingebird").state = "glimpsed";
    ctx.save();
    ctx.translate(180, 180);
    ctx.fillStyle = "#9a8a5c";
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 11, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2c2417"; ctx.beginPath(); ctx.arc(16, -9, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // ambient lore only — nothing here is clickable. it just watches the seam.
    G.text("a small brass bird, watching the wall.", 180, 220, { size: 12, colour: "#5c574c" });
    G.wrapText("“the wall has a second thought. do not pull. notice.”", 180, 240, 280, 20, { size: 13, colour: "#77705f" });
  };

  // ============================================================== ENDINGS
  function endGame(id, title, lines, tone) {
    G.S.ended = id;
    G.save();
    G.hardGo("ending", { id, title, lines, tone });
  }

  G.registerScene("ending", {
    enter(params) { G.hideWorld(); this.p = params; this.stage = 0; G.stopHum(); },
    draw() {
      const grey = this.p.id === "joke";
      G.clear(grey && this.stage >= this.p.lines.length ? "#8a8a8a" : "#060608");
      if (this.stage < this.p.lines.length) {
        G.text(this.p.title, W / 2, 300, { size: 30, align: "center", colour: "#cfc7b4" });
        G.wrapText(this.p.lines[this.stage], W / 2 - 330, 420, 660, 34, { size: 23, colour: "#b9b2a2" });
        G.hotspot(0, 0, W, H, () => { this.stage++; });
      } else if (this.p.id === "joke") {
        // the grey void: you can't do anything. you have to get up and leave.
        // (a merciful title link appears after a long minute.)
        if (G.sceneTime > 60) {
          G.text("·", W / 2, H / 2, { size: 14, align: "center", colour: "#7d7d7d" });
          G.hotspot(W / 2 - 20, H / 2 - 20, 40, 40, () => { G.wipe(); G.hardGo("title"); });
        }
      } else {
        G.text(this.p.tone || "the hotel remains.", W / 2, H / 2, { size: 20, align: "center", colour: "#77705f" });
        G.simpleButton("begin again (a new guest arrives)", W / 2 - 190, H / 2 + 90, 380, () => { G.wipe(); G.hardGo("title"); });
      }
    }
  });

  G.frontDoorAttempt = function () {
    const S = G.S, m = S.playerModel, dom = G.dominantStyle();
    // 1. joke ending: leave before ever sleeping
    if (S.night === 0) {
      return endGame("joke", "the first one in is the first one out",
        ["you turn around and walk back through the doors. nobody stops you. nobody will have to shuffle anymore. problem solved.",
         "snow under your feet. blue sky above. you walk toward the horizon.",
         "the sky goes grey. the snow thins to grey rock of a similar shade.",
         "grey."], "");
    }
    // 2. kaino-route early exit
    if (S.pureNeutralQuiz && m.neutral >= 6 && G.day() <= 5) {
      return endGame("earlyExit", "you pass through without holding anything",
        ["the front door opens the way doors are supposed to.",
         "you met only the newly stuck, and did not try to reshape them. you did not touch the ones who had settled.",
         "outside, the snow is just snow.",
         "that was nice :)"], "you did not stay long enough to become part of it.");
    }
    // 3. true neutral exit
    if (G.neutralUnlocked() && m.neutral >= 8 && dom.primary === "neutral" && G.day() >= 4) {
      return endGame("trueExit", "the door is still there",
        ["nothing is asking you for anything. the lobby is quiet, pale, uninsistent.",
         "you press the door. it opens. of course it opens.",
         "…oh. you could have left earlier.",
         "you leave. the door does not close behind you — or it does. you're no longer inside either way."], "nothing was keeping you here.");
    }
    // 4. force exit
    if (m.force >= 12) {
      return endGame("forceExit", "rupture",
        ["you put your shoulder to the doors and the doors, being doors, give.",
         "cold air. broken quiet. behind you the tannoy begins a sentence and thinks better of it.",
         "you ended it. you did not understand it. these were always different things."], "you ended it, but didn't understand it.");
    }
    // 5. caretaker
    if (S.questsDone >= 4 && G.day() >= 5) {
      return endGame("caretaker", "you stayed longer than most",
        ["you say your goodbyes. it takes a long time. several guests remember your name wrong, warmly.",
         "someone asks, softly, if you'll come back to finish the last favour. you don't answer.",
         "the door opens for you like an apology."], "bittersweet; incomplete; carried gently.");
    }
    // 6. pure ending
    if (G.day() >= 7 && dom.primaryScore / dom.total >= 0.6 && dom.primary !== "neutral") {
      return endGame("pure", "unchanged",
        ["you have been exactly one way the entire time. the hotel appreciates consistency; it is mostly made of it.",
         "the door opens. you leave as you arrived: yourself, thoroughly.",
         "somewhere upstairs, a room forgets you at its own pace."], "the hotel accepted you. you did not change.");
    }
    // 7. observer / oracle of aperture for late probers
    if (G.day() >= 5 && dom.primary === "probe") {
      return G.go("oracle");
    }
    // otherwise: the player traps themselves
    const excuses = [
      "you stand at the doors. the snow presses against the glass. something in you isn't finished here.",
      "the handle is cold. room " + (S.night + 2) + " is still unvisited, says a part of you that counts things.",
      "you could leave. you check the counter instead.",
      "hilbert, from somewhere: “departure occurs when presence ceases.” you cease to press the handle."
    ];
    G.toastMsg = { t: 4.5, text: excuses[(S.greetedTotal + G.day()) % excuses.length] };
  };

  // Oracle of Aperture: a dial. too closed, nothing; too open, washout. enough is enough.
  G.registerScene("oracle", {
    enter() { G.hideWorld(); this.dial = 0.05; this.done = false; },
    draw() {
      G.clear("#0a0a10");
      G.text("the oracle of aperture", W / 2, 140, { size: 24, align: "center", colour: "#b7a67c" });
      G.wrapText("“the opening is not hungry. you are. you may leave without taking the meaning with you.”", W / 2 - 300, 200, 600, 28, { size: 19, colour: "#8d887c" });
      // aperture
      const r = 40 + this.dial * 220;
      ctx.save();
      ctx.translate(W / 2, 520);
      ctx.fillStyle = this.dial > 0.85 ? "#e8e4da" : "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a6f3c"; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, Math.PI * 2); ctx.stroke();
      if (this.dial > 0.3 && this.dial < 0.75) {
        // through the enough-sized opening: snow, outside
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = "#dfe5ec"; ctx.fillRect(-r, -r, r * 2, r * 2);
        const rng = G.createRng(31);
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 40; i++) ctx.fillRect(-r + rng.next() * r * 2, -r + ((rng.next() * r * 2 + G.sceneTime * 20) % (r * 2)), 3, 3);
        ctx.restore();
      }
      ctx.restore();
      // dial
      ctx.fillStyle = "#111"; ctx.fillRect(262, 800, 500, 14);
      ctx.fillStyle = "#c9c0a8"; ctx.beginPath(); ctx.arc(262 + this.dial * 500, 807, 16, 0, Math.PI * 2); ctx.fill();
      G.hotspot(242, 770, 540, 74, () => {});
      // drag-ish: click along the bar
      G.hotspot(262, 780, 500, 54, () => { this.dial = Math.max(0, Math.min(1, (G.mouse.x - 262) / 500)); });
      G.text("closed", 262, 860, { size: 13, colour: "#57524a" });
      G.text("another room entirely", 762, 860, { size: 13, align: "right", colour: "#57524a" });
      if (this.dial > 0.3 && this.dial < 0.75) {
        G.simpleButton("step through", W / 2 - 110, 900, 220, () => {
          endGame("observer", "you saw a great deal",
            ["you leave with many connections, none confirmed. the theories keep each other warm in your coat pocket.",
             "the aperture holds at enough. you pass through without widening it into another room.",
             "you saw a great deal. it was not required."], "the hotel continues, gladly, without an audience.");
        });
      } else {
        G.text(this.dial <= 0.3 ? "too closed: nothing passes." : "too open: the image washes out.", W / 2, 920, { size: 15, align: "center", colour: "#77705f" });
      }
      G.simpleButton("not yet", 60, 930, 140, () => G.go("lobby"));
    }
  });

  G.windowAttempt = function () {
    const S = G.S;
    if (S.controlAffinity >= 8 || S.playerModel.control >= 10) {
      endGame("control", "decisive exit",
        ["the window opens onto cold arithmetic. you had almost mapped the whole system. almost.",
         "you jump. (the snow is closer than it looked, and softer. this is that kind of hotel.)",
         "you walk away from the drift, dusted white, ledger unbalanced.",
         "i almost had it, you tell the horizon. the horizon, being a limit, agrees."], "decisive. abrupt. hollow. yours.");
    }
  };

  // Observer state note: probers get no ending unless they seek one.
  // Hilbert acknowledges them at the desk after day 7 (handled in host lines).

  // ================================================================ BOOT
  window.addEventListener("load", () => {
    // roomRender boots itself; pause it and take the overlay.
    setTimeout(() => {
      try { window.roomRenderAPI.setPaused(true); } catch (e) {}
      const had = G.load();
      G.hardGo("title");
    }, 50);
  });
})();
