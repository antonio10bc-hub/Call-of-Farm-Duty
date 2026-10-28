# Instrucciones para Claude

- Al terminar cualquier cambio, haz commit y push directamente a `main` (la web publicada en Vercel se despliega desde `main`).
- Antes de hacer push, ejecuta `npm run build` y las pruebas según el flujo de abajo (con `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` si Playwright no encuentra su navegador).

## Pruebas (Playwright): que no saturen la CPU

Las pruebas renderizan el juego de verdad y son caras. En el Mac usan la GPU real (`channel: 'chromium'` + Metal; en CI, WebGL por software) y el juego en modo prueba (`?test`: menos resolución, sin partículas, 30 fps). Hay 2 workers. Están por áreas en `tests/*.spec.js` (map, unlock, sniper, killstreaks, ufo, debug), con las utilidades en `tests/helpers.js`, y etiquetadas `@smoke` (rápidas y críticas) o `@full`.

- Mientras iteras: ejecuta solo las pruebas de lo que cambias, con un worker: `npx playwright test tests/<área>.spec.js --workers=1` o `npx playwright test -g "<nombre>" --workers=1`. `npm run test:related` elige los archivos según lo que ha cambiado desde el último commit.
- Antes de dar una tarea por terminada: `npm run test:smoke`.
- La suite completa (`npm test`), una sola vez al final de cada tarea grande o cuando te la pidan; nunca en bucle.
- Si una prueba falla, vuelve a ejecutar solo esa (`-g "<nombre>" --workers=1`), no toda la suite.
- Nada de esperas fijas (`waitForTimeout`): espera a un estado del juego con `expect.poll` o a fotogramas con `frames(page)`.
- Estilo visual propio (partió de Tank-less, repo antonio10bc-hub/tanquesweb, y ya tiene identidad propia): render retro de píxel fino (~340 líneas), toon de 3 tonos, contornos de casco invertido, todo con cubos y proporciones reales (sin caras), paleta de granja con tinta marrón #2a1a0e, UI con Press Start 2P, bordes de tinta y animaciones con steps().
- Comentarios del código en español; textos del juego en inglés y español con `L('EN', 'ES')`.
