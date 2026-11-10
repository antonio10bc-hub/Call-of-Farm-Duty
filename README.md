# Call of Farm Duty

Granja voxel con estética de consola portátil (render retro de píxel fino, toon de 3 tonos y contornos de tinta): los cultivos crecen en la granja y los cosechas desde las torres de su campo con un rifle de francotirador en primera persona, mientras los alienígenas intentan robártelos.

## Cómo se juega

### El prólogo
Solo en una partida nueva (en DEBUG, VER EL PRÓLOGO), todo al atardecer, con barras de cine y textos que se pasan tocando:
1. En primera persona en un campo de trigo enorme: recoges dos matas a mano y aparece el **trigo mágico** (rayo arcoíris, sale de la tierra girando y estalla). Al ir a por él, habla.
2. En el espacio: tú, un ente blanco y brillante, cabeza con cabeza con el trigo mágico, con la cámara girando alrededor.
3. En una torre frente a un campo enorme: el rifle sale flotando del trigo, te enseña a apuntar y le disparas. Empieza la cinemática: las tres granadas, el bombardero y la bomba nuclear.
4. Fundido en blanco y al mapa, centrado en el granero, con todo por hacer. El trigo se despide, te deja su viejo granero (aparece con magia, con todo su recinto) y se va: «Buena suerte. Volveremos a encontrarnos». A partir de ahí, dependes de ti mismo.
- El sol del atardecer, en el centro de la vista.

