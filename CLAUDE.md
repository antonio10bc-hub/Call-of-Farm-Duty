# Instrucciones para Claude

- Al terminar cualquier cambio, haz commit y push directamente a `main` (la web publicada en Vercel se despliega desde `main`).
- Antes de hacer push, ejecuta `npm test` (con `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` si Playwright no encuentra su navegador) y `npm run build`.
- El estilo visual es exactamente el de Tank-less (repo antonio10bc-hub/tanquesweb): render retro a ~210 líneas, toon de 3 tonos, contornos de casco invertido, todo con cubos, UI con Press Start 2P, bordes de tinta #1b0b33 y animaciones con steps(). Las piezas de `src/render/` y `src/ui/PixelArt.js` vienen de allí.
- Comentarios del código en español; textos del juego en inglés y español con `L('EN', 'ES')`.
