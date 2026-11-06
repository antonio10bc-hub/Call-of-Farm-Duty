# Call of Farm Duty

Granja voxel con estética de consola portátil (render retro de píxel fino, toon de 3 tonos y contornos de tinta): los cultivos crecen en la granja y los cosechas desde las torres de su campo con un rifle de francotirador en primera persona, mientras los alienígenas intentan robártelos.

## Cómo se juega

### El prólogo
Solo en una partida nueva (en DEBUG, VER EL PRÓLOGO), todo al atardecer, con barras de cine y textos que se pasan tocando:
1. En primera persona en un campo de trigo enorme: recoges dos matas a mano y aparece el **trigo mágico** (rayo arcoíris, sale de la tierra girando y estalla). Al ir a por él, habla.
2. En el espacio: tú, un ente blanco y brillante, cabeza con cabeza con el trigo mágico, con la cámara girando alrededor.
3. En una torre frente a un campo enorme: el rifle sale flotando del trigo, te enseña a apuntar y le disparas. Empieza la cinemática: las tres granadas, el bombardero y la bomba nuclear.
4. Fundido en blanco y al mapa con todo por hacer. El trigo se despide, te deja su viejo granero (aparece con magia) y se va. A partir de ahí, dependes de ti mismo.

### La granja
- **Una cuadrícula de 3×3 parcelas** de 30×30 casillas, con vallas y portones donde pasan los caminos. En el centro, la de los campos y el granero; detrás, la de la casa; a su derecha, el claro del mercader; a los lados, dos parcelas que se compran con oro. Las demás (las esquinas y la de abajo) están abandonadas, en sombra y con un poste con candado: de momento no hay nada que desbloquear.
- **Moverse:** arrastra para mover la cámara; pellizca o usa la rueda para acercar o alejar. El botón **MAPA** (abajo a la izquierda) enseña toda la granja de un vistazo; otra vez (o acercar), de vuelta a donde estabas.
- **Carteles:** fichas cuadradas sobre cada campo y edificio, con su icono y su barra de nivel; un cuadrado verde avisa de que hay una mejora que te puedes permitir. El texto solo sale cuando importa (desbloquear, en venta, el mercader) o al pasar el ratón. Un campo maduro saca **¡RECOGER!**.
- **Dock** (abajo en el centro): GRANERO, CAMPOS (abre encima otra barra con las fichas de los cultivos que tienes, con su nivel en rayitas y un cuadradito rojo si están listos), CASA y MERCADER. El primer toque lleva la cámara y el segundo abre su ficha; un cuadradito rojo avisa de lo que pide atención.

### La progresión
Las cosas se van abriendo por pasos, cada una con su cartel grande:
1. **El granero**, al acabar el prólogo.
2. **El trigo:** su terreno empieza abandonado y lleno de chatarra. Desde una atalaya lejana hay que acertar al barril rojo del montón (cambia algo de sitio cada vez) para volarlo todo y dejar la tierra sembrada.
3. **Las rachas de granadas**, con el trigo a nivel 2.
4. **Los tomates**, con el trigo al máximo (mismo desbloqueo del barril). Desde aquí también cruzan el cielo los ovnis pequeños.
5. **La racha alienígena**, con los tomates a nivel 2.
6. **El mercader y la tienda de la casa**, con los tomates al máximo. Con su oro se compran las parcelas de los lados.

### Campos y cosecha
- **Mejorar un campo** (su ficha): cada nivel lo agranda en el mapa y llena su campo de tiro de más blancos. Hay 5 niveles. Lo que un campo ocupará al máximo empieza abandonado (tierra sucia, árboles, matorral, chatarra) y se va limpiando según crece.
  - **Trigo:** cada mejora cuesta 3 de trigo. Crece de 4×3 a 11×11 casillas, con 18, 36, 64, 100 y 150 matas (muchas, porque los alienígenas roban).
  - **Tomates:** cada mejora cuesta 5 de trigo y 3 tomates. Crece de 5×4 a 12×11 casillas, con 6, 12, 22, 36 y 56 tomates gigantes.
- **Torreta automática:** con un campo al máximo, su mejora pasa a ser **TORRETA**. Los sacos terreros caen en las 4 esquinas y la torreta baja del cielo en paracaídas. Desde entonces:
  - **En el mapa:** salta de esquina en esquina (a la de al lado, nunca en diagonal), tirotea el campo a ráfagas y recoge sola lo maduro (una mata cada 4 s, con la partida abierta, con su +1).
  - **En el campo de tiro:** va en lo alto de un mástil en las torres (nunca en la tuya) y acribilla matas para acabar antes.
  - Lo suyo no suma a las rachas.