### La granja
- **Un valle repartido en 14 parcelas** (`world/valley.js`, `content/farm.js`: `REGIONS`, `PLACES`): arriba, las montañas grandes; al pie, un lago glaciar que llena una cascada; de él sale el río, que cruza la colina y la llanura en diagonal. Todo el valle se reparte en zonas de forma irregular (como las comarcas de una provincia), sin huecos, con el río y el monte como frontera: cada una es plana a la altura media de su terreno. En el centro, el granero y su recinto militar; debajo, a un lado el trigo y al otro los tomates, cada uno en su zona; detrás, junto al lago, la pocilga (donde estaba la casa, ahora aparcada); el mercader, en el bosque de la otra orilla. La orilla alta va partida en vacas y ovejas (las dos, más grandes desde que llegaron las gallinas), la cañada en gallinas y calabazas (las dos se compran con oro) y la parcela de abajo (maíz) en tres: los otros dos trozos quedan de PRONTO. El valle flota en un mar de nubes: alrededor, cúmulos por pisos (base en sombra, bolas blancas y una arriba). La orilla del lago siempre es de tierra a la altura del agua (sin agua flotando). Cada parcela de 30×30 se estira desde su centro hasta el borde de su zona y la llena entera: su lógica sigue en las coordenadas de siempre (`toWorld`) y en el campo de tiro todo sigue siendo cuadrado. Los campos crecen desde su centro y al nivel 5 (28×28) llenan su zona.
- **Moverse:** arrastra para mover la cámara; pellizca o usa la rueda para acercar o alejar. El botón **MAPA** (abajo a la izquierda) enseña toda la granja de un vistazo; otra vez (o acercar), de vuelta a donde estabas.
- **Carteles:** fichas cuadradas sobre cada campo y edificio, con su icono; un cuadrado verde avisa de que hay una mejora que te puedes permitir. El de cada cultivo es su único icono: creciendo, una barrita que se llena; listo, amarillo, bota y lleva un «!». Al tocarlo sale la ficha de abajo con lo que le falta y **¡RECOGER!**. El texto solo sale cuando importa (desbloquear, en venta, el mercader) o al pasar el ratón.
- **El recinto del granero** (`render/compound.js`, `FARM.compound`): el cuartel de las rachas llena su zona (el granero, solo; lo militar es todo del recinto, sin piezas repetidas ni pisándose): tierra apisonada, la pista de asfalto con el avión del bombardero y su hangar, la bomba nuclear en su remolque sobre una plataforma con franjas de peligro, la armería (búnker con cajas de munición y armero), el helipuerto con el helicóptero, la torre de radar, las tiendas con el antiaéreo, almacenes de cajas y bidones y el control a la salida. Tocar cualquiera abre el armamento.
- **Vida y detalles:** patos que nadan en corro por el lago (uno amarillo con un lacito naranja), peces que saltan en el río y el lago, un molino de agua a la salida del lago, señales en los cruces de caminos (una tablilla del color de cada parcela cercana, apuntando hacia ella), bancos de nubes que tapan el borde del valle, y de noche en el recinto del granero, focos que barren y las luces de la pista.
- **El pato del lacito** sale del lago de vez en cuando, se da un paseo anadeando por la orilla y vuelve al agua.
- **Al volver** tras más de 3 minutos fuera (al abrir el juego o al volver a la pestaña), una tarjeta dice cuánto has estado fuera, qué campos están listos (y cuántas matas tienen), cuánto les falta a los demás y si ha llegado el mercader.
- **Toque largo** (medio segundo) sobre una parcela o un edificio: su ficha, sin mover la cámara.
- **Sorpresas del mapa:** pájaros posados en el granero (picotean y revolotean), un ovni pequeño que cruza el cielo de vez en cuando y deja caer una moneda (tocarla: +2 de oro), el cofre del día escondido en algún rincón del valle (+8 de oro, uno al día) y el pato del lacito, que al tocarlo hace «cuac», salta y suelta corazones.
- **Visitas raras del mercader:** una de cada cuatro viene de fiesta (gorro de cumpleaños y bufanda dorada) y paga un 60 % más de oro.
- **Mini-mapa** arriba a la derecha (cada parcela de su color; las que no son tuyas, apagadas) con el rectángulo de lo que se ve; tocarlo lleva la cámara allí. **Foto:** el botón de la cámara quita la interfaz y guarda una captura del mapa a píxel grande.
- **Atardecer:** el sol baja hasta esconderse tras las montañas y las farolas se encienden en cadena, de la granja hacia fuera.
- **Sonido de ambiente** según lo que se mira: pájaros en los bosques (más en el del mercader), el agua cerca del río y del lago, y viento en lo alto del monte.
- **El mercader, más a la vista:** al llegar avisa (también si estabas en el campo de tiro, al volver), su cartel late un rato y de su hoguera (al fondo del cráter, sin nada detrás) sale una columna de humo alta mientras está; con él fuera, apagada.
- **Al comprar una parcela** la cámara la recorre: primero entera, de lejos, y luego hacia su poste mientras se retira la sombra.
- **La ficha de un campo** da sus cifras: cosecha, lo que tarda en crecer, lo que da por hora y lo que añade el siguiente nivel. En la vista MAPA se ve siempre el nivel de cada parcela.
- **El bosque del mercader:** llena su zona, a manchas, con pinos y árboles redondos y suelo de bosque; el claro, de borde irregular a lo largo del surco del ovni y alrededor de su puesto.
- **El terreno** (`world/valley.js`, `world/Scenery.js`): celdas de 2×2 (4×4 en la montaña) en escalones de 0,6. La montaña va por franjas: verde abajo, luego tierra, roca gris y nieve solo en la cumbre. Caminos de tierra por las fronteras entre parcelas (del lado bajo) y desde las salidas de la granja y la casa, dos puentes de madera sobre el río, farolas que se encienden de noche, setos donde una parcela da al agua o al monte y bosque por las laderas. La vista MAPA enseña todo el valle; la cámara no sale de él.
- **Dock** (abajo en el centro): GRANERO, CAMPOS (abre encima otra barra con las fichas de los cultivos que tienes, con su nivel en rayitas y un cuadradito rojo si están listos) y MERCADER. El primer toque lleva la cámara y el segundo abre su ficha; un cuadradito rojo avisa de lo que pide atención.

