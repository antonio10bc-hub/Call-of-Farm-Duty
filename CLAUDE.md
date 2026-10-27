# Instrucciones para Claude

- Al terminar cualquier cambio, haz commit y push directamente a `main` (la web publicada en Vercel se despliega desde `main`).
- Antes de hacer push, ejecuta `npm test` (con `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` si Playwright no encuentra su navegador) y `npm run build`.
- Estilo visual propio (partió de Tank-less, repo antonio10bc-hub/tanquesweb, y ya tiene identidad propia): render retro de píxel fino (~340 líneas), toon de 3 tonos, contornos de casco invertido, todo con cubos y proporciones reales (sin caras), paleta de granja con tinta marrón #2a1a0e, UI con Press Start 2P, bordes de tinta y animaciones con steps().
- Comentarios del código en español; textos del juego en inglés y español con `L('EN', 'ES')`.
