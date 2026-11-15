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
    'cube-2': [true, 'Екі жағымен жанасады', 'Текшенің жақтары тегіс, сондықтан саусақтар оларға бүкіл бетімен қысылады.'],
    'cube-3': [true, 'Бір жағымен және екі қырымен жанасады', 'Бірақ тек бір саусақ жалпақ қысылады, қалған екеуі қырларға тіреледі. Тегіс жақтарға екі саусақ ыңғайлырақ.'],
    'ball-2': [false, 'Екі нүктеде жанасады', 'Доп домалақ, оны бүйірге кетуден тек екі нүктедегі үйкеліс ұстап тұр.'],
    'ball-3': [true, 'Үш нүктеде жанасады', 'Үш саусақ допты үш жағынан орап ұстайды және оны өздері ортаға қояды.'],
    'pencil-2': [true, 'Екі жағымен жанасады', 'Саусақтар қарындаштың жақтарына жалпақ жатады, әрі ол жеңіл.'],
    'pencil-3': [true, 'Үш жағымен жанасады', 'Үш саусақ үш жаққа жатады. Бірақ жеңіл қарындашқа екеуі де жетеді.'],
    'apple-2': [false, 'Екі нүктеде жанасады', 'Алма домалақ, оны бүйірге кетуден тек екі нүктедегі үйкеліс ұстап тұр. Ал зат неғұрлым ауыр болса, соғұрлым көбірек үйкеліс керек.'],
    'apple-3': [true, 'Үш нүктеде жанасады', 'Үш саусақ алманы үш жағынан орап ұстайды, ол бүйірге еш жаққа кете алмайды.'],
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
      verdict.textContent = holds ? 'Ұстайды' : 'Сырғып түсуі мүмкін';
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

  // A stage looking at the hand from a direction: az 0 is the palm side (+Z), negative az turns to finger A's side (-X), positive to the thumb's (+X).
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
  // Views [az, el]: the palm from finger A's side, the palm from the thumb's side, the back (hub screen, cover) from the thumb's
  // side as on page 53 of the instructions.
  const FRONT = [-0.6, 0.32], RIGHT = [0.55, 0.4], BACK = [Math.PI - 0.7, 0.36];
  // The hub's screen faces the back; the thumb and the colour sensor's lens face +X. Every other part shows best from the palm.
  const VIEW = { hub: BACK, thumb: RIGHT, controls: RIGHT };

  // Turns the camera round its target to a view [az, el], the short way round the side, until someone drags the model.
  function turner(stage) {
    const sph = new T.Spherical(), off = new T.Vector3(), c = stage.controls;
    let az = 0, polar = 0, turning = false;
    if (c) c.addEventListener('start', () => { turning = false; });   // a drag wins over the automatic turn
    return {
      to([a, el]) { az = a; polar = Math.PI / 2 - el; turning = true; },
      step(dt) {
        if (!turning || !c) return;
        sph.setFromVector3(off.copy(stage.camera.position).sub(c.target));   // theta is our az, phi is measured from straight up
        const k = live ? 1 - Math.exp(-dt * 3) : 1;
        const da = Math.atan2(Math.sin(az - sph.theta), Math.cos(az - sph.theta)), dp = polar - sph.phi;
        sph.theta += da * k;
        sph.phi += dp * k;
        if (Math.abs(da) + Math.abs(dp) < 0.01) turning = false;
        stage.camera.position.copy(c.target).add(off.setFromSpherical(sph));
      },
    };
  }

  function makeHand(root, sel) {
    const stage = handStage($('#les-hand-stage', root), ...FRONT);
    const h = RA.createHand(), fit = fitter(stage, h.group), turn = turner(stage);
    stage.scene.add(h.group, shadowCatcher());
    fit.measure(h.box);
    const list = $('#les-parts', root), name = $('#les-part-name', root), role = $('#les-part-role', root), all = role.textContent;

    sel.apply = () => {
      const p = h.PARTS.find((x) => x.id === sel.part);
      h.highlight(p ? p.id : null);
      name.textContent = p ? p.name : 'Бүкіл қол басы';
      role.textContent = p ? p.role : all;
      $$('[data-part]', list).forEach((b) => b.setAttribute('aria-pressed', b.dataset.part === (p ? p.id : '')));
      turn.to((p && VIEW[p.id]) || FRONT);
    };
    sel.apply();

    stage.frame((dt, t) => {
      dt = Math.max(dt, 0);       // the first frame after start() can come with a negative dt
      turn.step(dt);
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
    // Drawn now, not when the 3D stage scrolls in: by then a keyboard user has tabbed past them.
    $('#les-parts', root).innerHTML = [{ id: '', name: 'Бүкіл қол басы' }, ...RA.createHand.PARTS]
      .map((p) => `<button type="button" data-part="${p.id}" aria-pressed="${p.id === ''}">${p.name}</button>`).join('');
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-part]');
      if (!b) return;
      sel.part = b.dataset.part;
      sel.apply();
    });
    // Two equal 24-tooth gears at a right angle (SPEC §1): 1:1, so the standing gear, the lying one and the thumb on it all turn by
    // the motor's angle. The lying paths sit half a tooth round so a gap meets the standing gear's top tooth.
    const range = $('#les-gear', root), out = $('#les-gear-out', root), stand = $$('[data-stand]', root), lie = $$('[data-lie]', root);
    $$('.les-gears__wheel', root).forEach((p) => p.setAttribute('d', gearPath(24, 34, 29)));
    let touched = false;
    const turn = (deg) => {
      stand.forEach((g) => g.setAttribute('transform', `rotate(${deg})`));
      // At the mesh the standing gear's top drags the lying gear's near edge along: in the lying gear's own plane that is rotate(-deg).
      lie.forEach((g) => g.setAttribute('transform', `rotate(${-deg})`));
      out.textContent = `E моторы ${Math.round(deg)}°, бас бармақ ${Math.round(deg)}°`;
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
    // From the palm and the thumb's side, above: the fingers curl towards the palm, the thumb swings in front of it, the card shows by the colour sensor.
    const stage = handStage($('#les-try-stage', root), 1.1, 0.55);
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
    ['obj', 'Не аламыз', { cube: 'LEGO текшесі', ball: 'Доп', pencil: 'Қарындаш', apple: 'Алма', paper: 'Қағаз шар' }],
    ['fingers', 'Неше саусақ', { 2: '2', 3: '3' }],
    ['type', 'Қандай саусақтар', { hard: 'Қатты', rubber: 'Резеңке қаптамалы', soft: 'Жұмсақ' }],
    ['motors', 'Моторлар', { one: 'Барлық саусаққа біреу', each: 'Әр саусақтың өз моторы' }],
    ['control', 'Басқару', { hub: 'Хаб батырмасы', force: 'Күш датчигі', color: 'Түс датчигі', distance: 'Қашықтық датчигі', program: 'Бағдарлама бойынша өзі' }],
  ];
  const ROUND = ['ball', 'apple', 'paper'];
  // In order of importance; the passport shows the first three that apply.
  const TIPS = [
    [(d) => ROUND.includes(d.obj) && d.fingers === '2', 'Домалақ затты екі саусақ нашарырақ ұстайды. Үш саусақ оны үш жағынан орап ұстайды.'],
    [(d) => d.obj === 'apple' && d.type === 'hard', 'Алма ауыр. Резеңке қаптама үйкеліс береді, сонда оның сырғып түсуі қиындайды.'],
    [(d) => d.obj === 'paper' && d.type !== 'soft' && d.control !== 'force', 'Қағаз шар оңай мыжылады. Әлсіздеу қысу үшін жұмсақ саусақтарды немесе күш датчигін таңда.'],
    [(d) => d.obj === 'cube' && d.fingers === '3', 'Текшенің жақтары тегіс: екі саусақ та жетеді, әрі бөлшек азырақ кетеді.'],
    [(d) => d.motors === 'one' && d.fingers === '3', 'Үш саусаққа бір мотор: оларды бірге қозғау үшін иінтіректер немесе тісті дөңгелектер керек.'],
    [(d) => d.motors === 'each', 'Әр саусақтың өз моторы бар: оларды қол басындағыдай бір-бірлеп бүгуге болады. Жинақта үш мотор бар.'],
    [(d) => d.control === 'hub', 'Хаб батырмасы тек «басылған» немесе «жоқ» дегенді біледі. Күш датчигі өзінің қаншалықты қатты басылғанын да сезеді.'],
    [(d) => d.control === 'distance', 'Қашықтық датчигімен қармауыш зат жақын болғанда өзі қысыла алады. Бұл енді автономия.'],
    [(d) => d.type === 'hard', 'Тегіс пластиктің үйкелісі резеңкенікінен аз. Резеңке қаптама затты ұстап тұруға көмектеседі.'],
  ];
  const WHO = { hub: 'Адам: батырманы басады', force: 'Адам: датчикті басады', color: 'Адам: карточканы көрсетеді', distance: 'Қармауыштың өзі, қашықтық датчигі бойынша', program: 'Бағдарлама: қадамдар алдын ала жазылған' };
  const TESTS = [['flat', 'Жақтары тегіс зат'], ['round', 'Домалақ зат'], ['heavy', 'Ауыр зат']];
  const MARK = { '': ['', 'бос'], yes: ['✓', 'ұстайды'], no: ['✗', 'ұстамайды'] }, NEXT = { '': 'yes', yes: 'no', no: '' };

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
      if (!tips.length) tips = ['Жақсы жоспар. Қармауышты құрастырып, оны үш затпен сынап көр.'];
      pass.innerHTML = `<header class="les-pass__head"><span>Қармауыш паспорты</span><h3></h3></header>
        <dl class="les-pass__rows">${PLAN.map(([key, label, opts]) => `<div><dt>${label}</dt><dd>${d[key] ? opts[d[key]] : '—'}</dd></div>`).join('')}
        <div><dt>Кім шешеді</dt><dd>${d.control ? WHO[d.control] : '—'}</dd></div></dl>
        ${done ? `<div class="les-pass__tips"><b>Кеңестер</b><ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : '<p class="les-pass__wait">Барлық сұраққа жауап бер, сонда осы жерде кеңестер пайда болады.</p>'}
        <table class="les-tab les-pass__test"><thead><tr><th scope="col">Сынақ</th><th scope="col">Нәтиже</th></tr></thead>
        <tbody>${TESTS.map(([k, label]) => `<tr><th scope="row">${label}</th><td><button type="button" class="les-cell${d.test[k] ? ' is-' + d.test[k] : ''}" data-test="${k}" aria-label="${label}: ${MARK[d.test[k] || ''][1]}">${d.test[k] ? `<span><b>${MARK[d.test[k]][0]}</b><small>${MARK[d.test[k]][1]}</small></span>` : ''}</button></td></tr>`).join('')}</tbody></table>
        <button type="button" class="btn les-pass__clear" data-clear>Паспортты тазалау</button>`;
      $('h3', pass).textContent = d.name || 'Менің қармауышым';
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
        clear.textContent = 'Шынымен тазалайсың ба?';
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
    // From the palm side; the cover goes on the back, so its stage turns the model round.
    const FROM = [-0.6, 0.42], BEHIND = [BACK[0], 0.42];
    const stage = handStage($('#les-build-stage', root), ...FROM);
    const h = RA.createHand(), fit = fitter(stage, h.group), turn = turner(stage);
    stage.scene.add(h.group, shadowCatcher());
    const S = h.STAGES, last = S.length - 1, plays = live && !!stage.renderer;
    const rail = $('#les-rail', root), prev = $('#les-stage-prev', root), next = $('#les-stage-next', root), explode = $('#les-explode', root);
    // One hole per instruction step: «1–5» is five holes.
    rail.innerHTML = S.map((s, i) => {
      const [a, b] = String(s.steps).split(/[–-]/).map(Number), n = Math.max(1, (b || a) - a + 1) || 1;
      return `<li style="flex:${n} 1 0"><button type="button" data-stage="${i}" aria-label="${i + 1}-кезең: ${s.title}, ${s.steps}-${n > 1 ? 'қадамдар' : 'қадам'}">${'<i></i>'.repeat(n)}</button><span>${s.steps}</span></li>`;
    }).join('');
    const items = $$('li', rail);
    let n = 0, tween = 1, aim = FROM;

    const show = (i, animate) => {
      n = i;
      h.setBuildStage(n, 1);
      fit.measure();
      tween = animate && plays ? 0 : 1;
      h.setBuildStage(n, tween);
      const s = S[n];
      $('#les-stage-n', root).textContent = `${n + 1}-кезең, барлығы ${last + 1}.`;
      $('#les-stage-steps', root).textContent = `Нұсқаулықтың ${s.steps}-${/[–-]/.test(s.steps) ? 'қадамдары' : 'қадамы'}`;
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
    const go = (i) => {
      explode.value = 0;
      h.setExplode(0);
      show(i, true);
      const want = S[i].id === 'cover' ? BEHIND : FROM;
      if (want !== aim) turn.to((aim = want));     // only when the side changes: a model someone turned stays as it is
    };

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
      turn.step(dt);
      fit.step(dt);
      h.update(dt);
    });
    return stage;
  }

  /* ---------- Quiz ---------- */
  const QUIZ = [
    { q: 'Қай қармау допты жақсырақ ұстайды?', a: ['Үш саусақ', 'Екі саусақ', 'Айырмашылығы жоқ'], ok: 0,
      why: 'Үш саусақ допты үш жағынан орап ұстайды және оны өздері ортаға қояды. Домалақ затты екі саусақ нашарырақ ұстайды.' },
    { q: 'Сен күш датчигін ақырын бастың. Қол басы не істейді?', a: ['Үш саусақтың бәрін бүгеді', 'Ештеңе істемейді', 'C саусағын бүгеді'], ok: 2,
      why: '«(D) басылған кезде» ішкі бағдарламасы C моторын 270 позициясына жібереді. A саусағы қатты басуды күтеді, ал бас бармақ қызыл карточканы күтеді.' },
    { q: 'E моторы 80°-қа бұрылды. Оның екі тісті дөңгелегі бірдей, әрқайсысында 24 тіс. Бас бармақ неше градусқа бұрылады?', a: ['40°-қа', '80°-қа', '160°-қа'], ok: 1,
      why: 'Тісті дөңгелектердің тістері бірдей, бұл — 1:1 беріліс. Сондықтан бас бармақ мотор қанша градусқа бұрылса, сонша градусқа бұрылады: 80°-қа.' },
    { q: 'Саусақтарға резеңке қаптаманы не үшін қояды?', a: ['Резеңке үйкеліс береді, сондықтан зат сырғып түспейді', 'Әдемі болу үшін', 'Саусақтар тезірек бүгілуі үшін'], ok: 0,
      why: 'Резеңке затты тегіс пластиктен гөрі жақсы ұстайды. Сондықтан Робот-қолдың саусақтарында шиналар болған.' },
    { q: 'Қол басын не автономдырақ етеді?', a: ['Датчикті қаттырақ басу', 'Үлкенірек карточка', 'Бағдарламадағы қашықтық датчигі'], ok: 2,
      why: 'Қазір қашан қысып, қашан ашу керегін адам шешеді. Қашықтық датчигі модельде тұр, бірақ бағдарлама оны пайдаланбайды. Онымен қол басы өзі шеше алады.' },
  ];
  const VERDICT = ['Сабаққа қайта оралып, тағы бір рет байқап көр.', 'Сабаққа қайта оралып, тағы бір рет байқап көр.', 'Жаман емес. Қате кеткен бөлімдерге қайта оралып, тағы бір рет байқап көр.', 'Жақсы. Аз ғана қалды.', 'Тамаша, бәрі дерлік дұрыс.', 'Тамаша, бәрі дұрыс.'];

  function initQuiz(root) {
    const box = $('#les-quiz-box', root), pins = $('#les-quiz-pins', root), lastLine = $('#les-quiz-last', root);
    let i = 0, marks = [];
    const paintPins = () => {
      pins.innerHTML = QUIZ.map((q, k) => `<i class="${k in marks ? (marks[k] ? 'is-right' : 'is-wrong') : k === i ? 'is-now' : ''}"></i>`).join('');
      pins.setAttribute('aria-label', `${QUIZ.length} сұрақтан ${marks.filter(Boolean).length} дұрыс жауап`);
    };
    const paintLast = () => {
      const past = RA.store.get('lessonQuiz', null);
      lastLine.textContent = past ? `Алдыңғы нәтиже: ${past.total} сұрақтан ${past.score}` : '';
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
      $('.les-quiz__why', box).innerHTML = `<b>${right ? 'Дұрыс.' : 'Олай емес.'}</b> ${q.why}`;
      $('.les-quiz__foot', box).innerHTML = `<button type="button" class="btn" data-next>${i < QUIZ.length - 1 ? 'Келесі сұрақ' : 'Нәтижені көру'}</button>`;
      $('[data-next]', box).focus({ preventScroll: true });
      paintPins();
    };
    const finish = () => {
      const score = marks.filter(Boolean).length;
      RA.store.set('lessonQuiz', { score, total: QUIZ.length });
      RA.progress.mark('lesson');
      lastLine.textContent = '';
      box.innerHTML = `<div class="les-quiz__end"><p class="les-quiz__score">${score} / ${QUIZ.length}</p><p class="les-quiz__q">${VERDICT[score]}</p>
        <div class="les-quiz__foot"><a class="btn" href="#examples">Әрі қарай: өмірде</a><button type="button" class="btn" data-again>Қайта өту</button></div></div>`;
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