### La progresión
Al empezar está todo bloqueado (con su candado): todas las parcelas (también las que se compran), las clases menos FRANCOTIRADOR, las armas y accesorios menos los de serie y las rachas. Solo se puede tocar el armamento y el trigo. Lo demás se va abriendo por pasos (guardados en `state.story`; las partidas de antes lo deducen de cómo van):
1. **El granero**, al acabar el prólogo: aparece con magia y, en ola, todo su recinto (silo, tractor, helipuerto, hangar, nuclear...).
2. **El trigo:** su terreno empieza abandonado y lleno de chatarra. Desde una atalaya lejana hay que acertar al barril rojo del montón (cambia algo de sitio cada vez) para volarlo todo y dejar la tierra sembrada. A nivel 1, en el campo de tiro no hay alienígenas ni caja sorpresa.
3. **Trigo a nivel 2:** el trigo mágico brota en el mapa, te dice que lo estás haciendo muy bien y te regala **las rachas de cultivos** (y te recuerda que se gestionan en el ARMAMENTO). Los carteles de lo nuevo salen cuando ya se ha ido. Hasta entonces, en el armamento las rachas no se pueden leer (cada una, un «?»).
4. **Trigo a nivel 3:** vuelve y te avisa de que a veces intentan robarte los cultivos: te deja una herramienta secreta, **las rachas alienígenas**. Desde ahora vienen alienígenas a pie (los ovnis, cuando haya tomates).
5. **Trigo al máximo:** vuelve, te dice que un nivel más lo automatiza (la torreta) y te deja un regalo para la próxima vez: **la caja sorpresa** (aparecerá la próxima vez que coseches algo: mira en las torres de enfrente). Con el trigo al máximo se desbloquean también los tomates (mismo barril).
6. **Tomates al máximo:** **llamada entrante del mercader** (tiembla y suena hasta que la contestas): se presenta, te compra cosecha a buen precio en monedas de oro y viene por primera vez.
7. **La primera venta:** el trigo mágico vuelve con una idea para ese dinero: desde ahora **las parcelas se compran** con oro en el orden que quieras (cerdos, vacas, ovejas, gallinas, peces, calabazas, maíz): su candado pasa a ser su precio (las de PRONTO siguen con candado).
- **Clases:** COSECHADOR, ESPANTAALIENS, CLASE 4 y CLASE 5 se desbloquean con 10, 20, 35 y 50 monedas de oro.
- Al cargar, la cámara empieza en el granero. Esc cierra el menú que esté abierto (como VOLVER).

### Campos y cosecha
- **Mejorar un campo** (su ficha): cada nivel lo agranda en el mapa y llena su campo de tiro de más blancos. Hay 5 niveles. Lo que un campo ocupará al máximo empieza abandonado (tierra sucia, árboles, matorral, chatarra) y se va limpiando según crece.
  - **Trigo:** cada mejora cuesta 3 de trigo. Crece de 8×6 a 28×28 casillas, con 18, 40, 80, 140 y 240 matas (muchas, porque los alienígenas roban).
  - **Tomates:** cada mejora cuesta 5 de trigo y 3 tomates. Crece de 7×6 a 28×28 casillas, con 8, 18, 40, 80 y 150 tomates gigantes (al máximo, el campo a rebosar).
- **Torreta automática:** con un campo al máximo, su mejora pasa a ser **TORRETA**. Los sacos terreros caen en las 4 esquinas y la torreta baja del cielo en paracaídas. Desde entonces:
  - **En el mapa:** salta de esquina en esquina (a la de al lado, nunca en diagonal), tirotea el campo a ráfagas y recoge sola lo maduro (una mata cada 4 s, con la partida abierta, con su +1).
  - **En el campo de tiro:** va en lo alto de un mástil en las torres (nunca en la tuya) y acribilla matas para acabar antes.
  - Lo suyo no suma a las rachas.
  - **Munición:** cada mata que recoge (en el mapa o en el campo de tiro) gasta una de sus 60. Sin munición se apaga: se desploma a tirones con los cañones al suelo, su luz pasa de verde a roja parpadeando, echa humo y cada poco intenta arrancar y se vuelve a caer; su icono parpadea en rojo en el cartel y sale TORRETA SIN MUNICIÓN; el botón del panel pasa a **RECARGAR**, que se paga con monedas de oro (las de cartón del mercader): 6 vacía, la parte que falta si está a medias (al menos 1). Números en `TURRETS` de `content/farm.js`.

