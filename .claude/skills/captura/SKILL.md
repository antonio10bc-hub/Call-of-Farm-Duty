---
name: captura
description: Capturas del juego de verdad para revisar un cambio visual (mapa, prados, mercader, campo de tiro, reparto del valle en zonas). Úsala siempre que haya que ver cómo queda algo en pantalla, en vez de escribir un script de Playwright a mano.
---

# Captura del juego

Usa `scripts/shot.mjs` (también `npm run shot -- ...`). Arranca su propio servidor en un puerto libre, abre el juego con `?test` (de día, sin partículas), prepara la escena y guarda PNG en `test-results/shots/` (o `--out`). Al final imprime las rutas; míralas con Read. Si la página da errores, los lista y sale con código 1.

En la nube, antes: `export PW_CHROMIUM=...` (lo pone solo el hook de inicio de sesión; si no, `/opt/pw-browsers/chromium-*/chrome-linux64/chrome`).

## Opciones

| Opción | Qué hace |
|---|---|
| `--at nombre:x,z` | cámara sobre (x, z) en coordenadas de parcela; se repite (una captura por cada una) |
| `--zoom n` | 0.6 cerca, 1 normal, 2 lejos |
| `--map` | vista MAPA (todo el valle) |
| `--unlock a,b` / `--level n` | desbloquea campos y los pone a ese nivel (0-4) |
| `--merchant`, `--trust n`, `--own all` | mercader aquí, su confianza (0/4/10/20/35) y su colección |
| `--snipe cultivo` | entra al campo de tiro de ese cultivo |
| `--eval "js"` | código en la página antes de capturar (p. ej. `game.state.items.gold = 99`) |
| `--scale 2`, `--clip x,y,w,h` | de cerca: el doble de píxeles y solo un trozo |
| `--mobile`, `--size WxH` | tamaño de la ventana |
| `--regions` | además `regions.png`: el valle en zonas con sus semillas, y celdas por zona |

## Sitios útiles (coordenadas de parcela)

- Granero (0,0)-(30,30), centro (15,15). Mercader: puesto (41,-13), ovni (45,-15).
- Trigo (105,15), tomates (105,45), calabazas (75,15), maíz (45,15).
- Vacas (-15,-15), ovejas (75,-15), gallinas (-15,15), cerdos (15,-15; donde estaba la casa), laguna de peces (15,45).

## Ejemplos

```sh
npm run shot -- --unlock milk,wool,egg --level 4 --at vacas:-15,-15 --at ovejas:75,-15 --at gallinas:-15,15 --zoom 1.4
npm run shot -- --merchant --trust 35 --own all --at puesto:41,-13 --zoom 0.9 --scale 2
npm run shot -- --map --regions
npm run shot -- --snipe egg --wait 4000
```

Para la orientación: en pantalla, +x va hacia abajo a la derecha y +z hacia abajo a la izquierda; lo que sube (humo, edificios altos) tapa lo que queda detrás (menor x + z).
