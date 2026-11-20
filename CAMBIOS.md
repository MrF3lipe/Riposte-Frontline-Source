# Cambios de este fork

Este repositorio es un **fork no oficial** de [Riposte: Frontline](https://www.playriposte.com) (código fuente 5.6.0, [BenDBSS/Riposte-Frontline-Source](https://github.com/BenDBSS/Riposte-Frontline-Source)). El juego oficial no se publica aquí. La licencia MIT del original y las excepciones de `NOTICE.md` siguen igual.

El trabajo propio de Riposte Mix está documentado en los commits de `main`, a partir del snapshot oficial `31ca050`. Lo que sigue resume qué se añadió y qué se dejó fuera a propósito.

## Qué incluye

- Desbloqueo de armas y accesorios para poder jugar el catálogo de la 5.6 sin subir de nivel.
- Sin tope de cuatro accesorios por arma.
- Modos de fiesta ya escritos para la 5.6: Course aux armes, coop contra los bots e infectados.
- Partida LAN sin internet (servidor local y PeerJS en local).
- Atouts (dos por nivel), incluido Overkill para llevar dos armas principales. Las contrapartidas no se invierten.
- Partidas de 8 contra 8 y selector de cuántos bots hay.
- Personalidades fijas para cada bot (armas, atouts y rachas propias).
- Traducción al español, idioma por defecto.
- Baja confirmada, punto caliente y captura la bandera.
- Semtex, granada aturdidora, C4, Contra-UAV, y las medallas Primera sangre y Venganza.
- Orden de armas en Course aux armes: mezclado (por defecto: primero las más fáciles de usar para matar, alternando tipos), aleatorio o clásico.
- Racha Juggernaut y atout Última batalla (sin usar el modo Supervivencia de la 5.15).
- Inclinarse (Z / X), cuerpo a tierra (mantener agacharse) y escalar un borde (saltar frente a un saliente).
- Mejoras de campo (caja de munición, Trophy, baliza de reaparición, Fantasma) y opciones de partida privada (vida, velocidad, munición ilimitada, rachas).

## Qué no incluye, y por qué

- **Modo Supremo** (y el código SUPREMO / SUPREMOBOTS). Se quedó fuera a petición: este fork público no lo trae.
- **Assets y código reconstruido de Riposte 5.15 y 5.16** (modelos, sonidos, texturas, y las armas AUG, M16A4, FAL, P90, Bizon, Uzi, Intervention y SPAS-12). Esos paquetes no son del repositorio original con licencia MIT. El fork solo usa el código y los assets que ya autoriza el snapshot 5.6.0, más el trabajo propio escrito encima.
- **Supervivencia / zombis** y la corrección de compañeros de ese modo. Ese modo no existe en la 5.6 y depende de esos assets.
- **RPG en Course aux armes.** Añadirlo bien pediría un lanzacohetes con modelo, red y explosión propios. Sin los assets de la 5.15 no se portó, para no dejar un arma a medias.

## Cómo construir

```bash
python3 build.py
```

Se genera `dist/riposte-frontline.html`. El idioma por defecto es el español. El juego oficial sigue en https://www.playriposte.com.
