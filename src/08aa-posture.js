/* Postura: asomarse (lean Z/X), cuerpo a tierra (mantener agacharse) y escalar un borde (saltar frente a un saliente). Los campos ln / pr / mt son opcionales. */
const POSTURE = {
  leanDist: 0.35, leanAng: 15 * Math.PI / 180,
  proneEye: 0.45, proneH: 0.52, proneSpd: 0.3, proneHold: 0.4,
  mantleMin: 0.58, mantleMax: 1.62, mantleDur: 0.5
};
function postureInit(ent) {
  if (!ent || ent.lean !== undefined) return;
  ent.lean = 0; ent.leanWant = 0; ent.prone = false; ent.proneWant = false;
  ent.proneAmt = 0; ent.proneHold = 0; ent.mantle = null;
}
function postureReset(ent) {
  if (!ent) return;
  ent.lean = 0; ent.leanWant = 0; ent.prone = false; ent.proneWant = false;
  ent.proneAmt = 0; ent.proneHold = 0; ent.mantle = null;
}
function postureHeight(ent) {
  if (ent.mantle) return 1.15;
  if (ent.prone || (ent.proneAmt || 0) > 0.72) return POSTURE.proneH;
  return ent.crouch ? 1.2 : 1.75;
}
function postureEye(ent, sliding) {
  if (ent.mantle) return 1.32;
  if (ent.prone) return POSTURE.proneEye;
  if (sliding) return 0.85;
  if (ent.crouch) return 1.1;
  return 1.62;
}
function postureLeanRoom(ent, dir) {
  if (!dir) return true;
  const yaw = ent.yaw || 0, s = Math.sign(dir), rx = Math.cos(yaw) * s, rz = -Math.sin(yaw) * s;
  const y = ent.pos.y + (ent.eyeH || 1.5);
  const h = rayWorld(ent.pos.x, y, ent.pos.z, rx, 0, rz, 0.46);
  return !h || h.t > 0.3;
}
function postureHeld(action, fallback) {
  const code = (typeof bindOf === 'function') ? bindOf(action) : fallback;
  return !!(typeof KEYS !== 'undefined' && (KEYS[code] || KEYS[fallback]));
}
function postureCanMantle(ent) {
  if (!ent || !ent.onGround || ent.prone || ent.downed || ent.jugg) return false;
  const fx = -Math.sin(ent.yaw), fz = -Math.cos(ent.yaw);
  const h = rayWorld(ent.pos.x, ent.pos.y + 0.4, ent.pos.z, fx, 0, fz, 0.7);
  if (!h || h.t > 0.55) return false;
  const top = rayWorld(ent.pos.x + fx * 0.45, ent.pos.y + POSTURE.mantleMax + 0.05, ent.pos.z + fz * 0.45, 0, -1, 0, POSTURE.mantleMax - POSTURE.mantleMin);
  if (!top) return false;
  const gy = ent.pos.y + POSTURE.mantleMax + 0.05 - top.t;
  const rise = gy - ent.pos.y;
  if (rise < POSTURE.mantleMin || rise > POSTURE.mantleMax) return false;
  const ceil = ceilingAbove(ent.pos.x + fx * 0.45, ent.pos.z + fz * 0.45, gy + 0.1, 0.28);
  return ceil > gy + 1.2;
}
function postureStartMantle(ent) {
  const fx = -Math.sin(ent.yaw), fz = -Math.cos(ent.yaw);
  const top = rayWorld(ent.pos.x + fx * 0.45, ent.pos.y + POSTURE.mantleMax + 0.05, ent.pos.z + fz * 0.45, 0, -1, 0, POSTURE.mantleMax);
  const gy = top ? (ent.pos.y + POSTURE.mantleMax + 0.05 - top.t) : ent.pos.y + 1;
  ent.mantle = { t: 0, x0: ent.pos.x, y0: ent.pos.y, z0: ent.pos.z, x1: ent.pos.x + fx * 0.55, y1: gy, z1: ent.pos.z + fz * 0.55 };
  ent.vy = 0; ent.vel.x = 0; ent.vel.z = 0;
}
function postureMantleTick(ent, dt) {
  const m = ent.mantle; if (!m) return;
  m.t += dt / POSTURE.mantleDur;
  const k = Math.min(1, m.t);
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  ent.pos.x = m.x0 + (m.x1 - m.x0) * e;
  ent.pos.y = m.y0 + (m.y1 - m.y0) * e;
  ent.pos.z = m.z0 + (m.z1 - m.z0) * e;
  ent.onGround = k >= 1;
  ent.eyeH = damp(ent.eyeH, 1.32, 14, dt);
  if (k >= 1) { ent.mantle = null; ent.pos.y = m.y1; ent.vy = 0; }
}
function postureStance(ent, dt) {
  postureInit(ent);
  if (ent.downed) { ent.prone = false; ent.proneWant = false; ent.leanWant = 0; }
  const sliding = (ent.slideT || 0) > 0;
  const ceil = ceilingAbove(ent.pos.x, ent.pos.z, ent.pos.y + 0.15, 0.28);
  const room = ceil > ent.pos.y + POSTURE.proneH + 0.08;
  if (ent.isPlayer && !ent.downed && !ent.mantle) {
    const hold = postureHeld('crouch', 'ControlLeft');
    if (hold) { ent.proneHold = (ent.proneHold || 0) + dt; if (ent.proneHold >= POSTURE.proneHold) ent.proneWant = true; }
    else { ent.proneHold = 0; if (!hold && ent.prone && (ent.input && ent.input.jump)) ent.proneWant = false; }
    if (ent.input && ent.input.jump && ent.prone) { ent.proneWant = false; ent.input.jump = false; }
    let lean = 0;
    if (postureHeld('leanL', 'KeyZ')) lean -= 1;
    if (postureHeld('leanR', 'KeyX')) lean += 1;
    ent.leanWant = lean;
  }
  if (ent.proneWant && !ent.downed && !sliding && !ent.mantle && room) ent.prone = true;
  else if (!ent.proneWant) {
    if (ent.prone && ceilingAbove(ent.pos.x, ent.pos.z, ent.pos.y + 0.15, 0.28) > ent.pos.y + 1.7) ent.prone = false;
    else if (!ent.prone) {}
    else ent.prone = true;
  }
  ent.proneAmt = damp(ent.proneAmt || 0, ent.prone ? 1 : 0, 10, dt);
  let want = ent.leanWant || 0;
  if (ent.prone || sliding || ent.mantle || !postureLeanRoom(ent, want)) want = 0;
  ent.lean = damp(ent.lean || 0, want, 10, dt);
  if (Math.abs(ent.lean) < 0.02) ent.lean = 0;
}

