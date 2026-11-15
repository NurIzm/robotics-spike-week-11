// «Кисть»: «SPIKE Manipulator» by Irwin Wu, an alternate build of the LEGO SPIKE Prime set 45678, built procedurally from his instructions.
// 1 unit = 1 LEGO module (8 mm). +Y up, Y=0 the table, X=Z=0 the middle of the bottom frame. +Z is the palm, the side the fingers curl to.
// The instructions draw every fingertip bent towards the hub's battery side, where all three sensors work, so that side is the palm; the
// hub's screen and the azure cover face -Z, the back of the hand, as on the PDF's cover. +X is right seen from the palm: finger A on the
// left, finger C and the thumb on the right. ref/NOTES.md «Model decisions» has the numbers and which of them are guesses.
// Geometry and materials are built once; each createHand() only adds meshes and its own state.
(function () {
  const RA = window.RA;
  const T = THREE;
  const { mergeGeometries, toCreasedNormals } = T.BufferGeometryUtils;
  const Q = Math.PI / 2, TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = T.MathUtils.clamp;
  const smooth = (t) => t * t * (3 - 2 * t);
  const polar = (a, r = 1) => [Math.cos(a) * r, Math.sin(a) * r];

  const PARTS = [
    { id: 'base', name: 'Основание', role: 'Две голубые рамы 11 × 15 и балки: на них стоит вся кисть' },
    { id: 'hub', name: 'Хаб', role: 'Мозг: хранит программу, читает три датчика и управляет тремя моторами' },
    { id: 'fingerA', name: 'Палец A', role: 'Свой средний мотор, порт A. Сгибается при сильном нажатии' },
    { id: 'fingerC', name: 'Палец C', role: 'Свой средний мотор, порт C. Сгибается при лёгком нажатии' },
    { id: 'thumb', name: 'Большой палец', role: 'Большой мотор и две шестерни, порт E. Сгибается от красной карточки' },
    { id: 'distance', name: 'Датчик расстояния', role: 'Смотрит туда же, куда сгибаются пальцы: видит, далеко ли рука или предмет. Порт B' },
    { id: 'controls', name: 'Датчики силы и цвета', role: 'Кнопка силы в порту D и датчик цвета в порту F: ими управляет человек' },
    { id: 'palm', name: 'Ладонь', role: 'Балки перед моторами пальцев: к ним пальцы прижимают предмет. Сзади ладонь закрыта голубой накладкой' },
    { id: 'cables', name: 'Кабели', role: 'Нервы: шесть кабелей от моторов и датчиков к хабу' },
  ];

  // Motor positions from open (0). The designer's program closes A to 90, C to 270 (= -90), E to 80. Stops: closing, a finger's shaft
  // reaches the palm beams' top edge; tilted back, it lies down on the cover's bricks; the thumb's both stops are guesses.
  const FINGERS = {
    A: { name: 'Палец A', motor: 'средний', sign: 1, closeDeg: 90, stops: [-60, 115] },
    C: { name: 'Палец C', motor: 'средний', sign: -1, closeDeg: 90, stops: [-115, 60] },
    E: { name: 'Большой палец', motor: 'большой', sign: 1, closeDeg: 80, stops: [-40, 120] },
  };

  const STAGES = [
    { id: 'base', title: 'Основание', steps: '1–5', parts: 'Голубая рама 11 × 15, длинные чёрные балки, серые соединители',
      text: 'Положи голубую раму и закрепи на её длинных сторонах чёрные балки. На этом основании будет стоять вся кисть.' },
    { id: 'hub', title: 'Хаб', steps: '6–7', parts: 'Хаб, чёрные соединители, голубая балка',
      text: 'Поставь хаб на длинное ребро вдоль одной стороны рамы: экраном наружу, батареей внутрь.' },
    { id: 'distance', title: 'Датчик расстояния и верхняя рама', steps: '8–9', parts: 'Датчик расстояния, голубая угловая балка, вторая голубая рама',
      text: 'Поставь датчик расстояния глазами в сторону ладони, кабель в порт B. Сверху положи вторую раму.' },
    { id: 'fingers', title: 'Два пальца', steps: '10–13', parts: 'Два средних мотора, длинные и короткие чёрные гнутые балки, белые соединители',
      text: 'Каждый палец — две гнутые балки по бокам своего мотора. Поставь оба мотора на верхнюю раму, кабели в порты A и C.' },
    { id: 'thumb', title: 'Большой палец', steps: '14', parts: 'Большой мотор, две серые шестерни, жёлтые балки',
      text: 'Мотор крутит шестерню, она крутит вторую, а на её оси сидит жёлтый палец. Закрепи блок сбоку, кабель в порт E.' },
    { id: 'controls', title: 'Датчики силы и цвета', steps: '15–20', parts: 'Пурпурная рама, датчик силы, датчик цвета, балки ладони',
      text: 'Поставь пурпурную раму с датчиками со стороны ладони: датчик силы в порт D, датчик цвета в порт F. Добавь балки ладони.' },
    { id: 'cover', title: 'Накладка', steps: '21', parts: 'Пурпурная рама, голубые панели и изогнутые детали, синие кирпичи',
      text: 'Собери накладку и закрепи её с тыльной стороны, над экраном хаба.' },
  ];

  /* ---------- Layout, in modules (ref/NOTES.md «Model decisions») ---------- */
  const ROTOR = { y: 17.5, z: -3.5 };       // the finger motors' rotor axis, along X
  const FX = { A: -2.55, C: 2.55 };          // the finger motors' middles: the two fingers' inner liftarms keep 0.1 apart
  const THUMB = new T.Vector3(8.7, 16.6, 0);  // the thumb's axle, at its liftarm's middle
  const THUMB_OPEN = 45;                     // open, the thumb points this many degrees forward of +X
  const PALM_Z = 0.5, STAND_Y = 12;          // the palm beams' front; a held object sits this high, against them
  const FINGER_R = 0.5;
  // A finger: a 9-hole liftarm bent 45° on each side of its motor, and two short bent liftarms between them that hook forward.
  // Centre lines in the finger's plane as [forward, up] from the rotor; x across, outer side negative (finger A's).
  const LONG = [[0, 0], [0, 6], [1.41, 7.41]];
  const TIP = [[1.41, 7.41], [3.41, 7.41], [5.21, 5.01]];
  const LINES = [[-2.45, LONG], [2, LONG], [-0.9, TIP], [0.9, TIP]];
  // The thumb: a yellow liftarm bent twice, [along, inwards] from its axle.
  const THUMB_LINE = [[0, 0], [6, 0], [7.41, 1.41], [7.41, 3.41]];
  const TRAVEL = 1;                          // the force sensor's plunger travels 8 mm
  const FORCE = new T.Vector3(3.5, 5.5, 6);  // the force sensor's face, plunger towards +Z through the magenta frame
  const COLOR = new T.Vector3(8.5, 8.5, 8);  // the colour sensor's lens, looking out to +X
  const EYES = new T.Vector3(-5.5, 4.5, 1);  // the distance sensor's face, between the eyes, looking towards +Z
  const EXPLODE = { base: [0, 0, 0], hub: [0, 0, -7], fingerA: [-4, 7, 0], fingerC: [4, 7, 0], thumb: [8, 4, 0],
    distance: [-7, 0, 5], controls: [5, 0, 8], palm: [0, 5, 0], cables: [0, 0, 0] };
  const PALE = new T.Color('#cddae2');
  const RING_OFF = '#ece3bd', EYE_OFF = new T.Color('#2d3238'), EYE_ON = new T.Color('#ffffff');
  const LED_X = -6.25, LED_PITCH = 0.84;
  // Week 9's hub (face +Z, ports A, C, E along y=0) turned over: screen to -Z, A, C, E on top, centre button at +X.
  const HUB_M = new T.Matrix4().makeRotationX(Math.PI).setPosition(5.5, 9, -3.5);

  // Everything merges as plain non-indexed triangles with normals.
  const solid = (g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; };
  const box = (w, h, d, r = 0.05, seg = 1) => solid(new T.RoundedBoxGeometry(w, h, d, seg, r));
  const brick = (w, h, d) => solid(new T.BoxGeometry(w, h, d));
  const cyl = (r, h, seg = 12) => solid(new T.CylinderGeometry(r, r, h, seg));
  const lathe = (pts, seg = 24) => solid(new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg));
  const flat = (shape) => solid(new T.ShapeGeometry(shape, 4));
  const disc = (r, seg = 14) => solid(new T.CircleGeometry(r, seg));
  const ring = (a, b, seg = 14, start = 0, len = TAU) => solid(new T.RingGeometry(a, b, seg, 1, start, len));

  // Extruded along +Z from 0 to depth; the bevel stays inside the nominal outline.
  const extrude = (shape, depth, bevel = 0.04, curveSegments = 6) => {
    const g = new T.ExtrudeGeometry(shape, { depth: depth - bevel * 2, curveSegments, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1 });
    g.translate(0, 0, bevel);
    g.deleteAttribute('uv');
    return toCreasedNormals(g, 0.6);
  };
  // Same, from a plan drawn in the X-Z plane, standing on y0.
  const plan = (shape, y0, h, bevel, curveSegments) => extrude(shape, h, bevel, curveSegments).rotateX(Q).translate(0, y0 + h, 0);

  const rrect = (x0, y0, x1, y1, r) => {
    const s = new T.Shape();
    s.absarc(x1 - r, y0 + r, r, -Q, 0);
    s.absarc(x1 - r, y1 - r, r, 0, Q);
    s.absarc(x0 + r, y1 - r, r, Q, 2 * Q);
    s.absarc(x0 + r, y0 + r, r, 2 * Q, 3 * Q);
    s.closePath();
    return s;
  };
  // Liftarm outline around a centre line that bends one way: round outside, mitred inside.
  const polyBeam = (pts, r = 0.49) => {
    const cross = (i) => (pts[i][0] - pts[i - 1][0]) * (pts[i + 1][1] - pts[i][1]) - (pts[i][1] - pts[i - 1][1]) * (pts[i + 1][0] - pts[i][0]);
    if (pts.length > 2 && cross(1) < 0) pts = pts.slice().reverse();     // walk it so that every bend turns left
    const a = pts.slice(1).map((p, i) => Math.atan2(p[1] - pts[i][1], p[0] - pts[i][0]));
    for (let i = 1; i < a.length; i++) while (a[i] < a[i - 1] - Math.PI) a[i] += TAU;
    const n = pts.length - 1, s = new T.Shape();
    s.absarc(pts[0][0], pts[0][1], r, a[0] + Q, a[0] + 3 * Q);
    for (let i = 1; i < n; i++) s.absarc(pts[i][0], pts[i][1], r, a[i - 1] - Q, a[i] - Q);
    s.absarc(pts[n][0], pts[n][1], r, a[n - 1] - Q, a[n - 1] + Q);
    for (let i = n - 1; i > 0; i--) {
      const [mx, my] = polar((a[i - 1] + a[i]) / 2 + Q, r / Math.cos((a[i] - a[i - 1]) / 2));
      s.lineTo(pts[i][0] + mx, pts[i][1] + my);
    }
    s.closePath();
    return s;
  };
  const addHole = (shape, x, y, r = 0.38) => { const p = new T.Path(); p.absarc(x, y, r, 0, TAU, true); shape.holes.push(p); };
  // Hole centres one module apart along a centre line.
  const holesAlong = (pts) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
    return out;
  };
  const crossShape = (r, w) => {
    const s = new T.Shape();
    [[w, -w], [r, -w], [r, w], [w, w], [w, r], [-w, r], [-w, w], [-r, w], [-r, -w], [-w, -w], [-w, -r], [w, -r]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
  };
  const cog = (r, root, teeth) => {
    const s = new T.Shape(), step = TAU / teeth;
    for (let i = 0; i < teeth; i++) {
      [[root, -0.5], [root, -0.32], [r, -0.22], [r, 0.22], [root, 0.32], [root, 0.5]].forEach(([q, k]) => {
        const [x, y] = polar(i * step + k * step * 0.5, q);
        if (i || k > -0.5) s.lineTo(x, y); else s.moveTo(x, y);
      });
    }
    s.closePath();
    return s;
  };
  // Flat white cable along a smooth path; its width prefers `across`.
  const ribbon = (pts, across = [0, 1, 0], W = 0.43, H = 0.045) => {
    const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)), false, 'centripetal');
    const N = Math.ceil(curve.getLength() * 4), pos = [], idx = [];
    const t = new T.Vector3(), w = new T.Vector3(), n = new T.Vector3(), p = new T.Vector3(), a = new T.Vector3().fromArray(across);
    for (let i = 0; i <= N; i++) {
      curve.getPointAt(i / N, p);
      curve.getTangentAt(i / N, t);
      w.copy(a).addScaledVector(t, -t.dot(a));
      if (w.lengthSq() < 1e-4) w.set(1, 0, 0).addScaledVector(t, -t.x);   // the path runs along `across`: any side will do
      w.normalize();
      n.crossVectors(t, w);
      for (const [u, v] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) pos.push(p.x + w.x * W * u + n.x * H * v, p.y + w.y * W * u + n.y * H * v, p.z + w.z * W * u + n.z * H * v);
      if (i < N) for (let k = 0; k < 4; k++) {
        const c0 = i * 4 + k, c1 = i * 4 + ((k + 1) % 4);
        idx.push(c0, c1, c1 + 4, c0, c1 + 4, c0 + 4);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return toCreasedNormals(g, 0.7);
  };

  const FACES = { '+x': [1, 0, 0, 0, Q, 0], '-x': [-1, 0, 0, 0, -Q, 0], '+y': [0, 1, 0, -Q, 0, 0], '-y': [0, -1, 0, Q, 0, 0], '+z': [0, 0, 1, 0, 0, 0], '-z': [0, 0, -1, 0, Math.PI, 0] };
  const compose = (x, y, z, rx, ry, rz, s = 1) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(s, s, s));

  // A point of a finger's or the thumb's centre line, in the hand's space, at a motor angle.
  const angleOf = (port, deg) => clamp(deg, FINGERS[port].stops[0], FINGERS[port].stops[1]) * FINGERS[port].sign * DEG;
  const pivotAt = (port) => (port === 'E' ? THUMB.clone() : new T.Vector3(FX[port], ROTOR.y, ROTOR.z));
  const turnAt = (port, deg) => (port === 'E' ? new T.Euler(0, -(THUMB_OPEN * DEG + angleOf('E', deg)), 0) : new T.Euler(angleOf(port, deg), 0, 0));
  const lines = (port) => (port === 'E' ? [THUMB_LINE.map(([u, v]) => [u, 0, v])]
    : LINES.map(([x, pts]) => pts.map(([f, u]) => [port === 'A' ? x : -x, u, f])));
  const segDist = (c, a, b) => {
    const ab = b.clone().sub(a), t = clamp(c.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    return a.clone().addScaledVector(ab, t).distanceTo(c);
  };
  const fingerSegments = (port, deg) => {
    const e = turnAt(port, deg), o = pivotAt(port), segs = [];
    lines(port).forEach((line) => {
      const pts = line.map((p) => new T.Vector3(...p).applyEuler(e).add(o));
      for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
    });
    return segs;
  };
  const holdAt = (r) => new T.Vector3(0, STAND_Y + r, PALM_Z + r);
  const touchDeg = (port, r) => {
    const f = FINGERS[port], c = holdAt(r), end = f.sign > 0 ? f.stops[1] : -f.stops[0];
    for (let d = 0; d <= end; d += 0.5) {
      if (fingerSegments(port, d * f.sign).some(([a, b]) => segDist(c, a, b) <= r + FINGER_R)) return d * f.sign;
    }
    return null;
  };

  function buildKit() {
    const plastic = (color, roughness = 0.35) => new T.MeshStandardMaterial({ color, roughness, envMapIntensity: 0.35 });
    // Holes carry a darker tone of their part so they read as depth without ambient occlusion.
    const M = {
      azure: plastic('#01adc4'), magenta: plastic('#c92e85'), yellow: plastic('#fed920'), white: plastic('#eceded'),
      black: plastic('#16151a'), grey: plastic('#a9b0b5'), blue: plastic('#1f5aa8'), light: plastic('#5cc8e2'),
      dark: plastic('#2a2d33', 0.6), plate: plastic('#d9dcde', 0.5), red: plastic('#c8281f'), tan: plastic('#d8bf8a', 0.45),
      azureRim: plastic('#018da1', 0.5), azureHole: plastic('#02505e', 0.7), lightHole: plastic('#16606f', 0.7),
      magentaRim: plastic('#8f1c5d', 0.5), magentaHole: plastic('#4d0a33', 0.7),
      yellowRim: plastic('#e8bb12', 0.5), yellowHole: plastic('#a87d05', 0.7),
      whiteRim: plastic('#d5d8da', 0.5), whiteHole: plastic('#7f868b', 0.7),
      greyRim: plastic('#7c848a', 0.5), greyHole: plastic('#3d4347', 0.7),
      blackHole: plastic('#050506', 0.8), battery: plastic('#f4ce14'), plug: plastic('#e6e2d6', 0.5),
      led: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
      ledWindow: new T.MeshBasicMaterial({ color: '#3b4a54' }),
    };

    const RIM = ring(0.27, 0.38), CORE = disc(0.27);
    const dimple = (add, rim, core, x, y, z, face) => {
      const [nx, ny, nz, ...rot] = FACES[face], o = 0.006;
      add(rim, RIM, x + nx * o, y + ny * o, z + nz * o, ...rot);
      add(core, CORE, x + nx * o, y + ny * o, z + nz * o, ...rot);
    };
    const BORE = lathe([[0.38, -0.42], [0.285, -0.42], [0.285, 0.42], [0.38, 0.42]], 8);     // thickness 1, along Y
    const AXLE_END = flat(crossShape(0.27, 0.09));

    const piece = (name, stage, from, fill) => {
      const lists = new Map();
      fill((mat, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
        if (!lists.has(mat)) lists.set(mat, []);
        lists.get(mat).push(g.clone().applyMatrix4(compose(x, y, z, rx, ry, rz)));
      });
      return { name, stage, from, meshes: [...lists].map(([mat, list]) => ({ mat, geo: mergeGeometries(list) })) };
    };
    // Everything added through it is moved by m afterwards.
    const under = (add, m) => (mat, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => add(mat, g.clone().applyMatrix4(compose(x, y, z, rx, ry, rz)).applyMatrix4(m));

    // A liftarm 1 thick with holes along Z, its centre line drawn in the X-Y plane.
    const arm = (pts, holes = holesAlong(pts)) => {
      const s = polyBeam(pts);
      holes.forEach(([x, y]) => addHole(s, x, y));
      return { body: extrude(s, 1, 0.04, 5).translate(0, 0, -0.5), bores: mergeGeometries(holes.map(([x, y]) => BORE.clone().rotateX(Q).translate(x, y, 0))) };
    };
    const straight = (n) => arm([[0, 0], [n - 1, 0]]);
    // Rotations used below: none, holes along Z; (Q,0,0) flat, the drawing's y towards +Z; (0,-Q,0) upright, holes along X,
    // the drawing's x towards +Z; (0,0,Q) upright along Y, holes along Z.
    const addArm = (add, colour, a, x, y, z, rx = 0, ry = 0, rz = 0) => {
      add(M[colour], a.body, x, y, z, rx, ry, rz);
      add(M[colour + 'Hole'], a.bores, x, y, z, rx, ry, rz);
    };
    const BEAM3 = straight(3), BEAM11 = straight(11), BEAM13 = straight(13), BEAM15 = straight(15);
    // Open frame w x d, 1 thick, holes through it: drawn in X-Y. The holes are dark discs at mid-depth, cheaper than bores for 48 holes.
    const frame = (w, d) => {
      const s = rrect(-w / 2, -d / 2, w / 2, d / 2, 0.5), open = new T.Path(), holes = [];
      open.moveTo(-w / 2 + 1, -d / 2 + 1); open.lineTo(-w / 2 + 1, d / 2 - 1); open.lineTo(w / 2 - 1, d / 2 - 1); open.lineTo(w / 2 - 1, -d / 2 + 1); open.closePath();
      s.holes.push(open);
      for (let x = -w / 2 + 0.5; x < w / 2; x++) holes.push([x, -d / 2 + 0.5], [x, d / 2 - 0.5]);
      for (let y = -d / 2 + 1.5; y < d / 2 - 1; y++) holes.push([-w / 2 + 0.5, y], [w / 2 - 0.5, y]);
      holes.forEach(([x, y]) => addHole(s, x, y, 0.36));
      return { body: extrude(s, 1, 0, 4).translate(0, 0, -0.5), bores: mergeGeometries(holes.map(([x, y]) => disc(0.36, 8).translate(x, y, 0))) };
    };
    const FRAME15 = frame(15, 11), FRAME11 = frame(11, 7);
    const pinUp = (add, mat, x, y, z, len) => {
      add(mat, cyl(0.24, len, 10), x, y + len / 2, z);
      add(M.dark, disc(0.13, 8), x, y + len + 0.005, z, -Q);
    };

    /* ---------- Medium motor (week 9's): body along +x from 11 to 19, 3 x 3, rotor on the +y face at x 17.5 ---------- */
    const nose = (y0, h) => {
      const s = new T.Shape();
      s.moveTo(15.2, -1.5);
      s.lineTo(18.4, -1.5);
      s.absarc(18.4, -0.9, 0.6, -Q, 0);
      s.absarc(18.4, 0.9, 0.6, 0, Q);
      s.lineTo(15.2, 1.5);
      s.closePath();
      return plan(s, y0, h, 0.045, 3);
    };
    const motor = (add0, m) => {
      const add = under(add0, m);
      add(M.azure, box(4.3, 3, 3, 0.1, 2), 13.15, 3.5, 0);
      add(M.white, nose(2, 1.05));
      add(M.white, nose(3.05, 1.95));
      for (const [z, face] of [[1.5, '+z'], [-1.5, '-z']]) {
        for (const x of [16.5, 18.2]) {
          for (const y of [2.55, 4.45]) dimple(add, M.whiteRim, M.whiteHole, x, y, z, face);
          add(M.whiteRim, brick(0.42, 0.16, 0.01), x, 3.6, z);
        }
        for (const y of [2.5, 4.5]) dimple(add, M.azureRim, M.azureHole, 11.75, y, z, face);
        add(M.azureRim, brick(0.42, 1.1, 0.01), 11.75, 3.5, z);
      }
      add(M.dark, disc(0.28, 12), 11, 3.5, 0, 0, -Q, 0);           // the cable leaves the body's end
      add(M.dark, brick(0.9, 0.02, 0.45), 13.6, 2, 0.4);          // the badge, opposite the rotor
      add(M.azure, disc(0.55, 16), 17.5, 1.995, 0, Q);             // the rotor's other end, an axle hole
      add(M.azureHole, AXLE_END, 17.5, 1.99, 0, Q);
    };
    // The rotor disc, built along +y from the face; it turns with what it drives.
    const rotorDisc = (add) => {
      add(M.azureRim, lathe([[1.46, 0], [1.46, 0.06]], 32));
      add(M.azure, lathe([[1.5, 0.06], [1.5, 0.36], [1.42, 0.46], [0, 0.46]], 32));
      for (let i = 0; i < 4; i++) {
        const [x, z] = polar(Q / 2 + i * Q, 0.82);
        add(M.azureHole, disc(0.25, 10), x, 0.465, z, -Q);
      }
      add(M.azureHole, AXLE_END, 0, 0.465, 0, -Q);
    };

    /* ---------- Bottom frame and top frame ---------- */
    const base = piece('base', 0, [0, 4, 0], (add) => {
      addArm(add, 'light', FRAME15, 0, 0.5, 0, Q);
      for (const z of [-5, 5]) addArm(add, 'black', BEAM15, -7, 1.5, z, Q);
      for (const x of [-2, 2]) {
        add(M.grey, box(1, 1, 3, 0.12), x, 1.5, 0);
        pinUp(add, M.grey, x, 2, -1, 0.6);
      }
    });
    const topFrame = piece('topFrame', 2, [0, 8, 0], (add) => {
      addArm(add, 'light', FRAME15, 0, 10.5, 0, Q);
      for (const x of [-4.5, 4.5]) add(M.black, box(2, 1, 3, 0.12), x, 9.5, -3.5);   // cross blocks on the hub's ends hold it up
    });

    /* ---------- Hub: week 9's, turned over ---------- */
    const hub = piece('hub', 1, [0, 8, 0], (add0) => {
      const add = under(add0, HUB_M);
      add(M.yellow, box(11, 7, 3.15, 0.28, 2), -5.5, 3.5, -0.425);
      add(M.white, extrude(rrect(-11, 0, 0, 7, 0.62), 1, 0.1, 4), 0, 0, 1);
      add(M.battery, box(9.4, 5.4, 0.1, 0.04), -5.5, 3.5, -2.03);
      for (const x of [-10.35, -0.65]) for (const y of [0.65, 6.35]) {
        add(M.grey, cyl(0.42, 0.08, 16), x, y, 2.01, Q);
        add(M.greyRim, disc(0.2, 10), x, y, 2.056);
      }
      add(M.plate, flat(rrect(-2.45, 0.8, -0.95, 6.2, 0.74)), 0, 0, 2.004);
      add(M.plate, disc(1.34, 32), -1.7, 3.5, 2.006);
      add(M.grey, ring(0.52, 0.62, 24), -9.6, 5.5, 2.006);
      add(M.white, lathe([[0.52, 0], [0.5, 0.05], [0, 0.05]], 20), -9.6, 5.5, 2, Q);
      add(M.plate, flat(rrect(-10.15, 1.35, -9.05, 2.45, 0.08)), 0, 0, 2.004);
      // Ports: A, C, E along y=0 (the top once turned), B, D, F along y=7; A and B at the end away from the centre button.
      for (const x of [-7.6, -5.4, -3.2]) for (const [y, ny] of [[7, 1], [0, -1]]) {
        add(M.dark, brick(1.5, 0.1, 0.5), x, y + ny * 0.02, 1.04);
        add(M.greyHole, brick(1.2, 0.1, 0.18), x, y + ny * 0.05, 1.04);
      }
      for (const [y, face] of [[7, '+y'], [0, '-y']]) {
        for (const x of [-1, -10]) for (const z of [0.5, -0.5, -1.5]) dimple(add, M.yellowRim, M.yellowHole, x, y, z, face);
        add(M.yellowRim, brick(2.8, 0.03, 0.9), -5.5, y, -1.5);
      }
      add(M.dark, disc(0.92, 24), 0.006, 3.5, -0.3, 0, Q);          // the speaker, at the centre button's end
      for (const [x, face] of [[0, '+x'], [-11, '-x']]) {
        for (const y of [1.5, 5.5]) for (const z of [1, 0, -1]) dimple(add, M.yellowRim, M.yellowHole, x, y, z, face);
      }
    });

    /* ---------- Distance sensor: white face with two eyes, black back; standing, eyes one above the other ---------- */
    // Built lying along x with the face to +z, then stood up at EYES.
    const EYE_X = 1.6;
    const distance = piece('distance', 2, [0, 6, 4], (add0) => {
      const add = under(add0, compose(EYES.x, EYES.y, EYES.z, 0, 0, Q));
      add(M.black, box(7, 3, 1.2, 0.3, 2), 0, 0, -1.4);
      add(M.white, box(7, 3, 1, 0.3, 2), 0, 0, -0.5);
      for (const x of [-EYE_X, EYE_X]) {
        add(M.black, ring(0.72, 1.32, 28), x, 0, 0.004);
        add(M.dark, disc(0.72, 24), x, 0, 0.003);
        add(M.greyHole, ring(0.2, 0.6, 20), x, 0, 0.006);
      }
      add(M.dark, brick(1.1, 0.5, 0.02), 0, -0.9, 0.003);              // the badge between the eyes
      for (const x of [-3.5, 3.5]) for (const y of [-1, 1]) dimple(add, M.dark, M.blackHole, x, y, -1.4, x > 0 ? '+x' : '-x');
    });
    const eyeArcs = [-EYE_X, EYE_X].flatMap((x) => [Q / 2, Q / 2 + Math.PI].map((a) => ring(1.06, 1.26, 10, a, Math.PI * 0.55).translate(x, 0, 0.008)
      .applyMatrix4(compose(EYES.x, EYES.y, EYES.z, 0, 0, Q))));

    /* ---------- Fingers: one motor each, the whole finger turns on its rotor ---------- */
    // Standing, head up, the rotor's axis on ROTOR: finger A's rotor faces -X, finger C's is the same motor turned round.
    const motorA = compose(FX.A + 3.5, ROTOR.y - 17.5, ROTOR.z, 0, 0, Q);
    const motorC = compose(FX.C - 3.5, ROTOR.y - 17.5, ROTOR.z, 0, Math.PI, Q);
    const fingerBase = (port) => piece('motor' + port, 3, [0, 10, 0], (add) => motor(add, port === 'A' ? motorA : motorC));
    // The finger in its pivot: x across (finger A's outer side negative), y along the finger, z forward.
    const longArm = arm(LONG.map(([f, u]) => [f, u])), tipArm = arm(TIP.map(([f, u]) => [f, u]));
    const finger = (side) => piece('finger', 3, [0, 0, 0], (add) => {
      addArm(add, 'black', longArm, -2.45 * side, 0, 0, 0, -Q, 0);
      addArm(add, 'black', longArm, 2 * side, 0, 0, 0, -Q, 0);
      for (const x of [-0.9, 0.9]) addArm(add, 'black', tipArm, x, 0, 0, 0, -Q, 0);
      for (const x of [-1.95 * side, 1.5 * side]) {                  // a white 2-hole connector inside each liftarm, tan pins in it
        add(M.white, box(0.9, 2.2, 0.86, 0.2, 2), x, 3.8, 0);
        for (const y of [3, 4.6]) add(M.tan, cyl(0.24, 0.3, 8), x + (x < 0 ? -0.5 : 0.5), y, 0, 0, 0, Q);
      }
      for (const [f, u] of [[2.41, 7.41], [3.41, 7.41]]) {             // grey pins with red axles through the fingertip
        add(M.grey, cyl(0.25, 4.4, 10), -0.22 * side, u, f, 0, 0, Q);
        add(M.red, cyl(0.12, 4.6, 6), -0.22 * side, u, f, 0, 0, Q);
      }
      const rot = under(add, compose(-1.5 * side, 0, 0, 0, 0, side * Q));   // the rotor disc on the outer face turns with it
      rotorDisc(rot);
    });

    /* ---------- Thumb: large motor upright, its rotor drives a gear, which drives a gear lying on top; the thumb sits on that axle ---------- */
    const LS = 1.15;                                                  // the large motor drawn as the medium one, 15 % bigger
    const motorE = compose(5.275, -6.25, 0, 0, Math.PI, Q, LS);       // body x 7.6..11, y 6.4..15.6, rotor face at +X
    const ER = new T.Vector3(7.575, 17.5 * LS - 6.25, 0);              // the rotor's axis where it leaves the motor's inner face
    const GEAR = (() => {
      const s = cog(1.62, 1.42, 24);
      addHole(s, 0, 0, 0.3);
      return extrude(s, 0.5, 0.03, 4).translate(0, 0, -0.25);
    })();
    const thumbBase = piece('thumbBase', 4, [6, 4, 0], (add) => {
      motor(add, motorE);
      addArm(add, 'azure', arm([[0, 0], [4, 0], [4, 2]]), 7.5, 10.5, -2.4, Q, 0, 0);   // an azure L-beam holds it to the top frame
      add(M.black, box(1, 3, 1, 0.12), 9.3, 15.2, -2.2);                        // the black T-beam beside the gears
    });
    const eGear = piece('eGear', 4, [0, 0, 0], (add) => {                       // in the rotor's frame: x along the axis
      add(M.grey, GEAR, -0.4, 0, 0, 0, Q, 0);
      add(M.black, cyl(1.2, 0.8, 24), -1, 0, 0, 0, 0, Q);                      // two black wheel hubs on the same axle
      add(M.dark, disc(0.7, 16), -1.41, 0, 0, 0, -Q, 0);
      add(M.yellow, AXLE_END, -1.42, 0, 0, 0, -Q, 0);
      const rot = under(add, compose(3.45, 0, 0, 0, 0, -Q, LS));
      rotorDisc(rot);
    });
    const thumbArm = arm(THUMB_LINE);
    const thumb = piece('thumb', 4, [0, 0, 0], (add) => {                      // in the axle's frame: x along the thumb, z inwards
      add(M.grey, GEAR, 0, -0.75, 0, Q, 0, 0);
      addArm(add, 'yellow', thumbArm, 0, 0, 0, Q, 0, 0);
      addArm(add, 'yellow', BEAM3, 0, 1, 0, Q, 0, 0);
      add(M.black, cyl(0.22, 2.6, 8), 0, -0.2, 0);
      add(M.black, AXLE_END, 0, 1.51, 0, -Q);
    });

    /* ---------- Force and colour sensors on an upright magenta frame, on the palm side ---------- */
    const controls = piece('controls', 5, [0, 3, 8], (add) => {
      addArm(add, 'magenta', FRAME11, 3.5, 5.5, 6, 0, 0, Q);
      // Force sensor: white body, black back, plunger to +Z.
      add(M.white, box(3, 3, 2.4, 0.16, 2), FORCE.x, FORCE.y, FORCE.z - 1.2);
      add(M.black, box(3, 3, 2.4, 0.16, 2), FORCE.x, FORCE.y, FORCE.z - 3.6);
      add(M.dark, ring(0.4, 0.62, 20), FORCE.x, FORCE.y, FORCE.z + 0.01);
      for (const x of [-1, 1]) for (const y of [-1, 1]) dimple(add, M.whiteRim, M.whiteHole, FORCE.x + x, FORCE.y + y, FORCE.z, '+z');
      // Colour sensor: white body, black back, lens to +X.
      add(M.white, box(1.8, 3, 3, 0.16, 2), COLOR.x - 0.9, COLOR.y, COLOR.z);
      add(M.black, box(1, 3, 3, 0.16, 2), COLOR.x - 2.3, COLOR.y, COLOR.z);
      add(M.black, ring(0.55, 0.95, 24), COLOR.x + 0.004, COLOR.y, COLOR.z, 0, Q, 0);
      add(M.dark, disc(0.55, 20), COLOR.x + 0.003, COLOR.y, COLOR.z, 0, Q, 0);
      add(M.greyRim, disc(0.3, 16), COLOR.x + 0.006, COLOR.y, COLOR.z, 0, Q, 0);
      addArm(add, 'magenta', BEAM11, 7.5, 0.5, 6, 0, 0, Q);            // holds the colour sensor beside the frame
    });
    const plunger = cyl(0.36, 1.1, 14).rotateX(Q).translate(FORCE.x, FORCE.y, FORCE.z);

    /* ---------- Palm: beams in front of the finger motors; the cover on the back ---------- */
    const palm = piece('palm', 5, [0, 0, 6], (add) => {
      // shortcut: the PDF's 15L beams drawn shorter and without their connectors, so they clear the thumb's gears.
      addArm(add, 'azure', BEAM13, -6, 15.5, ROTOR.z + 2);            // across both motors (step 13)
      addArm(add, 'black', BEAM11, -5, 14.5, PALM_Z - 0.5);
      addArm(add, 'azure', BEAM11, -5, 13.5, PALM_Z - 0.5);
      addArm(add, 'black', BEAM11, -5, 12.5, PALM_Z - 0.5);
    });
    const coverSlope = (() => {
      const s = new T.Shape();
      // Curved slopes stood on end: full height under the bricks, sweeping out and down to a thin edge.
      s.moveTo(-6.4, 18);
      s.lineTo(-6.4, 13.4);
      s.lineTo(-8.7, 13.4);
      s.quadraticCurveTo(-8.6, 16.6, -7.6, 18);
      s.closePath();
      return extrude(s, 1.9, 0.05, 6);
    })();
    const cover = piece('cover', 6, [0, 0, -8], (add) => {
      addArm(add, 'magenta', FRAME11, 0, 12.5, -6);
      for (const x of [-4.4, 4.4]) add(M.light, box(2.1, 8.2, 1.1, 0.5, 2), x, 12.6, -7);
      [['light', -3], ['black', -1], ['light', 1]].forEach(([c, x]) => add(M[c], coverSlope, x + 1.95, -2, 0, 0, -Q, 0));
      for (const x of [-2, 2]) {
        add(M.blue, box(3.95, 1.2, 1.95, 0.05), x, 16.6, -6.5);
        for (const sx of [-1.5, -0.5, 0.5, 1.5]) for (const sz of [-0.5, 0.5]) add(M.blue, cyl(0.3, 0.2, 10), x + sx, 17.3, -6.5 + sz);
      }
    });

    /* ---------- Cables: each device to its port; A, C, E on the hub's top, B, D, F underneath ---------- */
    const PORT = { A: -2.1, C: 0.1, E: 2.3, B: -2.1, D: 0.1, F: 2.3 };
    const PZ = -4.54;
    const plugTop = (add, port) => add(M.plug, box(1.25, 0.75, 0.62, 0.12, 2), PORT[port], 9.4, PZ);
    const plugLow = (add, port) => add(M.plug, box(1.25, 0.75, 0.62, 0.12, 2), PORT[port], 1.62, PZ);
    const cable = (name, stage, port, pts, top) => piece(name, stage, [0, 3, 3], (add) => {
      add(M.white, ribbon([...pts, [PORT[port], top ? 9.8 : 1.25, PZ]], [1, 0, 0]));
      (top ? plugTop : plugLow)(add, port);
    });
    const cables = [
      cable('cableA', 3, 'A', [[FX.A, 11, ROTOR.z], [FX.A, 10.2, -4.3]], true),
      cable('cableC', 3, 'C', [[FX.C, 11, ROTOR.z], [1.5, 10.1, -4.4]], true),
      cable('cableE', 4, 'E', [[9.3, 6.4, 0], [9.2, 6.6, -1.3], [8, 9.6, -2.6], [5.5, 9.75, -4], [3.5, 9.8, -4.5]], true),
      cable('cableB', 2, 'B', [[EYES.x + 0.5, 1.6, EYES.z - 2], [-4, 1.2, -2.6], [-2.6, 1.2, -3.6]], false),
      cable('cableD', 5, 'D', [[FORCE.x, FORCE.y - 1, FORCE.z - 4.8], [2.5, 1.3, 0], [0.8, 1.2, -2.6]], false),
      cable('cableF', 5, 'F', [[COLOR.x - 2.8, COLOR.y, COLOR.z], [7.5, 4, 6.5], [4.5, 1.3, 3], [2.6, 1.2, -2.6]], false),
    ];

    /* ---------- Per-instance hub parts share these ---------- */
    const quads = [], order = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const x = LED_X + (r - 2) * LED_PITCH, y = 3.5 + (c - 2) * LED_PITCH, s = LED_PITCH * 0.33, i = quads.length / 3;
      quads.push(x - s, y - s, 2.012, x + s, y - s, 2.012, x + s, y + s, 2.012, x - s, y + s, 2.012);
      order.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
    const pill = (y0, y1) => extrude(rrect(-2.32, y0, -1.08, y1, 0.6), 0.12, 0.03, 4).translate(0, 0, 2).applyMatrix4(HUB_M);
    const arrow = (y, s) => { const a = new T.Shape(); a.moveTo(-1.95, y); a.lineTo(-1.45, y); a.lineTo(-1.7, y + s * 0.32); a.closePath(); return flat(a); };
    return {
      M, base, topFrame, hub, distance, eyeArcs, controls, plunger, palm, cover, cables,
      fingerBase: { A: fingerBase('A'), C: fingerBase('C') }, finger: { A: finger(1), C: finger(-1) },
      thumbBase, eGear, thumb, ER,
      ledPos: new T.Float32BufferAttribute(quads, 3).applyMatrix4(HUB_M), ledIndex: order,
      ledWindow: flat(rrect(LED_X - 2.3, 1.2, LED_X + 2.3, 5.8, 0.25)).translate(0, 0, 2.008).applyMatrix4(HUB_M),
      left: pill(0.9, 3.6), right: pill(3.4, 6.1),
      arrows: mergeGeometries([arrow(1.55, -1), arrow(5.45, 1)].map((g) => g.translate(0, 0, 2.123))).applyMatrix4(HUB_M),
      center: lathe([[1, 0], [0.99, 0.2], [0.86, 0.3], [0, 0.32]], 32).rotateX(Q).translate(-1.7, 3.5, 2).applyMatrix4(HUB_M),
      lightRing: ring(1.04, 1.22, 48).translate(-1.7, 3.5, 2.012).applyMatrix4(HUB_M),
    };
  }

  let KIT = null;

  RA.createHand = () => {
    const K = KIT || (KIT = buildKit());
    const group = new T.Group();
    const parts = {}, fade = {}, clones = {}, pieces = [];
    PARTS.forEach(({ id }) => { group.add((parts[id] = new T.Group())); fade[id] = 0; clones[id] = new Map(); });

    const mesh = (geo, mat, into) => {
      const m = new T.Mesh(geo, mat);
      m.castShadow = m.receiveShadow = true;
      m.userData.base = mat;
      into.add(m);
      return m;
    };
    const put = (p, into) => {
      const g = new T.Group();
      p.meshes.forEach(({ geo, mat }) => mesh(geo, mat, g));
      into.add(g);
      pieces.push({ stage: p.stage, from: new T.Vector3(...p.from), group: g });
      return g;
    };
    // A group turning about `at`, its piece drawn in that frame.
    const pivot = (p, into, at) => {
      const pv = new T.Group();
      pv.position.copy(at);
      into.add(pv);
      p.meshes.forEach(({ geo, mat }) => mesh(geo, mat, pv));
      pieces.push({ stage: p.stage, from: new T.Vector3(0, 10, 0), group: pv, at: at.clone() });
      return pv;
    };

    put(K.base, parts.base);
    put(K.topFrame, parts.base);
    const hubGroup = put(K.hub, parts.hub);
    const distGroup = put(K.distance, parts.distance);
    const ctrlGroup = put(K.controls, parts.controls);
    put(K.palm, parts.palm);
    put(K.cover, parts.palm);
    K.cables.forEach((c) => put(c, parts.cables).traverse((o) => { o.receiveShadow = false; }));   // a ribbon this thin only collects shadow acne

    const pivots = {};
    ['A', 'C'].forEach((port) => {
      const part = parts['finger' + port];
      put(K.fingerBase[port], part);
      pivots[port] = pivot(K.finger[port], part, pivotAt(port));
    });
    put(K.thumbBase, parts.thumb);
    const eRotor = pivot(K.eGear, parts.thumb, K.ER);
    pivots.E = pivot(K.thumb, parts.thumb, THUMB);

    // The hub's buttons, ring and LEDs belong to this instance.
    const hubButtons = { left: mesh(K.left, K.M.white, hubGroup), right: mesh(K.right, K.M.white, hubGroup), center: mesh(K.center, K.M.white, hubGroup) };
    mesh(K.arrows, K.M.greyRim, hubGroup);
    const lightMat = new T.MeshBasicMaterial({ color: RING_OFF });
    hubGroup.add(new T.Mesh(K.lightRing, lightMat));
    const ledGeo = new T.BufferGeometry();
    ledGeo.setAttribute('position', K.ledPos);
    ledGeo.setIndex(K.ledIndex);
    ledGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(25 * 4 * 4), 4));
    const led = new T.Mesh(ledGeo, K.M.led);
    led.visible = false;
    led.renderOrder = 1;
    const ledWindow = new T.Mesh(K.ledWindow, K.M.ledWindow);
    ledWindow.visible = false;
    hubGroup.add(ledWindow, led);

    // The distance sensor's four lights, the force plunger and the colour card belong to this instance too.
    const eyes = K.eyeArcs.map((g) => { const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: EYE_OFF })); distGroup.add(m); return m; });
    const forceButton = mesh(K.plunger, K.M.black, ctrlGroup);
    const anchors = { distance: new T.Object3D(), force: new T.Object3D(), color: new T.Object3D() };
    anchors.distance.position.copy(EYES);
    anchors.force.position.copy(FORCE).add(new T.Vector3(0, 0, 0.55));
    anchors.color.position.copy(COLOR);
    anchors.color.rotation.y = Q;
    distGroup.add(anchors.distance);
    ctrlGroup.add(anchors.force, anchors.color);
    const cardMat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    const card = new T.Mesh(new T.BoxGeometry(2.6, 3.4, 0.08), cardMat);
    card.position.set(0, 0, 1.6);
    card.visible = false;
    anchors.color.add(card);

    const gripPoint = new T.Object3D();
    gripPoint.position.set(0, 13.5, PALM_Z);
    group.add(gripPoint);

    const deg = { A: 0, C: 0, E: 0 };
    let exploded = 0, buildN = STAGES.length - 1, buildT = 1, focus = null;

    const pose = () => {
      PARTS.forEach(({ id }) => parts[id].position.fromArray(EXPLODE[id]).multiplyScalar(exploded));
      pieces.forEach((pc) => {
        pc.group.visible = pc.stage <= buildN;
        const fly = pc.stage === buildN ? 1 - smooth(buildT) : 0;
        pc.group.position.copy(pc.at || new T.Vector3()).addScaledVector(pc.from, fly);
      });
      ['A', 'C', 'E'].forEach((p) => pivots[p].rotation.copy(turnAt(p, deg[p])));
      eRotor.rotation.x = -angleOf('E', deg.E);                         // 1:1, so the thumb turns as far as the motor
      forceButton.position.z = -force * TRAVEL;
    };
    let force = 0;

    const paint = (id) => {
      const f = fade[id];
      parts[id].traverse((m) => {
        const base = m.userData.base;
        if (!base) return;
        if (!f) { m.material = base; return; }
        if (!clones[id].has(base)) clones[id].set(base, base.clone());      // private to this instance, so two models never fade each other
        m.material = clones[id].get(base);
        m.material.color.copy(base.color).lerp(PALE, f * 0.9);
      });
    };

    pose();
    group.updateMatrixWorld(true);
    const rest = new T.Box3().setFromObject(group);
    return {
      group, parts, PARTS, FINGERS, STAGES, gripPoint, anchors, forceButton, hubButtons, FINGER_R, box: rest,
      holdAt, touchDeg, fingerSegments,
      setMotor(port, d) {
        if (!(port in deg)) return;
        deg[port] = clamp(+d || 0, FINGERS[port].stops[0], FINGERS[port].stops[1]);
        pose();
      },
      curl: (port) => (deg[port] * FINGERS[port].sign) / FINGERS[port].closeDeg,
      setForce(pct) { force = clamp(+pct || 0, 0, 100) / 100; pose(); },
      setCard(css) { card.visible = !!css; if (css) cardMat.color.set(css); },
      setEyes(arr) { eyes.forEach((m, i) => m.material.color.copy(EYE_OFF).lerp(EYE_ON, arr ? clamp(arr[i] || 0, 0, 100) / 100 : 0)); },
      setMatrix(arr) {
        const c = ledGeo.attributes.color;
        let any = false;
        for (let i = 0; i < 25; i++) {
          const a = arr ? clamp(arr[i] || 0, 0, 100) / 100 : 0;
          any = any || a > 0;
          for (let k = 0; k < 4; k++) c.setXYZW(i * 4 + k, 1, 1, 1, a);
        }
        c.needsUpdate = true;
        led.visible = ledWindow.visible = any;
      },
      setCenterLight(css) { lightMat.color.set(css || RING_OFF); },
      highlight(id) { focus = id || null; },
      setExplode(t) { exploded = clamp(+t || 0, 0, 1); pose(); },
      setBuildStage(n, t) { buildN = Math.floor(clamp(+n || 0, 0, STAGES.length - 1)); buildT = clamp(t === undefined ? 1 : +t || 0, 0, 1); pose(); },
      update(dt) {
        PARTS.forEach(({ id }) => {
          const goal = focus && focus !== id ? 1 : 0;
          if (fade[id] === goal) return;
          const step = RA.reducedMotion ? 1 : (dt || 0) * 5;
          fade[id] = goal > fade[id] ? Math.min(goal, fade[id] + step) : Math.max(goal, fade[id] - step);
          paint(id);
        });
      },
    };
  };
})();
