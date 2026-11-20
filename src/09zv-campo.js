/* Mejoras de campo. Modelos procedurales, sin assets 5.15. El evento de red k:'fu' lo ignora una build original. */
const FIELD_IDS = ['ammo', 'trophy', 'spawn', 'ghost'];
const FIELD = { boxes: [], trophies: [], marks: [], ghostT: [], need: { ammo: 12, trophy: 10, spawn: 8, ghost: 15 } };
const FIELD_NONE = _t('Aucune');
const FIELD_DEF = {
  ammo: { name: _t('Caisse de munitions'), desc: _t('Posez une caisse. Vous et vos alliés rechargez chargeur et réserve en passant près. Quatre usages, 30 s.') },
  trophy: { name: _t('Système Trophy'), desc: _t('Détruit les grenades ennemies dans un rayon de 4 m. Trois charges, 20 s.') },
  spawn: { name: _t('Balise de réapparition'), desc: _t('Votre prochaine réapparition a lieu ici, une fois.') },
  ghost: { name: _t('Fantôme'), desc: _t('Pendant 25 s, vous n\u0027apparaissez ni sur le radar ni sur l\u0027UAV.') }
};
function fieldId(id) { return FIELD_IDS.indexOf(id) >= 0 ? id : ''; }
function fieldName(id) { return (FIELD_DEF[id] && FIELD_DEF[id].name) || FIELD_NONE; }
function fieldOf(e) {
  if (!e) return '';
  if (e.isPlayer) {
    const i = (PL && PL.classIdx != null) ? PL.classIdx : Settings.loadout;
    const c = CLASSES[i];
    return fieldId(c && c.fu);
  }
  if (e.fu) return fieldId(e.fu);
  return '';
}
function fieldReady(e) { return e && e.alive && !e.downed && !e.fieldUsed && fieldOf(e); }
function fieldMat(hex) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0.15 });
}
function fieldMeshBox(x, y, z, hex) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.4), fieldMat(hex));
  m.position.set(x, y + 0.16, z); m.castShadow = true; scene.add(m); return m;
}
function fieldClearAll() {
  for (const b of FIELD.boxes) if (b.m && b.m.parent) b.m.parent.remove(b.m);
  for (const t of FIELD.trophies) if (t.m && t.m.parent) t.m.parent.remove(t.m);
  for (const s of FIELD.marks) if (s.m && s.m.parent) s.m.parent.remove(s.m);
  FIELD.boxes.length = 0; FIELD.trophies.length = 0; FIELD.marks.length = 0; FIELD.ghostT.length = 0;
}
function fieldFront(e) {
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  return { x: e.pos.x + fx * 1.1, y: e.pos.y, z: e.pos.z + fz * 1.1, yaw: e.yaw };
}
function fieldSend(e, ev) {
  if (typeof netEvent === 'function' && (e === PL.ent || e.netBot)) netEvent(e, ev);
}
function fieldAmmoAt(owner, p, remote) {
  const m = fieldMeshBox(p.x, p.y, p.z, 0x3d6b2e);
  FIELD.boxes.push({ m, owner, t: 30, uses: 4, team: owner.team });
  if (!remote) fieldSend(owner, { k: 'fu', typ: 'ammo', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
}
function fieldTrophyAt(owner, p, remote) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8), fieldMat(0x4a5560));
  m.position.set(p.x, p.y + 0.23, p.z); m.castShadow = true; scene.add(m);
  FIELD.trophies.push({ m, owner, t: 20, n: 3, team: owner.team });
  if (!remote) fieldSend(owner, { k: 'fu', typ: 'trophy', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
}
function fieldSpawnAt(owner, p, remote) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.2, 0.45, 6), fieldMat(0x2a6aa0));
  m.position.set(p.x, p.y + 0.25, p.z); scene.add(m);
  for (let i = FIELD.marks.length - 1; i >= 0; i--) if (FIELD.marks[i].owner === owner) {
    if (FIELD.marks[i].m.parent) FIELD.marks[i].m.parent.remove(FIELD.marks[i].m);
    FIELD.marks.splice(i, 1);
  }
  FIELD.marks.push({ m, owner, x: p.x, y: p.y, z: p.z });
  owner.fieldSpawn = { x: p.x, y: p.y, z: p.z };
  if (!remote) fieldSend(owner, { k: 'fu', typ: 'spawn', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
}
function fieldGhostOn(e, remote) {
  e.fieldGhost = 25;
  if (e.isPlayer && typeof hudMsg === 'function') hudMsg(_t('Fantôme'), 1.6);
  if (!remote) fieldSend(e, { k: 'fu', typ: 'ghost' });
}
function fieldUse(e, remote) {
  if (!fieldReady(e) && !remote) return;
  const typ = fieldOf(e); if (!typ) return;
  e.fieldUsed = true;
  const p = fieldFront(e);
  if (typ === 'ammo') fieldAmmoAt(e, p, remote);
  else if (typ === 'trophy') fieldTrophyAt(e, p, remote);
  else if (typ === 'spawn') fieldSpawnAt(e, p, remote);
  else if (typ === 'ghost') fieldGhostOn(e, remote);
  if (e.isPlayer && typ !== 'ghost' && typeof hudMsg === 'function') hudMsg(fieldName(typ), 1.4);
}
function fieldRefill(ent) {
  const A = ent.arms; if (!A || !A.slots) return;
  for (const s of A.slots) if (s && s.def) { s.mag = s.def.mag; s.reserve = s.def.reserve; }
}
function fieldOffRadar(e) { return !!(e && e.fieldGhost > 0); }
function fieldTick(dt) {
  for (const e of entities) if (e && e.fieldGhost > 0) { e.fieldGhost -= dt; if (e.fieldGhost <= 0) e.fieldGhost = 0; }
  for (let i = FIELD.boxes.length - 1; i >= 0; i--) {
    const b = FIELD.boxes[i]; b.t -= dt;
    if (b.t <= 0 || b.uses <= 0) { if (b.m.parent) b.m.parent.remove(b.m); FIELD.boxes.splice(i, 1); continue; }
    for (const e of entities) {
      if (!e || !e.alive || e._fuBox === b) continue;
      if (typeof allied === 'function' && !allied(e, b.owner) && e !== b.owner && e.team !== b.team) continue;
      if (hyp(e.pos.x - b.m.position.x, e.pos.z - b.m.position.z) > 1.5) continue;
      fieldRefill(e); b.uses--; e._fuBox = b;
      if (e.isPlayer && typeof hudMsg === 'function') hudMsg(_t('Munitions'), 1.2);
      if (b.uses <= 0) break;
    }
  }
  if (typeof NADES !== 'undefined') {
    for (let i = FIELD.trophies.length - 1; i >= 0; i--) {
      const t = FIELD.trophies[i]; t.t -= dt; t.m.rotation.y += dt * 2;
      if (t.t <= 0 || t.n <= 0) { if (t.m.parent) t.m.parent.remove(t.m); FIELD.trophies.splice(i, 1); continue; }
      for (let j = NADES.length - 1; j >= 0 && t.n > 0; j--) {
        const n = NADES[j]; const np = n && (n.p || n.pos); if (!np) continue;
        const own = n.owner || n.ent;
        if (own && (own === t.owner || (typeof allied === 'function' && allied(own, t.owner)))) continue;
        if (hyp(np.x - t.m.position.x, np.z - t.m.position.z) > 4) continue;
        if (n.mesh && n.mesh.parent) n.mesh.parent.remove(n.mesh);
        NADES.splice(j, 1); t.n--;
      }
    }
  }
  const me = PL && PL.ent;
  if (me && me.alive && fieldReady(me) && postureHeld && (typeof postureHeld === 'function' ? postureHeld('field', 'KeyV') : KEYS.KeyV) && !me._fuKey) {
    me._fuKey = true; fieldUse(me, false);
  }
  if (me && !(typeof postureHeld === 'function' ? postureHeld('field', 'KeyV') : KEYS.KeyV)) me && (me._fuKey = false);
  for (const b of entities) {
    if (!b || b.isPlayer || b.isRemote || !fieldReady(b) || (b.spawnAt && MATCH.time - b.spawnAt < 8)) continue;
    const typ = fieldOf(b);
    if (typ === 'ammo' && b.arms && b.arms.slots && b.arms.slots.some((s) => s && s.reserve < (s.def.reserve || 0) * 0.35)) fieldUse(b, false);
    else if (typ === 'trophy' && Math.random() < 0.002) fieldUse(b, false);
  }
}

if (typeof BIND_DEFS !== 'undefined' && !BIND_DEFS.some((d) => d[0] === 'field')) {
  BIND_DEFS.push(['field', 'KeyV', _t('Déployer l\u0027amélioration de champ')]);
  if (typeof bindRebuild === 'function') bindRebuild();
}

const _field_slots = renderArsSlots;
renderArsSlots = function () {
  _field_slots();
  const root = $('arsTabs'); if (!root || root.querySelector('[data-v="f"]')) return;
  const c = CLASSES[ARSUI.cls], id = fieldId(c.fu);
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'ars-slot'; b.dataset.v = 'f'; b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', String(ARSUI.tab === 'f'));
  b.innerHTML = `<span class="sl">${esc(_t('Amélioration de champ'))}</span><span class="sv">${esc(fieldName(id))}</span><span class="ss">${esc(id ? _t('Touche V pour déployer') : _t('Aucune'))}</span>`;
  root.appendChild(b);
};
function renderArsFieldList() {
  const c = CLASSES[ARSUI.cls];
  const ids = [''].concat(FIELD_IDS);
  $('arsList').innerHTML = `<h4>${_t('Une par classe')}</h4><div class="ars-grid">${ids.map((id) => {
    const on = fieldId(c.fu) === id, N = id ? FIELD_DEF[id] : { name: FIELD_NONE, desc: _t('Pas d\u0027amélioration de champ.') };
    return `<button type="button" class="ars-card ars-ksc" data-fu="${id || 'none'}" aria-selected="${on}">${on ? `<span class="ars-on">${_t('Équipée')}</span>` : ''}<span class="n">${esc(N.name)}</span><span class="m">${esc(N.desc)}</span></button>`;
  }).join('')}</div>`;
  $('arsList').onclick = (ev) => {
    const btn = ev.target.closest('[data-fu]'); if (!btn) return;
    const id = btn.dataset.fu === 'none' ? '' : btn.dataset.fu;
    c.fu = fieldId(id);
    if (typeof arsLoadoutEdit === 'function') arsLoadoutEdit();
    if (typeof sfxUi === 'function') sfxUi('equip');
    renderArsSlots(); renderArsFieldList();
  };
}
const _field_ars = renderArsenal;
renderArsenal = function (reset) {
  if (ARSUI.tab === 'f') {
    if (!classEditable(ARSUI.cls)) { uiGo('classes', false); return; }
    const c = CLASSES[ARSUI.cls];
    $('arsSub').textContent = _t('Classe personnalisée {0} sur {1}. Choisissez une amélioration de champ, déployée avec la touche V', c.slot + 1, CUSTOM_MAX);
    const inp = $('arsName'); if (document.activeElement !== inp) inp.value = c.name;
    renderArsSlots();
    $('arsStage').classList.add('series');
    renderArsFieldList();
    $('arsPanel').innerHTML = `<div class="ars-cols"><div><div class="ars-lv"><p class="wt">${esc(_t('Amélioration de champ'))}</p><p class="wn">${esc(fieldName(fieldId(c.fu)))}</p><span>${esc((FIELD_DEF[c.fu] && FIELD_DEF[c.fu].desc) || _t('Pas d\u0027amélioration de champ.'))}</span></div></div></div>`;
    return;
  }
  _field_ars(reset);
};

const _field_blip = uavBlip;
uavBlip = function (o, me, wave) {
  if (fieldOffRadar(o)) return null;
  return _field_blip(o, me, wave);
};

const _field_spawn = spawnEntity;
spawnEntity = function (e) {
  const mark = e && e.fieldSpawn;
  const r = _field_spawn(e);
  if (e) { e.fieldUsed = false; e.fieldGhost = 0; e._fuBox = null; e._fuKey = false; }
  if (e && mark) {
    e.pos.x = mark.x; e.pos.y = mark.y; e.pos.z = mark.z;
    e.fieldSpawn = null;
    for (let i = FIELD.marks.length - 1; i >= 0; i--) if (FIELD.marks[i].owner === e) {
      if (FIELD.marks[i].m.parent) FIELD.marks[i].m.parent.remove(FIELD.marks[i].m);
      FIELD.marks.splice(i, 1);
    }
  }
  if (e && !e.isPlayer && !e.isRemote && !e.fu) {
    e.fu = FIELD_IDS[Math.floor(Math.random() * FIELD_IDS.length)];
  }
  return r;
};

const _field_start = startMatch;
startMatch = function (opt) {
  fieldClearAll();
  return _field_start(opt);
};
const _field_tick = matchTick;
matchTick = function (dt) {
  fieldTick(dt);
  return _field_tick(dt);
};
const _field_ev = netEventIn;
netEventIn = function (e, ev) {
  if (ev && ev.k === 'fu') {
    const typ = ev.typ, p = { x: ev.x || (e && e.pos.x), y: ev.y || (e && e.pos.y), z: ev.z || (e && e.pos.z) };
    if (e) e.fieldUsed = true;
    if (typ === 'ammo') fieldAmmoAt(e, p, true);
    else if (typ === 'trophy') fieldTrophyAt(e, p, true);
    else if (typ === 'spawn') fieldSpawnAt(e, p, true);
    else if (typ === 'ghost') fieldGhostOn(e, true);
    return;
  }
  return _field_ev(e, ev);
};