const _post_move = ctlMove;
ctlMove = function (ent, dt) {
  postureStance(ent, dt);
  if (ent.mantle) { postureMantleTick(ent, dt); return { landed: 0, jumped: 0, slid: 0 }; }
  if (ent.isPlayer && ent.input && ent.input.jump && !ent.prone && postureCanMantle(ent)) {
    postureStartMantle(ent);
    ent.input.jump = false;
    postureMantleTick(ent, 0);
    return { landed: 0, jumped: 1, slid: 0 };
  }
  if (ent.prone && ent.input) { ent.input.sprint = false; }
  const r = _post_move(ent, dt);
  if (ent.prone) { ent.sprinting = false; ent.crouch = true; }
  return r;
};

const _post_pmul = perkMoveMul;
perkMoveMul = function (ent) {
  const m = _post_pmul(ent);
  return (ent && ent.prone) ? m * POSTURE.proneSpd / 0.6 : m; // 0.6 already applies via crouch
};

if (typeof BIND_DEFS !== 'undefined') {
  const has = (a) => BIND_DEFS.some((d) => d[0] === a);
  if (!has('leanL')) BIND_DEFS.push(['leanL', 'KeyZ', _t('S\u0027incliner à gauche')]);
  if (!has('leanR')) BIND_DEFS.push(['leanR', 'KeyX', _t('S\u0027incliner à droite')]);
  if (typeof bindRebuild === 'function') bindRebuild();
}

const _post_cam = applyCamera;
applyCamera = function (dt, now, scoped) {
  _post_cam(dt, now, scoped);
  const e = PL && PL.ent;
  if (!e || !e.alive || MATCH.state === 'loading') return;
  const lean = e.lean || 0;
  if (!lean) return;
  const yaw = PL.yaw || e.yaw || 0;
  const rx = Math.cos(yaw) * lean * POSTURE.leanDist;
  const rz = -Math.sin(yaw) * lean * POSTURE.leanDist;
  camera.position.x += rx;
  camera.position.z += rz;
  camera.rotation.z += lean * POSTURE.leanAng;
};

const _post_spawn = spawnEntity;
spawnEntity = function (e) {
  const r = _post_spawn(e);
  postureReset(e);
  return r;
};
