// "В жизни": one shared stage, six stories from RA.SCENES swapped inside it, a caption timeline read from the same phase table.
(function () {
  const RA = window.RA, $ = RA.$;
  const FADE = 0.35; // shortcut: a dip to the background hides the reset at the loop point, make each loop seamless if the dip ever distracts
  const LEVELS = ['Қолмен', 'Бағдарлама', 'Автономия'];
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
    // https://blog.robotiq.com/knowledge/how-object-detection-works-on-robotiq-grippers : no tactile sensors; from finger position and motor current
    //   the gripper reports when its fingers stop on an object
    factory: {
      title: 'Зауыт', tag: '3 саусақ', grip: 'Үш саусақты қармауыш',
      where: 'Цех немесе зертхана. Қармауышты роботтың қолына орнатады.',
      does: 'Пішіні мен өлшемі әртүрлі бөлшектерді алады: домалақ, жалпақ, ұсақ. Ол үшін қармауышты ауыстырудың қажеті жоқ.',
      how: 'Үш саусақ: біреуі қалған екеуіне қарама-қарсы тұр. Саусақ бірнеше жерінен бүгіледі: ол бөлшекке тірелгенше жабыла береді де, оның пішінін өзі қайталайды. Орап алғанда саусақтар 10 кг-ға дейін ұстайды, ал тек ұштарымен — 2,5 кг-ға дейін.',
      sensors: 'Бөлек жанасу датчиктері жоқ. Қармауыш саусақтардың бөлшекке тірелгенін байқап, бұл туралы роботқа хабарлайды.',
      level: 1, auto: 'Қайда созылу және қашан қысу керегін роботтың бағдарламасы белгілейді. Ал бөлшектің пішініне саусақтар бағдарламасыз-ақ өздері бейімделеді.',
      common: 'Мұнда да үш саусақ, бас бармақ та қалған екеуіне қарай бұрылады. Бірақ біздің саусақтарымыз иілмейді: әрқайсысы өз моторымен тұтас бұрылады.',
    },
    // Robonaut 2 (NASA and General Motors).
    // https://www.nasa.gov/robonaut2/ : NASA and GM; launched 24 February 2011 on Discovery; the first humanoid robot in space; head full of cameras
    // https://www.space.com/14590-space-robot-astronaut-handshake-robonaut-2.html : the first humanoid robot to fly in space, NASA with GM, delivered February 2011
    // https://technology.nasa.gov/patent/MSC-TOPS-102 : tendons move the fingers, a human-like thumb, motors and electronics in the forearm
    // https://spectrum.ieee.org/how-robonaut-2-will-help-astronauts-in-space : five fingers, 4 of the 12 degrees of freedom in the thumb, tendon driven; stereo cameras
    // https://education.nationalgeographic.org/resource/robot-robonaut-2 : two cameras as a stereo pair for depth; force sensors give it a sense of touch
    // https://ntrs.nasa.gov/api/citations/20120002793/downloads/20120002793.pdf ("Robonaut 2 - Initial activities on-board the ISS", 2012) : a task board
    //   with buttons, switches and valves to practise on; the crew or the ground team ran semi-autonomous scripts and both watched; teleoperation too
    // https://artsandculture.google.com/asset/robonaut-measures-air-velocity-in-the-u-s-laboratory/8QGWfpfnl99DsQ (NASA photo ISS030-E-177178, 14 March 2012) : R2 measures air velocity at a vent
    // https://www.nasa.gov/image-article/robonaut-operates-task-board-space and https://www.gpsdaily.com/reports/Crew_Wraps_Up_Robonaut_Testing_999.html (January 2013) :
    //   ground teams commanded R2 to turn toggle and metering valves on the task board
    // https://www.nasa.gov/image-article/astronaut-chris-cassidy-robonaut-2-2 (ISS036-E-029109, 2013) : an astronaut in a vest, gloves and visor moves R2's arms and fingers with his own
    robonaut: {
      title: 'Ғарыш', tag: '5 саусақ', grip: 'Робонавт 2-нің қол басы',
      where: 'Халықаралық ғарыш станциясы. Робонавт 2 станцияға 2011 жылы ұшып келіп, ғарыштағы алғашқы адам тәрізді робот болды. Оны NASA мен General Motors жасады.',
      does: 'Экипажға көмектесуді үйренді: жаттығу панелінде батырмаларды басып, ауыстырғыштарды шертіп, вентильдерді бұрады. Адам қолына арналған аспаптармен жұмыс істеді: мысалы, желдеткіштен шыққан ауа ағынын аспаппен өлшеді.',
      how: 'Бес саусақ, бас бармақ басқа саусақтарға қарама-қарсы тұр. Саусақтарды сіңір сияқты жіңішке тростар тартады, ал моторлар білекке жасырылған.',
      sensors: 'Басында камералар бар: олардың екеуі көз сияқты қарап, заттарды көлемді көреді. Саусақтарында күш датчиктері бар, олар роботқа сипап сезу қабілетін береді.',
      level: 1, auto: 'Қарапайым тапсырмаларды робот бағдарлама бойынша орындайтын, ал Жердегі және станциядағы адамдар оны бақылап отыратын. Сондай-ақ ғарышкер виртуалды шындық дулығасын, қолғап пен кеудеше киетін, сонда робот оның қимылдарын қайталайтын.',
      common: 'Біздің қол басымыздағыдай, бас бармақ басқа саусақтарға қарай бұрылады. Тек бізде саусақ үшеу және әрқайсысы өз моторымен бұрылады, ал мұнда саусақтарды білектегі моторлардан келетін жіңішке тростар тартады.',
    },
    // OpenAI, a Shadow Dexterous Hand solves a Rubik's cube (2019).
    // https://openai.com/index/solving-rubiks-cube/ : trained in simulation, Kociemba's algorithm picks the moves; solved 60 % of the time, 20 % for the hardest scrambles
    // https://arxiv.org/abs/1910.07113 (OpenAI's paper) : Shadow Dexterous E Series Hand; three RGB cameras estimate the cube's pose; a cube with built-in sensors
    // https://venturebeat.com/ai/openai-teaches-a-robotic-hand-to-solve-a-rubiks-cube : about 13,000 years of simulated experience; 60 % at 15 turns, 20 % at 26
    // https://www.deeplearning.ai/the-batch/cube-controversy : 13,000 years; the solving algorithm is not learned; the cube carried sensors
    // https://www.shadowrobot.com/dexterous-hand/ : 20 motor-driven and 4 under-actuated joints, 24 in all; tendons from motors in the forearm
    rubik: {
      title: 'Рубик текшесі', tag: '5 саусақ', grip: 'Shadow қол басы',
      where: 'OpenAI компаниясының зертханасы, 2019 жыл.',
      does: 'Бір қол басы Рубик текшесін жинайды: оны алақанында ұстап, саусақтарымен бұрайды.',
      how: 'Бес саусақ және 24 буын. Білекте 20 мотор бар, олар саусақтарды жіңішке тростармен тартады.',
      sensors: 'Үш камера текшенің қайда екенін және қалай бұрылып тұрғанын бақылайды. Текшенің өзіне датчиктер орнатылған: олар оның қабаттары қалай бұрылғанын хабарлайды.',
      level: 2, auto: 'Саусақтарды қалай қозғау керегін нейрондық желі шешеді. Ол компьютерлік симуляцияда үйреніп, шамамен 13 000 жылдық тәжірибе жинады. Бұраулардың ретін дайын бағдарлама есептейді. Әрдайым сәтті бола бермейді: ең көп араластырылған текшені қол 100 әрекеттің 20-сында жинады, оңайырағын — 100 әрекеттің 60-ында.',
      common: 'Біздің қол басымыздың бағдарламасын адам жазады: күш датчигі басылды — саусақ бүгілді. Ал мұнда саусақтардың қимылын ешкім бағдарламаламаған: нейрондық желі оларды қайта-қайта байқап көріп, өзі тапқан.',
    },
    // e-NABLE, wrist-powered 3D-printed hands.
    // https://enablingthefuture.org/faqs-general/ : a worldwide group of volunteers; $20 to $50 of materials per hand; at least 30 degrees of wrist motion;
    //   do not carry more than 2 pounds with it
    // https://enablingthefuture.org/wrist-powered/ : bending the wrist makes the fingers close and open
    // https://en.wikipedia.org/wiki/E-NABLE : body-powered hands; cables on the front of the fingers close them, elastics in channels on the back open them
    // https://bmedesign.engr.wisc.edu/public/projects/f18/enable_hold/file/view/62a1f5d2-90f0-478d-84a4-03373be6da28/Final%20Report.pdf (University of Wisconsin) :
    //   flexing the wrist tensions the flexor cords that close the fingers; elastic cords on the back of the fingers open the hand again
    // https://www.popsci.com/lets-give-kids-3-d-printed-hand/ : volunteers print hands for children; cheap enough to print a bigger one as a child grows
    // https://www.massdevice.com/volunteers-use-3d-printers-create-inexpensive-prosthetics/ : $15 to $50 a hand; the plastic is too weak for heavy loads
    printed: {
      title: 'Принтерде басылған протез', tag: '5 саусақ', grip: '3D-принтерде басылған қол басы',
      where: 'Үйде, мектепте, көшеде. Мұндай қол бастарын әр елдегі e-NABLE қауымдастығының еріктілері 3D-принтерлерде басып шығарады. Оларды көбінесе балалар алады.',
      does: 'Жеңіл затты алып, ұстап тұруға көмектеседі. Бөлшектері бірнеше ондаған доллар тұрады, сондықтан бала өскенде үлкенірек қол басын басып шығаруға болады.',
      how: 'Шарнирлі бес пластик саусақ. Саусақтарға сіңір сияқты баулар тартылған. Білезікті бүксең, баулар керіледі: саусақтар бүгіледі. Жазсаң, резеңкелер саусақтарды ашады.',
      sensors: 'Датчик те, мотор да, батарея да жоқ. Бәрі білезіктің қимылымен жұмыс істейді.',
      level: 0, auto: 'Тек қолмен басқару: адам білезігін бүгіп, саусақтарды өзі бүгеді. Ол үшін білезік кемінде 30 градусқа бүгілуі керек.',
      common: 'Оны да біздікі сияқты бөлшектерден қолмен құрастырады. Тек біздің қол басымыздың саусақтарын бағдарламаның командасымен моторлар бүгеді, ал мұнда — адамның өзі, білезігін қимылдатып.',
    },
    // OceanOne, Stanford University's robot diver (2016).
    // https://news.stanford.edu/2016/04/27/robotic-diver-recovers-treasures/ : 2016, La Lune, Louis XIV's flagship sunk in 1664, 100 m deep, a vase, the pilot feels the grip;
    //   force sensors in the wrists; sensors gauge current and turbulence and switch on the thrusters by themselves to keep the robot in place
    // https://newatlas.com/oceanone-diving-humanoid-robot/43039 : 100 m off southern France, a grapefruit-sized vase, force sensors send touch feedback to the pilot
    // https://engineering.stanford.edu/news/robotic-diver-connects-humans-sight-and-touch-deep-sea : stereoscopic vision, touch feedback, eight thrusters
    // https://edg.berkeley.edu/publication/the-ocean-one-hands/ and https://bdml.stanford.edu/Main/UnderwaterManipulation (IJRR 2017) :
    //   one motor drives three fingers through tendons with springs; gentle with finds, strong enough for tools
    // https://www.machinedesign.com/news/humanoid-robot-handles-delicate-difficult-deep-sea-missions : the pilot steers with joysticks from a boat; force sensors in the wrists
    ocean: {
      title: 'Су астында', tag: '3 саусақ', grip: 'OceanOne қолдары',
      where: 'Франция жағалауына жақын Жерорта теңізі, тереңдігі шамамен 100 метр. Онда король Людовик XIV-нің «Ай» деген кемесі жатыр, ол 1664 жылы суға батқан.',
      does: '2016 жылы Стэнфорд университетінің OceanOne сүңгуір роботы теңіз түбінен көлемі грейпфруттай көне вазаны көтеріп шықты және оны сындырмады.',
      how: 'Әр қолында үш саусақ бар, үшеуін де бір мотор серіппелі жіңішке тростар арқылы бүгеді. Сондықтан саусақтар заттың пішінін жұмсақ қайталайды: сынғыш вазаны да, құралды да ұстайды.',
      sensors: 'Басындағы камералар көз сияқты заттарды көлемді көреді. Білезіктерінде күш датчиктері бар: пилот заттың ауыр не жеңіл екенін өз қолымен сезеді және тым қатты қыспайды.',
      level: 0, auto: 'Роботты пилот кемеден жүргізеді: оның камералары арқылы қарап, қолдарын джойстиктермен қозғайды. Ал бір орында робот өзі тұрады: датчиктер ағысты сезіп, құйрығындағы сегіз қозғалтқышты қосады.',
      common: 'Мұнда да үш саусақ, бірақ OceanOne роботында оларды бір мотор бүгеді, ал біздің қол басымызда әр саусақтың өз моторы бар. Бізде де күш датчигі бар, тек оны адам басады. Ал OceanOne роботының күш датчиктері білезіктерінде, пилот олар арқылы қолдың не ұстап тұрғанын сезеді.',
    },
    // Moley Robotics' robot kitchen (2015).
    // https://www.engadget.com/2015/04/14/robot-arms-will-cook-your-meals-like-a-masterchef/ : shown at Hannover Messe 2015, two arms copy chef Tim Anderson's movements
    // https://time.com/3819525/robot-chef-moley-robotics/ : hands by the Shadow Robot Company; crab bisque in under half an hour, the only dish it can make
    // https://www.popsci.com/robot-can-make-you-dinner : 20 motors, 24 joints, 129 sensors; it learns by copying a human chef
    // https://www.smithsonianmag.com/innovation/robot-make-me-dinner-180957535/ and https://www.kcur.org/2015-04-19/this-robot-chef-has-mastered-crab-bisque (NPR) : the same 20 / 24 / 129
    // https://www.pbs.org/newshour/world/robotic-chef-prepare-meals-homes-starting-2017 : Anderson's movements were recorded while he cooked the crab bisque
    // https://www.shadowrobot.com/dexterous-hand/ : a Shadow hand has five fingers, 24 joints, 20 motors, over 100 sensors
    kitchen: {
      title: 'Ас үй', tag: '2 × 5 саусақ', grip: 'Бес саусақты екі қол басы',
      where: 'Ганновердегі көрме, 2015 жыл. Робот ас үйді Moley Robotics компаниясы көрсетті.',
      does: 'Екі қол жарты сағатқа жетпей краб сорпасын пісірді.',
      how: 'Қол бастарын Shadow Robot компаниясы жасаған. Әрқайсысында бес саусақ, 24 буын және 20 мотор бар. Олар адам қолдарының қимылдарын қайталайды.',
      sensors: 'Қол бастарында жүзден астам датчик бар. Ал аспаздың қимылдарын ол осы сорпаны өзі пісіріп жатқанда алдын ала жазып алған.',
      level: 1, auto: 'Робот ештеңені өзі ойлап таппайды: ол аспаз Тим Андерсонның жазып алынған қимылдарын қайталайды. 2015 жылы ол тек осы сорпаны пісіре алатын.',
      common: 'Біздің қол басымызды да қимылдарды қайталауға үйретуге болады: бағдарлама әр моторға қайда бұрылу керегін айтады. Тек бізде үш мотор, ал бұл қол бастарының әрқайсысында — жиырма.',
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
    ui.toggle.setAttribute('aria-label', playing ? 'Үзіліс' : 'Көру');
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
