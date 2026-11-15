// Six real robot hands as short looping stories. Each entry is one phase table and build(root, stage) => apply(pose, time, loop);
// the facts and their sources are in examples.js. A row of the table holds the pose reached at its end, a row with text opens a caption step.
(function () {
  const RA = window.RA;
  const PI = Math.PI;
  const { lerp, clamp } = THREE.MathUtils;
  const UP = new THREE.Vector3(0, 1, 0);
  const NEG_Y = new THREE.Vector3(0, -1, 0);
  const vec = (x, y, z) => new THREE.Vector3(x, y, z);
  const ramp = (x, a, b) => clamp((x - a) / (b - a), 0, 1); // lets the joints of one finger close one after another

  const mats = {};
  const mat = (color, o) => {
    const key = color + (o ? JSON.stringify(o) : '');
    return mats[key] || (mats[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.38, envMapIntensity: 0.5 }, o)));
  };

  const group = (parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  // Collects shapes and merges them per material, so a rigid part costs one draw call per colour.
  function kit(parent) {
    const sets = new Map();
    const k = {
      geo(g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
        g = (g.index ? g.toNonIndexed() : g).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z);
        if (!sets.has(m)) sets.set(m, []);
        sets.get(m).push(g);
        return k;
      },
      box: (w, h, d, m, x, y, z, rx, ry, rz) => k.geo(new THREE.RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.14), m, x, y, z, rx, ry, rz),
      bar: (w, h, d, m, x, y, z, rx, ry, rz) => k.geo(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz), // sharp and cheap, for slats and stickers
      cyl: (r, h, m, x, y, z, axis, r2 = r) => k.geo(new THREE.CylinderGeometry(r, r2, h, 20), m, x, y, z, axis === 'z' ? PI / 2 : 0, 0, axis === 'x' ? -PI / 2 : 0),
      done() {
        sets.forEach((list, m) => {
          const mesh = new THREE.Mesh(list.length > 1 ? THREE.BufferGeometryUtils.mergeGeometries(list) : list[0], m);
          mesh.castShadow = mesh.receiveShadow = !m.transparent; // see-through parts must not throw a solid shadow
          parent.add(mesh);
        });
        return parent;
      },
    };
    return k;
  }

  const extrude = (shape, depth, bevel = 0.1, segs = 10) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0,
    bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: segs }).translate(0, 0, -depth / 2);

  // The colour comes from CSS and only shadows are drawn, so there is no horizon and no floor edge.
  function ground(root, opacity = 0.2) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(300, 8).rotateX(-PI / 2), new THREE.ShadowMaterial({ opacity }));
    m.receiveShadow = true;
    root.add(m);
  }

  // A round-ended link: the silhouette that reads as "robot arm" from the back of a classroom.
  function linkGeo(len, r1, r2, width) {
    const th = Math.acos((r1 - r2) / len), s = new THREE.Shape();
    s.absarc(0, 0, r1, th, 2 * PI - th, false);
    s.absarc(len, 0, r2, -th, th, false);
    return extrude(s, width, 0.14, 14);
  }

  // Yaw base, shoulder, elbow, wrist, with analytic two-link IK in the vertical plane. The tool points along its local +X.
  function makeArm(o) {
    const g = new THREE.Group(), yaw = group(g), up = group(yaw, 0, o.h), fore = group(up, o.l1), wrist = group(fore, o.l2), tool = group(wrist);
    const B = mat(o.color), D = mat(o.dark || '#2b333b'), r = o.r;
    kit(g).cyl(r * 1.7, r * 0.5, D, 0, r * 0.25, 0).done();
    const top = o.h - r * 0.75; // the shoulder sits on the column, its joint cap stays fully visible
    kit(yaw).cyl(r * 1.15, top, B, 0, top / 2, 0, null, r * 1.4).done();
    kit(up).geo(linkGeo(o.l1, r, r * 0.72, r * 1.05), B).cyl(r * 0.6, r * 1.3, D, 0, 0, 0, 'z').cyl(r * 0.44, r * 1.3, D, o.l1, 0, 0, 'z').done();
    kit(fore).geo(linkGeo(o.l2, r * 0.72, r * 0.42, r * 0.8), B).box(r * 1.5, r * 1.3, r * 0.9, D, -r * 0.8, 0, 0).done();
    kit(wrist).cyl(r * 0.3, r * 0.95, D, 0, 0, 0, 'z').done();
    kit(tool).cyl(r * 0.34, r * 0.7, D, r * 0.35, 0, 0, 'x').done();
    return {
      group: g, tool,
      // Target in the parent's coordinates. A tool pointing down keeps its heading in the world, like a real wrist roll joint.
      reach(x, y, z, pitch = -PI / 2, twist = 0) {
        x -= g.position.x; y -= g.position.y; z -= g.position.z;
        const a = Math.atan2(-z, x), R = Math.hypot(x, z) - o.tool * Math.cos(pitch), H = y - o.h - o.tool * Math.sin(pitch);
        const d = clamp(Math.hypot(R, H), Math.abs(o.l1 - o.l2) + 0.01, o.l1 + o.l2 - 0.01);
        const e = Math.acos(clamp((d * d - o.l1 * o.l1 - o.l2 * o.l2) / (2 * o.l1 * o.l2), -1, 1));
        const s = Math.atan2(H, R) + Math.atan2(o.l2 * Math.sin(e), o.l1 + o.l2 * Math.cos(e));
        yaw.rotation.y = a;
        up.rotation.z = s;
        fore.rotation.z = -e;
        wrist.rotation.z = pitch - s + e;
        tool.rotation.x = twist - a * Math.sin(pitch);
      },
    };
  }

  // Translucent sensor cone with its apex at the sensor. Same look in every scene: blue means "the robot is looking".
  function beam(parent, radius, color = '#00adc4') {
    const m = new THREE.Mesh(new THREE.ConeGeometry(radius, 1, 32, 1, true).translate(0, -0.5, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    parent.add(m);
    const dir = vec(0, 0, 0);
    return (from, to, opacity) => {
      m.visible = opacity > 0.01;
      if (!m.visible) return;
      dir.subVectors(to, from);
      m.position.copy(from);
      m.scale.y = dir.length();
      m.quaternion.setFromUnitVectors(NEG_Y, dir.normalize());
      m.material.opacity = opacity * 0.34;
    };
  }

  // Puffs of air, bubbles, drops. Positions are a pure function of time, so seeking and looping stay exact.
  function spray(parent, n, color, size, opts = {}) {
    const { speed = 12, gravity = -30, life = 0.7, dir = vec(0, 1, 0), spread = 1 } = opts;
    const seeds = Array.from({ length: n }, () => [Math.random(), Math.random() - 0.5, Math.random(), Math.random() - 0.5]);
    const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', pos),
      new THREE.PointsMaterial({ color, size, transparent: true, depthWrite: false }));
    pts.frustumCulled = false;
    parent.add(pts);
    return (on, t, o) => {
      pts.visible = on;
      if (!on) return;
      seeds.forEach(([p, a, b, c], i) => {
        const age = ((t / life + p) % 1) * life, sp = speed * (0.5 + b * 0.8);
        pos.setXYZ(i, o.x + (dir.x + a * spread) * sp * age, o.y + (dir.y + b * 0.3) * sp * age + gravity * age * age / 2, o.z + (dir.z + c * spread) * sp * age);
      });
      pos.needsUpdate = true;
    };
  }

  // A ring that always faces the camera, drawn over everything: "here".
  function marker(parent, color) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = color;
    g.lineWidth = 14;
    g.beginPath();
    g.arc(64, 64, 52, 0, 2 * PI);
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    s.scale.set(5, 5, 1);
    parent.add(s);
    return s;
  }
  // Rings that spread from a point and fade while `on` is up: a signal going out.
  function pulses(parent, color, x, y, z) {
    const list = [0, 1, 2].map(() => {
      const m = marker(parent, color);
      m.position.set(x, y, z);
      return m;
    });
    return (on, t) => list.forEach((m, i) => {
      const k = (t * 1.4 + i / 3) % 1;
      m.visible = on > 0.02;
      m.scale.setScalar(lerp(1.5, 5.5, k));
      m.material.opacity = on * (1 - k);
    });
  }

  // A cylinder stretched between two points each frame: arms, cords, cables.
  function limb(parent, m, r) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12).translate(0, 0.5, 0), m);
    mesh.castShadow = true;
    parent.add(mesh);
    const dir = vec(0, 0, 0);
    return (a, b) => {
      dir.subVectors(b, a);
      mesh.position.copy(a);
      mesh.scale.y = dir.length();
      mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    };
  }
  // Elbow of a two-equal-segment arm, bent towards the pole direction.
  function elbow(s, h, len, pole) {
    const d = Math.min(s.distanceTo(h), 2 * len - 0.01), dir = h.clone().sub(s).normalize();
    const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
    return s.clone().addScaledVector(dir, d / 2).addScaledVector(perp, Math.sqrt(len * len - d * d / 4));
  }
  // An upper arm and a forearm from the shoulder to the wrist, with a ball joint at the elbow.
  function arm(parent, m, joint, r, len, pole) {
    const up = limb(parent, m, r), lo = limb(parent, m, r * 0.85), knob = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 12, 8), joint);
    knob.castShadow = true;
    parent.add(knob);
    return (s, w) => {
      const e = elbow(s, w, len, pole);
      up(s, e);
      lo(e, w);
      knob.position.copy(e);
    };
  }

  // Fingers: segments along local +Y, each joint bends about its local X towards +Z. One geometry per size, shared by every hand.
  const geos = {};
  function chain(parent, x, y, z, lens, w, m) {
    let p = group(parent, x, y, z);
    return lens.map((len) => {
      const seg = p, key = w + '/' + len;
      const mesh = new THREE.Mesh(geos[key] || (geos[key] = new THREE.RoundedBoxGeometry(w, len * 0.94, w, 1, w * 0.3).translate(0, len / 2, 0)), m);
      mesh.castShadow = true;
      seg.add(mesh);
      p = group(seg, 0, len, 0);
      return seg;
    });
  }

  // A five-finger hand: the wrist at the origin, the palm up along +Y facing +Z, the thumb on -X (a left hand; side -1 makes a right one).
  // set(c, t, curl): c closes the four fingers towards the joint angles in curl, t swings the thumb in front of the palm and bends it.
  const GRIP5 = vec(0, 3.5, 1.2); // where a handle sits in a closed hand
  function hand5(parent, m, dark, side = 1) {
    const g = group(parent);
    kit(g).box(3.6, 3.8, 1.2, m, 0, 1.9, 0).done();
    const fingers = [1.45, 1.6, 1.5, 1.2].map((l, i) => chain(g, side * (i * 0.88 - 1.32), 3.8, 0, [l, l * 0.7, l * 0.56], 0.78, dark));
    const base = group(g, -side * 1.75, 1, 0.25);
    const thumb = chain(base, 0, 0, 0, [1.5, 1.2, 0.95], 0.86, dark);
    return {
      group: g, fingers, thumb,
      set(c, t, curl = [1.3, 1.4, 0.9]) {
        fingers.forEach((f) => f.forEach((s, j) => { s.rotation.x = lerp(0.06, curl[j], c); }));
        base.rotation.set(0, side * lerp(0.1, 1.15, t), side * lerp(0.8, 0.4, t));
        thumb.forEach((s, j) => { s.rotation.x = lerp(0.05, j ? 0.6 : 0.3, t); });
      },
    };
  }
  // Turns a hand so its fingers point along f and its palm faces p (unit vectors at right angles).
  const aim = (obj, f, p) => obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(vec(0, 0, 0).crossVectors(f, p), f, p));

  // Three fingers hanging from a palm (local -Y): finger A faces fingers B and C across the middle, like a thumb.
  // set(a): joint angles [base, middle, tip], the same for every finger; positive closes towards the middle.
  function claw3(parent, m, dark, s = 1) {
    const g = group(parent);
    kit(g).box(4.4 * s, 2 * s, 4.8 * s, m, 0, -s, 0).done();
    const fingers = [[0, -2], [-1.4, 2], [1.4, 2]].map(([x, z]) => {
      const b = group(g, x * s, -2 * s, z * s);
      b.rotation.set(z < 0 ? 0 : PI, 0, z < 0 ? PI : 0); // hanging down, each bends towards the middle
      return chain(b, 0, 0, 0, [2 * s, 1.7 * s, 1.3 * s], 0.95 * s, dark);
    });
    return { group: g, set(a) { fingers.forEach((f) => f.forEach((seg, j) => { seg.rotation.x = a[j]; })); } };
  }

  /* ---------- 1. Factory: three fingers wrap a ball, then the fingertips pinch a small part ---------- */

  function factory(root) {
    ground(root);
    const D = mat('#2b333b'), K = mat('#16151a'), W = mat('#eceded'), G = mat('#aab2b8'), A = mat('#01adc4'), M = mat('#c92e85'), Y = mat('#fed920');
    const TY = 7, R = 1.8, TX = 13, TZ = 2, TWIST = 0.6;
    const k = kit(root);
    k.box(42, 1, 20, W, 1, TY - 0.5, 1);
    [[-19, -8], [21, -8], [-19, 10], [21, 10]].forEach(([x, z]) => k.box(1.2, TY - 1, 1.2, D, x, (TY - 1) / 2, z));
    // A tray for the parts the robot has taken.
    k.bar(9.6, 0.4, 8, A, TX, TY + 0.2, TZ).box(9.6, 2.8, 0.5, A, TX, TY + 1.4, TZ + 3.8).box(9.6, 2.8, 0.5, A, TX, TY + 1.4, TZ - 3.8)
      .box(0.5, 2.8, 8, A, TX - 4.8, TY + 1.4, TZ).box(0.5, 2.8, 8, A, TX + 4.8, TY + 1.4, TZ).done();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 18), M);
    ball.castShadow = true;
    root.add(ball);
    const part = kit(group(root)).box(3.2, 1.4, 1.4, Y, 0, 0, 0).done();
    part.rotation.y = -TWIST; // lies across the fingers: B and C on one long side, A on the other

    const a = makeArm({ l1: 13, l2: 12, h: 9, r: 2, tool: 5.2, color: '#eceded' });
    a.group.position.set(0, TY, -7);
    root.add(a.group);
    const mount = group(a.tool, 1.2, 0, 0);
    mount.rotation.z = PI / 2; // the fingers hang along the tool
    const c = claw3(mount, G, K);
    const wrapAt = group(c.group, 0, -4, 0), tipAt = group(c.group, 0, -6.3, 0);
    const B0 = vec(-10, TY + R, 3), BT = vec(TX - 2.2, TY + 0.4 + R, TZ), P0 = vec(-3, TY + 0.7, 6), PT = vec(TX + 2.4, TY + 1.1, TZ);
    return (s) => {
      a.reach(s.x, s.y, s.z, -PI / 2, TWIST);
      // Base first, then the middle, then the tip: each joint keeps closing after the one before it touches, so the finger takes the ball's shape.
      c.set([lerp(-0.4, -0.15, ramp(s.wrap, 0, 0.45)) + 0.56 * s.pinch, lerp(0.1, 0.4, ramp(s.wrap, 0.3, 0.75)) - 0.1 * s.pinch,
        lerp(0.1, 0.65, ramp(s.wrap, 0.5, 1)) - 0.1 * s.pinch]);
      a.group.updateMatrixWorld(true);
      if (s.ball < 0.5) ball.position.copy(B0);
      else if (s.ball < 1.5) wrapAt.getWorldPosition(ball.position);
      else ball.position.copy(BT);
      if (s.part < 0.5) part.position.copy(P0);
      else if (s.part < 1.5) tipAt.getWorldPosition(part.position);
      else part.position.copy(PT);
    };
  }

  /* ---------- 2. Space: Robonaut 2 takes a meter made for a human hand ---------- */

  function robonaut(root) {
    ground(root, 0.14);
    const W = mat('#eceded'), D = mat('#2b333b'), K = mat('#16151a'), G = mat('#aab2b8'), A = mat('#01adc4'), Y = mat('#fed920');
    const GOLD = mat('#e0ad3a', { metalness: 0.45, roughness: 0.3 }), WALL = mat('#d3dbe2', { roughness: 0.8 }), PANEL = mat('#f2f5f7', { roughness: 0.7 });
    const LIT = mat('#57b552', { emissive: '#57b552', emissiveIntensity: 0.7 });
    const RX = 7, VENT = vec(-10, 18, -5.6);
    const k = kit(root);
    // The station wall: panels, a yellow handrail, the vent and the shelf the meter sits on.
    k.box(50, 34, 1, WALL, 0, 17, -7);
    [[-15, 9], [-15, 21], [0, 9], [0, 21], [15, 9], [15, 21]].forEach(([x, y]) => k.box(13.4, 11, 0.5, PANEL, x, y, -6.3));
    k.box(12, 0.7, 0.7, Y, 0, 28.5, -5.2).box(0.6, 0.6, 1.6, Y, -5.5, 28.5, -6).box(0.6, 0.6, 1.6, Y, 5.5, 28.5, -6);
    k.box(6.4, 4.4, 0.6, D, VENT.x, VENT.y, -6);
    for (let i = 0; i < 5; i++) k.bar(5.6, 0.3, 0.3, G, VENT.x, VENT.y - 1.6 + i * 0.8, -5.6);
    k.box(1.2, 1.2, 0.9, G, -6, 12.6, -5.7);
    // Robonaut: no legs here, the torso sits on a post. Gold helmet, dark visor.
    k.cyl(3, 0.6, D, RX, 0.3, 0).cyl(1.3, 8, D, RX, 4.6, 0).box(6, 3, 4.4, G, RX, 9.6, 0).box(8.4, 6.6, 4.6, W, RX, 13.6, 0).box(5, 5.4, 2, D, RX, 13.6, -3);
    k.cyl(0.8, 1.6, D, RX, 17.6, 0).box(3.8, 4, 3.8, GOLD, RX, 20.2, 0).box(3.2, 1.7, 0.4, K, RX, 20.5, 1.9);
    k.geo(new THREE.SphereGeometry(1.25, 14, 10), D, RX - 4.8, 15.6, 0).geo(new THREE.SphereGeometry(1.25, 14, 10), D, RX + 4.8, 15.6, 0).done();

    // The meter: a handle along Z; on a neck at its back end the fan head that faces the vent, a display on top.
    // Its origin is the middle of the handle, where the hand holds it.
    const meter = group(root);
    kit(meter).cyl(0.42, 4, K, 0, 0, -0.3, 'z').box(0.6, 1.4, 0.6, K, 0, 0.7, -2.3).cyl(1.4, 0.9, A, 0, 1.6, -2.3, 'z').box(1.8, 0.8, 0.5, W, 0, 3.4, -2.3).done();
    const fan = group(meter, 0, 1.6, -1.8);
    kit(fan).bar(2.2, 0.3, 0.1, K, 0, 0, 0).bar(0.3, 2.2, 0.1, K, 0, 0, 0).done();
    const reading = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.34, 0.1).translate(0.65, 0, 0), LIT);
    reading.position.set(-0.65, 3.4, -2.03);
    meter.add(reading);

    // The right hand lies palm up under the handle, fingers along -X: they curl up and over it, the thumb comes up in front.
    const hand = hand5(root, G, K);
    aim(hand.group, vec(-1, 0, 0), vec(0, 1, 0));
    const OFF = GRIP5.clone().applyQuaternion(hand.group.quaternion), SR = vec(RX - 4.8, 15.6, 0), REST = vec(-6, 11, -2.6);
    const right = arm(root, W, D, 1, 5.6, vec(0.2, -1, 0.3));
    // The left arm rests: shoulder, elbow and hand stay where they are.
    const left = hand5(root, G, K);
    aim(left.group, vec(0, -1, 0), vec(-1, 0, 0));
    left.group.position.set(RX + 5.8, 8.6, 2.2);
    left.set(0.35, 0.2);
    arm(root, W, D, 1, 5.6, vec(0.6, 0, -1))(vec(RX + 4.8, 15.6, 0), left.group.position);
    const air = spray(root, 36, '#ffffff', 0.45, { speed: 8, gravity: 0, life: 0.7, dir: vec(0, 0, 1), spread: 0.35 });
    const T = vec(0, 0, 0), wrist = vec(0, 0, 0);
    return (s, t) => {
      T.set(s.hx, s.hy, s.hz);
      wrist.copy(T).sub(OFF);
      hand.group.position.copy(wrist);
      hand.set(s.grip, s.thumb, [1.35, 1.45, 0.95]);
      right(SR, wrist);
      meter.position.copy(s.tool >= 0.5 && s.tool < 1.5 ? T : REST);
      reading.scale.x = Math.max(0.02, s.air);
      fan.rotation.z = s.air > 0.01 && s.air < 0.99 ? t * 14 : 0;
      air(s.air > 0.01 && s.air < 0.99, t, VENT);
    };
  }

  /* ---------- 3. Rubik's cube: five fingers turn the cube on the palm, three cameras watch ---------- */

  function rubik(root) {
    ground(root, 0.18);
    const D = mat('#2b333b'), K = mat('#16151a'), G = mat('#aab2b8'), A = mat('#01adc4');
    const FACES = ['#d8232f', '#ff8a00', '#f4f4f4', '#fed920', '#2fa84f', '#1e6fd9'].map((c) => mat(c, { roughness: 0.3 })); // +x -x +y -y +z -z
    const WR = vec(6, 10, 0), Q = 1.04;
    const k = kit(root);
    // The forearm on a stand, with the motors inside; three cameras on poles round the hand.
    k.cyl(1.2, 8, D, WR.x + 4, WR.y, 0, 'x', 1.05).box(1.8, WR.y - 1, 1.8, D, WR.x + 6, (WR.y - 1) / 2, 0).box(6, 0.6, 6, D, WR.x + 6, 0.3, 0);
    const CAMS = [vec(-7, 19, -9), vec(12, 20, -8), vec(11, 19.5, 10)];
    CAMS.forEach((p) => k.box(0.5, p.y - 1.4, 0.5, G, p.x, (p.y - 1.4) / 2, p.z));
    k.done();
    const cams = CAMS.map((p) => {
      const g = group(root, p.x, p.y, p.z);
      kit(g).box(2, 1.8, 2.6, K, 0, 0, 0).cyl(0.6, 0.4, A, 0, 0, 1.4, 'z').done();
      return g;
    });

    // The hand lies palm up, fingers along -X, thumb towards the viewer. Fingers are dark, the palm grey, like the real one.
    const hand = hand5(root, G, K);
    hand.group.position.copy(WR);
    aim(hand.group, vec(-1, 0, 0), vec(0, 1, 0));
    const CUBE = vec(WR.x - 2.1, WR.y + 0.6 + 1.5 * Q + 0.06, 0);
    cams.forEach((g) => g.lookAt(CUBE));

    // 26 small cubes in two groups: the top layer turns, the rest does not. Each group merges into a few meshes.
    const cube = group(root, CUBE.x, CUBE.y, CUBE.z), top = group(cube);
    const low = kit(cube), hi = kit(top);
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if (!x && !y && !z) continue;
      const kt = y === 1 ? hi : low, cx = x * Q, cy = y * Q, cz = z * Q;
      kt.box(1, 1, 1, K, cx, cy, cz);
      if (x) kt.bar(0.04, 0.82, 0.82, FACES[x > 0 ? 0 : 1], cx + x * 0.51, cy, cz);
      if (y) kt.bar(0.82, 0.04, 0.82, FACES[y > 0 ? 2 : 3], cx, cy + y * 0.51, cz);
      if (z) kt.bar(0.82, 0.82, 0.04, FACES[z > 0 ? 4 : 5], cx, cy, cz + z * 0.51);
    }
    low.done();
    hi.done();
    const looks = cams.map(() => beam(root, 1.5)), ok = marker(root, '#fed920'), eye = vec(0, 0, 0);
    ok.position.copy(CUBE);
    ok.scale.setScalar(7);
    return (s) => {
      hand.set(s.hold, s.hold, [1.45, 0.35, 0.25]); // the fingers stand up along the cube's far side
      hand.fingers[0][0].rotation.x -= 0.5 * s.push; // the index finger draws back and pushes
      hand.thumb[1].rotation.x += 0.4 * s.push;
      cube.rotation.y = s.spin * PI / 2;
      top.rotation.y = (s.turn - 1) * PI / 2; // one quarter turn short of solved until the last move
      cams.forEach((g, i) => looks[i](g.getWorldPosition(eye), CUBE, s.scan));
      ok.visible = s.done > 0.02;
      ok.material.opacity = s.done;
    };
  }

  /* ---------- 4. A printed hand: bending the wrist pulls the cords that close the fingers ---------- */

  function printed(root) {
    ground(root, 0.16);
    const SKIN = mat('#e8b58e', { roughness: 0.6 }), SLEEVE = mat('#57b552', { roughness: 0.7 }), PRINT = mat('#fed920', { roughness: 0.5 }), FING = mat('#01adc4', { roughness: 0.5 });
    const D = mat('#2b333b'), K = mat('#16151a'), WOOD = mat('#d9b27c', { roughness: 0.7 }), BALL = mat('#c92e85', { roughness: 0.5 });
    const CORD = new THREE.MeshStandardMaterial({ color: '#2b333b', roughness: 0.6 }); // its own material: it lights up when the cords pull
    const TY = 6, R = 1.9, BEND = 0.8;
    const k = kit(root);
    k.box(44, 1, 18, WOOD, 0, TY - 0.5, 0);
    [[-20, -7], [20, -7], [-20, 7], [20, 7]].forEach(([x, z]) => k.box(1.2, TY - 1, 1.2, D, x, (TY - 1) / 2, z));
    k.done();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), BALL);
    ball.castShadow = true;
    root.add(ball);

    // The forearm runs along -X from the wrist: a printed cuff with two straps over the skin, then the sleeve.
    const fore = group(root), wrist = group(fore);
    kit(fore).cyl(1.25, 9, SKIN, -5, 0, 0, 'x', 1.5).box(6.4, 3.4, 3.6, PRINT, -3.6, 0.1, 0).box(0.7, 3.6, 3.8, K, -2, 0.1, 0).box(0.7, 3.6, 3.8, K, -5.4, 0.1, 0)
      .cyl(2.1, 10, SLEEVE, -14, 0, 0, 'x').done();
    const hand = hand5(wrist, PRINT, FING);
    aim(hand.group, vec(1, 0, 0), vec(0, -1, 0));
    hand.group.position.set(0.4, 0, 0);
    const gripAt = group(hand.group, 0, 2.4, 0.6 + R);
    // Where the arm must stand so that, with the wrist fully bent, the grip point is on the ball.
    wrist.rotation.z = -BEND;
    fore.updateMatrixWorld(true);
    const B0 = vec(-2, TY + R, 1), ALIGN = B0.clone().sub(gripAt.getWorldPosition(vec(0, 0, 0)));
    // The cords leave the top of the cuff and run over the wrist to each finger.
    const anchors = [1.2, 0.4, -0.4, -1.2, 1.6].map((z) => vec(-3.2, 1.9, z)), knuckles = hand.fingers.map((f) => f[0]).concat([hand.thumb[0]]);
    const cords = anchors.map(() => limb(root, CORD, 0.14)), a = vec(0, 0, 0), b = vec(0, 0, 0);
    return (s) => {
      fore.position.set(ALIGN.x + s.ax, ALIGN.y + s.ay, ALIGN.z);
      wrist.rotation.z = -BEND * s.bend;
      hand.set(s.bend, s.bend, [1.1, 1.1, 0.8]);
      fore.updateMatrixWorld(true);
      cords.forEach((cord, i) => cord(fore.localToWorld(a.copy(anchors[i])), knuckles[i].localToWorld(b.set(0, 0.3, -0.5))));
      CORD.color.set(s.bend > 0.5 ? '#c92e85' : '#2b333b');
      if (s.hold < 0.5) ball.position.copy(B0);
      else if (s.hold < 1.5) gripAt.getWorldPosition(ball.position);
      else ball.position.set(B0.x + 7, B0.y, B0.z);
    };
  }

  /* ---------- 5. Under water: OceanOne lifts a vase from a shipwreck, the pilot feels the grip ---------- */

  function ocean(root) {
    ground(root, 0.25);
    const Y = mat('#fed920'), D = mat('#2b333b'), K = mat('#16151a'), W = mat('#eceded'), G = mat('#aab2b8');
    const ROCK = mat('#5d6b78', { flatShading: true, roughness: 0.9 }), WOOD = mat('#6b4a2f', { roughness: 0.85 }), IRON = mat('#3a3f44', { roughness: 0.6 }), CLAY = mat('#c8703e', { roughness: 0.7 });
    const SY = 38, V = vec(4, 0, 3), BK = vec(-4, 0, 6.5);
    const k = kit(root);
    [[-30, 2, -14, 4], [22, 2, -12, 4.5], [30, 1.2, 4, 2.5], [-38, 1, 6, 2.6]].forEach(([x, y, z, r]) => k.geo(new THREE.IcosahedronGeometry(r, 0), ROCK, x, y, z));
    // The wreck: a keel, leaning ribs, a few planks, two cannons on the sand.
    k.box(26, 1, 2.4, WOOD, -6, 0.5, -13);
    for (let i = 0; i < 7; i++) k.box(0.8, 9 - i * 0.7, 0.8, WOOD, -17 + i * 3.6, (9 - i * 0.7) / 2, -13.5, -0.35, 0, 0.12);
    k.box(20, 0.5, 1.8, WOOD, -8, 3.2, -11.6, -0.35, 0, 0.05).box(16, 0.5, 1.8, WOOD, -7, 5.4, -12.2, -0.35, 0, -0.04);
    k.cyl(0.65, 6, IRON, -8, 0.7, -4, 'x', 0.85).cyl(0.65, 6, IRON, 13, 0.7, -5, 'z', 0.85);
    // The ship above, where the pilot sits.
    k.box(34, 4.5, 9, D, -18, SY, -50).box(10, 5, 7, W, -12, SY + 4.6, -50).box(1, 10, 1, Y, -32, SY + 5.5, -53.5).box(1, 10, 1, Y, -32, SY + 5.5, -46.5).box(1, 1, 8, Y, -32, SY + 10.5, -50);
    k.done();
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 300).rotateX(-PI / 2),
      new THREE.MeshBasicMaterial({ color: '#bfeaf7', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    sea.position.y = SY - 0.5;
    root.add(sea);

    const vase = group(root);
    kit(vase).geo(new THREE.LatheGeometry([[0, 0], [0.9, 0], [1.5, 0.7], [1.75, 1.8], [1.45, 2.9], [0.75, 3.4], [0.6, 4], [0.85, 4.3]].map(([x, y]) => new THREE.Vector2(x, y)), 18), CLAY).done();
    // The recovery basket on a rope from the ship.
    const basket = group(root);
    kit(basket).bar(5, 0.3, 5, G, 0, 0.15, 0).box(5, 2.6, 0.3, G, 0, 1.3, 2.5).box(5, 2.6, 0.3, G, 0, 1.3, -2.5).box(0.3, 2.6, 5, G, 2.5, 1.3, 0).box(0.3, 2.6, 5, G, -2.5, 1.3, 0)
      .geo(new THREE.TorusGeometry(2.5, 0.14, 6, 20, PI), K, 0, 2.6, 0).done();
    const rope = limb(root, K, 0.12);

    // The robot diver: a yellow torso, a head with two camera eyes, a tail with the thrusters, two arms with three-finger hands.
    const rov = group(root);
    kit(rov).box(4.4, 5, 3.8, Y, 0, 0, 0).box(2.8, 2.4, 2.4, W, 0.3, 3.8, 0).cyl(0.42, 0.4, K, 1.75, 3.9, 0.6, 'x').cyl(0.42, 0.4, K, 1.75, 3.9, -0.6, 'x')
      .box(8, 2.6, 3, Y, -5.5, -1.2, 0).cyl(0.9, 1.6, K, -9.6, -1.2, 1.1, 'x').cyl(0.9, 1.6, K, -9.6, -1.2, -1.1, 'x').cyl(0.7, 1.2, K, -6, 0.5, 0)
      .geo(new THREE.SphereGeometry(0.9, 12, 8), D, 1, 1.8, 2.3).geo(new THREE.SphereGeometry(0.9, 12, 8), D, 1, 1.8, -2.3).done();
    const hand = claw3(root, D, K, 0.75), other = claw3(root, D, K, 0.75);
    const right = arm(root, W, D, 0.75, 3.8, vec(0, 0.4, 1)), left = arm(root, W, D, 0.75, 3.8, vec(0, 0.4, -1));
    const feel = pulses(hand.group, '#c92e85', 0, -0.8, 0);
    const look = beam(root, 2.4), cable = [limb(root, K, 0.3), limb(root, K, 0.3)], dots = [0, 1, 2, 3].map(() => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: '#7fe6ff' }));
      root.add(m);
      return m;
    });
    const bubbles = spray(root, 30, '#e8f8ff', 0.6, { speed: 3, gravity: 4, life: 1.2, spread: 1.2 });
    const TOP = vec(-32, SY + 10.5, -50), SAG = vec(-4, -8, 6), REACH = 4.4 * 0.75;
    const R0 = vec(0, 0, 0), T = vec(0, 0, 0), w = vec(0, 0, 0), sh = vec(0, 0, 0), end = vec(0, 0, 0), mid = vec(0, 0, 0), eye = vec(0, 0, 0), o = vec(0, 0, 0), up = vec(0, 0, 0);
    return (s, t) => {
      R0.set(s.rx, s.ry, s.rz);
      rov.position.copy(R0);
      T.set(s.rx + s.hx, s.ry + s.hy, s.rz + s.hz); // the hand's grip point, the middle of the vase's belly
      hand.group.position.copy(T).y += REACH;
      hand.set([lerp(-0.3, 0.05, ramp(s.grip, 0, 0.5)), lerp(0.1, 0.7, ramp(s.grip, 0.3, 0.8)), lerp(0.1, 0.6, ramp(s.grip, 0.5, 1))]);
      right(sh.copy(R0).add(o.set(1, 1.8, 2.3)), hand.group.position);
      other.group.position.copy(R0).add(o.set(4.6, -1.6, -3));
      other.set([0.1, 0.4, 0.3]);
      left(sh.copy(R0).add(o.set(1, 1.8, -2.3)), other.group.position);
      const lift = s.lift * 26;
      basket.position.set(BK.x, BK.y + lift, BK.z);
      rope(up.set(BK.x, BK.y + lift + 2.6, BK.z), TOP);
      if (s.vase < 0.5) vase.position.copy(V);
      else if (s.vase < 1.5) vase.position.set(T.x, T.y - 1.8, T.z);
      else vase.position.set(BK.x, BK.y + lift + 0.3, BK.z);
      feel(s.feel, t);
      w.copy(vase.position).y += 1.8;
      look(eye.set(s.rx + 1.9, s.ry + 3.9, s.rz), w, s.scan);
      end.set(s.rx - 7, s.ry + 0.4, s.rz);
      mid.lerpVectors(TOP, end, 0.5).add(SAG);
      cable[0](TOP, mid);
      cable[1](mid, end);
      // Commands run down the cable from the pilot on the ship.
      dots.forEach((m, i) => {
        const q = (t * 0.35 + i / 4) % 1;
        if (q < 0.5) m.position.lerpVectors(TOP, mid, q * 2);
        else m.position.lerpVectors(mid, end, q * 2 - 1);
      });
      bubbles(true, t, o.set(s.rx - 10, s.ry - 1, s.rz));
    };
  }

  /* ---------- 6. Kitchen: two arms from the ceiling, one holds the pot, the other stirs and serves ---------- */

  function kitchen(root) {
    ground(root, 0.18);
    const W = mat('#eceded'), D = mat('#2b333b'), K = mat('#16151a'), G = mat('#aab2b8');
    const STEEL = mat('#c4cbd0', { metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide }), SOUP = mat('#e58a2e', { roughness: 0.4 }), TILE = mat('#f6f1e7', { roughness: 0.8 });
    const CY = 9, P = vec(-5, CY + 0.3, 0.5), B = vec(7, CY, 3);
    const k = kit(root);
    k.box(60, 40, 1, TILE, 0, 20, -7.5).box(36, CY, 13, W, 0, CY / 2, 0).box(36, 0.6, 13.4, D, 0, CY + 0.1, 0).box(12, 0.3, 8, K, P.x, CY + 0.5, P.z);
    // The rail on the ceiling the arms hang from.
    k.box(40, 1.2, 1.6, D, -3, 32, -1.5).box(3, 2, 3, G, -11, 30.8, -1.5).box(3, 2, 3, G, 5, 30.8, -1.5);
    // The pot with its handle, the soup in it, and an empty bowl.
    k.geo(new THREE.CylinderGeometry(3.2, 3, 4.4, 28, 1, true), STEEL, P.x, P.y + 2.2, P.z).geo(new THREE.CircleGeometry(3, 28).rotateX(-PI / 2), STEEL, P.x, P.y + 0.05, P.z)
      .geo(new THREE.CircleGeometry(3.1, 28).rotateX(-PI / 2), SOUP, P.x, P.y + 3.2, P.z).box(4.4, 0.6, 0.9, K, P.x - 5.3, P.y + 3.6, P.z)
      .geo(new THREE.SphereGeometry(2.6, 24, 10, 0, 2 * PI, PI / 2, PI / 2), W, B.x, B.y + 2.6, B.z).cyl(1.2, 0.3, W, B.x, B.y + 0.6, B.z).done();
    const soup = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24).rotateX(-PI / 2), SOUP);
    soup.position.set(B.x, B.y + 1.9, B.z);
    root.add(soup);

    // The left hand takes the pot's handle from above; the right hand holds the ladle upright in its fist, the thumb on top.
    const lh = hand5(root, G, D), rh = hand5(root, G, D);
    aim(lh.group, vec(0, 0, 1), vec(0, -1, 0));
    aim(rh.group, vec(0, 0, 1), vec(-1, 0, 0));
    const RQ = rh.group.quaternion.clone(), LOFF = GRIP5.clone().applyQuaternion(lh.group.quaternion), ROFF = GRIP5.clone().applyQuaternion(RQ);
    kit(rh.group).cyl(0.24, 9.4, STEEL, 2.6, GRIP5.y, GRIP5.z, 'x').geo(new THREE.SphereGeometry(1.2, 16, 8, 0, 2 * PI, PI / 2, PI / 2), STEEL, 7.4, GRIP5.y, GRIP5.z, 0, 0, PI / 2).done();
    rh.set(1, 1, [1.4, 1.4, 1]);
    const scoop = group(rh.group, 7.4, GRIP5.y, GRIP5.z);
    const SL = vec(-11, 30, -1.5), SR = vec(5, 30, -1.5);
    const larm = arm(root, W, D, 1, 9, vec(-0.3, 0.2, -1)), rarm = arm(root, W, D, 1, 9, vec(0.3, 0.2, -1));
    const drip = spray(root, 24, '#e58a2e', 0.55, { speed: 2, gravity: -40, life: 0.32, spread: 0.3, dir: vec(0, -1, 0) });
    const TILT = new THREE.Quaternion(), Z = vec(0, 0, 1), lw = vec(0, 0, 0), rw = vec(0, 0, 0), o = vec(0, 0, 0);
    return (s, t) => {
      lw.set(s.lx, s.ly, s.lz).sub(LOFF);
      lh.group.position.copy(lw);
      lh.set(s.lg, s.lg, [1.5, 1.4, 0.9]);
      larm(SL, lw);
      // Two even circles round the pot; the offset is zero at both ends, so the stir starts and stops where the ladle is.
      const a = s.stir * 4 * PI;
      rh.group.quaternion.copy(RQ).premultiply(TILT.setFromAxisAngle(Z, s.tilt * 1.1));
      rw.set(s.rx + 1.6 * (Math.cos(a) - 1), s.ry, s.rz + 1.6 * Math.sin(a)).sub(o.copy(ROFF).applyQuaternion(TILT));
      rh.group.position.copy(rw);
      rarm(SR, rw);
      soup.visible = s.soup > 0.02;
      soup.scale.set(s.soup, 1, s.soup);
      rh.group.updateMatrixWorld(true);
      drip(s.tilt > 0.4, t, scoop.getWorldPosition(o));
    };
  }

  /* ---------- The six stories: motion and captions. Facts are in examples.js. ---------- */

  RA.SCENES = [
    {
      id: 'factory', bg: 'linear-gradient(#f2f5f7, #d8e0e5)', camera: [26, 44, 92], target: [2, 13, 0], poster: 4,
      start: { x: 2, y: 20, z: 3, wrap: 0, pinch: 0, ball: 0, part: 0 },
      phases: [
        { s: 1.5, text: 'Қол домалақ бөлшектің үстінде', x: -10, y: 17, z: 3 },
        { s: 0.9, y: 8.8 },
        { s: 1.6, text: 'Саусақтар оны үш жағынан орап ұстады', wrap: 1, ball: 1 },
        { s: 0.9, y: 17 },
        { s: 1.7, text: 'Бөлшек жәшікке қарай жылжиды', x: 10.8, z: 2 },
        { s: 0.8, y: 9.2 },
        { s: 0.8, wrap: 0, ball: 2 },
        { s: 0.7, y: 17 },
        { s: 1.6, text: 'Ұсақ бөлшекті саусақ ұштары алады', x: -3, z: 6 },
        { s: 0.9, y: 10 },
        { s: 0.8, pinch: 1, part: 1 },
        { s: 0.9, y: 17 },
        { s: 1.7, text: 'Қармауыш сол, бөлшек басқа', x: 15.4, z: 2 },
        { s: 0.8, y: 10.4 },
        { s: 0.7, pinch: 0, part: 2 },
        { s: 1.5, x: 2, y: 20, z: 3 },
      ],
      build: factory,
    },
    {
      id: 'robonaut', bg: 'linear-gradient(#eef2f5, #cfd8df)', camera: [12, 24, 56], target: [-4, 14, -2], poster: 6.4,
      start: { hx: -1, hy: 9, hz: 3, grip: 0, thumb: 0, tool: 0, air: 0 },
      phases: [
        { s: 1.7, text: 'Робонавт аспапқа қол созады', hx: -6, hy: 11, hz: -2.6 },
        { s: 1, text: 'Төрт саусақ тұтқаны орап ұстады', grip: 1, tool: 1 },
        { s: 0.9, text: 'Бас бармақ оны екінші жағынан қысты', thumb: 1 },
        { s: 1.7, text: 'Аспап ауа ағынын өлшейді', hx: -10, hy: 16.4, hz: -2.3 },
        { s: 2.4, air: 1 },
        { s: 1.7, text: 'Аспап орнына қайтты', hx: -6, hy: 11, hz: -2.6 },
        { s: 0.9, thumb: 0, grip: 0, tool: 2, air: 0 },
        { s: 1.4, hx: -1, hy: 9, hz: 3 },
      ],
      build: robonaut,
    },
    {
      id: 'rubik', bg: 'linear-gradient(#fdf8ec, #efe2c4)', camera: [-14, 22, 44], target: [2, 13, 0], poster: 5.4,
      start: { scan: 0, hold: 0, spin: 0, turn: 0, push: 0, done: 0 },
      phases: [
        { s: 1.6, text: 'Үш камера текшені бақылайды', scan: 1 },
        { s: 0.9, hold: 1, scan: 0.4 },
        { s: 1.6, text: 'Саусақтар бүкіл текшені бұрайды', spin: 1, push: 1 },
        { s: 0.5, push: 0 },
        { s: 1.6, text: 'Саусақ жоғарғы қабатты бұрайды', turn: 1, push: 1 },
        { s: 0.5, push: 0 },
        { s: 1.8, text: 'Текше жиналды', scan: 0, done: 1 },
        { s: 1, hold: 0 },
      ],
      build: rubik,
    },
    {
      id: 'printed', bg: 'linear-gradient(#fbf7f1, #eadfd2)', camera: [6, 22, 54], target: [2, 10, 0], poster: 3.9,
      start: { ax: -14, ay: 6, bend: 0, hold: 0 },
      phases: [
        { s: 1.8, text: 'Қол басы доптың үстінде, білезік түзу', ax: 0, ay: 0.8 },
        { s: 0.5, ay: 0 },
        { s: 1.5, text: 'Білезік бүгілді: баулар саусақтарды бүкті', bend: 1 },
        { s: 0.05, hold: 1 },
        { s: 1.3, text: 'Доп қолда', ay: 4 },
        { s: 1.4, ax: 7 },
        { s: 0.8, ay: 0 },
        { s: 0.05, text: 'Білезік жазылды: резеңкелер саусақтарды ашты', hold: 2 },
        { s: 1.5, bend: 0 },
        { s: 1.5, ax: 16, ay: 5 },
      ],
      build: printed,
    },
    {
      id: 'ocean', bg: 'linear-gradient(#3aa5d4, #0f5288 55%, #072b4f)', camera: [14, 13, 74], target: [-3, 8, 2], poster: 8,
      start: { rx: -34, ry: 20, rz: 0, hx: 5, hy: -2, hz: 3, grip: 0, vase: 0, scan: 0, feel: 0, lift: 0 },
      phases: [
        { s: 2.6, text: 'Пилот роботты батқан кемеге қарай жүргізеді', rx: -6, ry: 11 },
        { s: 1.5, text: 'Камералар вазаны көреді', scan: 1 },
        { s: 1.6, rx: -2, ry: 7, hx: 6, hy: -5.2, hz: 3 },
        { s: 1.5, text: 'Үш саусақ вазаны жұмсақ орап ұстады', grip: 1, vase: 1, scan: 0 },
        { s: 1.7, text: 'Пилот оның салмағын сезеді', feel: 1, ry: 9 },
        { s: 2, text: 'Ваза себетте', rx: -10, ry: 9.2, rz: 3.5, feel: 0 },
        { s: 1, ry: 7.3 },
        { s: 1, grip: 0, vase: 2 },
        { s: 1.4, rx: -20, ry: 13, rz: 0 },
        { s: 2.3, text: 'Себет жоғары көтеріледі', lift: 1 },
      ],
      build: ocean,
    },
    {
      id: 'kitchen', bg: 'linear-gradient(#fff7ea, #f1dfc2)', camera: [10, 30, 76], target: [-1, 19, 0], poster: 5.2,
      start: { lx: -10.3, ly: 21, lz: 0.5, lg: 0, rx: 2, ry: 25, rz: 0.5, stir: 0, tilt: 0, soup: 0 },
      phases: [
        { s: 1.8, text: 'Қолдар плитаға қарай түседі', ly: 12.9, rx: -5, ry: 21 },
        { s: 1, text: 'Қол басы кастрөлдің тұтқасынан ұстады', lg: 1 },
        { s: 0.8, ry: 19.4 },
        { s: 3.2, text: 'Екінші қол басы сорпаны аспаз сияқты араластырады', stir: 1, linear: true },
        { s: 0.9, ry: 21.5 },
        { s: 1.6, text: 'Сорпа тәрелкеде', rx: 7, rz: 3 },
        { s: 0.9, tilt: 1, soup: 1 },
        { s: 0.7, tilt: 0 },
        { s: 1, lg: 0 },
        { s: 1.6, ly: 21, rx: 2, ry: 25 },
      ],
      build: kitchen,
    },
  ];
})();
