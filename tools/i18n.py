"""Dictionnaires du jeu (i18n/en.txt, i18n/es.txt) : une entrée par ligne, « français ⇒ traduction ».
Dans une entrée, \\n est un saut de ligne et \\\\ une barre oblique inverse ; les lignes vides et celles qui commencent par # sont ignorées.
Utilisé par build.py (intégration dans la page) et par tools/dev/check_i18n.py (contrôles)."""
import glob,os
SEP=" ⇒ "
def unesc(s): return s.replace("\\\\","\x00").replace("\\n","\n").replace("\x00","\\")
def esc(s): return s.replace("\\","\\\\").replace("\n","\\n")
def load_dict(root, prefix):
    """Retourne (dict, erreurs). Les fichiers sont i18n/<prefix>*.txt, lus dans l'ordre alphabétique."""
    d={}; errs=[]
    for f in sorted(glob.glob(os.path.join(root,"i18n",prefix+"*.txt"))):
        for n,l in enumerate(open(f,encoding="utf-8").read().split("\n"),1):
            if not l.strip() or l.lstrip().startswith("#"): continue
            if l.count(SEP)!=1: errs.append(f"{f}:{n} : un seul « ⇒ » attendu"); continue
            k,v=l.split(SEP); k=unesc(k); v=unesc(v)
            if v=="=": v=k  # « = » : traduction identique au français (noms propres : Ghillie, Raptor...)
            if not k.strip() or not v.strip(): errs.append(f"{f}:{n} : clé ou traduction vide"); continue
            if k in d: errs.append(f"{f}:{n} : clé en double : {k[:60]}"); continue
            d[k]=v
    return d,errs
def load_en(root="."):
    return load_dict(root,"en")
def load_es(root="."):
    return load_dict(root,"es")
