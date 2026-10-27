# Call of Farm Duty

Granja voxel con estética de consola portátil (mismo estudio y estilo que Tank-less): el trigo crece en la granja y lo cosechas desde una torreta con un rifle de francotirador en primera persona.

## Cómo se juega
- **Granja (menú principal):** granero en el centro y 8 parcelas de trigo que crecen solas. Cuando alguna está lista aparece **¡RECOGER!**.
- **Francotirador:** el campo es un cuadrilátero con una torreta en cada esquina.
  - Móvil: toca para apuntar con la mira, arrastra para afinar, toca o pulsa FUEGO para disparar. Desliza a izquierda/derecha (o las flechas) para cambiar de esquina.
  - Teclado: espacio/enter apunta y dispara, WASD/flechas afinan con la mira, A/D o Q/E cambian de esquina, Esc sale de la mira / vuelve a la granja.
  - Mando: A/RT apuntar y disparar, stick para afinar, LB/RB esquinas, B salir.
  - El botón GRANJA vuelve en cualquier momento; lo recogido se guarda.

## Desarrollo
```
npm install
npm start          # http://localhost:3000 (sirve public/)
npm test           # Playwright (PW_CHROMIUM=ruta para usar un Chromium ya instalado)
npm run build      # dist/ para Vercel
```
Web estática con módulos ES y Three.js 0.160 en `public/vendor`. El contenido (tema, cultivos, campo) vive en `public/src/content/`.
