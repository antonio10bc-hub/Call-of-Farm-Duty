# Call of Farm Duty

Granja voxel con estética de consola portátil (mismo estudio y estilo que Tank-less): el trigo crece en la granja y lo cosechas desde una torreta con un rifle de francotirador en primera persona.

## Cómo se juega
- **Granja:** un mapa que se gestiona tocando sus edificios (granero, silo, casa, torre de vigía, tractor) y su campo de trigo, que crece solo. Arrastra para moverte; pellizca o usa la rueda para el zoom. Cuando el campo está maduro sale **¡RECOGER!**.
- **Mejorar el campo:** encima del campo flota un cartel con su nivel; al tocarlo se abre su ficha, donde **MEJORAR** cuesta 3 de trigo. Hay 5 niveles: el campo crece de 4×3 a 11×11 casillas y en el campo de tiro salen más matas (6, 10, 16, 23 y 32). La flecha verde del cartel avisa de que hay trigo para mejorar.
- **Francotirador:** desde una torre en cada esquina del campo, con control de shooter: la vista es libre y la mirilla está en el centro.
  - Móvil: arrastra para mirar; deja el dedo quieto un momento para subir el arma (zoom), muévelo para afinar (más despacio) y suéltalo para disparar. Desliza desde el borde (o usa las flechas) para cambiar de torre.
  - Ordenador: el clic de RECOGER ya bloquea el ratón; muévelo para mirar, mantén el botón derecho para apuntar y suéltalo para disparar (el izquierdo dispara al momento). Q/E saltan a la torre de la izquierda/derecha, Esc suelta el ratón, H vuelve a la granja.
  - Mando: sticks para mirar, LT apuntar (soltar dispara), RT/A disparar, LB/RB torres, B salir.
  - Precisión: sin la mira subida el tiro se dispersa mucho (no scope; en móvil, un toque rápido dispara desde la cadera). Girar la vista justo antes de disparar también abre el tiro. Al 95% de la subida desaparece la dispersión de cadera y la mira empieza a asentarse (medio segundo, con un leve temblor): un quickscope bien colocado acierta la gran mayoría de las veces. La mirilla se abre según la dispersión.
  - Colateral: la bala atraviesa todas las matas que pilla en línea hasta tocar el suelo, y las recoge todas.
  - Medallas (pequeñas, arriba): COLATERAL xN, y DOBLE / TRIPLE / MULTI KILL al encadenar matas con menos de 3 s entre una y otra.
  - Si sueltas mientras el cerrojo recarga, el disparo sale en cuanto está listo. Se puede mirar, apuntar y disparar durante el salto entre torres.
  - El botón GRANJA vuelve en cualquier momento; lo recogido se guarda.
- **Ajustes:** música, sonido, vibración, idioma y BORRAR PROGRESO (dos toques: borra el trigo y el campo, no los ajustes).

## Desarrollo
```
npm install
npm start          # http://localhost:3000 (sirve public/)
npm test           # Playwright (PW_CHROMIUM=ruta para usar un Chromium ya instalado)
npm run build      # dist/ para Vercel
```
Web estática con módulos ES y Three.js 0.160 en `public/vendor`. El contenido (tema, cultivos, campo) vive en `public/src/content/`.
