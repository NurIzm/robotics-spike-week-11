// Start screen: «Кисть» as a product reveal. It sits dead centre, the page behind it is plain CSS.
(function () {
  const RA = window.RA;
  const Q = Math.PI / 2;
  // The turn starts where the PDF's cover looks from: the hub's screen and the azure cover, a little from finger A's side.
  // The model's +Z is the palm, so that view is from -Z.
  const AZIMUTH = Math.PI + 0.45, ELEVATION = 0.42;
  const INTRO = 1.8, SWEEP = 0.8, TURN = 0.1, BEAT = 9;   // seconds, radians, rad/s, seconds
  const FILL_W = 0.9, FILL_H = 0.84;                       // share of the screen the model may take
  // The designer's sequence: finger C, finger A, the thumb, a hold, all open. [port, closed position, start s, ramp s]
  const MOVES = [['C', -90, 0, 0.7], ['A', 90, 0.9, 0.7], ['E', 80, 1.8, 0.7]];
  const OPEN_AT = 3.8, OPEN_FOR = 0.9;
  const ease = (t) => 1 - (1 - t) ** 3;
  const ramp = (p, start, dur) => { const t = Math.min(1, Math.max(0, (p - start) / dur)); return t * t * (3 - 2 * t); };

  let stage;

  RA.view('start', {
    init(root) {
      const h = RA.createHand();
      // The model's middle and the corners of each part's box at rest: closing only moves the fingers inwards, so this frames it from any side.
      const outline = [];
      Object.values(h.parts).forEach((p) => {
        const b = new THREE.Box3().setFromObject(p, true);
        if (!b.isEmpty()) for (let i = 0; i < 8; i++) outline.push([i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z]);
      });
      const aim = h.box.getCenter(new THREE.Vector3());
      const AIM = aim.toArray();

      const az = AZIMUTH - (RA.reducedMotion ? 0 : SWEEP);
      const dir = [Math.sin(az) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(az) * Math.cos(ELEVATION)];
      stage = RA.stage(RA.$('.hero__stage', root), { fov: 18, target: AIM, camera: dir.map((v, i) => AIM[i] + v * 120) });
      stage.scene.add(h.group);
      if (!stage.renderer) return;

      // A table that only shows the model's shadow.
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ opacity: 0.16 }));
      ground.rotation.x = -Q;
      ground.position.set(aim.x, -0.02, aim.z);
      ground.receiveShadow = true;
      // The stage's key light leaves the far side dim, and the turntable shows it.
      const fill = new THREE.DirectionalLight(0xffffff, 1.1);
      fill.position.set(10, 20, -60);
      stage.scene.add(ground, fill);

      const c = stage.controls, foot = RA.$('.hero__foot', root);
      c.enableZoom = false;
      c.autoRotate = !RA.reducedMotion;
      const tan = Math.tan((stage.camera.fov * Math.PI) / 360);
      let intro = RA.reducedMotion ? 0 : 1;
      // The distance at which the model just fills the screen from the side it shows now, so it stays the biggest thing as it turns.
      const distance = () => {
        const a = c.getAzimuthalAngle(), el = Q - c.getPolarAngle();
        let u = 0, v = 0;
        outline.forEach(([x, y, z]) => {
          x -= AIM[0]; y -= AIM[1]; z -= AIM[2];
          u = Math.max(u, Math.abs(x * Math.cos(a) - z * Math.sin(a)));
          v = Math.max(v, Math.abs(y * Math.cos(el) - (x * Math.sin(a) + z * Math.cos(a)) * Math.sin(el)));
        });
        // On a phone the foot runs edge to edge, so the model must stay clear of it; on wider screens it passes between the corners.
        const fillH = stage.size.w > 640 ? FILL_H : 1 - (2 * (foot.offsetHeight + 44)) / stage.size.h;
        return Math.max(v / fillH, u / (FILL_W * stage.camera.aspect)) / tan;
      };
      stage.frame((dt, t) => {
        const push = 1 + 0.3 * (1 - ease(1 - intro));
        stage.camera.position.sub(c.target).setLength(distance() * push).add(c.target);
        if (RA.reducedMotion) return;
        // OrbitControls turns per frame; this keeps the speed the same on any screen. Negative: the azimuth grows, as the sweep needs.
        c.autoRotateSpeed = -((TURN + (3 * SWEEP / INTRO) * intro * intro) * dt * 3600) / (2 * Math.PI);
        if (intro > 0) {
          intro = Math.max(0, intro - dt / INTRO);
          return;
        }
        // Now and then the hand runs the designer's sequence. The beat counts from the intro's end, so the first move ramps in.
        const p = (t - INTRO) % BEAT, open = 1 - ramp(p, OPEN_AT, OPEN_FOR);
        MOVES.forEach(([port, deg, start, dur]) => h.setMotor(port, deg * Math.min(ramp(p, start, dur), open)));
      });
    },
    enter() { stage.start(); },
    leave() { stage.stop(); },
  });
})();
