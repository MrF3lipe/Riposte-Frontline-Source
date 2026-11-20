/* Médailles : première élimination et vengeance (tuer celui qui vous a tué).
   +100 de score et un avis au HUD. Le killfeed l'affiche aussi. Calcul local :
   une build d'origine n'a pas besoin d'un événement nouveau. */
function medalName(tag) {
  return tag === 'first' ? _t('Première élimination') : _t('Vengeance');
}
function medalTags(a, v) {
  if (!a || !v || a === v) return null;
  if (allied(a, v) || MATCH.finalPending || MATCH.fin) return null;
  const tags = [];
  if (!MATCH.firstBlood) tags.push('first');
  if (a.killedBy === v) tags.push('pay');
  return tags.length ? tags : null;
}
const _feedMedal = addKillfeed;
addKillfeed = function (a, v, weapon, head) {
  let w = weapon;
  if (a && a._medal && a._medal.length) w = String(weapon) + ' · ' + a._medal.map(medalName).join(' · ');
  return _feedMedal(a, v, w, head);
};
const _killMedal = killEnt;
killEnt = function (v, a, weapon, head, dir, life) {
  const tags = medalTags(a, v);
  if (a) a._medal = tags;
  const r = _killMedal(v, a, weapon, head, dir, life);
  if (a && v && a !== v && !allied(a, v)) v.killedBy = a;
  if (a && tags && v && !v.alive && !a.isRemote) {
    if (tags.includes('pay')) a.killedBy = null;
    if (tags.includes('first')) MATCH.firstBlood = true;
    a.score = (a.score || 0) + 100 * tags.length;
    if (a.isPlayer) {
      let delay = 200;
      for (const t of tags) {
        const name = medalName(t);
        setTimeout(() => xpPopup('+100', name, 'chain'), delay);
        delay += 180;
      }
    }
  } else if (tags && tags.includes('first')) MATCH.firstBlood = true;
  if (a) a._medal = null;
  return r;
};
const _startMedal = startMatch;
startMatch = function (opt) {
  const r = _startMedal(opt);
  MATCH.firstBlood = false;
  for (const e of entities) e.killedBy = null;
  return r;
};