### Parcelas en venta
- **Oeste (15 de oro) y este (25 de oro).** Mientras no son tuyas se ven en sombra, con un poste de SE VENDE junto a su portón.
- **Al comprarlas,** la sombra se retira en una onda dorada desde el poste, el poste salta por los aires y se iza tu bandera: ya es tuya, pero sigue sucia. Luego se desbloquea con su barril y queda limpia con su cultivo (5 niveles, torreta y campo de tiro). Al nivel 5 el campo ocupa casi toda la parcela (26×26).
  - **Calabazas** (oeste): enormes, entre hojas grandes. Aguantan 3 tiros (cada uno las resquebraja, con su hitmarker) y paran la bala.
  - **Maíz** (este): matas de más de 2 m en hileras (cada partida en una dirección) con dos mazorcas a media altura. Las hileras dan colaterales largos y las matas tapan la vista.

### El mercader y el oro
- **Quién es:** un alienígena muy mal disfrazado de humano (careta plana con su goma, gabardina y sombrero con las antenas asomando). Llega en un ovni disfrazado de coche (una careta gigante de cartón con un coche rojo de perfil) al claro del bosque donde una vez se estrelló una nave: baja al surco, lo recorre pegado al suelo levantando polvo, baja la rampa y sale.
- **Su ritmo,** con el reloj de verdad: cada 5 min llega y se queda 4; luego se vuelve por donde vino. De noche, farol, guirnalda de bombillas y luz cálida.
- **Sus encargos:** su hoja trae 3 encargos de cosecha, de los campos que tienes y en cantidad según su nivel, y los paga en **monedas de oro** (más por los tomates y las calabazas). Al cerrar un trato lo celebra: salta, gira y se le cae la careta.
- **El oro es la única moneda:** monedas de cartón muy falsas, recortadas a tijera y con un $ de rotulador.

### La casa y su tienda
- **La casa** empieza en ruinas, con toda su parcela sucia. Tiene 3 niveles: el 1 (8 de trigo) la arregla y limpia alrededor; el 2 (20 de trigo), gran parte de la parcela; el 3 (35 de trigo y 10 tomates), toda.
- **La tienda:** desde que se abre el mercader (tomates al máximo), un cartel sobre la casa abre su tienda, que lleva él y se paga con oro. Es una hoja abajo con la casa encuadrada arriba, que cambia en directo:
  - **CASA:** tejado, fachada, puerta y marcos. Tipo de casa, ventanas, chimenea y porche están en PRONTO.
  - **PARCELA:** 40 cosas (agua, jardín, juegos, estructuras, decoración y de otro mundo), cada una en su hueco fijo. Se compran una vez y luego se ponen o se quitan.

### El granero: armamento por clases
Al estilo «Crear clase» de Call of Duty. Su recinto crece con sus 5 niveles (los 3 primeros cuestan trigo, 5, 15 y 30; los 2 últimos, trigo y tomates, 40 + 15 y 60 + 30), y se llena de cosas: sacos, tiendas, búnker, helipuerto, hangar…
- **Clases:** a la izquierda, 5 (Francotirador, Cosechador, Espantaaliens y dos más que se abren con el granero a nivel 3 y 5). EQUIPAR CLASE elige la que se lleva al campo.
- **La clase que se edita** (a la derecha): arma principal, accesorios (mirilla, cargador y un hueco PRÓXIMAMENTE) y dos secciones de rachas, de cultivos y de alienígenas, que se ponen o quitan tocándolas. En el campo de tiro solo saltan las de la clase equipada.
- **Armería:** tocar el arma o un accesorio abre su lista, un maletín de espuma con el fusil desmontado. Se compra con oro y se monta en esa clase; cada pieza se ve distinta en su dibujo y en el fusil en primera persona, y tiene sus pegas:
  - **Mirillas:** estándar; punto rojo (poco zoom, se sube al instante, muy firme); táctica (más zoom y firme); largo alcance (zoom enorme, lenta y temblona); visión nocturna (de noche ve como de día, con la lente verde). Cada una con su retícula.
  - **Rifles:** de cerrojo (atraviesa 4); semiautomático (muy rápido, sin colaterales); carabina (corta, buena sin mira); antimaterial (lo atraviesa todo y rompe calabazas de un tiro, pero lento y con mucho retroceso); alienígena (rayos verdes, atraviesa 6 y hace doble daño).
  - **Cargadores:** estándar (10 balas); rápido (6, recarga enseguida); ampliado (18, recarga lenta); tambor (40, tarda una eternidad); célula alienígena (8, nunca recarga: las balas se regeneran).
  - Precios y números en `content/arsenal.js`.

