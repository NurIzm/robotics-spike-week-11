# «Кисть» — lesson platform, build spec (week 11)

This is the brief written before the build. Where it and the code disagree, the code is right.

The site is for a school robotics lesson for ages ~10-14 with a LEGO SPIKE Prime set. All on-screen text is Russian (a Kazakh copy
comes last, §9). The teacher projects it in class and students use it on school PCs. It is the third and last lesson of the unit
«Манипуляторы и автономия». The teacher's table says: урок «Робот-рука (модель 3). Многопальцевые захваты.», содержание
«Двух-трех пальцевые захваты, улучшения модели, постройка личного захвата.», 1 час, неделя 11, вид деятельности «Сборка и разборка».

Last week's site («Захваты», week 10, `../Week 10`, live at https://nurizm.github.io/robotics-spike-week-10/) is the base: this
repository started as a copy of it (without its Kazakh copy). Same platform, same look, same four views: start, lesson, examples,
program. Change the content, not the platform. Read `../Week 9/src/SPEC.md` once: its hard constraints (§1), shared runtime (§3),
blocks (§6) and visual identity (§10) still hold, and `../Week 10/src/SPEC.md` for what week 10 changed. This file wins where it differs.

## 0. Paths and process

- The site is the repository root. View fragments: `src/views/{start,lesson,examples,program}.html`. Run `node src/build.js` after
  changing a fragment: it stitches them into `index.html`. Do not edit `index.html` by hand.
- `ref/` (git-ignored, never published) holds the model's building instructions and program: read `ref/NOTES.md` first. Every page of
  the PDF is `ref/pdf/page-NN.jpg`; the designer's program is `ref/program/project.json`.
- Do not touch files you do not own (§2). `js/core.js`, `css/style.css`, `src/index.template.html`, `src/build.js` are shared and read-only.
- Headless QA on this machine: Brave + puppeteer-core with software WebGL, see `QA` in the build brief you were given. It is slow
  (5–10 s per page load): test what you changed, not everything every time. A fresh browser per screen size: changing only the
  hash does not reload the page.

## 1. Facts (true, sourced; do not invent others — when unsure, leave it out)

- The model: «SPIKE Manipulator», an alternate build for the LEGO SPIKE Prime set 45678 by the designer Irwin Wu («LAN's MOC»).
  It is not in the SPIKE app: the teacher has the PDF instructions («робо рука 3 моторами и 3 датчиками»). The site calls it «Кисть»
  and credits the designer in the lesson's build section and footer: «Модель SPIKE Manipulator, автор Irwin Wu».
- It uses all the set's electronics: the hub, three motors and three sensors. Ports (designer's program and the PDF):
  **A** — medium motor, палец A; **C** — medium motor, палец C (next to the thumb); **E** — large motor, большой палец, through two
  24-tooth gears; **B** — distance sensor; **D** — force sensor; **F** — colour sensor.
- Each finger is rigid and turns as a whole on its own motor (no joints inside a finger). The thumb's two equal 24-tooth gears
  mesh at a right angle (one stands, one lies on the motor): they turn the motion round a corner, and with equal teeth the ratio
  is 1:1, so the thumb turns through the same angle as the motor. Do not say the gears turn "the other way": at a right angle
  that has no meaning.
- The designer's program («Manipulator 1», `ref/program/project.json`): start: A, C, E speed 100 %, all to position 0 (open).
  (D) when pressed → C to 270 (shortest path, i.e. 90° back); (D) when hard-pressed → A to 90; (D) when released → A to 0, C to 0;
  (F) when colour red → E to 80; (F) when no colour → E to 0. So: light press — one finger, hard press — two fingers, red card —
  the thumb. Fingers A and C are mirror images, which is why one goes to 90 and the other to 270.
