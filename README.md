# Call of Farm Duty

Granja voxel con estética de consola portátil (mismo estudio y estilo que Tank-less): el trigo crece en la granja y lo cosechas desde una torreta con un rifle de francotirador en primera persona.

## Cómo se juega
- **Granja:** un mapa que se gestiona tocando sus edificios (granero, silo, casa, torre de vigía, tractor) y sus 6 campos de trigo, que crecen solos. Arrastra para moverte; pellizca o usa la rueda para el zoom. Sobre cada campo maduro sale **¡RECOGER!**.
- **Francotirador:** desde una torre en cada esquina del campo.
  - Móvil: mantén el dedo para apuntar (zoom hacia ese punto), muévelo para mover la mira despacio y suéltalo para disparar. Un deslizamiento rápido a izquierda/derecha (o las flechas) cambia de torre; también se puede apuntar y disparar durante el salto.
  - Ordenador: la mirilla sigue al ratón; mantén el botón derecho para apuntar y suéltalo para disparar. Q/E o A/D cambian de torre, espacio mantiene/suelta la mira, Esc vuelve a la granja.
  - Mando: A/RT mantener y soltar, stick para la mira, LB/RB torres, B salir.
  - El botón GRANJA vuelve en cualquier momento; lo recogido se guarda.

## Desarrollo
```
npm install
npm start          # http://localhost:3000 (sirve public/)
npm test           # Playwright (PW_CHROMIUM=ruta para usar un Chromium ya instalado)
npm run build      # dist/ para Vercel
```
Web estática con módulos ES y Three.js 0.160 en `public/vendor`. El contenido (tema, cultivos, campo) vive en `public/src/content/`.