### Parcelas en venta
- **Los corrales de animales** (vacas, ovejas, gallinas y cerdos) tienen su valla de madera alrededor: por dentro del corral, pegada a los caminos que los separan (sin cortarlos).
- **La casa personalizable está aparcada** (`FARM.house.hidden`): no se ve ni se usa (ni su tienda ni su columna del DEBUG); su parcela es la pocilga. El código y sus pruebas (en `test.skip`) se quedan por si vuelve.
- **Oeste (15 de oro), este (25 de oro), noroeste (40 de oro) y el prado de las ovejas (60 de oro, a la izquierda de las vacas, en la otra mitad de la orilla alta).** Mientras no son tuyas se ven en sombra, con un poste de SE VENDE.
- **Al comprarlas,** la sombra se retira en una onda dorada desde el poste, el poste salta por los aires y se iza tu bandera: ya es tuya, pero sigue sucia. Luego se desbloquea con su barril y queda limpia con su cultivo (5 niveles, torreta y campo de tiro). Al nivel 5 el campo ocupa casi toda la parcela (28×28), que en el mapa llena su zona.
  - **Calabazas** (la mitad oeste de la cañada, 15 de oro): enormes, entre hojas grandes (6, 10, 16, 26 y 40). Aguantan 3 tiros (cada uno las resquebraja, con su hitmarker) y paran la bala.
  - **Maíz** (este): matas de más de 2 m en hileras (cada partida en una dirección) con dos mazorcas a media altura: 16, 36, 72, 140 y 260 mazorcas (al máximo, un maizal a rebosar). Las hileras dan colaterales largos y las matas tapan la vista.
  - **Vacas** (noroeste): su campo es un prado de hierba fresca donde pastan. En el campo de tiro corren por todo el prado, cada una a su ritmo (unas al paso, otras al galope), y se les va hinchando la ubre hasta hacerse gigante (6 veces su tamaño): a medio llenar ya no les caben las patas debajo, así que se suben encima y van botando por el prado sobre ella como en una pelota saltarina (patas colgando, la ubre aplastándose en cada bote, ¡boing!). Llena (temblando, a veces con un mugido) es el blanco: un tiro a la ubre da un **cubo de leche**. Ordeñada, se desinfla, vuelve a apoyar las patas y sigue corriendo. Un cubo por vaca: 4, 6, 10, 15 y 22 según el nivel; cada mejora cuesta 10 de trigo y 3 cubos. Los alienígenas a pie no las persiguen, pero un ovni ladrón puede llevarse una entera con su rayo. El mercader compra la leche.
  - **Gallinas** (la otra mitad de la cañada, donde antes estaban las calabazas; 50 de oro): corretean por su corral y, cada pocos segundos, lanzan un **huevo** al aire en parábola, como un plato de tiro. El blanco es el huevo en el aire, no ellas; si cae sin que le des, se casca (yema y chof) y la gallina vuelve a cargarse (se agacha temblando antes de lanzar y aletea al hacerlo). Una por huevo: 5, 8, 12, 18 y 26 según el nivel; cada mejora cuesta 10 de trigo y 3 huevos. El mercader compra los huevos. (Las partidas de antes con la parcela oeste comprada conservan las calabazas en su sitio nuevo.)
  - **Edificios de los prados** (`render/barnyard.js`): cada nivel de vacas, ovejas, gallinas, cerdos y peces añade algo típico de su animal, juntos como una granjita junto al borde de arriba del campo (se recolocan cuando crece, salen con un bote y los animales no se meten en ellos):
    - Vacas: abrevadero y paca (1), lecheras y más pacas (2), establo rojo (3), silo y almiar (4), molinete de agua que gira y cerca con abrevadero largo (5).
    - Ovejas: comedero de heno (1), carro-cabaña del pastor (2), corral de piedra seca con lana (3), esquiladero y balas de lana (4), molino de viento con aspas que giran y cerca (5).
    - Gallinas: nidales con comedero (1), gallinero sobre patas con rampa (2), silo de pienso y sacos (3), gallinero grande y cajas de huevos (4), espantapájaros y cerca con cajas (5).
  - **Peces** (la laguna del pescador, a la derecha de los cerdos, en el desagüe del lago; 45 de oro): en el mapa, una laguna que llena casi todo el campo (con su orilla de arena; sin comprar, se ve una sola laguna de muestra) donde los peces saltan de vez en cuando, y la cabaña del pescador (luego el muelle con su barca, el secadero, el ahumadero y un farolillo con cañas). En el campo de tiro, la laguna llena casi todo el recinto (con una orilla de arena junto a la valla): los peces saltan fuera del agua cuando quieren, en arco y con su salpicón, de tres tamaños (pequeños plateados, altos y deprisa; carpas doradas; grandes verdes, bajos y despacio); en el aire, un tiro da un **pescado**; si no, vuelve al agua y salta más tarde. 6, 10, 16, 24 y 34 peces según el nivel; cada mejora cuesta 10 de trigo y 3 pescados.
  - **Cerdos** (la pocilga, en la parcela de la antigua casa; 35 de oro): su campo es de barro. En el campo de tiro cada cerdo coge carrerilla y se tira de barriga a deslizarse por el barro (salpicando) hasta pararse; luego otro rumbo y otra vez. Rebotan contra el borde y entre ellos. Hozando, cada poco uno encuentra una **trufa** y la lleva brillando en el lomo: un tiro a la trufa, y es tuya. 4, 7, 11, 16 y 22 cerdos según el nivel; cada mejora cuesta 10 de trigo y 3 trufas. Su pocilga crece con comedero, pocilga, tobogán de barro, cobertizo y charcos. El mercader paga bien las trufas.
  - **Ovejas** (la otra mitad de la orilla alta, a la izquierda de las vacas): su campo es otro prado. En el campo de tiro corren por todas partes al azar (cada una a su velocidad, cambiando de rumbo de vez en cuando) y rebotan contra el borde y entre ellas como bolas de billar. El vellón les crece hasta hacerse una **bola de lana** (el doble de grande que la oveja) en la que van metidas, rodando y pataleando; hecha la bola, un tiro da un **ovillo**. Esquilada, la bola se deshace y sigue corriendo. Una por ovillo: 6, 10, 18, 28 y 40 según el nivel; cada mejora cuesta 12 de trigo y 3 ovillos. El mercader compra la lana.

