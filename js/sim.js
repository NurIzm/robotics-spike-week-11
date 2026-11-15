// The simulator: the hand on a table, a stand in front of its palm, and the person on the palm side (force sensor, colour cards,
// a hand in front of the distance sensor) behind sim.hw, which is all the VM ever touches. The hand stands still; «Поднять кисть» tests the grip.
(function () {
  const RA = window.RA;
  const T = THREE;
  const clamp = T.MathUtils.clamp;
  const wrap = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
  const sleep = (sec) => new Promise((res) => setTimeout(res, sec * 1000));
  const ease = (t) => t * t * (3 - 2 * t);

  const STEP = 1 / 120, MAX_FRAME = 1;        // physics runs on real time: a slow PC gets a choppy hand, not a slow one
  const MAX_SPEED = 600, ACCEL = 6000;        // °/s at 100 %, °/s²
  const STALL_END = 0.4;
  const TOUCH = 0.6;                          // Н, as in the VM
  const GRAVITY = 160;                        // modules/s², slower than real so a drop can be followed
  const ROLL = 15;                            // modules/s: how fast a round thing leaves a two-finger grip sideways
  const LIFT = { up: 0.6, shake: 0.9, hold: 1.5, down: 0.6, height: 8, sway: 0.5 };   // seconds; modules
  const LIFT_TOP = LIFT.up + LIFT.shake + LIFT.hold;
  const CM = 1.25;                            // modules in a centimetre: a module is 8 mm
  const FOV = 26, VIEW = new T.Vector3(0.55, 0.36, 0.75).normalize();                // from the front-right, a little above
  const PORTS = ['A', 'C', 'E'];
  const ORIENT = { upright: 0, right: 1, upsidedown: 2, left: 3 };
  const SCROLL_MS = 90;
  // Cards in front of the colour sensor: SPIKE colour code and reflected light.
  // shortcut: the reflected % are rough guesses, measure a real sensor with the cards to tune them.
  const CARDS = [
    { code: 9, name: 'красный', css: '#e2342b', light: 45 },
    { code: 7, name: 'жёлтый', css: '#fed920', light: 80 },
    { code: 5, name: 'зелёный', css: '#1f9d55', light: 30 },
    { code: 3, name: 'синий', css: '#1e6fd9', light: 25 },
    { code: 10, name: 'белый', css: '#f6f7f8', light: 95 },
    { code: 0, name: 'чёрный', css: '#16151a', light: 5 },
  ];

  // Distance from p to the surface of a box (half sizes x, y, z) or a rod along X (half length l, radius r) centred at c.
  const boxDist = (p, c, x, y, z) => {
    const dx = Math.abs(p.x - c.x) - x, dy = Math.abs(p.y - c.y) - y, dz = Math.abs(p.z - c.z) - z;
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dy, dz), 0);
  };
  const rodDist = (p, c, l, r) => {
    const dx = Math.abs(p.x - c.x) - l, dr = Math.hypot(p.y - c.y, p.z - c.z) - r;
    return Math.hypot(Math.max(dx, 0), Math.max(dr, 0)) + Math.min(Math.max(dx, dr), 0);
  };
  // r: half-depth from the palm (h.holdAt), hy: half-height, dist: its shape, n: neuter noun ("выпало"). round: why two fingers lose it (SPEC §7's table):
  // a round thing escapes sideways between two fingers, the thumb closes that side.
  const OBJECTS = [
    { id: 'cube', name: 'Кубик', r: 1, hy: 1.2, dist: (p, c) => boxDist(p, c, 2, 1.2, 1) },
    { id: 'pencil', name: 'Карандаш', r: 0.5, hy: 0.5, dist: (p, c) => rodDist(p, c, 5, 0.5) },
    { id: 'ball', name: 'Мяч', r: 3, hy: 3, round: 'Круглый: выкатился вбок', dist: (p, c) => p.distanceTo(c) - 3 },
    { id: 'apple', name: 'Яблоко', n: true, r: 3.5, hy: 3.2, round: 'Тяжёлое и круглое: выскользнуло', dist: (p, c) => p.distanceTo(c) - 3.5 },
  ];

  function createSound(onBeep) {
    let ctx = null, main = null, panner = null, volume = 100, tone = null;
    const effects = { pitch: 0, pan: 0 };
    const voices = new Set();
    // Synthesised: the kit's recordings are not ours to ship. Parts are [wave, from Hz, to Hz, seconds]; no wave is a pause.
    const SOUNDS = {
      'Cat Meow 1': [['sawtooth', 430, 800, 0.22], ['sawtooth', 800, 380, 0.4]],
      'Dog Bark 1': [['square', 340, 160, 0.13], [null, 0, 0, 0.07], ['square', 320, 150, 0.17]],
      Laser: [['square', 1800, 180, 0.4]],
      Hello: [['triangle', 300, 430, 0.17], ['triangle', 430, 260, 0.3]],
      Applause: [['noise', 0, 0, 1.2]],
    };
    const apply = () => {
      if (!ctx) return;
      main.gain.value = (volume / 100) * 0.25;
      panner.pan.value = clamp(effects.pan, -100, 100) / 100;
    };
    const rate = () => 2 ** (clamp(effects.pitch, -360, 360) / 120);     // 10 is one semitone, as in Scratch
    const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
    const fade = (at, dur) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + 0.01);
      g.gain.setValueAtTime(1, at + Math.max(0.01, dur - 0.03));
      g.gain.linearRampToValueAtTime(0, at + dur);
      g.connect(main);
      return g;
    };
    const voice = (node, out) => {
      voices.add(node);
      node.onended = () => voices.delete(node);
      node.connect(out);
    };
    const noise = (at, dur) => {
      const n = ctx.createBufferSource();
      n.buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      n.buffer.getChannelData(0).forEach((v, i, a) => { a[i] = (Math.random() - 0.5) * 0.7; });
      voice(n, fade(at, dur));
      n.start(at);
    };
    const osc = (type, f0, f1, at, dur) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0 * rate(), at);
      o.frequency.exponentialRampToValueAtTime(f1 * rate(), at + dur);
      voice(o, fade(at, dur));
      o.start(at);
      o.stop(at + dur);
    };
    const play = (parts) => {
      if (!ctx) return;
      let at = ctx.currentTime;
      parts.forEach(([wave, f0, f1, dur]) => {
        if (wave === 'noise') noise(at, dur);
        else if (wave) osc(wave, f0, f1, at, dur);
        at += dur;
      });
    };
    const silence = () => { voices.forEach((v) => v.stop()); voices.clear(); tone = null; };
    return {
      // Browsers only open audio from a user gesture: Play and the hub's buttons call this.
      unlock() {
        if (!ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          ctx = new Ctx();
          main = ctx.createGain();
          panner = ctx.createStereoPanner();
          main.connect(panner).connect(ctx.destination);
          apply();
        }
        ctx.resume();
      },
      beep(midi, sec) {
        onBeep();
        play([['square', hz(midi), hz(midi), Math.max(0.05, sec)]]);
        return sleep(sec);
      },
      beepStart(midi) {
        onBeep();
        if (tone) tone.stop();
        if (!ctx) return;
        tone = ctx.createOscillator();
        tone.type = 'square';
        tone.frequency.value = hz(midi) * rate();
        voice(tone, main);
        tone.start();
      },
      stop: silence,
      play(name, untilDone) {
        const parts = SOUNDS[name] || SOUNDS.Laser;
        play(parts);
        return untilDone ? sleep(parts.reduce((sum, p) => sum + p[3], 0)) : Promise.resolve();
      },
      get volume() { return volume; },
      set volume(v) { volume = clamp(v, 0, 100); apply(); },
      setEffect(name, val) { effects[name] = val; apply(); },
      changeEffect(name, delta) { effects[name] += delta; apply(); },
      clearEffects() { effects.pitch = effects.pan = 0; apply(); },
    };
  }

  // Any alphabet, no font table: the browser draws each letter and its columns are read back for the 5×5 screen.
  function textColumns(text) {
    const SIZE = 12, c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true }), cols = [];
    c.width = SIZE;
    c.height = 7;
    g.font = '7px Arial, sans-serif';
    for (const letter of text) {
      g.clearRect(0, 0, SIZE, 7);
      g.fillText(letter, 1, 6);
      const data = g.getImageData(0, 0, SIZE, 7).data, glyph = [];
      for (let x = 0; x < SIZE; x++) {
        const col = [1, 2, 3, 4, 5].map((y) => data[(y * SIZE + x) * 4 + 3] > 70);
        if (col.some(Boolean)) glyph.push(col);
      }
      cols.push(...(glyph.length ? glyph : [[], []]), []);
    }
    return cols;
  }

  const plastic = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.4, envMapIntensity: 0.4 }, o));
  const shadowed = (m) => { m.traverse((o) => { o.castShadow = o.receiveShadow = true; }); return m; };

  function tableMesh(half) {
    const S = 14, W = half * 2, c = document.createElement('canvas');
    c.width = c.height = W * S;
    const g = c.getContext('2d');
    g.fillStyle = '#f8fafb';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#e4ebef';
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 8; x < W; x += 8) { g.moveTo(x * S, 0); g.lineTo(x * S, c.height); g.moveTo(0, x * S); g.lineTo(c.width, x * S); }
    g.stroke();
    const map = new T.CanvasTexture(c);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 8;
    const top = new T.Mesh(new T.PlaneGeometry(W, W).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map, roughness: 0.75, envMapIntensity: 0.5 }));
    top.receiveShadow = true;
    const edge = new T.Mesh(new T.BoxGeometry(W, 1.4, W).translate(0, -0.71, 0), new T.MeshStandardMaterial({ color: '#c7d3da', roughness: 0.7 }));
    return new T.Group().add(top, edge);
  }

  // Each mesh has its middle at its origin.
  const MESHES = {
    cube() {
      const parts = [new T.RoundedBoxGeometry(4, 2.4, 2, 1, 0.06)];
      for (const x of [-1.5, -0.5, 0.5, 1.5]) for (const z of [-0.5, 0.5]) parts.push(new T.CylinderGeometry(0.3, 0.3, 0.2, 12).translate(x, 1.3, z));
      return new T.Mesh(T.BufferGeometryUtils.mergeGeometries(parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; })), plastic('#e8352e', { roughness: 0.35 }));
    },
    // Lying across the palm: eraser on finger A's side, the point on the thumb's.
    pencil() {
      const along = (g, x) => g.rotateZ(-Math.PI / 2).translate(x, 0, 0);
      return new T.Group().add(
        new T.Mesh(along(new T.CylinderGeometry(0.5, 0.5, 7.6, 6), -0.4), plastic('#f2b705', { flatShading: true })),
        new T.Mesh(along(new T.CylinderGeometry(0.12, 0.5, 1.4, 6), 4.1), plastic('#e9c79a', { roughness: 0.8, flatShading: true })),
        new T.Mesh(along(new T.CylinderGeometry(0.02, 0.12, 0.3, 6), 4.95), plastic('#33363a')),
        new T.Mesh(along(new T.CylinderGeometry(0.46, 0.46, 0.8, 12), -4.6), plastic('#f08aa6', { roughness: 0.7 })));
    },
    ball() {
      return new T.Mesh(new T.SphereGeometry(3, 28, 18), plastic('#f28a1d', { roughness: 0.55 }));
    },
    apple() {
      const stem = new T.Mesh(new T.CylinderGeometry(0.18, 0.25, 1.4, 8).rotateZ(0.25).translate(0.1, 3.5, 0), plastic('#6b4a2b'));
      return new T.Group().add(new T.Mesh(new T.SphereGeometry(3.5, 28, 18).scale(1, 0.92, 1), plastic('#d8262b', { roughness: 0.3 })), stem);
    },
  };

  // Sensor plunger travel for a force: touch is the first 2 mm up to 2.5 Н, then 2–8 mm for 2.5–10 Н. Percent of the 8 mm.
  const travel = (n) => (n < 2.5 ? (n / 2.5) * 2 : 2 + ((n - 2.5) / 7.5) * 6) / 8 * 100;

  RA.createSim = (container) => {
    const h = RA.createHand();
    // What the camera has to show: every mesh of the hand at rest and lifted, which hugs the hand far better than one box
    // round all of it; the stand and the objects sit inside. Each corner is fitted exactly, see tick().
    const right = new T.Vector3(0, 1, 0).cross(VIEW).normalize(), up = VIEW.clone().cross(right);
    const corners = [], b = new T.Box3();
    h.group.updateMatrixWorld(true);
    h.group.traverseVisible((m) => {
      if (!m.isMesh) return;
      b.setFromObject(m);
      for (let i = 0; i < 16; i++) corners.push(new T.Vector3(i & 1 ? b.max.x : b.min.x, (i & 2 ? b.max.y : b.min.y) + (i & 8 ? LIFT.height : 0), i & 4 ? b.max.z : b.min.z));
    });
    const uv = corners.map((p) => [p.dot(right), p.dot(up), p.dot(VIEW)]);
    const span = (k) => [Math.min(...uv.map((q) => q[k])), Math.max(...uv.map((q) => q[k]))];
    const [u0, u1] = span(0), [v0, v1] = span(1), um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
    const aim = right.clone().multiplyScalar(um).addScaledVector(up, vm).addScaledVector(VIEW, corners.reduce((s, p) => s + p.dot(VIEW), 0) / corners.length);
    const an = aim.dot(VIEW);
    const fit = uv.map(([u, v, n]) => [Math.abs(u - um), v - vm, n - an]);
    const stage = RA.stage(container, { fov: FOV, target: aim.toArray(), camera: aim.clone().addScaledVector(VIEW, 120).toArray(), shadowBox: 40 });
    const { scene, camera } = stage;
    const half = Math.ceil(Math.max(...corners.map((p) => Math.max(Math.abs(p.x), Math.abs(p.z)))) / 8 + 2) * 8;
    scene.add(h.group, tableMesh(half));

    // The stand: a post, a plate and a foot, the post as tall as the object on it needs.
    const standMat = plastic('#c3ccd2', { roughness: 0.55 });
    const post = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 1, 16).translate(0, 0.5, 0), standMat);
    const plate = new T.Mesh(new T.CylinderGeometry(1, 1, 0.3, 24).translate(0, -0.15, 0), standMat);
    const foot = new T.Mesh(new T.CylinderGeometry(1.8, 2, 0.4, 24).translate(0, 0.2, 0), standMat);
    const stand = shadowed(new T.Group().add(post, plate, foot));
    scene.add(stand);

    const objects = OBJECTS.map((o) => {
      const mesh = shadowed(MESHES[o.id]());
      mesh.visible = false;
      scene.add(mesh);
      return Object.assign({ mesh, state: 'stand', x: 0, y: 0, z: 0, vx: 0, vy: 0, touch: null }, o);
    });
    const byId = (id) => objects.find((o) => o.id === id) || null;

    // The person's hand near the distance sensor, on the line the sensor looks along.
    const proxy = shadowed(new T.Mesh(new T.RoundedBoxGeometry(5, 6, 1.6, 2, 0.6), plastic('#efc7a2', { roughness: 0.8 })));
    proxy.visible = false;
    scene.add(proxy);
    h.group.updateMatrixWorld(true);
    const eye = h.anchors.distance.getWorldPosition(new T.Vector3()), look = h.anchors.distance.getWorldDirection(new T.Vector3());

    let time = 0, force = 0, card = null, dist = null, obj = null, lift = null, listener = null;
    const offset = new T.Vector3();             // the lifted hand
    const buttons = { left: false, right: false };
    const emit = (e) => { if (listener) listener(e); };
    const v3 = new T.Vector3();

    /* ---------- Motors A, C, E ---------- */
    const degS = (pct) => (clamp(pct, -100, 100) * MAX_SPEED) / 100;
    const createMotor = (port) => {
      const F = h.FINGERS[port];
      const M = { F, pos: 0, vel: 0, want: 0, mode: 'stop', speed: 0, goal: 0, until: 0, raw: false, pressing: 0, zero: 0, def: 75,
        lo: F.stops[0], hi: F.stops[1], touch: null, push: 0, done: null };
      const finish = () => { const d = M.done; M.done = null; if (d) d(); };
      // A new command interrupts the old one, whose promise then ends.
      const drive = (mode, o) => { finish(); Object.assign(M, { mode, until: 0, raw: false, pressing: 0 }, o); };
      const driveAsync = (mode, o) => { drive(mode, o); return new Promise((res) => { M.done = res; }); };
      M.step = (dt) => {
        if (M.until && time >= M.until) drive('stop', {});
        let want = 0;
        if (M.mode === 'run') want = M.speed;
        if (M.mode === 'to') {
          const left = M.goal - M.pos;
          if (Math.abs(left) < 1.5 && M.goal >= M.lo && M.goal <= M.hi) { M.pos = M.goal; M.vel = 0; drive('stop', {}); }
          else want = Math.sign(left) * Math.min(M.speed, Math.sqrt(2 * ACCEL * Math.abs(left)));
        }
        M.want = want;
        M.vel += clamp(want - M.vel, -ACCEL * dt, ACCEL * dt);
        const free = M.pos + M.vel * dt, p = clamp(free, M.lo, M.hi);
        if (p !== free) M.vel = 0;
        const stuck = (p === M.hi && want > 0) || (p === M.lo && want < 0);
        M.pressing = stuck ? M.pressing + dt : 0;
        // Stopped by the object and still pushing: the finger grips. A regulated motor pushes with all it has.
        M.push = stuck && p === M.touch ? (M.raw ? Math.abs(want) / 6 : 100) : 0;
        M.pos = p;
        // A stalled move ends for the program, but the motor keeps pushing towards its goal, as a held position does.
        if (M.mode === 'to' && M.pressing >= STALL_END) finish();
      };
      M.halt = () => { drive('stop', {}); Object.assign(M, { pos: 0, vel: 0, want: 0, push: 0 }); };
      M.api = {
        run(pct, dir) { drive('run', { speed: degS(pct) * dir }); },
        runPower(pct) { drive('run', { speed: degS(pct), raw: true }); },
        stop() { drive('stop', {}); },
        runFor(deg, pct) {
          if (!pct) return Promise.resolve();
          return driveAsync('to', { goal: M.pos + deg * Math.sign(pct), speed: Math.abs(degS(pct)) });
        },
        runForSeconds(sec, pct, dir) { return driveAsync('run', { speed: degS(pct) * dir, until: time + sec }); },
        goTo(deg, mode, pct) {
          const d = wrap(deg) - wrap(M.pos);
          const turnBy = mode === 'clockwise' ? ((d % 360) + 360) % 360 : mode === 'counterclockwise' ? -(((-d % 360) + 360) % 360) : wrap(d);
          return M.api.runFor(turnBy, Math.abs(pct));
        },
        get position() { return wrap(Math.round(M.pos)); },
        get relative() { return Math.round(M.pos - M.zero); },
        set relative(v) { M.zero = M.pos - v; },
        get speedPct() { return Math.round(M.vel / 6); },
        get powerPct() { return Math.round(M.pressing && !M.raw ? Math.sign(M.want) * 100 : M.want / 6); },
        get defaultSpeed() { return M.def; },
        set defaultSpeed(v) { M.def = clamp(v, -100, 100); },
      };
      return M;
    };
    const motors = {};
    PORTS.forEach((p) => { motors[p] = createMotor(p); });
    const closed = (p) => motors[p].push > 0 || motors[p].pos * motors[p].F.sign >= motors[p].F.closeDeg / 2;
    const isOpen = (p) => Math.abs(motors[p].pos) <= 10;
    const grips = () => ({ A: motors.A.push > 0, C: motors.C.push > 0, E: motors.E.push > 0 });

    /* ---------- The object on the stand ---------- */
    // The signed motor angle where this finger first touches the object centred at c, or null before |upTo|: its centre lines,
    // sampled every quarter module, against the object's shape.
    const touchAt = (port, o, c, upTo) => {
      const F = h.FINGERS[port];
      const near = ([a, b]) => {
        const n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.25));
        for (let i = 0; i <= n; i++) if (o.dist(v3.lerpVectors(a, b, i / n), c) <= h.FINGER_R) return true;
        return false;
      };
      for (let d = 0; d <= upTo; d += 0.5) if (h.fingerSegments(port, d * F.sign).some(near)) return d * F.sign;
      return null;
    };
    // Where the object sits: against the palm (h.holdAt), raised or lowered up to 4 modules and moved up to 2 towards the thumb
    // until the designer's closed positions (A 90, C 270, E 80) grip it, as a person sets the stand. Only a round one needs the thumb.
    const seat = (o) => {
      const base = h.holdAt(o.r), need = o.round ? PORTS : ['A', 'C'], side = Math.sign(h.fingerSegments('E', 0)[0][0].x - base.x);
      for (let dx = 0; dx <= 2; dx++) for (let k = 0; k <= 16; k++) {
        const c = base.clone().add(v3.set(side * dx, (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5, 0));
        if (c.y - o.hy > 1 && need.every((p) => touchAt(p, o, c, h.FINGERS[p].closeDeg - 3) !== null)) return c;
      }
      return base;
    };
    // shortcut: an object that stays on the stand during a lift still stops the fingers in the air; fine for a 3.6 s lift.
    const setLimits = () => PORTS.forEach((p) => {
      const M = motors[p], c = obj && (obj.state === 'stand' || obj.state === 'held') ? obj.touch[p] : null;
      M.touch = c;
      [M.lo, M.hi] = c === null ? M.F.stops : M.F.sign > 0 ? [M.F.stops[0], c] : [c, M.F.stops[1]];
    });
    // The stand grows to the object: right under its middle, its top just under it, its plate no wider than it.
    const fitStand = (o) => {
      const c = o.c || h.holdAt(o.r);
      stand.position.set(c.x, 0, c.z);
      // The stand rises through both frames' openings, which end 4.5 in front of the middle: the foot slides back to stay inside.
      foot.position.z = Math.min(0, 4.45 - 2 - c.z);
      post.scale.y = Math.max(0.01, c.y - o.hy - 0.3);
      plate.position.y = c.y - o.hy;
      const k = clamp(o.r * 0.8, 0.5, 1.6);
      plate.scale.set(k, 1, k);
      return c;
    };
    const putOnStand = (o) => {
      const c = fitStand(o);
      Object.assign(o, { state: 'stand', x: c.x, y: c.y, z: c.z, vx: 0, vy: 0 });
    };
    const setObject = (id) => {
      if (lift) return;
      objects.forEach((o) => { o.mesh.visible = o.id === id; });
      obj = byId(id);
      if (obj) {
        if (!obj.touch) {
          obj.c = seat(obj);
          obj.touch = {};
          PORTS.forEach((p) => { const F = h.FINGERS[p]; obj.touch[p] = touchAt(p, obj, obj.c, F.sign > 0 ? F.stops[1] : -F.stops[0]); });
        }
        putOnStand(obj);
      } else fitStand(OBJECTS[0]);
      setLimits();
      emit({ type: 'object', obj });
    };

    // Why the object is not held, or null when it is: both fingers have to grip, a round object needs the thumb too.
    const verdict = (g) => {
      const fell = obj.n ? 'выпало' : 'выпал';
      if (!g.A && !g.C && !g.E) return { stays: true, text: `Пальцы его не сжали: ${obj.n ? 'осталось' : 'остался'} на подставке` };
      const miss = ['A', 'C'].filter((p) => !g[p]);
      if (miss.length) return { text: miss.length === 2 ? `Пальцы A и C не сжали его: ${fell}` : `Палец ${miss[0]} не сжал его: ${fell}` };
      if (obj.round && !g.E) return { text: obj.round };
      return null;
    };
    // The grip the table of task 2 files a lift under: 2 = A and C closed, 3 = with the thumb, 0 = something else.
    const gripKind = () => (closed('A') && closed('C') ? (closed('E') ? 3 : 2) : 0);

    const report = (held, text) => {
      lift.told = true;
      emit({ type: 'held', obj, kind: lift.kind, held, text });
    };
    // From where it is in the lifted hand; a round one rolls out sideways, on the thumb's side that two fingers leave open.
    // shortcut: a falling object passes through the frames under it; give it a roll forward first if that ever bothers anyone.
    const drop = (text) => {
      const c = obj.c.clone().add(offset);
      Object.assign(obj, { state: 'fall', x: c.x, y: c.y, z: c.z, vx: obj.round ? ROLL : 0, vy: 0 });
      setLimits();
      if (!lift.told) report(false, text);
    };
    const startLift = () => {
      if (lift) return;
      lift = { t: 0, kind: gripKind(), slip: null, told: false };
      if (obj && obj.state === 'stand') {
        const v = verdict(grips());
        if (v && v.stays) report(false, v.text);
        else { obj.state = 'held'; lift.slip = v && v.text; }
      }
      emit({ type: 'lift', up: true });
    };
    const liftStep = (dt) => {
      if (!lift) return;
      const t = (lift.t += dt), { up, shake, down, height, sway } = LIFT;
      offset.y = height * (t < up ? ease(t / up) : t < LIFT_TOP ? 1 : 1 - ease(Math.min(1, (t - LIFT_TOP) / down)));
      offset.x = t > up && t < up + shake ? sway * Math.sin(((t - up) / shake) * Math.PI * 6) : 0;
      if (obj && obj.state === 'held') {
        // A weak grip lasts until the shake; a good one until the fingers let go.
        if (lift.slip && t >= up) drop(lift.slip);
        else if (!lift.slip && verdict(grips())) drop(`Пальцы разжались: ${obj.n ? 'выпало' : 'выпал'}`);
        else if (t >= LIFT_TOP && !lift.told) report(true, '');
      }
      if (t < LIFT_TOP + down) return;
      lift = null;
      offset.set(0, 0, 0);
      if (obj && obj.state === 'held') obj.state = 'stand';
      emit({ type: 'lift', up: false });
    };
    const fallStep = (dt) => {
      if (!obj || obj.state !== 'fall') return;
      obj.vy -= GRAVITY * dt;
      obj.x += obj.vx * dt;
      obj.y += obj.vy * dt;
      const c = obj.c, onStand = Math.hypot(obj.x - c.x, obj.z - c.z) < 1.5, floor = onStand ? c.y : obj.hy;
      if (obj.y > floor) return;
      if (onStand) putOnStand(obj);
      else Object.assign(obj, { y: floor, state: 'table' });
      setLimits();
    };

    const step = (dt) => {
      time += dt;
      PORTS.forEach((p) => motors[p].step(dt));
      liftStep(dt);
      fallStep(dt);
    };

    /* ---------- Hub ---------- */
    const screen = new Array(25).fill(0);
    let turn = 0, bright = 100, scrolling = 0;
    const paint = () => {
      const px = new Array(25);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        const [y, x] = [[r, c], [c, 4 - r], [4 - r, 4 - c], [4 - c, r]][turn];
        px[y * 5 + x] = (screen[r * 5 + c] * bright) / 100;
      }
      h.setMatrix(px);
      emit({ type: 'display', px });
    };
    const sound = createSound(() => emit({ type: 'beep' }));
    const display = {
      setImage(arr) { scrolling++; arr.forEach((v, i) => { screen[i] = v; }); paint(); },
      clear() { scrolling++; screen.fill(0); paint(); },
      setPixel(x, y, pct) {
        if (x < 1 || x > 5 || y < 1 || y > 5) return;
        scrolling++;
        screen[(Math.round(y) - 1) * 5 + Math.round(x) - 1] = clamp(pct, 0, 100);
        paint();
      },
      setBrightness(pct) { bright = clamp(pct, 0, 100); paint(); },
      rotate(dir) { turn = (turn + dir + 4) % 4; paint(); },
      setOrientation(name) { turn = ORIENT[name] || 0; paint(); },
      scroll(text) {
        const run = ++scrolling, cols = textColumns(text.toUpperCase());
        return new Promise((done) => {
          let at = -5;
          const next = () => {
            if (run !== scrolling) return done();
            for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) screen[r * 5 + c] = cols[at + c] && cols[at + c][r] ? 100 : 0;
            paint();
            if (++at > cols.length) return done();
            setTimeout(next, SCROLL_MS);
          };
          next();
        });
      },
    };

    const hw = {
      ports: { A: 'motor', B: 'distance', C: 'motor', D: 'force', E: 'motor', F: 'color' },
      motors: { A: motors.A.api, C: motors.C.api, E: motors.E.api },
      display,
      centerLight(css) { h.setCenterLight(css); emit({ type: 'light', css }); },
      distanceLights(arr) { h.setEyes(arr); },
      sound,
      sensors: {
        force: () => force,
        color: () => (card ? card.code : -1),
        reflected: () => (card ? card.light : 0),
        distance: () => dist,
        button: (side) => buttons[side],
        tilted: () => false,                                 // the hand stands on the table
        orientationUp: (name) => name === 'leftside',        // the hub stands on its long side with ports A, C, E on top
        gesture: () => false,
        angle: () => 0,
        resetYaw() {},
      },
      onEvent(fn) { listener = fn; },
      reset() {
        PORTS.forEach((p) => motors[p].api.stop());
        bright = 100;
        turn = 0;
        display.clear();
        hw.centerLight(null);
        h.setEyes(null);
        sound.stop();
        sound.clearEffects();
        sound.volume = 100;
      },
    };

    /* ---------- The person ---------- */
    const press = (side, on) => {
      if (buttons[side] === on) return;
      buttons[side] = on;
      if (on) sound.unlock();
      emit({ type: 'button', side, state: on ? 'pressed' : 'released' });
    };
    // Newtons on the force sensor, 0..10 in steps of 0.1 like the real one.
    const setForce = (n) => {
      n = clamp(Math.round(n * 10) / 10, 0, 10);
      if (n === force) return;
      if (n >= TOUCH && force < TOUCH) sound.unlock();
      force = n;
      h.setForce(travel(n));
      emit({ type: 'force', n });
    };
    // A card from CARDS, or null to take it away.
    const setCard = (c) => {
      if (c === card) return;
      card = c;
      h.setCard(c && c.css);
      emit({ type: 'card', card: c });
    };
    // Centimetres from the distance sensor to the person's hand, or null: nothing in front of it.
    const setDistance = (cm) => {
      dist = cm === null ? null : Math.round(cm);
      proxy.visible = dist !== null;
      if (dist !== null) {
        proxy.position.copy(eye).addScaledVector(look, dist * CM + 0.8);
        proxy.position.y = Math.max(proxy.position.y, 5.1);        // close up it would dip into the base's front beam (Y 1..2)
        proxy.lookAt(eye.x, proxy.position.y, eye.z);
      }
      emit({ type: 'distance', cm: dist });
    };

    const resetTable = () => {
      lift = null;
      offset.set(0, 0, 0);
      PORTS.forEach((p) => motors[p].halt());
      setObject(obj && obj.id);
      draw();
    };

    /* ---------- Picture ---------- */
    const draw = () => {
      PORTS.forEach((p) => h.setMotor(p, motors[p].pos));
      h.group.position.copy(offset);
      if (!obj) return;
      if (obj.state === 'held') obj.mesh.position.copy(obj.c).add(offset);
      else obj.mesh.position.set(obj.x, obj.y, obj.z);
    };

    let last = 0, ticker = 0, seen = null, running = false;
    const tick = (dt) => {
      const now = performance.now();
      let left = Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      for (; left > 1e-6; left -= STEP) step(Math.min(left, STEP));
      h.update(dt || 0.05);
      draw();
      if (sim.onTick) sim.onTick();
      if (stage.size !== seen && stage.controls) {
        seen = stage.size;
        // The nearest camera that shows every corner at its own depth with a module to spare, the object chips' 56 px kept clear
        // at the top and 16 px at the bottom. need(s) is that distance with the aim raised by s; it is convex, so a ternary search finds the best s.
        const tan = Math.tan((camera.fov * Math.PI) / 360), top = tan * Math.max(0.5, 1 - 112 / seen.h), low = tan * (1 - 32 / seen.h), wide = tan * camera.aspect;
        const need = (s) => Math.max(...fit.map(([u, v, n]) => n + Math.max((v - s + 1) / top, (s - v + 1) / low, (u + 1) / wide)));
        let s0 = -12, s1 = 12;
        for (let i = 0; i < 40; i++) { const a = s0 + (s1 - s0) / 3, z = s1 - (s1 - s0) / 3; if (need(a) < need(z)) s1 = z; else s0 = a; }
        const s = (s0 + s1) / 2, d = need(s), dir = camera.position.clone().sub(stage.target).normalize();
        stage.target.copy(aim).addScaledVector(up, s);
        stage.controls.target.copy(stage.target);
        camera.position.copy(stage.target).addScaledVector(dir, d);
        stage.controls.minDistance = d * 0.4;
        stage.controls.maxDistance = d * 1.6;
      }
    };
    stage.frame(tick);
    // A resize wipes the canvas; drawing at once keeps the splitter drag from flickering.
    if (stage.renderer) new ResizeObserver(() => { if (running) stage.renderer.render(scene, camera); }).observe(container);

    /* ---------- Pointer on the 3D view: the hub's buttons and the force sensor; anything else orbits ---------- */
    const el = stage.renderer && stage.renderer.domElement;
    if (el) {
      const ray = new T.Raycaster(), ndc = new T.Vector2();
      h.forceButton.geometry.computeBoundingBox();
      const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
      const within = (o, root) => { for (; o; o = o.parent) if (o === root) return true; return false; };
      let pressed = null, plunger = false;
      const end = () => {
        if (pressed) press(pressed, false);
        if (plunger) setForce(0);
        pressed = null;
        plunger = false;
        stage.controls.enabled = true;
      };
      // Capture phase: this has to decide before OrbitControls starts an orbit.
      container.addEventListener('pointerdown', (e) => {
        if (e.target !== el || e.button !== 0) return;
        const r = el.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        // Raycasting sees hidden meshes too (the card when none is shown): the first visible hit counts.
        const hits = ray.intersectObject(h.group, true).filter((x) => shown(x.object)), hit = hits[0];
        if (!hit) return;
        const o = hit.object, b = h.hubButtons;
        // The plunger is small and the colour sensor hides much of it from the front-right: the force sensor's face round it
        // counts too, and so does the plunger just behind whatever the pointer hit first.
        const cap = h.forceButton.geometry.boundingBox.getCenter(v3).applyMatrix4(h.forceButton.matrixWorld);
        const onForce = (within(o, h.parts.controls) && hit.point.distanceTo(cap) < 2.3) || hits.some((x) => x.object === h.forceButton && x.distance - hit.distance < 5);
        if (within(o, b.center)) emit({ type: 'center' });
        else if (within(o, b.left)) press((pressed = 'left'), true);
        else if (within(o, b.right)) press((pressed = 'right'), true);
        else if (onForce) { plunger = true; setForce(4); }
        else return;
        stage.controls.enabled = false;
        el.setPointerCapture(e.pointerId);
      }, true);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }

    const sim = {
      hw, stage, hand: h, motors, objects, CARDS, OBJECTS,
      press, setForce, setCard, setDistance, setObject, resetTable, closed, isOpen, step, draw, onTick: null,
      lift: startLift,
      get time() { return time; },
      get force() { return force; },
      get card() { return card; },
      get distance() { return dist; },
      get object() { return obj; },
      get lifting() { return !!lift; },
      start() {
        running = true;
        last = performance.now();
        stage.start();
        if (!el) ticker = setInterval(tick, 50);        // no WebGL: the blocks and the 2D hub still work
      },
      stop() {
        running = false;
        stage.stop();
        clearInterval(ticker);
      },
    };
    setObject(null);
    draw();
    return sim;
  };
})();
