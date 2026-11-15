// The lesson: how many fingers, the hand in 3D, its program to try, a grip planner, the build stepper, a quiz.
// Three 3D stages, each built on first sight and running only while it is on screen.
(function () {
  const RA = window.RA, T = THREE, { $, $$ } = RA;
  const live = !RA.reducedMotion;
  const DEG = Math.PI / 180;
  const PORTS = ['A', 'C', 'E'];
  const spike = (deg) => ((Math.round(deg) % 360) + 360) % 360;   // the app shows motor positions as 0..359

  /* ---------- How many fingers: a top view of jaws closing on an object ---------- */
  // r: radius of a round thing, or the distance from the middle to a flat side; faces: how many flat sides, the first one facing right.
  const THINGS = {
    cube: { r: 34, faces: 4 },
    ball: { r: 40 },
    pencil: { r: 15.6, faces: 6 },
    apple: { r: 48 },
  };
  const JAWS = { 2: [0, 180], 3: [0, 120, 240] };
  // [holds, how it touches, why]. Only what SPEC §1 says: two jaws suit flat sides, three close round things in and centre them.
  const GRIPS = {
    'cube-2': [true, 'Касается двумя сторонами', 'У кубика плоские стороны, и пальцы прижимаются к ним всей поверхностью.'],
    'cube-3': [true, 'Касается одной стороной и двумя рёбрами', 'Но плоско прижат только один палец, два других упираются в рёбра. Для плоских сторон удобнее два пальца.'],
    'ball-2': [false, 'Касается в двух точках', 'Мяч круглый, и вбок его держит лишь трение в двух точках.'],
    'ball-3': [true, 'Касается в трёх точках', 'Три пальца обхватывают мяч с трёх сторон и сами ставят его в середину.'],
    'pencil-2': [true, 'Касается двумя гранями', 'Пальцы плоско ложатся на грани карандаша, а он лёгкий.'],
    'pencil-3': [true, 'Касается тремя гранями', 'Три пальца ложатся на три грани. Но лёгкому карандашу хватает и двух.'],
    'apple-2': [false, 'Касается в двух точках', 'Яблоко круглое, и вбок его держит лишь трение в двух точках. А чем тяжелее предмет, тем больше нужно трения.'],
    'apple-3': [true, 'Касается в трёх точках', 'Три пальца обхватывают яблоко с трёх сторон, и вбок ему уйти некуда.'],
  };

  // Where a jaw coming from angle a (degrees, 0 = from the right) stops, and what it touches: a flat side, a corner or a round side.
  function contact(th, a) {
    if (!th.faces) return { d: th.r, at: [[th.r, 0]] };
    const step = 360 / th.faces, off = ((a % step) + step) % step;
    if (off < 0.5 || off > step - 0.5) {
      const half = Math.min(14, th.r * Math.tan(Math.PI / th.faces));   // no wider than the jaw
      return { d: th.r, at: [[th.r, -half], [th.r, half]] };
    }
    // Corners sit halfway between the flat sides; the jaw meets the one nearest its own direction.
    const R = th.r / Math.cos(Math.PI / th.faces), c = (step / 2 - off) * DEG;
    return { d: R * Math.cos(c), at: [[R * Math.cos(c), -R * Math.sin(c)]] };
  }

  function initFingers(root) {
    const svg = $('#les-fing-svg', root), jaws = $$('.les-jaw', svg), dots = $('#les-fing-dots', svg);
    const touch = $('#les-fing-touch', root), verdict = $('#les-fing-v', root), why = $('#les-fing-why', root);
    const draw = () => {
      const thing = $('[name="les-thing"]:checked', root).value, grip = $('[name="les-grip"]:checked', root).value;
      const th = THINGS[thing], [holds, how, text] = GRIPS[thing + '-' + grip];
      $$('[data-thing]', svg).forEach((g) => g.setAttribute('display', g.dataset.thing === thing ? 'inline' : 'none'));
      let marks = '';
      jaws.forEach((j, i) => {
        const a = JAWS[grip][i];
        j.setAttribute('display', a === undefined ? 'none' : 'inline');
        if (a === undefined) return;
        const c = contact(th, a);
        j.style.transform = `rotate(${-a}deg) translateX(${c.d}px)`;
        // Contacts in the jaw's frame, turned into the picture: one point is a dot, two are a flat side.
        const p = c.at.map(([x, y]) => [x * Math.cos(a * DEG) + y * Math.sin(a * DEG), -x * Math.sin(a * DEG) + y * Math.cos(a * DEG)].map((v) => v.toFixed(1)));
        marks += p.length > 1 ? `<path class="les-fing__flat" d="M${p[0]}L${p[1]}"/>` : `<circle class="les-fing__dot" cx="${p[0][0]}" cy="${p[0][1]}" r="5"/>`;
      });
      dots.innerHTML = marks;
      touch.textContent = how;
      verdict.textContent = holds ? 'Держит' : 'Может выскользнуть';
      verdict.classList.toggle('is-no', !holds);
      why.textContent = text;
    };
    $$('[name="les-thing"], [name="les-grip"]', root).forEach((r) => r.addEventListener('change', draw));
    draw();
  }

  /* ---------- 3D helpers ---------- */
  function shadowCatcher() {
    const m = new T.Mesh(new T.PlaneGeometry(240, 240), new T.ShadowMaterial({ opacity: 0.16 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.02;
    m.receiveShadow = true;
    return m;
  }

  // A stage looking at the hand from a direction: az 0 is the palm side (+Z), negative az turns to the thumb's side (-X).
  function handStage(el, az, el2) {
    const dir = [Math.sin(az) * Math.cos(el2), Math.sin(el2), Math.cos(az) * Math.cos(el2)];
    const stage = RA.stage(el, { fov: 22, maxDpr: 1.5, camera: dir.map((v, i) => v * 100 + (i === 1 ? 14 : 0)), target: [0, 14, 0] });
    if (stage.controls) {
      stage.controls.enableZoom = false;      // the wheel must keep scrolling the page
      stage.renderer.domElement.style.touchAction = 'pan-y';
    }
    return stage;
  }

  // Keeps a box in view whatever the model looks like: the target glides to its centre, the camera keeps its direction.
  function fitter(stage, obj) {
    const box = new T.Box3(), one = new T.Box3(), mid = new T.Vector3(), d = new T.Vector3();
    const ax = [new T.Vector3(), new T.Vector3(), new T.Vector3()], corners = Array.from({ length: 8 }, () => new T.Vector3());
    const tan = Math.tan((stage.camera.fov * DEG) / 2);
    let snap = true;
    return {
      // Without a box: what is visible now (build stages, exploded view).
      measure(b) {
        if (b) box.copy(b);
        else {
          box.makeEmpty();
          obj.updateMatrixWorld(true);
          obj.traverseVisible((o) => { if (o.isMesh) box.union(one.setFromObject(o)); });
        }
        if (box.isEmpty()) return;
        box.getCenter(mid);
        corners.forEach((c, i) => c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(mid));
      },
      step(dt) {
        const c = stage.controls, cam = stage.camera;
        if (!c) return;
        const k = snap || !live ? 1 : 1 - Math.exp(-dt * 3);
        snap = false;
        d.copy(mid).sub(c.target).multiplyScalar(k);
        c.target.add(d);
        cam.position.add(d);
        // Every corner of the box must fit across and up the view; the corners nearer the camera need more room.
        cam.updateMatrixWorld();
        ax.forEach((a, i) => a.setFromMatrixColumn(cam.matrixWorld, i));
        let want = 0;
        corners.forEach((p) => {
          want = Math.max(want, Math.max(Math.abs(p.dot(ax[0])) / (tan * cam.aspect), Math.abs(p.dot(ax[1])) / tan) + p.dot(ax[2]));
        });
        const now = cam.position.distanceTo(c.target);
        cam.position.sub(c.target).setLength(now + (want * 1.08 - now) * k).add(c.target);
      },
    };
  }

  /* ---------- Our hand: parts, ports, how a finger and the thumb's gears move ---------- */
  const FRONT = [-0.6, 0.32], BACK = [Math.PI - 0.8, 0.36];

  function makeHand(root, sel) {
    const stage = handStage($('#les-hand-stage', root), ...FRONT);
    const h = RA.createHand(), fit = fitter(stage, h.group), c = stage.controls;
    stage.scene.add(h.group, shadowCatcher());
    fit.measure(h.box);
    const list = $('#les-parts', root), name = $('#les-part-name', root), role = $('#les-part-role', root), all = role.textContent;
    list.innerHTML = [{ id: '', name: 'Вся кисть' }, ...h.PARTS].map((p) => `<button type="button" data-part="${p.id}">${p.name}</button>`).join('');
    // Parts behind the model's middle are seen from the back, the rest from the palm side.
    const mid = h.box.getCenter(new T.Vector3()), side = {};
    h.PARTS.forEach((p) => { side[p.id] = new T.Box3().setFromObject(h.parts[p.id]).getCenter(new T.Vector3()).z < mid.z - 1 ? BACK : FRONT; });
    const want = new T.Vector3(), off = new T.Vector3();
    let turning = false;
    if (c) c.addEventListener('start', () => { turning = false; });   // a drag wins over the automatic turn

    sel.apply = () => {
      const p = h.PARTS.find((x) => x.id === sel.part);
      h.highlight(p ? p.id : null);
      name.textContent = p ? p.name : 'Вся кисть';
      role.textContent = p ? p.role : all;
      $$('[data-part]', list).forEach((b) => b.setAttribute('aria-pressed', b.dataset.part === (p ? p.id : '')));
      const [az, el] = p ? side[p.id] : FRONT;
      want.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      turning = true;
    };
    sel.apply();

    stage.frame((dt, t) => {
      dt = Math.max(dt, 0);       // the first frame after start() can come with a negative dt
      if (turning && c) {
        off.copy(stage.camera.position).sub(c.target);
        const len = off.length();
        off.normalize().lerp(want, live ? 1 - Math.exp(-dt * 3) : 1).normalize();
        if (off.angleTo(want) < 0.01) turning = false;
        stage.camera.position.copy(c.target).addScaledVector(off, len);
      }
      fit.step(dt);
      h.update(dt);
      sel.tick(t);
    });
    return stage;
  }

  // A gear outline with square-ish teeth around (0,0).
  function gearPath(teeth, rOut, rIn) {
    const pts = [];
    for (let i = 0; i < teeth * 4; i++) {
      const a = (i / (teeth * 4)) * 2 * Math.PI, r = i % 4 < 2 ? rOut : rIn;
      pts.push(`${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`);
    }
    return `M${pts.join('L')}Z`;
  }

  function initHand(root) {
    const sel = { part: '', apply() {}, tick() {} };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-part]');
      if (!b) return;
      sel.part = b.dataset.part;
      sel.apply();
    });
    // Two equal 24-tooth gears (SPEC §1): the thumb turns as far as the motor, the other way. The view turns gear B half a tooth so they mesh.
    const range = $('#les-gear', root), out = $('#les-gear-out', root), a = $('#les-gear-a', root), b = $('#les-gear-b', root);
    $('#les-gear-a-path', root).setAttribute('d', gearPath(24, 41, 35));
    $('#les-gear-b-path', root).setAttribute('d', gearPath(24, 41, 35));
    let touched = false;
    const turn = (deg) => {
      a.setAttribute('transform', `rotate(${deg})`);
      b.setAttribute('transform', `rotate(${-deg})`);
      out.textContent = `Мотор ${Math.round(deg)}° по часовой, палец ${Math.round(deg)}° против`;
    };
    range.addEventListener('input', () => { touched = true; turn(+range.value); });
    // The slider moves by itself while the 3D runs, until someone takes it, so the class sees what it does.
    sel.tick = (t) => {
      if (!live || touched) return;
      range.value = 40 - 40 * Math.cos(t * 0.9);
      turn(+range.value);
    };
    turn(0);
    return sel;
  }

  /* ---------- The designer's program, played in plain JS (SPEC §1) ---------- */
  // Each stack: its motor moves in order. A move waits until the motor gets there, as «перейти в положение» does in SPIKE.
  const PROGRAM = {
    start: [['A', 0], ['C', 0], ['E', 0]],
    pressed: [['C', 270]],
    hard: [['A', 90]],
    released: [['A', 0], ['C', 0]],
    red: [['E', 80]],
    none: [['E', 0]],
  };
  // shortcut: one speed for all three motors, picked to read well on a projector; take the program view's motor model if timings ever matter.
  const SPEED = 240;
  const PLUNGER = [0, 25, 90];       // % of the 8 mm travel: released, a light press, a hard press
  const RED = '#e3000b';

  function makeTry(root) {
    const stage = handStage($('#les-try-stage', root), -2.1, 0.42);   // from behind the thumb's side: sensors, fingers and thumb in view
    const h = RA.createHand(), fit = fitter(stage, h.group);
    stage.scene.add(h.group, shadowCatcher());
    // Frame the closed hand too: fingers and thumb swing out of the open hand's box.
    const box = h.box.clone();
    PORTS.forEach((p) => h.setMotor(p, h.FINGERS[p].sign * h.FINGERS[p].closeDeg));
    box.union(new T.Box3().setFromObject(h.group));
    PORTS.forEach((p) => h.setMotor(p, 0));
    fit.measure(box);

    const pos = { A: 0, C: 0, E: 0 }, goal = { A: 0, C: 0, E: 0 }, runs = {}, glowUntil = {}, outs = {};
    PORTS.forEach((p) => { outs[p] = $('#les-pos-' + p, root); });
    const stacks = $$('[data-stack]', root), forceBtns = $$('[data-force]', root), card = $('#les-card', root);
    let force = 0, plunger = 0, now = 0;

    // A stack's next move; a stack fired again starts over, as a SPIKE hat does.
    const next = (id) => {
      const r = runs[id], move = PROGRAM[id][++r.i];
      if (!move) { delete runs[id]; return; }
      const [port, to] = move, f = h.FINGERS[port], cur = pos[port];
      const target = cur + ((((to - cur) % 360) + 540) % 360) - 180;   // the shortest way round to that position
      r.port = port;
      r.to = goal[port] = Math.min(f.stops[1], Math.max(f.stops[0], target));   // a mechanical stop ends the move there
    };
    const fire = (id) => { runs[id] = { i: -1 }; glowUntil[id] = now + 0.8; next(id); };
    const setForce = (lvl) => {
      if (!force && lvl) fire('pressed');
      if (force < 2 && lvl === 2) fire('hard');
      if (force && !lvl) fire('released');
      force = lvl;
      forceBtns.forEach((b) => b.setAttribute('aria-pressed', +b.dataset.force === lvl));
    };
    forceBtns.forEach((b) => b.addEventListener('click', () => setForce(+b.dataset.force)));
    card.addEventListener('click', () => {
      const on = card.getAttribute('aria-pressed') !== 'true';
      card.setAttribute('aria-pressed', on);
      h.setCard(on ? RED : null);
      fire(on ? 'red' : 'none');
    });
    fire('start');

    stage.frame((dt) => {
      dt = Math.max(dt, 0);       // the first frame after start() can come with a negative dt
      now += dt;
      PORTS.forEach((p) => {
        const d = goal[p] - pos[p], step = live ? SPEED * dt : Infinity;
        pos[p] = Math.abs(d) <= step ? goal[p] : pos[p] + Math.sign(d) * step;
        h.setMotor(p, pos[p]);
        outs[p].textContent = spike(pos[p]);
      });
      // A move is over when its motor got there or another stack took that motor.
      Object.keys(runs).forEach((id) => { const r = runs[id]; if (pos[r.port] === r.to || goal[r.port] !== r.to) next(id); });
      stacks.forEach((s) => s.classList.toggle('is-run', s.dataset.stack in runs || now < (glowUntil[s.dataset.stack] || 0)));
      plunger = live ? plunger + (PLUNGER[force] - plunger) * Math.min(1, dt * 12) : PLUNGER[force];
      h.setForce(plunger);
      fit.step(dt);
      h.update(dt);
    });
    return stage;
  }

  /* ---------- Own grip: a planner and its passport ---------- */
  const PLAN = [
    ['obj', 'Что берём', { cube: 'Кубик LEGO', ball: 'Мяч', pencil: 'Карандаш', apple: 'Яблоко', paper: 'Бумажный шарик' }],
    ['fingers', 'Сколько пальцев', { 2: '2', 3: '3' }],
    ['type', 'Какие пальцы', { hard: 'Жёсткие', rubber: 'С резиновыми накладками', soft: 'Мягкие' }],
    ['motors', 'Моторы', { one: 'Один на все пальцы', each: 'Свой на каждый палец' }],
    ['control', 'Управление', { hub: 'Кнопка хаба', force: 'Датчик силы', color: 'Датчик цвета', distance: 'Датчик расстояния', program: 'Сам по программе' }],
  ];
  const ROUND = ['ball', 'apple', 'paper'];
  // In order of importance; the passport shows the first three that apply.
  const TIPS = [
    [(d) => ROUND.includes(d.obj) && d.fingers === '2', 'Круглое двумя пальцами держится хуже. Три пальца обхватят его с трёх сторон.'],
    [(d) => d.obj === 'apple' && d.type === 'hard', 'Яблоко тяжёлое. Резиновые накладки дадут трение, и ему будет труднее выскользнуть.'],
    [(d) => d.obj === 'paper' && d.type !== 'soft' && d.control !== 'force', 'Бумажный шарик легко смять. Возьми мягкие пальцы или датчик силы, чтобы сжимать слабее.'],
    [(d) => d.obj === 'cube' && d.fingers === '3', 'У кубика плоские стороны: хватит и двух пальцев, а деталей уйдёт меньше.'],
    [(d) => d.motors === 'one' && d.fingers === '3', 'Один мотор на три пальца: нужны рычаги или шестерни, чтобы двигать их вместе.'],
    [(d) => d.motors === 'each', 'Свой мотор у каждого пальца: их можно сгибать по одному, как у кисти. В наборе три мотора.'],
    [(d) => d.control === 'hub', 'Кнопка хаба знает только «нажата» или «нет». Датчик силы чувствует ещё и то, как сильно нажали.'],
    [(d) => d.control === 'distance', 'С датчиком расстояния захват может сжиматься сам, когда предмет рядом. Это уже автономия.'],
    [(d) => d.type === 'hard', 'У гладкого пластика трение меньше, чем у резины. Резиновые накладки помогут удержать предмет.'],
  ];
  const WHO = { hub: 'Человек: нажимает кнопку', force: 'Человек: нажимает датчик', color: 'Человек: показывает карточку', distance: 'Сам захват, по датчику расстояния', program: 'Программа: шаги записаны заранее' };
  const TESTS = [['flat', 'Предмет с плоскими сторонами'], ['round', 'Круглый предмет'], ['heavy', 'Тяжёлый предмет']];
  const MARK = { '': ['', 'пусто'], yes: ['✓', 'держит'], no: ['✗', 'не держит'] }, NEXT = { '': 'yes', yes: 'no', no: '' };

  function initPlan(root) {
    const form = $('#les-plan', root), pass = $('#les-pass', root);
    let d = RA.store.get('lessonDesign', {}), sure = 0;
    d.test = d.test || {};
    form.insertAdjacentHTML('beforeend', PLAN.map(([key, label, opts]) => `<fieldset class="les-chips"><legend>${label}</legend>${Object.keys(opts).map((v) =>
      `<label><input type="radio" name="${key}" value="${v}"${d[key] === v ? ' checked' : ''}><span>${opts[v]}</span></label>`).join('')}</fieldset>`).join(''));
    const nameIn = $('[name="gname"]', form);
    nameIn.value = d.name || '';

    const paint = () => {
      const done = PLAN.every(([key]) => d[key]);
      let tips = TIPS.filter(([when]) => when(d)).map(([, text]) => text).slice(0, 3);
      if (!tips.length) tips = ['Хороший план. Собери захват и испытай его на трёх предметах.'];
      pass.innerHTML = `<header class="les-pass__head"><span>Паспорт захвата</span><h3></h3></header>
        <dl class="les-pass__rows">${PLAN.map(([key, label, opts]) => `<div><dt>${label}</dt><dd>${d[key] ? opts[d[key]] : '—'}</dd></div>`).join('')}
        <div><dt>Кто решает</dt><dd>${d.control ? WHO[d.control] : '—'}</dd></div></dl>
        ${done ? `<div class="les-pass__tips"><b>Советы</b><ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : '<p class="les-pass__wait">Ответь на все вопросы, и здесь появятся советы.</p>'}
        <table class="les-tab les-pass__test"><thead><tr><th scope="col">Испытание</th><th scope="col">Результат</th></tr></thead>
        <tbody>${TESTS.map(([k, label]) => `<tr><th scope="row">${label}</th><td><button type="button" class="les-cell${d.test[k] ? ' is-' + d.test[k] : ''}" data-test="${k}" aria-label="${label}: ${MARK[d.test[k] || ''][1]}">${d.test[k] ? `<span><b>${MARK[d.test[k]][0]}</b><small>${MARK[d.test[k]][1]}</small></span>` : ''}</button></td></tr>`).join('')}</tbody></table>
        <button type="button" class="btn les-pass__clear" data-clear>Очистить паспорт</button>`;
      $('h3', pass).textContent = d.name || 'Мой захват';
    };
    const save = () => { RA.store.set('lessonDesign', d); paint(); };
    form.addEventListener('change', (e) => { if (e.target.type === 'radio') { d[e.target.name] = e.target.value; save(); } });
    form.addEventListener('input', (e) => { if (e.target === nameIn) { d.name = nameIn.value.trim(); save(); } });
    form.addEventListener('submit', (e) => e.preventDefault());
    pass.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-test]'), clear = e.target.closest('[data-clear]');
      if (cell) {
        d.test[cell.dataset.test] = NEXT[d.test[cell.dataset.test] || ''];
        save();
        $(`[data-test="${cell.dataset.test}"]`, pass).focus();
      }
      if (!clear) return;
      // No native confirm in the published page: the button asks again in its own label.
      clearTimeout(sure);
      if (!clear.dataset.sure) {
        clear.dataset.sure = '1';
        clear.textContent = 'Точно очистить?';
        sure = setTimeout(paint, 3000);
        return;
      }
      d = { test: {} };
      nameIn.value = '';
      $$('[type="radio"]', form).forEach((r) => { r.checked = false; });
      save();
    });
    paint();
  }

  /* ---------- Build stepper ---------- */
  function makeBuild(root) {
    const stage = handStage($('#les-build-stage', root), -0.6, 0.42);
    const h = RA.createHand(), fit = fitter(stage, h.group);
    stage.scene.add(h.group, shadowCatcher());
    const S = h.STAGES, last = S.length - 1, plays = live && !!stage.renderer;
    const rail = $('#les-rail', root), prev = $('#les-stage-prev', root), next = $('#les-stage-next', root), explode = $('#les-explode', root);
    // One hole per instruction step: «1–5» is five holes.
    rail.innerHTML = S.map((s, i) => {
      const [a, b] = String(s.steps).split(/[–-]/).map(Number), n = Math.max(1, (b || a) - a + 1) || 1;
      return `<li style="flex:${n} 1 0"><button type="button" data-stage="${i}" aria-label="Этап ${i + 1}: ${s.title}, ${n > 1 ? 'шаги' : 'шаг'} ${s.steps}">${'<i></i>'.repeat(n)}</button><span>${s.steps}</span></li>`;
    }).join('');
    const items = $$('li', rail);
    let n = 0, tween = 1;

    const show = (i, animate) => {
      n = i;
      h.setBuildStage(n, 1);
      fit.measure();
      tween = animate && plays ? 0 : 1;
      h.setBuildStage(n, tween);
      const s = S[n];
      $('#les-stage-n', root).textContent = `Этап ${n + 1} из ${last + 1}.`;
      $('#les-stage-steps', root).textContent = `${/[–-]/.test(s.steps) ? 'Шаги' : 'Шаг'} ${s.steps} в инструкции`;
      $('#les-stage-title', root).textContent = s.title;
      $('#les-stage-text', root).textContent = s.text;
      $('#les-stage-parts', root).textContent = s.parts;
      items.forEach((li, k) => {
        li.classList.toggle('is-done', k < n);
        li.classList.toggle('is-now', k === n);
        if (k === n) li.firstChild.setAttribute('aria-current', 'step');
        else li.firstChild.removeAttribute('aria-current');
      });
      prev.disabled = n === 0;
      next.disabled = n === last;
    };
    const go = (i) => { explode.value = 0; h.setExplode(0); show(i, true); };

    rail.addEventListener('click', (e) => { const b = e.target.closest('[data-stage]'); if (b) go(+b.dataset.stage); });
    prev.addEventListener('click', () => go(n - 1));
    next.addEventListener('click', () => go(n + 1));
    // Taking a model apart starts from the whole model.
    explode.addEventListener('input', () => {
      if (n !== last) show(last, false);
      h.setExplode(explode.value / 100);
      fit.measure();
    });
    show(0, false);

    stage.frame((dt) => {
      dt = Math.max(dt, 0);       // the first frame after start() can come with a negative dt
      if (tween < 1) {
        tween = Math.min(1, tween + dt / 0.9);
        h.setBuildStage(n, tween);
      }
      fit.step(dt);
      h.update(dt);
    });
    return stage;
  }

  /* ---------- Quiz ---------- */
  const QUIZ = [
    { q: 'Какой хват лучше удержит мяч?', a: ['Три пальца', 'Два пальца', 'Без разницы'], ok: 0,
      why: 'Три пальца обхватывают мяч с трёх сторон и сами ставят его в середину. Двумя пальцами круглое держится хуже.' },
    { q: 'Ты слегка нажал датчик силы. Что сделает кисть?', a: ['Согнёт все три пальца', 'Ничего', 'Согнёт палец C'], ok: 2,
      why: 'Подпрограмма «(D) когда нажата» отправляет мотор C в положение 270. Палец A ждёт сильного нажатия, а большой палец ждёт красную карточку.' },
    { q: 'Мотор E повернулся на 80°. Две его шестерни одинаковые, по 24 зуба. Что с большим пальцем?', a: ['80° в ту же сторону', '80° в другую сторону', '160° в ту же сторону'], ok: 1,
      why: 'Шестерни одинаковые, поэтому угол тот же, 1:1. А сцепленные шестерни крутятся в разные стороны.' },
    { q: 'Зачем на пальцы ставят резиновые накладки?', a: ['Резина даёт трение, и предмет не выскальзывает', 'Для красоты', 'Чтобы пальцы сгибались быстрее'], ok: 0,
      why: 'Резина цепляется за предмет лучше гладкого пластика. Поэтому у Роборуки на пальцах были шины.' },
    { q: 'Что сделает кисть автономнее?', a: ['Нажимать на датчик сильнее', 'Карточка побольше', 'Датчик расстояния в программе'], ok: 2,
      why: 'Сейчас, когда сжать и разжать, решает человек. Датчик расстояния стоит на модели, но программа его не использует. С ним кисть сможет решать сама.' },
  ];
  const VERDICT = ['Вернись к уроку и попробуй ещё раз.', 'Вернись к уроку и попробуй ещё раз.', 'Неплохо. Вернись к разделам, где были ошибки, и попробуй ещё раз.', 'Хорошо. Осталось чуть-чуть.', 'Отлично, почти всё верно.', 'Отлично, всё верно.'];

  function initQuiz(root) {
    const box = $('#les-quiz-box', root), pins = $('#les-quiz-pins', root), lastLine = $('#les-quiz-last', root);
    let i = 0, marks = [];
    const paintPins = () => {
      pins.innerHTML = QUIZ.map((q, k) => `<i class="${k in marks ? (marks[k] ? 'is-right' : 'is-wrong') : k === i ? 'is-now' : ''}"></i>`).join('');
      pins.setAttribute('aria-label', `Верных ответов: ${marks.filter(Boolean).length} из ${QUIZ.length}`);
    };
    const paintLast = () => {
      const past = RA.store.get('lessonQuiz', null);
      lastLine.textContent = past ? `Прошлый результат: ${past.score} из ${past.total}` : '';
    };
    const ask = () => {
      const q = QUIZ[i];
      box.innerHTML = `<div class="les-quiz__ask"><p class="les-quiz__q">${q.q}</p><p class="les-quiz__why" aria-live="polite"></p><div class="les-quiz__foot"></div></div>
        <div class="les-opts">${q.a.map((a, k) => `<button type="button" class="les-opt" data-a="${k}">${a}</button>`).join('')}</div>`;
      paintLast();
      paintPins();
    };
    const answer = (k) => {
      const q = QUIZ[i], right = k === q.ok;
      marks[i] = right;
      $$('.les-opt', box).forEach((b, n) => {
        b.disabled = true;
        if (n === q.ok) b.classList.add('is-right');
        else if (n === k) b.classList.add('is-wrong');
      });
      $('.les-quiz__why', box).innerHTML = `<b>${right ? 'Верно.' : 'Не совсем.'}</b> ${q.why}`;
      $('.les-quiz__foot', box).innerHTML = `<button type="button" class="btn" data-next>${i < QUIZ.length - 1 ? 'Следующий вопрос' : 'Узнать результат'}</button>`;
      $('[data-next]', box).focus({ preventScroll: true });
      paintPins();
    };
    const finish = () => {
      const score = marks.filter(Boolean).length;
      RA.store.set('lessonQuiz', { score, total: QUIZ.length });
      RA.progress.mark('lesson');
      lastLine.textContent = '';
      box.innerHTML = `<div class="les-quiz__end"><p class="les-quiz__score">${score} из ${QUIZ.length}</p><p class="les-quiz__q">${VERDICT[score]}</p>
        <div class="les-quiz__foot"><a class="btn" href="#examples">Дальше: в жизни</a><button type="button" class="btn" data-again>Пройти ещё раз</button></div></div>`;
      paintPins();
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.a) answer(+b.dataset.a);
      else if ('next' in b.dataset) { i += 1; if (i < QUIZ.length) ask(); else finish(); }
      else if ('again' in b.dataset) { i = 0; marks = []; ask(); }
    });
    ask();
  }

  /* ---------- View ---------- */
  let active = false;
  const syncs = [];

  // Builds its 3D on first sight of el, then runs only while el is both on screen and in the current view.
  function watch(el, make) {
    let stage = null, seen = false;
    const sync = () => {
      if (seen && active && !stage) stage = make();
      if (!stage) return;
      if (seen && active) stage.start();
      else stage.stop();
    };
    // The top bar covers the first 64px, and a box that merely touches the edge still counts: hence 65.
    new IntersectionObserver((list) => { seen = list[list.length - 1].isIntersecting; sync(); }, { rootMargin: '-65px 0px 0px' }).observe(el);
    syncs.push(sync);
  }

  RA.view('lesson', {
    init(root) {
      root.classList.toggle('is-live', live);
      initFingers(root);
      initPlan(root);
      initQuiz(root);
      const sel = initHand(root);
      watch($('#les-hand-stage', root), () => makeHand(root, sel));
      watch($('#les-try', root), () => makeTry(root));      // the whole panel: its buttons need the model
      watch($('#les-build-stage', root), () => makeBuild(root));
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-to]');
        if (b) $('#' + b.dataset.to).scrollIntoView({ behavior: live ? 'smooth' : 'auto' });
      });
    },
    enter() { active = true; syncs.forEach((s) => s()); },
    leave() { active = false; syncs.forEach((s) => s()); },
  });
})();