### El mercader y el oro
- **Quién es:** un alienígena muy mal disfrazado de humano (careta plana con su goma, gabardina y sombrero con las antenas asomando). Llega en un ovni disfrazado de coche (una careta gigante de cartón con un coche rojo de perfil) al claro del bosque donde una vez se estrelló una nave y dejó un surco largo y ancho que cruza la parcela de punta a punta: baja al surco, lo recorre pegado al suelo levantando polvo, baja la rampa y sale.
- **Su ritmo,** con el reloj de verdad: cada 5 min llega y se queda 4; luego se vuelve por donde vino. De noche, farol, guirnalda de bombillas y luz cálida.
- **Sus encargos:** su hoja trae 3 encargos de cosecha, de los campos que tienes y en cantidad según su nivel, y los paga en **monedas de oro** (más por los tomates y las calabazas). Al cerrar un trato lo celebra: salta, gira y se le cae la careta.
- **Su vida con el tiempo** (`content/merchantLife.js`; lógica en `FarmState`):
  - **Confianza** en 5 niveles (DESCONOCIDO, CLIENTE, HABITUAL, SOCIO, AMIGO DEL ALMA; 0/4/10/20/35 puntos): +1 por encargo, +2 los especiales y combinados, +1 al cumplirlo todo. Cada nivel paga un 6 % más, pide más variado y saluda distinto (te reconoce y acaba confesando que no es de aquí). Su hoja enseña nivel, barra, racha y ánimo.
  - **Racha:** visitas seguidas con todo cumplido; cada 3, la siguiente trae un **regalo** (una pieza de colección o 30 de oro).
  - **Ánimo:** contento si cumpliste la anterior (paga +10 % y baila de vez en cuando); serio si lo dejas plantado dos visitas seguidas sin entregarle nada (paga −10 %, pide un encargo menos, no sonríe ni saluda).
  - **Encargos nuevos:** combinado (nivel 2, con dos campos o más: varios cultivos, +30 %), urgente (nivel 3: 2:30 de cuenta atrás; a tiempo paga el doble) y especial (nivel 2 una visita sí y otra no, desde el 4 siempre: mucho de un cultivo a cambio de una pieza de colección; con todas, +50 % de oro).
  - **Su primo** (una visita de cada cinco): otro alienígena, morado, junto al puesto; pide el cultivo que menos se pide ese día y paga +50 %.
  - **Su tienda:** 2-3 cosas cada visita (siempre las mismas para esa visita); en las de fiesta, además, una exclusiva (bola de discoteca, estatua del mercader).
  - **El campamento crece:** 2, toldo de rayas y un banco; 3, cartel sobre el toldo y una caja olvidada; 4, tienda de campaña junto al ovni y una antena; 5, alfombra, banderines y sillón. Banco, caja y antena se quedan cuando se va (la antena parpadea: llama a casa).
  - **Colección** (7 piezas, compradas o regaladas, a la vista en su claro): gnomo alienígena, flamenco, bandera, trofeo, bola de discoteca, estatua y la chistera del pato del lacito.
