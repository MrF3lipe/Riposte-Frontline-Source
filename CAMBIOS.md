# Cambios

Hice este fork a partir de Riposte: Frontline 5.6.0, de [BenDBSS](https://github.com/BenDBSS/Riposte-Frontline-Source). El juego oficial está en [playriposte.com](https://www.playriposte.com). La licencia MIT y las excepciones de `NOTICE.md` siguen igual.

Esto es lo que fui agregando, a partir del snapshot `31ca050`:

- Desbloqueé las armas y los accesorios para jugar el catálogo de la 5.6 sin subir de nivel.
- Quité el tope de cuatro accesorios por arma.
- Agregué los modos de fiesta: Course aux armes, coop contra los bots e infectados.
- Agregué la partida LAN sin internet (servidor local y PeerJS en local).
- Agregué los atouts (dos por nivel), incluido Overkill para llevar dos armas principales. Las contrapartidas no se invierten.
- Habilité las partidas de 8 contra 8 y el selector de bots.
- Le di a cada bot una personalidad fija, con armas, atouts y rachas propias.
- Traduje el juego al español y lo dejé como idioma por defecto.
- Agregué baja confirmada, punto caliente y captura la bandera.
- Agregué Semtex, la granada aturdidora, C4, el Contra-UAV y las medallas Primera sangre y Venganza.
- Agregué el orden de armas en Course aux armes: mezclado (por defecto: primero las más fáciles de usar para matar, alternando tipos), aleatorio o clásico.
- Agregué la racha Juggernaut y el atout Última batalla.
- Agregué inclinarse (Z / X), cuerpo a tierra (mantener agacharse) y escalar un borde (saltar frente a un saliente).
- Agregué las mejoras de campo (caja de munición, Trophy, baliza de reaparición, Fantasma) y las opciones de partida privada (vida, velocidad, munición ilimitada, rachas).

## Cómo construir

```bash
python3 build.py
```

Se genera `dist/riposte-frontline.html`. El idioma por defecto es el español. El juego oficial sigue en https://www.playriposte.com.
