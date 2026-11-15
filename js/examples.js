// "В жизни": one shared stage, six stories from RA.SCENES swapped inside it, a caption timeline read from the same phase table.
(function () {
  const RA = window.RA, $ = RA.$;
  const FADE = 0.35; // shortcut: a dip to the background hides the reset at the loop point, make each loop seamless if the dip ever distracts
  const LEVELS = ['Ручное', 'Программа', 'Автономия'];
  const ease = (x) => x * x * x * (x * (6 * x - 15) + 10);
  const at = (list, t) => { // last entry that has started by time t
    let i = list.length - 1;
    while (i && t < list[i].t0) i--;
    return i;
  };
  // The verified facts of each story, merged into RA.SCENES (motion and captions, scenes.js) by id. Sources above each story.
  const FACTS = {
    // Robotiq 3-Finger Adaptive Robot Gripper.
    // https://blog.robotiq.com/bid/72861/more-than-just-a-parallel-gripper-how-does-it-works : underactuated fingers adapt to the shape; 10 kg wrapped, 2.5 kg fingertips
    // https://www.universal-robots.com/marketplace/products/01tP40000071NgLIAU : four grip modes, wraps 20 to 155 mm, 10 kg form-fit, 2.5 kg friction grip
    // https://legacy.cs.indiana.edu/ftp/techreports/TR711.pdf (Indiana University) : the fingers adapt to the object's shape as the motor closes them
    // https://blog.robotiq.com/hubfs/eBooks/Robotiq-3-Finger-Adaptive-Gripper-Simulation-Data-V1.1.pdf : finger A stands in front of fingers B and C
    // https://blog.robotiq.com/knowledge/how-object-detection-works-on-robotiq-grippers : the gripper reports when its fingers stop on an object
    factory: {
      title: 'Завод', tag: '3 пальца', grip: 'Трёхпальцевый захват',
      where: 'Цех или лаборатория. Захват ставят на руку робота.',
      does: 'Берёт детали разной формы и размера: круглые, плоские, мелкие. Менять захват для этого не нужно.',
      how: 'Три пальца: один стоит напротив двух. Палец сгибается в нескольких местах: он закрывается, пока не упрётся в деталь, и сам ложится по её форме. Обхватом пальцы держат до 10 кг, одними кончиками до 2,5 кг.',
      sensors: 'Отдельных датчиков касания нет. Захват замечает, что пальцы упёрлись в деталь, и сообщает об этом роботу.',
      level: 1, auto: 'Куда тянуться и когда сжать, задаёт программа робота. А под форму детали пальцы подстраиваются сами, без программы.',
      common: 'Тоже три пальца, и один напротив двух, как у нашей кисти. Только наши пальцы не гнутся: каждый поворачивается целиком на своём моторе.',
    },
    // Robonaut 2 (NASA and General Motors).
    // https://www.nasa.gov/robonaut2/ : NASA and GM; launched 24 February 2011 on Discovery; the first humanoid robot in space; head full of cameras
    // https://www.space.com/14590-space-robot-astronaut-handshake-robonaut-2.html : the first humanoid robot to fly in space, NASA with GM, delivered February 2011
    // https://technology.nasa.gov/patent/MSC-TOPS-102 : tendons move the fingers, a human-like thumb, motors and electronics in the forearm
    // https://spectrum.ieee.org/how-robonaut-2-will-help-astronauts-in-space : five fingers, 4 of the 12 degrees of freedom in the thumb, tendon driven; stereo cameras
    // https://education.nationalgeographic.org/resource/robot-robonaut-2 : two cameras as a stereo pair for depth; force sensors give it a sense of touch
    // https://ntrs.nasa.gov/citations/20130010237 : on the station it pressed buttons, flipped switches, turned knobs, measured air flow with a hand-held meter
    // https://www.nasa.gov/image-article/astronaut-chris-cassidy-robonaut-2-2 : an astronaut in a vest, gloves and visor moves R2's arms and fingers with his own
    // https://ntrs.nasa.gov/api/citations/20120002793/downloads/20120002793.pdf : teleoperation with a VR helmet; supervised autonomy watched by an operator
    robonaut: {
      title: 'Космос', tag: '5 пальцев', grip: 'Кисть Робонавта 2',
      where: 'Международная космическая станция. Робонавт 2 прилетел туда в 2011 году и стал первым человекоподобным роботом в космосе. Его сделали NASA и General Motors.',
      does: 'Помогает экипажу: нажимает кнопки, щёлкает переключателями, крутит ручки. Берёт приборы, сделанные для руки человека: например, прибором мерил, как дует воздух из вентиляции.',
      how: 'Пять пальцев, большой палец стоит напротив остальных. Пальцы тянут тросики, как сухожилия, а моторы спрятаны в предплечье.',
      sensors: 'В голове камеры: две из них смотрят как глаза и видят объём. В пальцах датчики силы, они дают роботу чувство касания.',
      level: 0, auto: 'Чаще им управлял человек: астронавт надевал шлем виртуальной реальности, перчатки и жилет, и робот повторял его движения. Простые задания робот выполнял сам, а люди следили.',
      common: 'Большой палец напротив других пальцев, как у нашей кисти. Только у нас пальцев три и каждый поворачивает свой мотор, а здесь пальцы тянут тросики из предплечья.',
    },
    // OpenAI, a Shadow Dexterous Hand solves a Rubik's cube (2019).
    // https://openai.com/index/solving-rubiks-cube/ : trained in simulation, Kociemba's algorithm picks the moves; solved 60 % of the time, 20 % for the hardest scrambles
    // https://arxiv.org/abs/1910.07113 (OpenAI's paper) : Shadow Dexterous E Series Hand; three RGB cameras estimate the cube's pose; a cube with built-in sensors
    // https://venturebeat.com/ai/openai-teaches-a-robotic-hand-to-solve-a-rubiks-cube : about 13,000 years of simulated experience; 60 % at 15 turns, 20 % at 26
    // https://www.deeplearning.ai/the-batch/cube-controversy : 13,000 years; the solving algorithm is not learned; the cube carried sensors
    // https://www.shadowrobot.com/dexterous-hand/ : 20 motor-driven and 4 under-actuated joints, 24 in all; tendons from motors in the forearm
    rubik: {
      title: 'Кубик Рубика', tag: '5 пальцев', grip: 'Кисть Shadow',
      where: 'Лаборатория компании OpenAI, 2019 год.',
      does: 'Одна кисть собирает кубик Рубика: держит его на ладони и поворачивает пальцами.',
      how: 'Пять пальцев и 24 сустава. В предплечье 20 моторов, они тянут пальцы тросиками.',
      sensors: 'Три камеры смотрят, где кубик и как он повёрнут. В сам кубик встроены датчики: они сообщают, как повёрнуты его слои.',
      level: 2, auto: 'Как двигать пальцами, решает нейросеть. Она училась в компьютерной симуляции, и опыта там набралось примерно на 13 000 лет. Порядок поворотов считает готовая программа. Получается не всегда: самый запутанный кубик рука собирала 20 раз из 100, попроще 60 раз из 100.',
      common: 'Нашей кисти программу пишет человек: нажали датчик силы, и палец закрылся. А здесь движения пальцев никто не программировал: нейросеть нашла их сама, пробуя снова и снова.',
    },
    // e-NABLE, wrist-powered 3D-printed hands.
    // https://enablingthefuture.org/faqs-general/ : a worldwide group of volunteers; $20 to $50 of materials per hand; needs at least 30 degrees of wrist motion
    // https://enablingthefuture.org/wrist-powered/ : bending the wrist makes the fingers close and open; the wrist must bend at least 30 degrees
    // https://bmedesign.engr.wisc.edu/projects/f18/enable_lateral/file/view/e3f64f4a-5800-42cc-87cc-8df28492f860/Final%20Report.pdf (University of Wisconsin) :
    //   bending the wrist pulls the cords that curl the fingers, elastic cords open the hand again
    // https://www.popsci.com/lets-give-kids-3-d-printed-hand/ : volunteers print hands for children; cheap enough to print a bigger one as a child grows
    // https://www.massdevice.com/volunteers-use-3d-printers-create-inexpensive-prosthetics/ : $15 to $50 a hand; the plastic is too weak for heavy loads
    printed: {
      title: 'Протез из принтера', tag: '5 пальцев', grip: 'Кисть из 3D-принтера',
      where: 'Дома, в школе, на улице. Такие кисти печатают на 3D-принтерах волонтёры сообщества e-NABLE в разных странах. Часто их получают дети.',
      does: 'Помогает взять и удержать лёгкую вещь, например мяч. Детали стоят несколько десятков долларов, поэтому, когда ребёнок вырастет, можно напечатать кисть побольше.',
      how: 'Пять пластиковых пальцев на шарнирах. К пальцам идут шнуры, как сухожилия. Согнул запястье, и шнуры натянулись: пальцы сжались. Разогнул, и резинки раскрыли пальцы.',
      sensors: 'Датчиков, моторов и батареек нет. Всё работает от движения запястья.',
      level: 0, auto: 'Только ручное управление: пальцы сжимает сам человек, когда сгибает запястье. Для этого запястье должно сгибаться хотя бы на 30 градусов.',
      common: 'Её тоже собирают руками из готовых деталей. Только нашу кисть сжимают моторы по команде программы, а эту сам человек движением запястья.',
    },
    // OceanOne, Stanford University's robot diver (2016).
    // https://news.stanford.edu/2016/04/27/robotic-diver-recovers-treasures/ : 2016, La Lune, Louis XIV's flagship sunk in 1664, 100 m deep, a vase, the pilot feels the grip
    // https://newatlas.com/oceanone-diving-humanoid-robot/43039 : 100 m off southern France, a grapefruit-sized vase, force sensors send touch feedback to the pilot
    // https://engineering.stanford.edu/news/robotic-diver-connects-humans-sight-and-touch-deep-sea : stereoscopic vision, touch feedback, eight thrusters
    // https://edg.berkeley.edu/publication/the-ocean-one-hands/ and https://bdml.stanford.edu/Main/UnderwaterManipulation (IJRR 2017) :
    //   one motor drives three fingers through tendons with springs; gentle with finds, strong enough for tools
    // https://www.machinedesign.com/news/humanoid-robot-handles-delicate-difficult-deep-sea-missions : the pilot steers with joysticks from a boat; force sensors in the wrists
    ocean: {
      title: 'Под водой', tag: '3 пальца', grip: 'Руки OceanOne',
      where: 'Средиземное море у берегов Франции, глубина около 100 метров. Там лежит «Луна», корабль короля Людовика XIV, он затонул в 1664 году.',
      does: 'В 2016 году робот-ныряльщик OceanOne из Стэнфордского университета поднял со дна старинную вазу размером с грейпфрут и не разбил её.',
      how: 'На каждой руке три пальца, все три сгибает один мотор через тросики с пружинами. Поэтому пальцы мягко ложатся по форме вещи: держат и хрупкую вазу, и инструмент.',
      sensors: 'Камеры в голове видят объёмно, как глаза. В запястьях датчики силы: пилот чувствует руками, тяжёлая вещь или лёгкая, и не сжимает слишком сильно.',
      level: 0, auto: 'Робота ведёт пилот с корабля: смотрит его камерами и двигает его руки джойстиками. Восемь двигателей в хвосте помогают роботу плавать.',
      common: 'Тоже три пальца, но у OceanOne их сгибает один мотор, а у нашей кисти у каждого пальца свой. Датчик силы у нас тоже есть, только на него нажимает человек, а у OceanOne он чувствует, как крепко рука держит вещь.',
    },
    // Moley Robotics' robot kitchen (2015).
    // https://www.engadget.com/2015/04/14/robot-arms-will-cook-your-meals-like-a-masterchef/ : shown at Hannover Messe 2015, two arms copy chef Tim Anderson's movements
    // https://time.com/3819525/robot-chef-moley-robotics/ : hands by the Shadow Robot Company; crab bisque in under half an hour, the only dish it can make
    // https://www.popsci.com/robot-can-make-you-dinner : 20 motors, 24 joints, 129 sensors; it learns by copying a human chef
    // https://www.pbs.org/newshour/world/robotic-chef-prepare-meals-homes-starting-2017 : Anderson's movements were recorded while he cooked the crab bisque
    // https://www.shadowrobot.com/dexterous-hand/ : a Shadow hand has five fingers, 24 joints, 20 motors, over 100 sensors
    kitchen: {
      title: 'Кухня', tag: '2 × 5 пальцев', grip: 'Две пятипалые кисти',
      where: 'Выставка в Ганновере, 2015 год. Кухню-робота показала компания Moley Robotics.',
      does: 'Две руки сварили суп из краба меньше чем за полчаса.',
      how: 'Кисти сделала компания Shadow Robot. В каждой пять пальцев, 24 сустава и 20 моторов. Они повторяют даже мелкие движения рук человека.',
      sensors: 'В кистях больше ста датчиков. А движения повара записали заранее, когда он сам варил этот суп.',
      level: 1, auto: 'Робот ничего не придумывает: он повторяет записанные движения повара Тима Андерсона. В 2015 году он умел варить только этот суп.',
      common: 'Нашу кисть тоже можно научить повторять движения: программа говорит каждому мотору, куда повернуться. Только у нас три мотора, а в каждой из этих кистей двадцать.',
    },
  };
  const pose = {};
  let stage, box, ui, cur = null, time = 0, playing = false, step = -1;
  // Ids of stories that no longer exist are dropped, so they cannot count towards the three seen.
  const seen = new Set([].concat(RA.store.get('examples.seen', [])).filter((id) => RA.SCENES.some((s) => s.id === id)));

  // Turns a scene's table into running times, whole poses and caption steps.
  function prepare(sc) {
    sc.poses = [sc.start];
    sc.total = 0;
    sc.steps = [];
    sc.phases.forEach((row, i) => {
      const { s, text, linear, ...to } = row;
      sc.poses.push(Object.assign({}, sc.poses[i], to));
      if (text) sc.steps.push({ text, t0: sc.total, s: 0 });
      sc.steps[sc.steps.length - 1].s += s;
      row.t0 = sc.total;
      sc.total += s;
    });
  }

  function sample(sc, t) {
    const i = at(sc.phases, t), r = sc.phases[i], raw = Math.min(1, (t - r.t0) / r.s), k = r.linear ? raw : ease(raw), a = sc.poses[i], b = sc.poses[i + 1];
    for (const key in b) pose[key] = a[key] + (b[key] - a[key]) * k;
  }

  function paintStep(t) {
    const i = at(cur.steps, t);
    if (i !== step) {
      step = i;
      ui.now.textContent = cur.steps[i].text;
      ui.steps.forEach((el, n) => {
        el.classList.toggle('is-now', n === i);
        el.classList.toggle('is-past', n < i);
        if (n === i) el.setAttribute('aria-current', 'step');
        else el.removeAttribute('aria-current');
      });
    }
    ui.steps[i].style.setProperty('--p', Math.min(1, (t - cur.steps[i].t0) / cur.steps[i].s));
  }

  function draw() {
    const t = time % cur.total;
    sample(cur, t);
    cur.apply(pose, time, t / cur.total);
    paintStep(t);
    if (stage.renderer) stage.renderer.domElement.style.opacity = playing ? Math.min(1, t / FADE, (cur.total - t) / FADE) : 1;
  }

  function paintToggle() {
    ui.toggle.setAttribute('aria-label', playing ? 'Пауза' : 'Смотреть');
    ui.toggle.dataset.state = playing ? 'playing' : 'paused';
    ui.toggle.classList.toggle('is-waiting', !playing && RA.reducedMotion);
  }

  function frameCamera() {
    if (!cur) return;
    // Pull back on narrow canvases so the whole story stays in the frame.
    const fit = Math.max(1, 1.42 / (stage.size.w / stage.size.h));
    const eye = new THREE.Vector3(...cur.camera), target = new THREE.Vector3(...cur.target);
    stage.camera.position.copy(target).addScaledVector(eye.sub(target), fit);
    stage.target.copy(target);
    if (stage.controls) {
      stage.controls.target.copy(target);
      stage.controls.update();
    }
  }

  function fill(sc) {
    ui.grip.textContent = sc.grip;
    $('#ex-where').textContent = sc.where;
    $('#ex-does').textContent = sc.does;
    $('#ex-how').textContent = sc.how;
    $('#ex-sensors').textContent = sc.sensors;
    $('#ex-auto').textContent = sc.auto;
    $('#ex-common').textContent = sc.common;
    RA.$$('#ex-levels span').forEach((el, i) => el.classList.toggle('is-on', i === sc.level));
    ui.stepList.replaceChildren(...sc.steps.map((st) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ex__step';
      b.innerHTML = '<i class="ex__hole"></i><span></span>';
      b.lastChild.textContent = st.text;
      b.addEventListener('click', () => seek(st.t0));
      li.append(b);
      return li;
    }));
    ui.steps = RA.$$('.ex__step', ui.stepList);
    step = -1;
    RA.$$('.ex__item').forEach((el) => {
      const on = el.dataset.id === sc.id;
      el.classList.toggle('is-current', on);
      el.classList.toggle('is-seen', seen.has(el.dataset.id));
      if (on) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
  }

  function show(id) {
    const sc = RA.SCENES.find((s) => s.id === id) || RA.SCENES[0];
    if (sc === cur) return;
    if (cur && cur.root) cur.root.visible = false;
    if (RA.webgl && !sc.root) {
      sc.root = new THREE.Group();
      stage.scene.add(sc.root);
      sc.apply = sc.build(sc.root, stage);
    }
    if (!sc.apply) sc.apply = () => {};
    if (sc.root) sc.root.visible = true;
    cur = sc;
    box.style.background = sc.bg;
    if (stage.renderer) stage.renderer.domElement.setAttribute('aria-label', sc.title + '. ' + sc.does);
    seen.add(sc.id);
    RA.store.set('examples.seen', [...seen]);
    if (seen.size >= 3) RA.progress.mark('examples');
    fill(sc);
    frameCamera();
    playing = !RA.reducedMotion;
    time = playing ? FADE : sc.poster; // a reduced-motion viewer gets a telling still and waits for the button
    paintToggle();
    draw();
  }

  function seek(t) {
    time = t;
    draw();
  }

  function init(view) {
    box = $('#ex-stage', view);
    ui = { now: $('#ex-now', view), stepList: $('#ex-steps', view), toggle: $('#ex-toggle', view), grip: $('#ex-grip', view), steps: [] };
    RA.SCENES.forEach((sc) => prepare(Object.assign(sc, FACTS[sc.id])));
    $('#ex-levels', view).innerHTML = LEVELS.map((l) => '<span>' + l + '</span>').join('');
    $('#ex-list', view).innerHTML = RA.SCENES.map((s) => '<li><button type="button" class="ex__item" data-id="' + s.id + '"><i class="ex__hole"></i>' +
      '<b>' + s.title + '</b><em>' + s.tag + '</em></button></li>').join('');
    $('#ex-list', view).addEventListener('click', (e) => {
      const b = e.target.closest('.ex__item');
      if (b) show(b.dataset.id);
    });
    ui.toggle.addEventListener('click', () => {
      playing = !playing;
      paintToggle();
    });
    stage = RA.stage(box, { fov: 24, near: 4, far: 1400, shadowBox: 76, maxDpr: 1.5, camera: [0, 30, 100], target: [0, 8, 0] });
    if (stage.renderer) {
      stage.key.position.set(-34, 90, 60);
      stage.key.intensity = 1.25; // the scenes bring saturated toy colours, the stage defaults would burn them out
      stage.key.shadow.camera.far = 260;
      stage.key.shadow.camera.updateProjectionMatrix();
      stage.controls.minDistance = 30;
      stage.controls.maxDistance = 240;
      stage.renderer.domElement.style.touchAction = 'pan-y'; // a phone can still scroll the page across the canvas
      stage.renderer.domElement.setAttribute('role', 'img');
    }
    stage.frame((dt) => {
      if (!cur) return;
      if (playing) time += dt;
      draw();
    });
    new ResizeObserver(frameCamera).observe(box);
    show(RA.SCENES[0].id);
  }

  RA.view('examples', {
    init,
    enter() { stage.start(); },
    leave() { stage.stop(); },
  });

  RA.examples = { show, seek, get stage() { return stage; } }; // the QA script drives the stills through this
})();