- **El oro es la única moneda:** monedas de cartón muy falsas, recortadas a tijera y con un $ de rotulador.

### La casa y su tienda (aparcada: `FARM.house.hidden`; nada de esto se ve ahora)
- **La casa** empieza en ruinas, con toda su parcela sucia. Tiene 3 niveles: el 1 (8 de trigo) la arregla y limpia alrededor; el 2 (20 de trigo), gran parte de la parcela; el 3 (35 de trigo y 10 tomates), toda.
- **La tienda:** desde que se abre el mercader (tomates al máximo), un cartel sobre la casa abre su tienda, que lleva él y se paga con oro. Es una hoja abajo con la casa encuadrada arriba, que cambia en directo:
  - **CASA:** tejado, fachada, puerta y marcos. Tipo de casa, ventanas, chimenea y porche están en PRONTO.
  - **PARCELA:** 40 cosas (agua, jardín, juegos, estructuras, decoración y de otro mundo), cada una en su hueco fijo. Se compran una vez y luego se ponen o se quitan.

### El granero: armamento por clases
Al estilo «Crear clase» de Call of Duty. El granero no se mejora: se queda como está, y su menú es solo el de las clases.
- **Clases:** a la izquierda, 5 (Francotirador, Cosechador, Espantaaliens y dos más; solo la primera viene de serie, las demás se compran con oro). EQUIPAR CLASE elige la que se lleva al campo.
- **Cabe entero en la pantalla** (sin desplazar ni alejar; en el ordenador, algo más grande): VOLVER arriba a la izquierda, el título pequeño, y tres columnas (clases; arma y accesorios; rachas y EQUIPAR CLASE). En el móvil, una columna apretada con las clases en dos filas.
- **La clase que se edita** (a la derecha): arma principal, accesorios (mirilla y cargador) y dos secciones de rachas, de cultivos y de alienígenas, que se ponen o quitan tocándolas. En el campo de tiro solo saltan las de la clase equipada.
- **Armería:** tocar el arma o un accesorio abre su lista, un maletín de espuma con el fusil desmontado. Se compra con oro y se monta en esa clase; cada pieza se ve distinta en su foto y en el fusil en primera persona (las fotos no son dibujos: son las piezas de verdad renderizadas en 3D a píxeles, `ui/GearArt.js`; la del arma principal, el fusil entero tal cual va montado), y tiene sus pegas:
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
- **Alienígenas ladrones:** entran por un borde con un rayo verde, van andando, al trote o corriendo a por una mata, la cogen y huyen con un aviso rojo encima. En los prados también roban: persiguen a las vacas, ovejas y cerdos que ya tienen algo que llevarse, les quitan los huevos a las gallinas y se meten a nado en la laguna a por un pez (en el agua, hasta el cuello y a crol).
  - Si llegan al borde se la llevan (−1 rojo y ¡ROBADO!); si se les abate, se recupera.
  - Llevan un casco de cristal que de noche brilla en verde.
  - Al darles con una bala sale un **hitmarker** y su +1 encima de la cabeza.
