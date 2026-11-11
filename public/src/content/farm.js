import { L } from '../core/I18n.js';
import { REGIONS, G, GN, cellX, cellZ, regionAt, toUV, toXZ, VW, VH } from '../world/valley.js';

// Plano de la granja (en casillas). Cada edificio se puede tocar para ver su ficha.
//   kind      modelo que se construye (render/structures.js)
//   x, z      centro; w, d: huella en casillas (para tocarlo y para el camino)
//   ry        giro en cuartos de vuelta
export const FARM = {
    size: 30, // casillas de lado de cada parcela (el césped sigue hasta el horizonte)
    // Parcelas valladas [x0, z0, x1, z1): la de los campos y, detrás del granero, la de la casa
    parcels: [
        [0, 0, 30, 30],
        [0, -30, 30, 0],
        [30, -30, 60, 0], // el claro del mercader
        [90, 0, 120, 30], // el trigo (en su zona)
        [90, 30, 120, 60], // los tomates (en la suya)
    ],
    // Las demás parcelas de la cuadrícula de 3×3 (la de los campos, con el granero, en el
    // centro). Las que se compran con el oro del comerciante (price) empiezan abandonadas (árboles,
    // matorral y chatarra) con su cartel de EN VENTA; una vez compradas se desbloquean como
    // cualquier terreno (disparando al barril de su campo) y queda limpia, con el campo de su
    // cultivo nuevo (field). Las de soon, de momento abandonadas y sin nada que desbloquear.
    // Sin comprar se ven oscuras (como en sombra) y con su poste (SE VENDE o PRONTO); al comprarla
    // la oscuridad se retira en una onda desde el poste, que salta, y queda tu bandera.
    //   price   monedas de oro que cuesta
    //   post    dónde está el poste (y luego la bandera): se calcula al repartir el valle (abajo)
    lands: [
        { id: 'west', rect: [-30, 0, 0, 30], price: 50, field: 'egg', name: L('HEN RUN', 'CORRAL DE GALLINAS') },
        { id: 'east', rect: [30, 0, 60, 30], price: 25, field: 'corn', name: L('EAST PLOT', 'PARCELA ESTE') },
        { id: 'nw', rect: [-30, -30, 0, 0], price: 40, field: 'milk', name: L('NORTH-WEST PLOT', 'PARCELA NOROESTE') },
        { id: 'sw', rect: [-30, 30, 0, 60], price: 15, field: 'pumpkin', name: L('PUMPKIN PLOT', 'PARCELA DE CALABAZAS') },
        // (el desagüe del lago, a la derecha de los cerdos: la laguna del pescador)
        { id: 'south', rect: [0, 30, 30, 60], price: 45, field: 'fish', name: L('FISHING POND', 'LAGUNA DEL PESCADOR') },
        { id: 'se', rect: [30, 30, 60, 60], soon: true },
        // Las otras mitades de la orilla alta (la de las ovejas), la cañada y la parcela de abajo
        { id: 'nw2', rect: [60, -30, 90, 0], price: 60, field: 'wool', name: L('SHEEP MEADOW', 'PRADO DE LAS OVEJAS') },
        { id: 'west2', rect: [60, 0, 90, 30], price: 45, field: 'honey', name: L('APIARY', 'COLMENAR') },
        // La de la casa (aparcada de momento, la casa personalizable: ver house.hidden) es ahora la
        // pocilga de los cerdos
        { id: 'house', rect: [0, -30, 30, 0], price: 35, field: 'truffle', name: L('PIGSTY', 'POCILGA') },
        { id: 'east2', rect: [60, 30, 90, 60], price: 55, field: 'sunflower', name: L('SUNFLOWER FIELD', 'CAMPO DE GIRASOLES') },
    ],
    bounds: { x0: -30, z0: -30, x1: 120, z1: 60 }, // todas las parcelas (en sus coordenadas de siempre)
    // El granero (armamento: rachas de bajas y mejoras del rifle) y su recinto militar, que llena
    // toda su zona: tierra apisonada (zone/yard) con un borde de hierba, la pista con el avión y su
    // hangar (strip), y las plataformas de hormigón (pads) de la nuclear, la armería y el
    // helipuerto. Lo que hay en el recinto, en compound (render/compound.js). Ya no se mejora: sus
    // niveles se quedan por las partidas guardadas.
    barn: {
        zone: [1, 1, 29, 29],
        levels: [
            { yard: [1, 1, 29, 29] },
            { yard: [1, 1, 29, 29], cost: { wheat: 5 } },
            { yard: [1, 1, 29, 29], cost: { wheat: 15 } },
            { yard: [1, 1, 29, 29], cost: { wheat: 30 } },
            { yard: [1, 1, 29, 29], cost: { wheat: 40, tomato: 15 } },
            { yard: [1, 1, 29, 29], cost: { wheat: 60, tomato: 30 } },
        ],
        strip: [9, 20, 28, 24],
        pads: [[2.5, 2.5, 14.5, 9.5], [20, 3, 27, 9], [2.5, 9.5, 8.5, 15]],
    },
    // Lo del recinto del granero: kind (la pieza de render/compound.js), x, z (su centro, en las
    // coordenadas de la parcela; en el mapa se reparte estirado por toda la zona) y ry (cuartos de vuelta)
    compound: [
        { kind: 'nuke', x: 8.5, z: 6, pad: 1 }, // (pad: en el centro de esa plataforma y a su medida)
        { kind: 'armory', x: 23.5, z: 6 },
        { kind: 'radar', x: 17.2, z: 3.4 }, // (fuera de la plataforma de la nuclear)
        { kind: 'heli', x: 5.5, z: 12.3 },
        { kind: 'range', x: 24.5, z: 13, structure: 'range' }, // (el campo de tiro de pruebas: se toca para entrar)
        { kind: 'hangar', x: 5, z: 22, strip: true },
        { kind: 'plane', x: 20, z: 22, strip: true },
        { kind: 'checkpoint', x: 15, z: 27.3 },
        { kind: 'depot', x: 3.5, z: 26.8, ry: 1 },
        // Lo que llena los huecos (con aire entre unos y otros)
        { kind: 'tower', x: 11, z: 18.7 },        // torre de control, junto al principio de la pista
        { kind: 'motorpool', x: 8.6, z: 27.2 },   // parque móvil, abajo a la izquierda
        { kind: 'fuel', x: 27.2, z: 26.6 },       // depósitos de combustible, en la esquina de abajo a la derecha
        { kind: 'barracks', x: 21.4, z: 27.8 },   // barracón, abajo, entre el control y el combustible
    ],
    // La casa y su parcela: empieza en ruinas con toda la parcela abandonada (zone). Nivel 1: la
    // casita arreglada y limpio alrededor; 2: gran parte de la parcela; 3: toda (clear).
    //   cost   lo que cuesta llegar a ese nivel
    // hidden: aparcada de momento (no se ve ni se usa: su parcela es la pocilga). El código se queda
    // por si vuelve
    house: {
        hidden: true,
        zone: [0, -30, 30, 0], // (toda la parcela: en el mapa llena su zona)
        levels: [
            { clear: null },
            { clear: [10, -20, 21, -10], cost: { wheat: 8 } },
            { clear: [4, -26, 26, -4], cost: { wheat: 20 } },
            { clear: [0, -30, 30, 0], cost: { wheat: 35, tomato: 10 } },
        ],
    },
    structures: [
        { id: 'barn', kind: 'barn', x: 15, z: 12, w: 5, d: 4, ry: 0, name: L('BARN', 'GRANERO') },
        { id: 'silo', kind: 'silo', x: 20.2, z: 11, w: 2, d: 2, name: L('SILO', 'SILO') },
        { id: 'house', kind: 'house', x: 15, z: -15, w: 4, d: 4, ry: 0, name: L('FARMHOUSE', 'CASA') }, // en el centro de su parcela
        { id: 'tractor', kind: 'tractor', x: 9.9, z: 13.4, w: 2, d: 3, ry: 1, name: L('TRACTOR', 'TRACTOR') }, // junto al granero (sin pegarse)
    ],
    // Campos de cultivo. Cada uno crece al mejorarlo desde una esquina fija (corner) hacia
    // los lados que marcan dx, dz (+1 / -1).
    //   cost      lo que cuesta cada mejora, por recurso
    //   locked    empieza como un terreno abandonado lleno de chatarra que se desbloquea
    //             disparando al barril rojo; con `after`, solo cuando ese campo está al máximo; con
    //             `land`, cuando se ha comprado esa parcela
    //   levels    w, d: tamaño en casillas (en el mapa); sheaves: blancos en el campo de tiro;
    //             arena: tamaño del campo de tiro (1 = el normal); sign: color del cartel.
    //             El nivel 1 apenas cambia; los altos tienen un campo de tiro mucho mayor y a
    //             rebosar (sobre todo el maíz y los tomates)
    //   turrets   lo que cuesta la torreta automática, la mejora extra con el campo al máximo:
    //             una torreta que va de esquina en esquina y lo recoge sola (ver TURRETS)
    fields: [
        {
            id: 'wheat',
            crop: 'wheat',
            name: L('WHEAT FIELD', 'CAMPO DE TRIGO'),
            corner: { x: 105, z: 15, center: true }, // crece desde el centro de su parcela
            cost: { wheat: 3 },
            turrets: { wheat: 40 },
            // Lo primero del juego: limpiar este terreno para poder sembrar trigo
            locked: { barn: true, name: L('JUNKYARD', 'TERRENO ABANDONADO') },
            // El último llena su zona entera
            levels: [
                { w: 8, d: 6, sheaves: 18, arena: 1, sign: 0x9a6a3a },
                { w: 12, d: 10, sheaves: 40, arena: 1.2, sign: 0xb07a44 },
                { w: 17, d: 15, sheaves: 80, arena: 1.45, sign: 0x5a9e32 },
                { w: 22, d: 21, sheaves: 140, arena: 1.75, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 240, arena: 2.1, sign: 0xc8402e },
            ],
        },
        {
            id: 'tomato',
            crop: 'tomato',
            name: L('TOMATO FIELD', 'CAMPO DE TOMATES'),
            corner: { x: 105, z: 45, center: true }, // crece desde el centro de su parcela
            cost: { wheat: 5, tomato: 3 },
            turrets: { wheat: 40, tomato: 25 },
            locked: { after: 'wheat', name: L('JUNKYARD', 'TERRENO ABANDONADO') },
            // El último llena su zona entera
            levels: [
                { w: 7, d: 6, sheaves: 8, arena: 1, sign: 0x9a6a3a },
                { w: 11, d: 10, sheaves: 18, arena: 1.2, sign: 0xb07a44 },
                { w: 16, d: 15, sheaves: 40, arena: 1.45, sign: 0x5a9e32 },
                { w: 22, d: 20, sheaves: 80, arena: 1.75, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 150, arena: 2.1, sign: 0xc8402e },
            ],
        },
        // Los de las parcelas que se compran (con su cultivo nuevo y su forma de disparar)
        // Los de las parcelas que se compran (con su cultivo nuevo y su forma de disparar). Al nivel
        // máximo ocupan casi toda su parcela (con un margen de aire)
        {
            id: 'pumpkin',
            crop: 'pumpkin',
            name: L('PUMPKIN PATCH', 'CAMPO DE CALABAZAS'),
            corner: { x: -15, z: 45, center: true }, // crece desde el centro de su parcela (la de abajo de la cañada)
            cost: { wheat: 8, pumpkin: 2 },
            turrets: { wheat: 40, pumpkin: 10 },
            locked: { land: 'sw', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 6, d: 5, sheaves: 6, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 10, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 16, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 26, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 40, arena: 2.4, sign: 0xc8402e },
            ],
        },
        // Colmenar: donde estaban las calabazas (la cañada); abejas con gotas de miel
        {
            id: 'honey',
            crop: 'honey',
            name: L('APIARY', 'COLMENAR'),
            corner: { x: 75, z: 15, center: true },
            cost: { wheat: 10, honey: 3 },
            turrets: { wheat: 40, honey: 12 },
            locked: { land: 'west2', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 6, d: 5, sheaves: 6, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 10, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 16, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 24, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 34, arena: 2.4, sign: 0xc8402e },
            ],
        },
        // Girasoles: debajo de los tomates
        {
            id: 'sunflower',
            crop: 'sunflower',
            name: L('SUNFLOWER FIELD', 'CAMPO DE GIRASOLES'),
            corner: { x: 75, z: 45, center: true },
            cost: { wheat: 8, sunflower: 4 },
            turrets: { wheat: 40, sunflower: 16 },
            locked: { land: 'east2', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 6, d: 5, sheaves: 8, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 14, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 22, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 32, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 48, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'corn',
            crop: 'corn',
            name: L('CORN FIELD', 'CAMPO DE MAÍZ'),
            corner: { x: 45, z: 15, center: true },
            cost: { wheat: 6, corn: 5 },
            turrets: { wheat: 40, corn: 30 },
            locked: { land: 'east', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 6, d: 5, sheaves: 16, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 36, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 72, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 140, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 260, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'milk',
            crop: 'milk',
            name: L('COW PASTURE', 'PRADO DE VACAS'),
            corner: { x: -15, z: -15, center: true },
            cost: { wheat: 10, milk: 3 },
            turrets: { wheat: 40, milk: 12 },
            locked: { land: 'nw', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            // sheaves: vacas del campo de tiro (un cubo cada una)
            levels: [
                { w: 6, d: 5, sheaves: 4, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 6, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 10, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 15, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 22, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'wool',
            crop: 'wool',
            name: L('SHEEP MEADOW', 'PRADO DE LAS OVEJAS'),
            corner: { x: 75, z: -15, center: true }, // (a la izquierda de las vacas, en la orilla alta)
            cost: { wheat: 12, wool: 3 },
            turrets: { wheat: 40, wool: 12 },
            locked: { land: 'nw2', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            // sheaves: ovejas del campo de tiro (un ovillo cada una)
            levels: [
                { w: 6, d: 5, sheaves: 6, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 10, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 18, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 28, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 40, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'truffle',
            crop: 'truffle',
            name: L('PIGSTY', 'POCILGA'),
            corner: { x: 15, z: -15, center: true }, // (donde estaba la casa)
            cost: { wheat: 10, truffle: 3 },
            turrets: { wheat: 40, truffle: 10 },
            locked: { land: 'house', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            // sheaves: cerdos del campo de tiro (una trufa cada uno)
            levels: [
                { w: 6, d: 5, sheaves: 4, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 7, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 11, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 16, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 22, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'fish',
            crop: 'fish',
            name: L('FISHING POND', 'LAGUNA DEL PESCADOR'),
            corner: { x: 15, z: 45, center: true },
            cost: { wheat: 10, fish: 3 },
            turrets: { wheat: 40, fish: 12 },
            locked: { land: 'south', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            // sheaves: peces de la laguna del campo de tiro (un pescado cada uno)
            levels: [
                { w: 6, d: 5, sheaves: 6, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 10, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 16, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 24, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 34, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'egg',
            crop: 'egg',
            name: L('HEN RUN', 'CORRAL DE GALLINAS'),
            corner: { x: -15, z: 15, center: true }, // (donde estaban las calabazas)
            cost: { wheat: 10, egg: 3 },
            turrets: { wheat: 40, egg: 12 },
            locked: { land: 'west', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            // sheaves: gallinas del campo de tiro (un huevo cada una)
            levels: [
                { w: 6, d: 5, sheaves: 5, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 8, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 12, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 18, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 26, arena: 2.4, sign: 0xc8402e },
            ],
        },
    ],
    // Caminos de tierra: rectángulos de casillas [x0, z0, x1, z1) (el final no entra)
    paths: [
        [14, 14, 16, 30],   // del portón del granero al sur (cruza la pista)
        [0, 16, 30, 17],    // de oeste a este, delante del granero
        [14, 0, 16, 9],     // a la trasera del granero (sale por el norte)
        [14, -13, 16, 0],   // de la casa hacia la granja (sale por el sur)
        [17, -16, 30, -14], // de la casa hacia el este
        [0, -16, 13, -14],  // de la casa hacia el oeste
    ],
};

// Torreta automática de un campo (mejora extra con el campo al máximo): una sola, que va de
// esquina en esquina (salta cada hop s a la de al lado, nunca en diagonal, como el tirador entre torres). Dispara a ráfagas (burst
// balas, una cada rate s) como una ametralladora. En el mapa, plantada en unos sacos en cada
// esquina, recoge sola lo que esté maduro, una mata cada every s (mientras el juego está
// abierto), y entre tanto no para de tirotear el campo. En el campo de tiro va de un mástil a
// otro (de alto mast, en cada torre menos la tuya): acribilla una mata con una ráfaga y la
// recoge, descansa cool s y a por otra. Lo que recoge no suma a las rachas.
// Munición: ammo matas recogidas (en el mapa y en el campo de tiro) y se queda sin balas, quieta
// hasta que se recargue en el panel del campo pagando reload monedas de oro (las de cartón del
// mercader; a medio gastar, la parte que falta, al menos 1).
export const TURRETS = { every: 4, cool: 0.7, burst: 6, rate: 0.075, aim: 0.35, mast: 2.4, hop: 7, ammo: 60, reload: 6 };

// Fichas de los edificios: un texto corto debajo del nombre
export const INFO = {
    silo: L('GRAIN SILO. KEEPS THE HARVEST DRY.', 'SILO DE GRANO. MANTIENE SECA LA COSECHA.'),
    house: L('HOME SWEET HOME.', 'HOGAR, DULCE HOGAR.'),
    tractor: L('READY TO PLOUGH.', 'LISTO PARA ARAR.'),
};

export const FIELD_BY_ID = Object.fromEntries(FARM.fields.map((f) => [f.id, f]));

export const LAND_BY_ID = Object.fromEntries(FARM.lands.map((l) => [l.id, l]));

// ---------- Composición del mapa ----------
// Cada parcela de 30×30 casillas guarda su lógica en sus coordenadas de siempre (from: su esquina
// en la cuadrícula de antes), pero en el mapa rellena su zona entera del valle (world/valley.js):
// su centro va al punto más hondo de la zona y desde ahí se estira (o se encoge) en cada dirección
// hasta el borde de la zona. Lo de cerca del centro (el granero, la casa, el cruce) queda tal cual;
// lo de fuera se reparte hasta el borde. En el campo de tiro todo sigue siendo cuadrado.
//   gates  por dónde salen sus caminos (en sus coordenadas de siempre, en su borde)
export const PLACES = [
    { id: 'farm', from: [0, 0], gates: [[15, 30], [0, 16.5], [30, 16.5], [15, 0]] },
    { id: 'wheatP', from: [90, 0], gates: [] },
    { id: 'tomatoP', from: [90, 30], gates: [] },
    { id: 'house', from: [0, -30], gates: [[15, 0], [30, -15], [0, -15]] },
    { id: 'merchant', from: [30, -30], gates: [] },
    { id: 'west', from: [-30, 0], gates: [] },
    { id: 'east', from: [30, 0], gates: [] },
    { id: 'nw', from: [-30, -30], gates: [] },
    { id: 'south', from: [0, 30], gates: [] },
    { id: 'se', from: [30, 30], gates: [] },
    { id: 'sw', from: [-30, 30], gates: [] },
    { id: 'nw2', from: [60, -30], gates: [] },
    { id: 'west2', from: [60, 0], gates: [] },
    { id: 'east2', from: [60, 30], gates: [] },
    { id: 'well', from: [120, 0], gates: [] }, // (el pozo de los deseos: su cuadrado, fuera de los demás)
];
const NA = 96; // direcciones en las que se mide la zona desde su centro
{
    // Lo lejos que está cada celda del borde de su zona (para buscar el centro de cada una)
    const N = GN * GN, depth = new Int16Array(N).fill(-1), q = [];
    for (let k = 0; k < N; k++) {
        if (G.reg[k] < 0 || G.water[k]) continue;
        const i = k % GN, nb = [i > 0 ? k - 1 : -1, i < GN - 1 ? k + 1 : -1, k - GN, k + GN];
        if (nb.some((j) => j < 0 || j >= N || G.reg[j] !== G.reg[k] || G.water[j])) { depth[k] = 0; q.push(k); }
    }
    for (let qi = 0; qi < q.length; qi++) {
        const k = q[qi], i = k % GN;
        for (const j of [i > 0 ? k - 1 : -1, i < GN - 1 ? k + 1 : -1, k - GN, k + GN]) {
            if (j < 0 || j >= N || depth[j] >= 0 || G.reg[j] !== G.reg[k] || G.water[j]) continue;
            depth[j] = depth[k] + 1;
            q.push(j);
        }
    }
    for (const P of PLACES) {
        P.ri = REGIONS.findIndex((r) => r.place === P.id);
        P.rot = 0;
        const R = REGIONS[P.ri], [sx, sz] = toXZ(...R.seeds[0]);
        // El centro: la celda más honda (y, entre las igual de hondas, la más cerca de su semilla)
        let best = -1, bs = -Infinity;
        for (let k = 0; k < N; k++) {
            if (G.reg[k] !== P.ri || G.water[k]) continue;
            const sc = depth[k] - Math.hypot(cellX(k) - sx, cellZ(k) - sz) * 0.02;
            if (sc > bs) { bs = sc; best = k; }
        }
        P.c = [cellX(best), cellZ(best)];
        P.at = [P.c[0] - 15, P.c[1] - 15];
        P.h = R.h;
        // Hasta dónde llega la zona en cada dirección (sin pasarse: el mínimo con las de al lado)
        const raw = [];
        for (let a = 0; a < NA; a++) {
            const ang = (a / NA) * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
            let t = 0;
            while (t < 90 && regionAt(P.c[0] + dx * t, P.c[1] + dz * t) === P.ri) t += 0.5;
            raw.push(Math.max(2, t - 0.6));
        }
        P.reach = raw.map((_, a) => Math.min(...[-1, 0, 1].map((d) => raw[(a + d + NA) % NA])));
        // Lo de dentro de este radio queda sin estirar (el granero, la casa, el cruce de caminos)
        P.core = Math.min(6, Math.min(...P.reach) * 0.6);
    }
}
// Cuánto llega la zona de P en la dirección ang (interpolado entre las medidas)
export function reachAt(P, ang) {
    const f = ((ang / (Math.PI * 2)) * NA + NA) % NA, i = Math.floor(f), k = f - i;
    return P.reach[i] * (1 - k) + P.reach[(i + 1) % NA] * k;
}
// Del cuadrado a la zona: un desplazamiento (dx, dz) desde el centro del cuadrado, en el mundo
function stretch(P, dx, dz, inverse = false) {
    const d = Math.hypot(dx, dz);
    if (d <= P.core) return [dx, dz];
    const ang = Math.atan2(dz, dx), sq = 15 / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))), r = reachAt(P, ang);
    const d2 = inverse ? P.core + ((d - P.core) * (sq - P.core)) / (r - P.core) : P.core + ((d - P.core) * (r - P.core)) / (sq - P.core);
    return [(dx / d) * d2, (dz / d) * d2];
}
const placeOf = (x, z) => PLACES.find(({ from: [x0, z0] }) => x >= x0 && x < x0 + 30 && z >= z0 && z < z0 + 30);
// Un punto de la parcela P (en sus coordenadas de siempre), en el mundo: estirado hasta su zona
export function placeToWorld(P, x, z, y = 0) {
    const [dx, dz] = stretch(P, x - P.from[0] - 15, z - P.from[1] - 15);
    return { x: P.c[0] + dx, y: y + P.h, z: P.c[1] + dz, place: P };
}
// Y al revés: un punto del mundo, en las coordenadas de siempre de la parcela P
export function worldToPlace(P, x, z) {
    const [dx, dz] = stretch(P, x - P.c[0], z - P.c[1], true);
    return { x: P.from[0] + 15 + dx, z: P.from[1] + 15 + dz };
}
// Un rectángulo de la parcela P (en sus coordenadas de siempre), recto en el mundo: sus lados
// llegan hasta donde llegan los estirados (por su línea media), pero sin torcerse (la pista y las
// plataformas de hormigón: al estirarlas se doblaban a escalones). En el mundo, a medias casillas
export function worldRect(P, [x0, z0, x1, z1]) {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, snap = (v) => Math.round(v * 2) / 2;
    const a = placeToWorld(P, x0, mz), b = placeToWorld(P, x1, mz), c = placeToWorld(P, mx, z0), d = placeToWorld(P, mx, z1);
    return [snap(a.x), snap(c.z), snap(b.x), snap(d.z)];
}
// Del mundo al grupo de la parcela P (que solo la lleva a su sitio, sin estirar)
export const worldToLocal = (P, x, z) => ({ x: P.from[0] + 15 + x - P.c[0], z: P.from[1] + 15 + z - P.c[1] });
// Lo que se cuelga del grupo de una parcela (que solo la lleva a su sitio, sin estirar): dónde
// tiene que ir dentro del grupo un punto de sus coordenadas de siempre para caer donde toca
export function stretchLocal(x, z) {
    const P = placeOf(x, z);
    if (!P) return { x, z };
    const [dx, dz] = stretch(P, x - P.from[0] - 15, z - P.from[1] - 15);
    return { x: P.from[0] + 15 + dx, z: P.from[1] + 15 + dz };
}
// De las coordenadas de siempre (de una parcela) al mundo (fuera de las parcelas, tal cual)
export function toWorld(x, z, y = 0) {
    const P = placeOf(x, z);
    return P ? placeToWorld(P, x, z, y) : { x, y, z, place: null };
}
// La parcela que cubre un punto del mundo: la de su zona (los rincones a los que no llega su
// cuadrado estirado toman lo de su borde más cercano)
export function floorPlace(x, z) {
    const ri = regionAt(x, z);
    return ri < 0 ? null : PLACES.find((p) => p.ri === ri) || null;
}
// Una puerta de una parcela, en el mundo, y hacia dónde sale (ox, oz)
export function gateWorld(id, i) {
    const P = PLACES.find((p) => p.id === id), [gx, gz] = P.gates[i];
    const lx = gx - P.from[0], lz = gz - P.from[1];
    const ox = lx <= 0 ? -1 : lx >= 30 ? 1 : 0, oz = lz <= 0 ? -1 : lz >= 30 ? 1 : 0;
    const w = placeToWorld(P, gx - ox * 0.01, gz - oz * 0.01);
    return { x: w.x, z: w.z, y: P.h, ox, oz };
}
// ¿Este punto (en las coordenadas de siempre) es de su parcela? (ahora la parcela entera cae en su zona)
export function inShapeOf() {
    return true;
}
// El poste de cada parcela en venta: a un lado de su centro (fuera de su campo al máximo, que
// ocupa del 1 al 29), del lado que mira a la granja
{
    const F = PLACES[0], fx = F.at[0] + 15, fz = F.at[1] + 15;
    for (const l of FARM.lands) {
        const P = PLACES.find((p) => p.id === l.id), cx = P.at[0] + 15, cz = P.at[1] + 15;
        const dx = fx - cx, dz = fz - cz;
        const sides = [[Math.sign(dx) || 1, 0], [0, Math.sign(dz) || 1], [-(Math.sign(dx) || 1), 0], [0, -(Math.sign(dz) || 1)]];
        if (Math.abs(dz) > Math.abs(dx)) [sides[0], sides[1]] = [sides[1], sides[0]];
        const [ox, oz] = sides[0], post = { x: P.from[0] + 15 + ox * 14.4, z: P.from[1] + 15 + oz * 14.4 };
        l.post = post || { x: P.from[0] + 15, z: P.from[1] + 15 };
    }
}
// Lo que abarca el valle: en la pantalla (u, v) y en el mundo (para la cámara)
FARM.valley = { w: VW, h: VH, toUV, toXZ };
FARM.world = { x0: -VW * 0.71, z0: -VH * 0.71, x1: VW * 0.71, z1: VH * 0.71 };
FARM.view = { ...FARM.world };

// La forma de un campo (no un rectángulo): una mancha de esquinas redondeadas y borde irregular
// dentro de su rectángulo f, distinta en cada campo (seed)
export function inFieldShape(f, seed, x, z) {
    const u = (x - f.cx) / (f.w / 2), v = (z - f.cz) / (f.d / 2), a = Math.atan2(v, u);
    // Cuanto más grande, más cuadrado (y menos ondulado): en el mapa la parcela se estira hasta
    // su zona, así que un campo que llena su parcela llena la zona y su borde es el de la zona
    const big = Math.min(1, Math.min(f.w, f.d) / 28) ** 3, e = 2.6 + 9 * big;
    const R = 1 - (0.05 * (1 + Math.sin(a * 3 + seed)) + 0.03 * (1 + Math.sin(a * 7 + seed * 2.3))) * (1 - 0.8 * big);
    return Math.abs(u) ** e + Math.abs(v) ** e <= R ** e;
}
