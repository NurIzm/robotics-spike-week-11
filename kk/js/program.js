// The program view: blocks on the left, the hand on the right, the four tasks on top.
(function () {
  const RA = window.RA;
  const { $, $$ } = RA;

  const TASKS = [
    { title: 'Бағдар\u00ADламаны толықтыр', xml: () => RA.SOLUTION_XML, ready: 'Іске қосу батырмасын бас. Қызыл карточканы көрсет (1 пернесі), күте тұр, сосын оны алып таста (0 пернесі).',
      goal: 'Бұл — модель авторының бағдарламасы. Қызыл карточка бас бармақты бүгеді, бірақ ол кері жазылмайды: соңғы тізбекте бір блок жетіспейді. Оны қос.',
      stacks: ['flipperevents_whenColor'],
      hint: 'Сол жақ бағандағы соңғы тізбек: «(F) түсі … болғанда», дөңгелегі сызылған, яғни «түс жоқ». Оның астына «Моторлар» бөлімінен блок қой: E ең қысқа жолмен 0 позициясына бару.' },
    { title: 'Екі не үш саусақ', xml: () => RA.SOLUTION_XML, ready: 'Бірінші тапсырманың бағдарламасын іске қос та, тұғырға қоятын затты таңда.',
      goal: 'Әр затты екі саусақпен де, үш саусақпен де көтер. Екі саусақ: күш датчигін қатты бас. Үш саусақ: оған қоса қызыл карточканы көрсет. Кесте өзі толады.',
      stacks: ['flipperevents_whenPressed'],
      hint: 'Басу қай саусақтарды бүгетінін оң жақ бағандағы «(D) … кезде» тізбектерінен көресің. Shift пен пробелді басып ұста (9 Н), үш саусақ үшін 1 пернесін де бас. Саусақтар қысулы тұрғанда жоғары нұсқарды бас. Тінтуірмен: «Ұстап тұру» батырмасын қос, датчиктің төменгі жағын бас, сосын «Қол басын көтеру» батырмасын бас.' },
    { title: 'Үш саусақ бір батыр\u00ADмамен', xml: () => RA.ONEPRESS_XML, ready: 'Бағдарламаны іске қос та, күш датчигін қатты бас (Shift пен пробел). Карточканы көрсетпе.',
      goal: 'Бағдарламаны жақсарт: қатты басқанда бас бармақ та бүгілсін, ал датчикті жібергенде үшеуі де жазылсын. Карточкасыз.',
      stacks: ['flipperevents_whenPressed'],
      hint: 'Күш датчигінің тізбектері оң жақ бағанда. «(D) қатты басылған кезде» тізбегіне «E ең қысқа жолмен 80 позициясына бару» блогын қос, ал «(D) жіберілген кезде» тізбегіне «E … 0 позициясына бару» блогын қос.' },
    { title: 'Затты ұсын', xml: () => RA.HANDOVER_XML, ready: 'Бағдарламаны іске қос. Күш датчигін баспа, карточка көрсетпе. Сосын қолыңды қашықтық датчигіне жақындат.',
      goal: 'Робот затты адамға өзі ұсынады. Іске қосылған соң қол басы үш саусағын да қысады. Адамның қолы қашықтық датчигіне 10 см-ден жақын келгенде, қол басы өзі ашылады.',
      stacks: ['flipperevents_whenProgramStarts'],
      hint: 'Сол жақта, жоғарыда — «бағдарлама іске қосылғанда» тізбегі. Онда: A 90 позициясына, C — 270, E — 80, сосын «Датчиктер» бөлімінен «(B) жақынырақ 10 см? болғанша күту» (см таңда), сосын A, C және E 0 позициясына.' },
  ];
  const ROWS = [[2, 'Екі саусақ'], [3, 'Үш саусақ']];
  const PORTS = ['A', 'C', 'E'];
  const TOUCH = 0.6, HARD = 7, RED = 9, NEAR = 10;         // Н, SPIKE colour code, cm
  const BACK = 3, HANDOVER = 2;                             // seconds the checks give the fingers

  let root, sim, bl, vm, split;
  let task = 0, watch = {};
  let results = {};                                        // task 2: {2: {cube: {held, text}, …}, 3: {…}}
  let spaceHeld = false, wheelHeld = false, latched = false, lastForce = 0, nudged = -1e9;

  const say = (text, kind) => {
    const s = $('#task-status');
    s.textContent = text;
    s.dataset.kind = kind || '';
  };
  const warn = (text) => { say(text, 'warn'); RA.toast(text, 'warn'); };

  const solved = (i, text) => {
    say(text, 'ok');
    RA.toast(text, 'ok');
    const done = RA.store.get('program.tasks', {});
    if (done[i]) return;
    done[i] = true;
    RA.store.set('program.tasks', done);
    paintTabs();
    if (TASKS.every((t, n) => done[n])) RA.progress.mark('program');
  };

  const paintTabs = () => {
    const done = RA.store.get('program.tasks', {});
    $$('.tasks__tab').forEach((b, i) => {
      b.setAttribute('aria-pressed', i === task);
      b.classList.toggle('is-done', !!done[i]);
    });
  };

  // A reason reads «почему: что случилось»; the cell shows what happened, the why under it.
  const cell = (r) => {
    if (!r) return '<td>…</td>';
    if (r.held) return '<td data-mark="ok">ұстайды</td>';
    const [why, what] = r.text.split(': ');
    return `<td data-mark="slip">${what}<small>${why[0].toLowerCase() + why.slice(1)}</small></td>`;
  };
  const paintTable = () => {
    $('#task-table').innerHTML = `<tr><td></td>${sim.OBJECTS.map((o) => `<th scope="col">${o.name}</th>`).join('')}</tr>`
      + ROWS.map(([k, name]) => `<tr><th scope="row">${name}</th>${sim.OBJECTS.map((o) => cell((results[k] || {})[o.id])).join('')}</tr>`).join('');
  };

  // Task 2: every lift with two or three closed fingers fills its cell.
  const record = (e) => {
    if (task !== 1) return;
    if (!e.kind) return say('Кестеге екі саусақ (қатты басу) немесе үш саусақ (оған қоса қызыл карточка) жазылады. Қазір саусақтар басқаша қысулы.', 'warn');
    results[e.kind] = results[e.kind] || {};
    results[e.kind][e.obj.id] = { held: e.held, text: e.text };
    RA.store.set('program.results', results);
    paintTable();
    if (ROWS.every(([k]) => sim.OBJECTS.every((o) => (results[k] || {})[o.id]))) {
      solved(1, 'Кесте дайын! Жолдарды салыстыр. Бас бармақ затты үшінші жағынан қысады, сондықтан домалақ зат енді домалап кетпейді.');
    }
  };

  const newRound = () => {
    watch = { step: 0, at: sim.time, far: true };
    say(TASKS[task].ready);
  };

  // Brings the stacks a task works with into view: their column at the left edge, from the top of the program down as far as
  // their last block and room for one more under it (the tools and the run buttons cover the bottom 90 px).
  const reveal = () => {
    const ws = bl.workspace, tops = ws.getTopBlocks(false).filter((b) => TASKS[task].stacks.includes(b.type));
    if (!tops.length) return;
    const m = ws.getMetrics(), s = ws.scale, at = tops.map((b) => b.getRelativeToSurfaceXY());
    const x0 = Math.min(...at.map((p) => p.x)), y0 = Math.min(...at.map((p) => p.y));
    const y1 = Math.max(...tops.map((b, i) => at[i].y + b.getHeightWidth().height));
    const top = Math.max(0, Math.min((y1 + 60) * s + 90 - m.viewHeight, (y0 - 30) * s));
    ws.scrollbar.set((x0 - 48) * s - m.contentLeft, top - m.contentTop);
  };

  const select = (i) => {
    task = i;
    RA.store.set('program.task', i);
    const t = TASKS[i];
    $('#task-goal').textContent = t.goal;
    $('#task-hint').textContent = t.hint;
    $('#task-hint').hidden = true;
    $('#task-hint-btn').setAttribute('aria-expanded', 'false');
    $('#task-table').hidden = i !== 1;
    paintTabs();
    vm.stop();
    sim.resetTable();
    newRound();
    reveal();
  };

  const code = () => (sim.card ? sim.card.code : -1);
  const allClosed = () => PORTS.every(sim.closed);
  const allOpen = () => PORTS.every(sim.isOpen);

  // Task 1: the red card closes the thumb, and taking the card away has to open it again by program.
  const watchThumb = () => {
    const w = watch, t = sim.time, red = code() === RED;
    if (w.step === 0) {
      if (red && sim.closed('E')) { w.step = 1; say('Бас бармақ бүгілді. Енді карточканы алып таста: 0 пернесі.'); }
      if (!red) w.red = 0;
      else if (!w.red) w.red = t;
      else if (t - w.red > BACK && !w.told) { w.told = true; warn('Қызыл карточка датчиктің алдында, бірақ бас бармақ бүгілмейді. «(F) түсі қызыл болғанда» тізбегін тексер.'); }
    } else if (w.step === 1 && code() === -1) {
      Object.assign(w, { step: 2, at: t });
    } else if (w.step === 2) {
      if (sim.isOpen('E')) { w.step = 3; solved(0, 'Тамаша: карточканы алып тастағанда бас бармақ өзі жазылды.'); }
      else if (t - w.at > BACK) { w.step = 0; warn('Карточканы алып тастадың, бірақ бас бармақ бүгулі күйінде қалды. «(F) түсі түс жоқ болғанда» тізбегіне «E ең қысқа жолмен 0 позициясына бару» блогын қос.'); }
    }
  };

  // Task 3: one hard press closes all three fingers, letting go opens all three. No card, so the press has to move the thumb.
  const watchOnePress = () => {
    const w = watch, t = sim.time, f = sim.force;
    if (code() !== -1) {
      if (w.step) warn('Бұл тапсырма карточкасыз: бас бармақ қатты басқанда бүгілуі керек. Карточканы 0 пернесімен алып таста.');
      w.step = 0;
      return;
    }
    const thumbless = () => (sim.closed('A') && sim.closed('C') ? 'A және C саусақтары бүгілді, ал бас бармақ бүгілмеді. «(D) қатты басылған кезде» тізбегіне «E 80 позициясына бару» блогын қос.'
      : 'Саусақтар бүгілгенше қатты басып ұста: Shift пен пробел.');
    if (w.step === 0 && f >= HARD) Object.assign(w, { step: 1, at: t, told: false });
    if (w.step === 1) {
      if (allClosed()) { w.step = 2; say('Үш саусақ та қысулы. Енді датчикті жібер.'); }
      else if (f < TOUCH) { w.step = 0; warn(thumbless()); }
      else if (t - w.at > BACK && !w.told) { w.told = true; warn(thumbless()); }
    }
    if (w.step === 2 && f < TOUCH) Object.assign(w, { step: 3, at: t });
    if (w.step === 3) {
      const bent = PORTS.filter((p) => !sim.isOpen(p));
      if (!bent.length) { w.step = 4; solved(2, 'Тамаша: бір қатты басу үш саусақты да қысады, ал датчикті жібердің — үшеуі де ашылды.'); }
      else if (f >= TOUCH) w.step = 2;
      else if (t - w.at > BACK) {
        w.step = 0;
        warn(bent.includes('E') ? 'Датчикті жібердің, бірақ бас бармақ бүгулі күйінде қалды. «(D) жіберілген кезде» тізбегіне «E 0 позициясына бару» блогын қос.'
          : `Датчикті жібердің, бірақ ${bent.join(' және ')} ${bent.length > 1 ? 'саусақтары' : 'саусағы'} жазылмады.`);
      }
    }
  };

  // Task 4: the hand closes all three fingers by itself and opens them when a person's hand comes closer than 10 cm.
  const watchHandover = () => {
    const w = watch, t = sim.time, d = sim.distance, near = d !== null && d < NEAR;
    if (sim.force >= TOUCH || code() !== -1) {
      if (w.step >= 0) { w.step = -1; warn('Бұл тапсырмада басу да, карточка да жоқ: қол басы өзі жұмыс істейді. Бағдарламаны тоқтат та, қайта іске қос.'); }
      return;
    }
    if (w.step === 0 && allClosed()) {
      w.step = 1;
      say(near ? 'Саусақтар қысулы. Қолыңды 10 см-ден алысқа әкет, сосын қайта жақындат.' : 'Саусақтар қысулы. Қолыңды қашықтық датчигіне 10 см-ден жақын әкел.');
    } else if (w.step === 0 && t - w.at > BACK && !w.told) {
      w.told = true;
      warn('Іске қосылған соң саусақтар қысылмады. Мына блоктарды «бағдарлама іске қосылғанда» тізбегіне қой: A 90 позициясына, C — 270, E — 80.');
    }
    if (w.step === 1 && near && w.far) Object.assign(w, { step: 2, at: t });
    if (w.step === 2) {
      if (allOpen()) { w.step = 3; solved(3, 'Қол жақын, қол басы затты өзі берді. Датчикке қарап бағдарлама шешеді: бұл — автономия.'); }
      else if (t - w.at > HANDOVER) { w.step = 1; warn('Қол 10 см-ден жақын, бірақ саусақтар 2 секундта ашылмады. Қысқан соң қашықтық датчигі (B) 10 см-ден жақынды көрсеткенше күту керек, сосын A, C және E 0 позициясына барсын.'); }
    }
    w.far = !near;
  };

  const WATCH = [watchThumb, null, watchOnePress, watchHandover];

  const show = (sel, v) => {
    const el = $(sel), text = String(v).replace('-', '−');
    if (el.textContent !== text) el.textContent = text;
  };
  const tick = () => {
    PORTS.forEach((p) => {
      const m = sim.hw.motors[p];
      show(`#read-${p}-angle`, m.position);
      show(`#read-${p}-speed`, m.speedPct);
      show(`#read-${p}-power`, m.powerPct);
    });
    const check = WATCH[task];
    if (vm.running && check && !watch.bent) check();
  };

  const paintForce = (n) => {
    const text = n.toFixed(1).replace('.', ',');
    show('#force-n', text);
    show('#read-D', text + ' Н');
    show('#force-state', n >= HARD ? 'қатты басылған' : n >= TOUCH ? 'басылған' : 'жіберілген');
    root.style.setProperty('--press', n / 10);
  };
  const paintCard = (c) => {
    $$('#cards button').forEach((b, i) => b.setAttribute('aria-pressed', String(c ? sim.CARDS[i] === c : i === sim.CARDS.length)));
    show('#read-F', c ? c.name : 'түс жоқ');
  };
  const paintDistance = (cm) => {
    const text = cm === null ? 'жоқ' : cm + ' см';
    show('#dist-out', text);
    show('#read-B', text);
  };

  const play = () => {
    sim.hw.sound.unlock();
    vm.start();
  };
  const startStop = () => { if (vm.running) vm.stop(); else play(); };

  // Every check watches one run from its start. Tasks 3 and 4 need open fingers then: ones still bent by an earlier run would
  // pass a program that never bends them.
  const onRun = (running) => {
    root.classList.toggle('is-running', running);
    // A program that ends once the fingers are closed would leave the student waiting at «поднеси руку». Status only, no toast:
    // a Stop, a reset or another task land here too, and the last two put their own text in at once.
    if (!running && task === 3 && watch.step === 1) say('Бағдарлама тоқтады, ал саусақтар қысулы күйде. Ол қолды күтуі керек: «(B) жақынырақ 10 см? болғанша күту», сосын A, C және E 0 позициясына.', 'warn');
    if (!running) return;
    watch = { step: 0, at: sim.time, far: true, bent: task >= 2 && !allOpen() };
    if (watch.bent) warn('Саусақтар алдыңғы іске қосудан бері бүгулі тұр. «Үстелді қалпына келтіру» батырмасын бас та, бағдарламаны қайта іске қос.');
  };

  // Pressing while nothing runs: say so once, not on every press.
  const nudge = () => {
    if (vm.running || performance.now() - nudged < 6000) return;
    nudged = performance.now();
    RA.toast('Бағдарлама іске қосылмаған. Домалақ іске қосу батырмасын бас.');
  };

  const leds = [];
  const onHw = (e) => {
    vm.dispatch(e);
    if (e.type === 'center') startStop();
    if (e.type === 'display') e.px.forEach((v, i) => { leds[i].style.opacity = v / 100; });
    if (e.type === 'light') $('#hub-center').style.setProperty('--light', e.css);
    if (e.type === 'force') {
      if (e.n >= TOUCH && lastForce < TOUCH) nudge();
      lastForce = e.n;
      paintForce(e.n);
    }
    if (e.type === 'card') {
      if (e.card) nudge();
      paintCard(e.card);
    }
    if (e.type === 'distance') paintDistance(e.cm);
    if (e.type === 'button') {
      $('#hub-' + e.side).classList.toggle('is-pressed', e.state === 'pressed');
      if (e.state === 'pressed') nudge();
    }
    if (e.type === 'object') $$('.stand [data-obj]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.obj === (e.obj ? e.obj.id : ''))));
    if (e.type === 'lift') $$('#prog-lift, .stand button').forEach((b) => { b.disabled = e.up; });
    if (e.type === 'held') {
      say(e.held ? `${e.obj.name}: қол басы оны көтеріп, ұстап тұр.` : `${e.obj.name}. ${e.text}.`, e.held ? 'ok' : 'warn');
      record(e);
    }
  };

  // Text fields, menus and dialogs own the keyboard while they are open.
  const typing = () => {
    const a = document.activeElement;
    return (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) || Blockly.WidgetDiv.isVisible()
      || !!Blockly.DropDownDiv.owner_ || !!$('dialog[open]');
  };
  const release = () => { if (!latched) sim.setForce(0); };
  const letGo = () => {
    spaceHeld = wheelHeld = false;
    release();
    sim.press('left', false);
    sim.press('right', false);
  };
  const onKey = (e) => {
    const down = e.type === 'keydown';
    if (e.code === 'Space') {
      if (!down) {
        if (spaceHeld) { e.preventDefault(); spaceHeld = false; release(); }
        return;
      }
      if (spaceHeld) return e.preventDefault();
      // A control focused from the keyboard keeps its own Space. Pointer clicks blur, see wire().
      const a = document.activeElement;
      if (typing() || (a !== document.body && a.matches('a, button, [tabindex]') && a.id !== 'force-btn')) return;
      e.preventDefault();
      spaceHeld = true;
      sim.setForce(e.shiftKey ? 9 : 4);
      return;
    }
    if (!down || e.repeat || typing() || e.ctrlKey || e.metaKey || e.altKey) return;
    const card = /^(Digit|Numpad)([0-6])$/.exec(e.code);
    if (card) {
      e.preventDefault();
      sim.setCard(+card[2] ? sim.CARDS[card[2] - 1] : null);
    } else if (e.code === 'ArrowUp' && document.activeElement !== split) {
      e.preventDefault();
      sim.lift();
    }
  };

  const setSplit = (pct) => {
    // The left panel keeps room beside the palette for the tools and the run buttons.
    const w = root.clientWidth, min = ((bl.workspace.getMetrics().absoluteLeft + 345) / w) * 100, max = 100 - (320 / w) * 100;
    pct = Math.min(max, Math.max(min, pct));
    root.style.setProperty('--split', pct + '%');
    return pct;
  };

  const build = () => {
    const tabs = $('#task-tabs');
    TASKS.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tasks__tab';
      b.innerHTML = '<span class="tasks__pin" aria-hidden="true"></span><span class="tasks__name"></span>';
      b.lastChild.textContent = t.title;
      b.onclick = () => { if (i !== task) select(i); };
      tabs.append(b);
    });
    const box = $('#hub-leds');
    for (let i = 0; i < 25; i++) leds.push(box.appendChild(document.createElement('i')));
    $('#cards').innerHTML = sim.CARDS.map((c, i) => `<button type="button" style="--card:${c.css}" aria-label="Карточка: ${c.name}, ${i + 1} пернесі" title="${c.name}">${i + 1}</button>`).join('')
      + '<button type="button" class="cards__off" aria-label="Карточканы алып тастау, 0 пернесі">алу</button>';
  };

  const wire = () => {
    $('#task-hint-btn').onclick = (e) => {
      const hint = $('#task-hint');
      hint.hidden = !hint.hidden;
      e.currentTarget.setAttribute('aria-expanded', !hint.hidden);
    };
    $('#task-solution').onclick = () => {
      const xml = TASKS[task].xml();
      if (!xml) return RA.toast('Шешімі әлі дайын емес.', 'warn');
      Blockly.confirm('Бағдарламаңды дайын шешіммен ауыстырасың ба? Сенің блоктарың жоғалады.', (ok) => {
        if (!ok) return;
        vm.stop();
        bl.load(xml);
        reveal();
        say('Шешім жүктелді. Іске қосу батырмасын бас та, тексер.');
      });
    };
    $('#task-reset').onclick = () => {
      vm.stop();
      sim.resetTable();
      newRound();
    };
    $('#task-restart').onclick = () => {
      Blockly.confirm('Қайтадан бастайсың ба? Бастапқы бағдарлама қайтады. Тапсырмалардың белгілері, сынақ кестесі, қармауыш паспорты және тест нәтижесі өшеді.', (ok) => {
        if (!ok) return;
        RA.store.remove(['done', 'program.tasks', 'program.xml', 'program.task', 'program.results', 'lessonQuiz', 'lessonDesign', 'examples.seen']);
        location.reload();
      });
    };
    $('#prog-play').onclick = play;
    $('#prog-stop').onclick = () => vm.stop();
    $('#hub-center').onclick = startStop;
    $('#prog-lift').onclick = () => sim.lift();
    $$('.stand [data-obj]').forEach((b) => { b.onclick = () => sim.setObject(b.dataset.obj || null); });
    $$('#cards button').forEach((b, i) => { b.onclick = () => sim.setCard(sim.CARDS[i] || null); });
    $('#dist').addEventListener('input', (e) => { const v = +e.target.value; sim.setDistance(v > 40 ? null : v); });

    $('#prog-tools').onclick = (e) => {
      const b = e.target.closest('[data-tool]'), ws = bl.workspace;
      if (!b) return;
      ({ fit: () => { ws.zoomToFit(); ws.setScale(ws.scale * 0.75); ws.scrollCenter(); }, out: () => ws.zoomCenter(-1), in: () => ws.zoomCenter(1), undo: () => ws.undo(false), redo: () => ws.undo(true) })[b.dataset.tool]();
    };

    ['left', 'right'].forEach((side) => {
      const b = $('#hub-' + side);
      b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); sim.press(side, true); });
      ['pointerup', 'pointercancel'].forEach((n) => b.addEventListener(n, () => sim.press(side, false)));
    });
    // The force wheel: where the pointer presses sets the force, 2,5 Н at the top edge (less is touch only, as the lesson says), 10 Н at the bottom.
    // «Держать» keeps the press after the pointer lets go: one mouse can then press and lift.
    const wheel = $('#force-btn');
    const at = (e) => { const r = wheel.getBoundingClientRect(); return 2.5 + 7.5 * Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)); };
    wheel.addEventListener('pointerdown', (e) => { wheel.setPointerCapture(e.pointerId); wheelHeld = true; sim.setForce(at(e)); });
    wheel.addEventListener('pointermove', (e) => { if (wheelHeld) sim.setForce(at(e)); });
    ['pointerup', 'pointercancel'].forEach((n) => wheel.addEventListener(n, () => { if (!wheelHeld) return; wheelHeld = false; release(); }));
    $('#force-latch').onclick = (e) => {
      latched = !latched;
      e.currentTarget.setAttribute('aria-pressed', String(latched));
      if (!latched && !spaceHeld) sim.setForce(0);
    };

    // A click leaves focus on the control, and then Space would press it instead of the force sensor.
    root.addEventListener('click', (e) => {
      const a = document.activeElement;
      if (e.detail && a && a !== document.body && !typing()) a.blur();
    });
    // The slider keeps the keyboard while focused: let go of it once the pointer is done, so the keys work again.
    $('#dist').addEventListener('change', (e) => { if (!e.target.matches(':focus-visible')) e.target.blur(); });

    split = $('#prog-split');
    split.addEventListener('pointerdown', (e) => {
      split.setPointerCapture(e.pointerId);
      split.classList.add('is-moving');
    });
    split.addEventListener('pointermove', (e) => {
      if (!split.classList.contains('is-moving')) return;
      const r = root.getBoundingClientRect();
      RA.store.set('program.split', setSplit(((e.clientX - r.left) / r.width) * 100));
    });
    ['pointerup', 'pointercancel'].forEach((n) => split.addEventListener(n, () => split.classList.remove('is-moving')));
    split.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const now = parseFloat(root.style.getPropertyValue('--split')) || 58;
      RA.store.set('program.split', setSplit(now + (e.key === 'ArrowLeft' ? -2 : 2)));
    });
  };

  RA.view('program', {
    init(el) {
      root = $('#prog', el);
      sim = RA.createSim($('#prog-stage'));
      build();
      results = RA.store.get('program.results', {});
      paintTable();
      const saved = RA.store.get('program.split', 0);
      if (saved) root.style.setProperty('--split', saved + '%');
      const host = $('#prog-blockly');
      bl = RA.createBlocks(host, { onChange: () => RA.store.set('program.xml', bl.save()) });
      const starter = RA.STARTER_XML || '<xml></xml>';
      try { bl.load(RA.store.get('program.xml', null) || starter); } catch (e) { bl.load(starter); }
      root.style.setProperty('--palette', bl.workspace.getMetrics().absoluteLeft + 'px');
      new ResizeObserver(() => { if (RA.current === 'program') Blockly.svgResize(bl.workspace); }).observe(host);

      vm = RA.createVM(bl.workspace, sim.hw, { onState: onRun });
      sim.hw.onEvent(onHw);
      sim.onTick = tick;
      wire();
      paintForce(0);
      paintCard(null);
      paintDistance(null);
      select(Math.min(RA.store.get('program.task', 0), TASKS.length - 1));
      // Only now the task text is in and the panel has its size. The program comes in two columns: the whole of it when that is
      // still readable (scale 0.55 or more), else the left one, which has the start and the colour stacks. Never above the usual 0.8,
      // never below 0.5: a phone cannot fit it at a readable size, it scrolls.
      const ws = bl.workspace;
      Blockly.svgResize(ws);                     // Blockly still has the size from before the task text
      const m = ws.getMetrics(), right = (blocks) => Math.max(...blocks.map((b) => b.getRelativeToSurfaceXY().x + b.getHeightWidth().width), 1);
      const tops = ws.getTopBlocks(false), x0 = Math.min(...tops.map((b) => b.getRelativeToSurfaceXY().x));
      const fit = (blocks) => (m.viewWidth - 30) / (right(blocks) + 30);
      const all = fit(tops);
      ws.setScale(Math.max(0.5, Math.min(0.8, all >= 0.55 ? all : fit(tops.filter((b) => b.getRelativeToSurfaceXY().x < x0 + 200)))));
      const at = ws.getMetrics();
      ws.scrollbar.set(-at.contentLeft, -at.contentTop);       // a new scale moves the blocks: put the origin back in the corner, as load() does
      reveal();
      RA.program = { sim, bl, vm, select, get results() { return results; }, get task() { return task; }, get watch() { return watch; } };   // QA and the console reach the live objects here
    },
    enter() {
      Blockly.svgResize(bl.workspace);
      sim.start();
      addEventListener('keydown', onKey);
      addEventListener('keyup', onKey);
      addEventListener('blur', letGo);
    },
    leave() {
      vm.stop();
      sim.stop();
      letGo();
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKey);
      removeEventListener('blur', letGo);
      Blockly.hideChaff();
      Blockly.DropDownDiv.hideWithoutAnimation();
      // Delete on another view must not eat the block that was last selected here.
      if (Blockly.selected) Blockly.selected.unselect();
    },
  });
})();
