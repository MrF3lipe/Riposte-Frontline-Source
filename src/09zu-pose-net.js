/* Presencia de red para la postura (ln / pr / mt). Una build original ignora estos campos. */
const _post_pres = netPresence;
netPresence = function (e, now) {
  const p = _post_pres(e, now);
  if (p && e) {
    if (e.lean) p.ln = Math.round(e.lean * 10) / 10;
    if (e.prone) p.pr = 1;
    if (e.mantle) p.mt = 1;
  }
  return p;
};
const _post_apply = netApply;
netApply = function (id, P) {
  _post_apply(id, P);
  const e = NET.remotes.get(id);
  if (!e || !P) return;
  if ('ln' in P) e.lean = P.ln || 0;
  if ('pr' in P) e.prone = !!P.pr;
  if ('mt' in P) e.mantleVis = P.mt;
};
