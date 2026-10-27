# Call of Farm Duty

Granja voxel con estética de consola portátil (mismo estudio y estilo que Tank-less): el trigo crece en la granja y lo cosechas desde una torreta con un rifle de francotirador en primera persona.

## Cómo se juega
- **Lo primero:** el terreno del trigo empieza abandonado y lleno de chatarra. Su cartel dice **¡DESBLOQUEAR!**: desde una atalaya lejana hay que acertar al barril rojo encima del montón para volarlo todo y dejar la tierra lista (el montón cambia algo de sitio en cada desbloqueo). Después ya se siembra y se cosecha.
- **Granja:** un mapa que se gestiona tocando sus edificios (granero de las rachas de bajas, silo, casa, tractor) y su campo de trigo, que crece solo. Arrastra para moverte; pellizca o usa la rueda para el zoom. Cuando el campo está maduro sale **¡RECOGER!**.
- **Mejorar el campo:** encima del campo flota un cartel con su nivel; al tocarlo se abre su ficha, donde **MEJORAR** cuesta 3 de trigo. Hay 5 niveles: el campo crece de 4×3 a 11×11 casillas y en el campo de tiro salen más matas (6, 10, 16, 23 y 32). La flecha verde del cartel avisa de que hay trigo para mejorar.
- **Campo de tomates:** en la otra esquina del cruce de caminos (crece desde ella, como el trigo) hay un terreno abandonado, sucio y lleno de chatarra oxidada. Con el trigo al nivel máximo su cartel pasa a **¡DESBLOQUEAR!**: tocarlo lleva a una sola atalaya, muy lejos (unos 52 m), en un escenario lleno de chatarra, desde la que hay que acertar un disparo al barril rojo encima del montón (tiembla, late y su contorno brilla). La explosión enorme vuela la chatarra, limpia la tierra y vuelve sola al mapa con el campo sembrado. Los tomates gigantes se recogen disparándoles; el campo tiene 5 niveles (de 5×4 a 12×11 casillas; 4, 7, 11, 16 y 22 tomates) y cada mejora cuesta 5 de trigo y 3 tomates. El desbloqueo es igual para cualquier terreno nuevo (`locked` en `content/farm.js`).
- **Francotirador:** desde una torre en cada esquina del campo, con control de shooter: la vista es libre y la mirilla está en el centro.
  - Móvil: arrastra para mirar; deja el dedo quieto un momento para subir el arma (zoom), muévelo para afinar (más despacio) y suéltalo para disparar. Desliza desde el borde (o usa las flechas) para cambiar de torre.
  - Ordenador: el clic de RECOGER ya bloquea el ratón; muévelo para mirar, mantén el botón derecho para apuntar y suéltalo para disparar (el izquierdo dispara al momento). Q/E saltan a la torre de la izquierda/derecha, Esc suelta el ratón, H vuelve a la granja.
  - Mando: sticks para mirar, LT apuntar (soltar dispara), RT/A disparar, LB/RB torres, B salir.
  - Precisión: sin la mira subida el tiro se dispersa mucho (no scope; en móvil, un toque rápido dispara desde la cadera). Girar la vista justo antes de disparar también abre el tiro. Al 95% de la subida desaparece la dispersión de cadera y la mira empieza a asentarse (medio segundo, con un leve temblor): un quickscope bien colocado acierta la gran mayoría de las veces. La mirilla se abre según la dispersión.
  - Colateral: la bala atraviesa todas las matas que pilla en línea hasta tocar el suelo, y las recoge todas.
  - Racha de bajas: cada blanco recogido rellena una barra (arriba) que se vacía cada vez más deprisa; si se vacía, la racha se pierde. Medallas pequeñas: COLATERAL xN y DOBLE / TRIPLE / MULTI KILL. Solo valen las rachas equipadas en el **granero** (tócalo en el mapa; 2 como mucho):
    - 5: **granada**, sale delante de la cámara con brillo y estela hacia el grupo de blancos más gordo de los que se ven, y recoge lo de alrededor.
    - 10: **misil Predator**, la vista pasa a ser cenital; el misil baja solo, se guía moviendo la vista y el gatillo (o un toque) lo acelera. Al llegar al suelo explota y recoge lo que pilla.
    - 20: **bombardero**, un avión enorme cruza el campo soltando bombas mientras sigues disparando.
    - 30: **bomba nuclear**, cuenta atrás de 5 s y lo recoge todo: el campo y lo maduro del resto de la granja; deja una neblina amarillenta radiactiva.
    - Lo que recogen las recompensas también suma a la racha. Los números y ajustes están en `content/killstreaks.js`.
  - Si sueltas mientras el cerrojo recarga, el disparo sale en cuanto está listo. Se puede mirar, apuntar y disparar durante el salto entre torres.
  - El botón GRANJA vuelve en cualquier momento; lo recogido se guarda.
- **Ajustes:** música, sonido, vibración e idioma. En la caja DEBUG: COSTES 0 (todas las mejoras gratis), BAJAS POR RACHA (con - / + se elige cuántas bajas pide cada recompensa; RACHAS POR DEFECTO las devuelve a 5, 10, 20 y 30; todo se recuerda) y BORRAR PROGRESO (dos toques: borra la cosecha y los campos, no los ajustes).

## Desarrollo
```
npm install
npm start          # http://localhost:3000 (sirve public/)
npm test           # Playwright (PW_CHROMIUM=ruta para usar un Chromium ya instalado)
npm run build      # dist/ para Vercel
```
Web estática con módulos ES y Three.js 0.160 en `public/vendor`. El contenido (tema, cultivos, campo) vive en `public/src/content/`.