- **Ovnis ladrones:** algunos ovnis pequeños se paran sobre la zona con más cultivos de lo que estás viendo (con su aviso ¡OVNI LADRÓN!; mientras baja sigue a lo que tenga debajo, que los animales se mueven) y su rayo verde absorbe hasta 8, que suben girando a la nave. Derribados, se recupera todo; si escapan, se pierde todo. Los ovnis no dan monedas, pero suman a la racha alienígena.
- **Rachas de bajas** (solo las de tu clase):
  - **De cultivos** (arriba): cada blanco recogido rellena una barra que se vacía cada vez más deprisa (empieza en 6 s y nunca baja de 2,6 s). A las 5, **fragmentación**; a las 10, **racimo** (6 mini granadas); a las 15, **incendiaria** (un fuego que quema lo de dentro y a los alienígenas que pasen). Medallas: COLATERAL xN; DOBLE / TRIPLE / MULTI KILL, solo con alienígenas abatidos seguidos.
  - **Alienígena** (a la izquierda, una torre de rayas que se encienden de una en una): cada alienígena abatido suma 1 y no se pierde hasta salir del campo. A los 3, **misil Predator** (vista cenital, se guía mirando y el gatillo lo acelera; la vista se corta en seco al explotar); a los 6, **bombardero**; a los 10, **bomba nuclear** (cuenta atrás mientras cae; lo recoge todo, alienígenas y ovnis incluidos, y lo maduro del resto de la granja, con neblina radiactiva).
  - Números en `content/killstreaks.js` (y en DEBUG).
- **Caja sorpresa** (como la de Kino der Toten en el modo zombis de Black Ops): mientras se recoge, de vez en cuando aparece una caja de madera con «?» pintados (y uno grande en la tapa) en una torre que no es la tuya, en la plataforma pequeña que cada torre tiene por fuera de su barandilla izquierda, con un rayo de luz azul hasta el cielo y un «?» flotando encima; su flecha de torre parpadea en azul. Espera 30 s.
  - Disparada desde otra torre no hace nada (¡DESDE SU TORRE!). Salta a su torre y dispárale: se abre la tapa con un fogonazo suave, una onda y chispas, salen de dentro rayos de luz dorada girando y las armas suben desde la boca de la caja girando cada vez más despacio. La que toca sale con un estallido dorado, sube algo más, se hincha flotando y te vuela a las manos dejando estela.
  - **Bazuca** (6 cohetes que revientan donde dan), **pistola de rayos** (3 rayos verdes continuos que siguen a la mirilla y lo recogen y abaten todo a su paso; tras cada uno se sobrecalienta, echa vapor y hay que esperar) o **ballesta explosiva** (8 virotes que se clavan, pitan y revientan al segundo).
  - No llevan mirilla de francotirador: al apuntar, el arma sube al centro con poco zoom y se apunta con su propia mira (alza y punto de mira).
  - Tienen un solo cargador y no se recargan: al gastarlo, el arma baja de las manos y sale volando torre abajo dando vueltas (bota y desaparece en humo) y tu fusil sube girando y se le monta el cerrojo.
  - El virote de la ballesta se clava donde da (en un cultivo, en el suelo o en un alienígena u ovni, y entonces va pegado a él) y luego revienta; clavado, tiene una lucecita roja (se ve hasta entre los cultivos) que parpadea y pita cada vez más deprisa hasta reventar. Números en `content/mysterybox.js`; los modelos, en `render/wonder.js`.
- El botón GRANJA vuelve en cualquier momento; lo recogido se guarda.