### El campo de tiro
Desde una torre en cada esquina del campo, con control de shooter: la vista es libre y la mirilla está en el centro.
- **Móvil:** arrastra en cualquier sitio para mirar. El botón de mira: mantenlo para apuntar, desliza el dedo para afinar y suéltalo para disparar. Un toque rápido dispara sin mira; las flechas < > cambian de torre.
- **Ordenador:** el ratón mira (el clic de RECOGER ya lo bloquea). Mantén el botón derecho para apuntar y suéltalo para disparar; el izquierdo dispara al momento. R recarga, Q/E cambian de torre, Esc suelta el ratón y H vuelve a la granja.
- **Mando:** sticks para mirar, LT apunta (soltar dispara), RT/A disparan, LB/RB (o la cruceta) cambian de torre y B sale.
- **Precisión:** sin la mira subida el tiro se dispersa mucho; girar la vista justo antes de disparar también lo abre. Al subir la mira se asienta en un momento, con un leve temblor (según la mirilla). La mirilla se abre según la dispersión.
- **Colateral:** la bala atraviesa en línea tantos blancos como permita el rifle.
- **Cargador:** cada disparo gasta una bala. Al vaciarse recarga solo; R (o tocar el contador de balas) recarga antes.
- **Alienígenas ladrones:** entran por un borde con un rayo verde, van andando, al trote o corriendo a por una mata, la cogen y huyen con un aviso rojo encima.
  - Si llegan al borde se la llevan (−1 rojo y ¡ROBADO!); si se les abate, se recupera.
  - Llevan un casco de cristal que de noche brilla en verde.
  - Al darles con una bala sale un **hitmarker** y su +1 encima de la cabeza.
- **Ovnis ladrones:** algunos ovnis pequeños se paran sobre la zona con más cultivos y su rayo verde absorbe hasta 8, que suben girando a la nave. Derribados, se recupera todo; si escapan, se pierde todo. Los ovnis no dan monedas, pero suman a la racha alienígena.
- **Rachas de bajas** (solo las de tu clase):
  - **De cultivos** (arriba): cada blanco recogido rellena una barra que se vacía cada vez más deprisa (empieza en 6 s y nunca baja de 2,6 s). A las 5, **fragmentación**; a las 10, **racimo** (6 mini granadas); a las 15, **incendiaria** (un fuego que quema lo de dentro y a los alienígenas que pasen). Medallas: COLATERAL xN y DOBLE / TRIPLE / MULTI KILL.
  - **Alienígena** (a la izquierda, una torre de rayas que se encienden de una en una): cada alienígena abatido suma 1 y no se pierde hasta salir del campo. A los 3, **misil Predator** (vista cenital, se guía mirando y el gatillo lo acelera; la vista se corta en seco al explotar); a los 6, **bombardero**; a los 10, **bomba nuclear** (cuenta atrás mientras cae; lo recoge todo, alienígenas y ovnis incluidos, y lo maduro del resto de la granja, con neblina radiactiva).
  - Números en `content/killstreaks.js` (y en DEBUG).
- El botón GRANJA vuelve en cualquier momento; lo recogido se guarda.

### Día y noche
Con el reloj de verdad: 4 min de día y 2 de noche, con amanecer y atardecer de 40 s (naranja abajo, morado arriba y el sol grande y bajo).
- **De noche:** el cielo se vuelve azul marino con luz de luna; en el campo de tiro sale una luna llena enorme con estrellas, y vienen más alienígenas (el doble de seguidos y hasta 6 a la vez), que brillan en la oscuridad.
- **El reloj** (arriba a la derecha) enseña el sol o la luna y lo que falta para que cambie.
- Ajustes en `THEME.night`, `THEME.dusk` y `THEME.cycle` (`content/theme.js`).

### Ajustes y depuración
- **Ajustes:** música, sonido, vibración e idioma.
- **Debug** (botón discreto abajo a la derecha de la granja), con dos tablas:
  - **GRANJA:** COSTES 0, HORA (AUTO, DÍA o NOCHE), COMERCIANTE (AUTO, AQUÍ o FUERA), MONEDAS DE ORO (de 10 en 10), BAJAS POR RACHA (y RACHAS POR DEFECTO), DESBLOQUEAR de uno en uno (cada terreno, toda la armería y la torreta de cada campo), DESBLOQUEAR TODO, VER EL PRÓLOGO y BORRAR PROGRESO (dos toques; no borra los ajustes).
  - **CASA:** COSTES 0, NIVEL DE LA CASA, DESBLOQUEAR TODO y CASA DE SERIE.
  - Lo de COSTES, HORA, COMERCIANTE y BAJAS se recuerda.

## Desarrollo
```
npm install
npm start          # http://localhost:3000 (sirve public/)
npm test           # Playwright, la suite completa (PW_CHROMIUM=ruta para usar un Chromium ya instalado)
npm run test:smoke # solo las @smoke (rápidas y críticas)
npm run test:related  # solo los archivos de pruebas afectados por lo que ha cambiado (un worker)
npm run build      # dist/ para Vercel
```
Las pruebas están por áreas en `tests/*.spec.js` (map, unlock, sniper, killstreaks, ufo, debug, progress y prologue) y abren el juego con `?test`: se dibuja más barato (menos resolución, sin partículas, 30 fps), siempre es de día, el mercader está fuera y la progresión viene abierta (con `?progress`, cerrada, para probarla). En el Mac usan la GPU real (Chromium con Metal); en CI o con `PW_GPU=soft`, WebGL por software.

Web estática con módulos ES y Three.js 0.160 en `public/vendor`. El contenido (tema, cultivos, granja, rachas, armería, mercader y tienda) vive en `public/src/content/`.