- **The palm is the sensor side.** The fingers curl towards the hub's battery side (checked on pages 24, 27, 30, 01, 53 and with
  SPIKE's "positive = clockwise seen from the rotor face": A +90 and C 270 both swing the fingers that way). On that side sit the
  force sensor and the colour sensor (on an upright magenta frame, low) and the distance sensor, which looks out of the palm. The
  hub's screen and the azure cover with the curved slopes are the **back of the hand** («тыльная сторона», «накладка»); pages 01
  and 53 show the back. Seen from the palm the thumb is on the right; seen from the back (as on the PDF cover) on the left.
  The person works on the palm side: presses the force sensor, shows cards to the colour sensor (it looks sideways, past the
  thumb), and whatever comes in front of the palm is what the distance sensor sees. The designer's program does not use it.
- Force Sensor (LEGO's technical sheet, as in week 10): touch in the first 0–2 mm of the 8 mm travel at 0.5–1 N, force 2–8 mm,
  2.5–10 N in steps of 0.1 N. In the SPIKE app the force reads in newtons (0–10) or percent.
- Colour and distance sensor: in the SPIKE app the colour sensor reports a colour (or «нет цвета») and reflected light in %;
  the distance sensor reports cm, % or inches. Any other number (how many colours, range, accuracy) only with a source
  (WebSearch, load it with ToolSearch `select:WebSearch`), or leave it out.
- Two-jaw vs three-jaw: two jaws squeeze from two sides and suit flat-sided parts; three jaws (like a lathe chuck) close around
  a round part from three sides and centre it by themselves. A human thumb is opposable: it can press against the other fingers.
- Week 10 recap: «Захваты», one motor in port A opened and closed a claw, a force sensor in port E on a hand controller was the
  button; two swappable claws (гибкий, раздвоенный) were tested fairly. Week 9 recap: «Роборука», one motor in port F closed two
  fingers with rubber tyres, the hub's left button was the control.

## 2. File ownership (edit only your own files)

| Owner | Files |
|---|---|
| model | `js/robot.js`, `js/hero.js`, `css/start.css`, `src/views/start.html` |
| lesson | `js/lesson.js`, `css/lesson.css`, `src/views/lesson.html` |
| examples | `js/scenes.js`, `js/examples.js`, `css/examples.css`, `src/views/examples.html` |
| program | `js/sim.js`, `js/program.js`, `css/program.css`, `src/views/program.html`, `js/vm.js`, `js/blocks.js`, `css/blocks.css`, `tests/vm-check.html` |

Everyone builds on last week's file of the same name: keep what fits, change what this model needs. The storage prefix is now
`kist.` (already set in `js/core.js`). `README.md`, `src/SPEC.md` and the template belong to the lead.

## 3. The model (`js/robot.js`, owner: model)

`js/robot.js` starts as a box stub with the full API below, so the lesson and program owners can work at once. The model owner
replaces it with the real model and keeps the API exactly. Never leave `js/robot.js` broken: write the new version to a temp file,
`node --check` it, test it, then move it over `js/robot.js`.

Build `RA.createHand()` procedurally from `ref/` (every page; `NOTES.md` has the page index). Reuse the week 10 kit in the same file
(rounded boxes, Technic beams with real holes, bent liftarms, the hub with its LED matrix and buttons, the medium motor, the force
sensor, materials and colours) and add what is new: the large motor, two grey 24-tooth gears, the distance sensor (white face, two
round "eyes"), the colour sensor, the 11×15 azure open frames, the magenta 7×11 frame, azure panels and curved slopes.

Units: 1 scene unit = 1 LEGO module = 8 mm. Axes: +X to the right seen from the palm side, +Y up, +Z towards the palm side
(the front, where the fingers curl). Y=0 is the table. X=0, Z=0 is the middle of the bottom frame. The model stands on the table.
Rough size (refine from the pictures): footprint ≈ 11 × 15, fingertips ≈ Y 28–30 when open, thumb sticks out to the left (−X).

- **Fingers**: seen from the palm (+Z, the sensor side, see §1), finger A on the left, finger C on the right next to the thumb.
  Each turns about a horizontal axis (along X) through its motor's rotor; open (motor 0) it points up with its tip bent towards
  +Z; closing it swings forward and down over the palm. Finger A closes with rising motor position (0 → 90), finger C with
  falling (0 → −90, i.e. 270).
- **Thumb**: on the right seen from the palm (+X), driven by the large motor E through the right-angle 1:1 gear pair; E 0 → 80
  swings it in front of the palm, towards the fingers. (As built: `ref/NOTES.md`, «Model decisions».)
- **Mechanical stops**: pick from the geometry where a finger or the thumb would hit the model (e.g. the palm) at each end; the
  simulator stalls the motor there. Keep the designer's positions (A 90, C 270, E 80) clearly short of the closed stops.
- Plastic look and colours as in weeks 9–10: azure `#01adc4` (the frames and panels here are the light azure of the set; sample
  the pictures), magenta `#c92e85`, yellow `#fed920`, white `#eceded`, black `#16151a`, grey `#a9b0b5`, blue (2×4 bricks), hub yellow
  body with a light grey face. Cables: flat white ribbons from each device to its port (motors to A, C, E; sensors to B, D, F).
  Whole scene under ~80k triangles, static meshes merged per material. Quality bar: at first glance a student recognises page 01
  and page 53 of the PDF.

API (other owners depend on it exactly):

```js
const h = RA.createHand();     // new instance every call; geometries and materials shared between instances
scene.add(h.group);
h.parts                // {base, hub, fingerA, fingerC, thumb, distance, controls, palm, cables}: THREE.Group each
h.PARTS                // [{id, name, role}] in that order, Russian, e.g. {id:'thumb', name:'Большой палец', role:'…'}
h.FINGERS              // {A: {name:'Палец A', motor:'средний', sign:1, closeDeg:90, stops:[min,max]}, C: {…, sign:-1, …},
                       //  E: {name:'Большой палец', motor:'большой', sign:1, closeDeg:80, stops:[…]}}
                       // sign: +1 if a rising motor position closes it; closeDeg: the designer's closed position (as |degrees|);
                       // stops: motor positions (signed degrees from open = 0) of the mechanical limits, [lower, upper]
h.setMotor(port, deg)  // 'A'|'C'|'E': moves that finger as the motor at this signed angle from open would (0 = open). Clamped to stops
h.curl(port)           // 0 open .. 1 at closeDeg (may exceed 1 up to the stop), from the last setMotor
h.box                  // THREE.Box3 of the model at rest (open), in h.group space: for cameras and layout
h.fingerSegments(port, deg)  // that finger's (or the thumb's) centre lines at this motor angle: [[Vector3, Vector3], …] in h.group
                       // space. Its contact surface is h.FINGER_R from them. The simulator tests its objects against these.
h.FINGER_R             // half a finger's thickness, modules
h.holdAt(r)            // THREE.Vector3 in h.group space: the centre of an object of half-depth r (modules) resting against the palm
h.touchDeg(port, r)    // signed motor angle at which that finger first touches a ball of radius r at holdAt(r); null if never
h.gripPoint            // THREE.Object3D at the middle of the palm's front surface (child of h.group): read its world position
h.anchors              // {distance, force, color}: THREE.Object3D on each sensor's working face, local +Z pointing out of the sensor
h.setForce(pct)        // 0..100: pushes the force sensor's plunger in by up to 1 module (the 8 mm travel)
h.forceButton          // the plunger mesh, for raycasting
h.setCard(css|null)    // shows a small coloured card held in front of the colour sensor, or none
h.setEyes(arr4|null)   // the distance sensor's four lights around the eyes, 0..100 each, or off
h.setMatrix(arr|null)  // as week 10: 25 brightness values 0..100, row by row with the hub read upright
h.setCenterLight(css|null)
h.hubButtons           // {left, right, center}: meshes for raycasting
h.highlight(id|null)   // fades everything except that part (ids of h.parts); null restores. Animated by update()
h.setExplode(t)        // 0..1: exploded view
h.STAGES               // [{id, title, steps, parts, text}]: the build stages, see below
h.setBuildStage(n, t)  // shows stages up to n (0-based); stage n flies into place as t goes 0..1
h.update(dt)           // call every frame
```

Stages (main steps of the PDF; sub-builds belong to the main step that adds them): 1 «Основание» (шаги 1–5), 2 «Хаб» (6–7),
3 «Датчик расстояния и верхняя рама» (8–9, порт B), 4 «Два пальца» (10–13, порты A и C), 5 «Большой палец» (14, порт E),
6 «Датчики силы и цвета» (15–20, порты D и F), 7 «Накладка» (21). `text`: one or two plain sentences a student can follow; `parts`:
plain descriptions you can see in the pictures, no counts you cannot verify. Refine the split if the pictures say otherwise.

## 4. Start view (`js/hero.js`, `css/start.css`, `src/views/start.html`, owner: model)

As week 10, new model and words. The model dead centre, largest thing on the screen, slow turntable starting from the back of the hand, the PDF cover's view (hub screen and cover);
now and then: finger C closes, then A, then the thumb, a short hold, all open (the designer's sequence). Display title «КИСТЬ»,
kicker «Робот-рука, модель 3». Spec strip: Моторы: A, C, E · Датчики: B, D, F · Пальцев: 3 · Время: 1 час.
Button «Начать урок» → lesson. `RA.reducedMotion`: still until dragged.

## 5. Lesson view (`js/lesson.js`, `css/lesson.css`, `src/views/lesson.html`, owner: lesson)

One scrolling page, big type for a projector, same visual language as week 10 (reuse its CSS and components). `Далее` → examples.
1. Header: kicker «Урок: робот-рука, модель 3. Многопальцевые захваты», h1 «Манипуляторы и автономия», цель (the teacher's words
   above), facts: 1 час, сборка и разборка, неделя 11; «Что узнаем».
2. Три модели одной темы (было — стало): Роборука (1 мотор, 2 пальца, кнопка хаба) → Захваты (1 мотор, датчик силы, 2 сменных
   захвата) → Кисть (3 мотора, 3 датчика, 3 пальца, у каждого пальца свой мотор). What «улучшение модели» means.
3. Сколько пальцев нужно: two-finger vs three-finger grips (§1). Interactive: pick an object (кубик, мяч, карандаш, яблоко) and a
   grip (2 пальца / 3 пальца), see a simple SVG with the contact points and a verdict with one line why. True statements only.
   The human hand: the opposable thumb.
4. Наша кисть: the 3D model (`createHand`), parts with `highlight` (PARTS), the ports table A–F, how a finger moves (the whole finger
   turns on its motor), the thumb's gear pair (1:1, opposite direction).
5. Программа кисти: the designer's six stacks as small pictures of SPIKE-looking blocks (HTML/CSS, SPIKE colours from week 9 §6),
   one line each. Next to it a try-it panel on the same or a second 3D model: a force control (light / hard press) and a red card
   toggle move the fingers exactly as that program would (plain JS, not the VM).
6. Улучшаем модель: the engineering loop (собрали → испытали → нашли слабое место → улучшили → снова испытали) and improvement ideas
   for this hand, each with why: rubber pads on the fingertips (friction, week 9's tyres), all three fingers on one press,
   using the distance sensor so the hand reacts by itself, gear ratio for the thumb (stronger vs faster).
7. Свой захват (постройка личного захвата): a planner the class fills on the projector: what to pick up, how many fingers, finger
   type (жёсткие / с резиновыми накладками / мягкие), motors (один на все пальцы / свой на каждый), control (кнопка хаба / датчик
   силы / датчик цвета / датчик расстояния / сам по программе). It prints a short «паспорт захвата» with 1–3 rule-based tips, saved
   with `RA.store`. Rules for building it from the set's spare parts and testing it on three objects.
8. Сборка и разборка: the 3D model with the stage stepper (`STAGES`, `setBuildStage`) and an explode slider; pairs; the ports; the
   instructions are the teacher's PDF, not the SPIKE app; credit the designer. Tidy disassembly: parts back into their trays.
9. Манипуляторы и автономия, итог раздела: the ladder ручное → программа → автономия across weeks 9–11 (кнопка хаба, датчик силы,
   датчики цвета и расстояния). Who decides when to grip.
10. Мини-тест: 5 questions with instant explanation, stored with `RA.store` (`lessonQuiz`), `RA.progress.mark('lesson')` at the end.
Footer with the trademark note of week 9 and the model credit.

## 6. Examples view (`js/scenes.js`, `js/examples.js`, `css/examples.css`, `src/views/examples.html`, owner: examples)

Same machinery as week 10 (one shared stage, a phase table per scene, caption timeline, list beside the canvas, the autonomy
level). Six new stories about multi-fingered robot hands and grippers, each answering: где, что делает, сколько пальцев и как они
двигаются, какие датчики, насколько автономно, и «Что общего с нашей кистью». Low-poly, clean, same plastic look, readable on a
projector. Do not repeat weeks 9–10 stories (автозавод, склад, хирургия, Canadarm2, ферма, сапёр; сортировка мусора, протез
с бумажным стаканчиком, пекарня, медузы, горячая камера, автомат с игрушками). Candidates (verify each, replace if unsure):
1. Завод: a three-finger adaptive gripper takes parts of different shapes without changing the gripper.
2. Космос: Robonaut 2, a humanoid with five-finger hands on the ISS, handles the astronauts' tools.
3. Кубик Рубика: a five-finger robot hand turns a Rubik's cube (OpenAI with the Shadow hand, 2019), cameras watch it.
4. Протез из 3D-принтера: e-NABLE hands, the fingers bend on cords when the child bends the wrist, no motors.
5. Подводный археолог: Stanford's OceanOne with hands that let the pilot feel the grip, at a shipwreck.
6. One more of your choice where finger count or thumb matters (e.g. a robot kitchen with two hands).
Every claim and number must be checked with WebSearch or left out.

## 7. Program view (`js/sim.js`, `js/program.js`, `js/vm.js`, `js/blocks.js`, css, view; owner: program)

Same layout and controls as week 10 (blocks left, 3D right, splitter, round Play/Stop, tools, task bar with 4 tasks, hub panel).

Hardware now: `hw.ports = {A:'motor', B:'distance', C:'motor', D:'force', E:'motor', F:'color'}`.

```js
hw.motors              // {A, C, E}: each the week 10 motor: run(speedPct, dir), runPower(pct), stop(), runFor(deg, speedPct) → Promise,
                       // runForSeconds(sec, speedPct, dir) → Promise, goTo(deg, mode, speedPct) → Promise, position (-180..179),
                       // relative (get/set), speedPct, powerPct, defaultSpeed (get/set, 75)
hw.sensors.force()     // newtons 0..10, steps of 0.1
hw.sensors.color()     // SPIKE colour code: -1 нет цвета, 0 чёрный, 1 фиолетовый, 3 синий, 4 голубой, 5 зелёный, 7 жёлтый, 9 красный, 10 белый
hw.sensors.reflected() // 0..100 %
hw.sensors.distance()  // cm, or null when nothing is in range
// buttons, tilt, display, sound, centerLight, onEvent, reset: as week 10
```

VM: one motor object per port; a block's port picks it. Implement the colour and distance blocks for real (`flipperevents_whenColor`
incl. «нет цвета», `flippersensors_isColor`, `flippersensors_color`, reflectivity, `flipperevents_whenDistance`,
`flippersensors_isDistance`, `flippersensors_distance`, `flipperlight_ultrasonicLightUp`), keep the force blocks of week 10.
Colour menus in the sensor blocks use the codes above (the motor-free light blocks may keep their own colours).
Hats are edge-triggered. Wrong port toasts, once per run, e.g. «В порту B датчик расстояния, а не мотор. Пальцы: моторы A и C,
большой палец: мотор E.», «В порту A нет датчика цвета. Датчик цвета подключён к порту F.» Movement blocks: «У этой модели нет
ходовых моторов: блок пропущен.» Touch threshold 0.6 N, «сильно нажата» from 7 N (week 10's choice).

Simulator: the hand stands on a table, seen from the front-right so the palm, the fingers and the thumb are visible. In front of the
palm a small stand («подставка») where the student puts an object; «Поднять кисть» lifts the whole hand about 8 modules, shakes it
a little, holds 1.5 s and puts it back: a held object goes with it, a badly held one stays or falls with a short reason. Motors as
week 10's (ramp, stall): each finger stalls at its stops and at `touchDeg` when an object is on the stand; a finger "grips" while it
touches and its motor pushes. Objects (lesson point, keep it):

| Предмет | Size (ball radius r) | Два пальца (A и C) | Три пальца (A, C и большой) |
|---|---|---|---|
| Кубик LEGO 2×4 | ≈1.5 | держит | держит |
| Карандаш (лежит поперёк) | ≈0.5 | держит | держит |
| Мяч | ≈3 | «Круглый: выкатился вбок» | держит |
| Яблоко | ≈3.5, тяжёлое | «Тяжёлое и круглое: выскользнуло» | держит |

Controls under the 3D view, compact: the force sensor button as week 10 (where you press sets the force; Space 4 N, Shift+Space 9 N);
colour cards to show the colour sensor (красный, жёлтый, зелёный, синий, белый, чёрный, «убрать»), keys 1–6 and 0; a distance
control «рука у датчика расстояния: N см / нет»; the objects for the stand; «Поднять кисть»; readouts for A, C, E (угол, скорость,
мощность) and B, D, F. Last week's hub panel stays (LEDs, hub buttons, centre button = start/stop).

Tasks (progress with `RA.store`, solved → tick, all four → `RA.progress.mark('program')`); each with goal, «Подсказка»,
«Показать решение» (in-page confirm), «Сбросить стол»:
1. «Допиши программу». Starter: the designer's program (§1) with the last stack «(F) когда цвет [нет цвета]» empty. The student adds
   «E перейти самым коротким путём в положение 0». Passes when in one run the thumb closes on the red card and, after the card is
   taken away, re-opens by program (|E| ≤ 10° within 3 s).
2. «Два или три пальца». Lift each object with two fingers (hard press) and with three (hard press + red card). A 2 × 4 table fills
   itself on every lift: держит / выпал (reason). Passes when all 8 cells have a result; then one line: what the thumb adds.
3. «Три пальца одной кнопкой». Improve the program: a hard press also closes the thumb, a release opens all three. Passes when in one
   run, with no colour card, a hard press closes A, C and E and the release opens all three.
4. «Передай предмет». Autonomy with the distance sensor: on start the hand closes all three fingers; when a hand comes closer than
   10 cm to the distance sensor, the hand opens by itself (a robot handing a thing to a person). Passes when in one run, with no
   press and no card, the fingers close, then open within 2 s after the distance drops below 10 cm.
Autosave the workspace with `RA.store`. `RA.createSim(container)` → `{hw, stage, hand, ...}`; expose `RA.program` for QA as week 10 did.

## 8. Visual identity

As week 9 §10. Title of the page: «Кисть». Top bar: «Неделя 11» · «Манипуляторы и автономия».

## 9. Kazakh copy (after the Russian site is tested)

As week 10: `kk/` and `src/kk/`, `node src/build.js kk`, terms in `src/kk/GLOSSARY.md` (week 10's file is the start), `node src/kk/check.js`
lists text still in Russian. The Russian files are the source.