### Día y noche
Con el reloj de verdad: 4 min de día y 2 de noche, con amanecer y atardecer de 40 s (naranja abajo, morado arriba y el sol grande y bajo).
- **De noche:** el cielo se vuelve azul marino con luz de luna (sutil: se nota que es de noche pero se ve todo); en el campo de tiro sale una luna llena enorme y cuadrada con estrellas, y vienen más alienígenas (el doble de seguidos y hasta 6 a la vez), que brillan en la oscuridad.
- **El reloj** (arriba a la derecha) enseña el sol o la luna y lo que falta para que cambie.
- Ajustes en `THEME.night`, `THEME.dusk` y `THEME.cycle` (`content/theme.js`).

### Ajustes y depuración
- **Ajustes:** música, sonido, vibración e idioma.
- **Debug** (botón discreto abajo a la derecha de la granja): columnas una al lado de otra que caben en la pantalla sin desplazar, con VOLVER arriba a la izquierda (en las pantallas estrechas, pestañas: una columna cada vez, y se recuerda la última).
  - **GRANJA:** COSTES 0, HORA (AUTO, DÍA o NOCHE), COMERCIANTE (AUTO, AQUÍ o FUERA), MONEDAS DE ORO (de 10 en 10), +100 DE CADA COSECHA, VER EL PRÓLOGO y BORRAR PROGRESO (dos toques; no borra los ajustes).
  - **MERCADER:** CONFIANZA (nivel 1-5), RACHA, ÁNIMO, FIESTA y PRIMO (AUTO, SÍ o NO), VISITA (CUMPLIR: da lo que falta y lo entrega todo; SIGUIENTE: como si se fuera y volviera), ENCARGOS (NUEVOS; URGENTE TARDE), REGALO (DAR), COLECCIÓN (de una en una) y REINICIAR MERCADER.
  - **CAMPOS:** el nivel de cada campo con - / + (lo desbloquea si hace falta; enseña nivel·blancos del campo de tiro), MADURAR TODO y la munición de todas las torretas (VACIAR o LLENAR).
  - **CAMPO DE TIRO:** la caja sorpresa (SALE: NORMAL o ENSEGUIDA; DA: AL AZAR o un arma fija; EMPIEZAS CON: FUSIL o un arma de la caja), las vacas (NORMAL o UBRES LLENAS) y ALIENÍGENAS Y OVNIS (SÍ o NO).
  - **RACHAS:** las bajas que pide cada una (y RACHAS POR DEFECTO).
  - **DESBLOQUEAR:** de uno en uno (cada terreno, toda la armería y la torreta de cada campo) y DESBLOQUEAR TODO.
  - Lo de COSTES, HORA, COMERCIANTE, BAJAS y el campo de tiro se recuerda.

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

Web estática con módulos ES y Three.js 0.160 en `public/vendor`. El contenido (tema, cultivos, granja, rachas, armería, caja sorpresa, mercader y tienda) vive en `public/src/content/`.

### Píxel
- Render retro de píxel fino (unas 340 líneas en el lado corto, `RetroRenderer`). Al alejar la vista del mapa (hasta MAPA), el píxel se afina un poco, hasta un 25 % más de detalle, en pasos que caen justos en los píxeles de la pantalla.

### Rendimiento
- **Publicación** (`scripts/build.mjs`): el juego y three.js van en un solo `src/main.<huella>.js` minificado (pedido desde el principio con `modulepreload`) y el CSS en `style.<huella>.css`. Con la huella en el nombre no cambian nunca: Vercel los sirve con caché de un año (`vercel.json`) y el service worker los da de su copia sin esperar a la red; la página siempre se pide a la red primero.
- **Llamadas de dibujo:** las piezas fijas de cada modelo (granero, silo, casa, tractor, postes, torres, ovnis y el campamento del mercader con su surco) se juntan en una malla por material (`bake` en `render/VoxelModel.js`). Las nubes son dos mallas instanciadas.
- **Lo que no se ve no se dibuja:** el paisaje, el suelo de las parcelas, el bosque y la maleza van en trozos de 64×64 casillas con su esfera, y la cámara se salta los que quedan fuera.
- **Carga:** el reparto de árboles y matas usa una rejilla para no comparar cada uno con todos; dónde cae en el mundo cada pieza de una parcela se calcula una vez.
