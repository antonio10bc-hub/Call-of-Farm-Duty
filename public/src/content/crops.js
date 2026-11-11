import { L } from '../core/I18n.js';

// Cultivos.
//   name       nombre del recurso que da (contador, costes)
//   icon       sprite de la interfaz (clase CSS <icon>-ico y --px-<icon>)
//   growTime   segundos reales desde que se siembra hasta que está listo
//   stages     color de la planta en cada fase (brote → verde → madurando → maduro)
//   burst      colores de lo que salta al recogerlo en el campo de tiro
//   unit       cómo se llama cada blanco en las fichas (matas, tomates...)
//   loot       color del hatillo que se llevan los alienígenas al robarlo
//   stub       colores del rastrojo de su campo de tiro
export const CROPS = {
    wheat: {
        name: L('WHEAT', 'TRIGO'),
        icon: 'wheat',
        growTime: 30,
        stages: [0x6fbf3a, 0x8fcc40, 0xc8c84a, 0xe8b830],
        ear: 0xf6cf4a,
        earDark: 0xd9a42e,
        burst: [0xf6cf4a, 0xffe9a0, 0xd9a42e, 0xfff6dc],
        chaff: [0xe8b830, 0xc8c84a, 0xfff3d6],
        unit: L('BUNDLES', 'MATAS'),
        loot: 0xf6cf4a,
    },
    // Tomates: matas verdes con tutor y tomates gigantes (verdes mientras crecen)
    tomato: {
        name: L('TOMATOES', 'TOMATES'),
        icon: 'tomato',
        growTime: 45,
        stages: [0x6fbf3a, 0x4caf3c, 0x3d9a34, 0x3d9a34],
        leaves: [0x4caf3c, 0x3d9a34, 0x2f8a2c],
        fruit: 0xe8352a,
        fruitDark: 0xc0281e,
        unripe: 0x9ad04a,
        calyx: 0x2f8a2c,
        stake: 0xb07a44,
        burst: [0xe8352a, 0xff6a4a, 0xc0281e, 0xffd23f],
        chaff: [0xff8a6a, 0x4caf3c, 0xfff3d6],
        unit: L('TOMATOES', 'TOMATES'),
        loot: 0xe8352a,
    },
    // Calabazas gigantes tumbadas entre sus hojas: aguantan hp disparos (y paran la bala); cada
    // tiro las va resquebrajando
    pumpkin: {
        name: L('PUMPKINS', 'CALABAZAS'),
        icon: 'pumpkin',
        growTime: 60,
        hp: 3,
        stages: [0x6fbf3a, 0x5aa83a, 0x4a9a34, 0x3d8a2c],
        leaves: [0x4a9a34, 0x3d8a2c, 0x5aa83a],
        fruit: 0xf08a1e,
        fruitDark: 0xd06a10,
        unripe: 0x9ad04a,
        calyx: 0x5a7a2a,
        burst: [0xf08a1e, 0xffb04a, 0xd06a10, 0xfff3d6],
        chaff: [0xffe9a0, 0x4a9a34, 0xd06a10],
        unit: L('PUMPKINS', 'CALABAZAS'),
        loot: 0xf08a1e,
        stub: [0x4a9a34, 0x3d8a2c, 0x8a7a4a],
    },
    // Maíz: matas muy altas en hileras con las mazorcas arriba (las hileras dan colaterales
    // largos); las matas tapan la vista
    corn: {
        name: L('CORN', 'MAÍZ'),
        icon: 'corn',
        growTime: 50,
        stages: [0x6fbf3a, 0x8fcc40, 0x9ac040, 0xa8b048],
        leaves: [0x7ab83a, 0x6aa832, 0x8ac04a],
        fruit: 0xffd23f,
        fruitDark: 0xe8b830,
        unripe: 0xc8e070,
        calyx: 0x9ac04a,
        stalk: 0x8ab83a,
        burst: [0xffd23f, 0xfff3a0, 0xe8b830, 0xfff6dc],
        chaff: [0xc8e070, 0x9ac04a, 0xfff3d6],
        unit: L('COBS', 'MAZORCAS'),
        loot: 0xffd23f,
        stub: [0x9ac04a, 0x8a7a4a, 0x7ab83a],
    },
    // Leche: vacas que corren por su prado; cada poco se les hincha la ubre y, llena, un tiro a la
    // ubre da un cubo de leche (cada vaca, uno por partida). Su campo es un prado, no tierra arada
    milk: {
        name: L('MILK', 'LECHE'),
        icon: 'milk',
        growTime: 50,
        pasture: true,
        swell: [3, 7], // segundos que tarda en llenarse la ubre de cada vaca
        burst: [0xffffff, 0xf3ead2, 0xd8f0ff, 0xffffff],
        chaff: [0xffffff, 0xf2a0b0, 0xf3ead2],
        unit: L('BUCKETS', 'CUBOS'),
        loot: 0xf6f3ea,
        stub: [0x8fd45a, 0x7fc84e, 0x9ad962],
    },
    // Huevos: gallinas que corretean por su corral y, cada poco, lanzan un huevo al aire como un
    // plato de tiro: hay que darle al huevo en el aire (a las gallinas, no). Si cae sin que le des,
    // se casca contra el suelo y la gallina vuelve a ponerse. Cada gallina, un huevo por partida
    egg: {
        name: L('EGGS', 'HUEVOS'),
        icon: 'egg',
        growTime: 40,
        pasture: true,
        swell: [2.5, 6], // segundos hasta que lanza el huevo
        toss: { up: [10, 13], side: [0.6, 2.2], grav: 9 }, // el lanzamiento: velocidad hacia arriba y de lado
        burst: [0xffffff, 0xfff6dc, 0xffd23f, 0xf6e8c8],
        chaff: [0xfff6dc, 0xffe06a, 0xffffff],
        unit: L('EGGS', 'HUEVOS'),
        loot: 0xfff6dc,
        stub: [0xb4d070, 0xa8c860, 0xc0d880],
    },
    // Pescado: peces en la laguna del centro de su campo que saltan fuera del agua cuando quieren,
    // en arco, cada uno de su tamaño (los pequeños, altos y deprisa; los grandes, bajos y
    // despacio); en el aire, un tiro y es tuyo. Si no, vuelve al agua y salta más tarde
    fish: {
        name: L('FISH', 'PESCADO'),
        icon: 'fish',
        growTime: 45,
        pasture: true,
        pond: 2.4, // (su campo: una laguna que lo llena casi entero; desde la valla, este tanto de orilla)
        swell: [1.2, 4.5], // segundos bajo el agua entre salto y salto
        // El salto de cada tamaño: velocidad hacia arriba y de lado
        jump: { s: { up: [10, 12], side: [1.6, 3] }, m: { up: [8, 9.5], side: [1.2, 2.2] }, l: { up: [6, 7], side: [0.8, 1.5] }, grav: 9.5 },
        burst: [0xffffff, 0xc0e4f8, 0x5ab4ff, 0x9ab8d0],
        chaff: [0xffffff, 0x9fdcff, 0x5ab4ff],
        unit: L('FISH', 'PESCADOS'),
        loot: 0x9ab8d0,
        stub: [0x6a9a3a, 0x5a8a2e, 0x7aaa4a],
    },
    // Trufas: cerdos en su pocilga embarrada, que cogen carrerilla y se deslizan de barriga por el
    // barro una y otra vez (rebotando contra el borde y entre ellos); hozando, cada poco uno
    // encuentra una trufa y la lleva en el lomo: un tiro a la trufa, y es tuya (cada cerdo, una)
    truffle: {
        name: L('TRUFFLES', 'TRUFAS'),
        icon: 'truffle',
        growTime: 50,
        pasture: true,
        mud: true, // (su campo, de barro)
        swell: [3, 7], // segundos que tarda cada cerdo en encontrar su trufa
        burst: [0x4a2e1a, 0x7a5232, 0xffe03a, 0xf2a8b0],
        chaff: [0x7a5232, 0x5a3a22, 0x8a5e38],
        unit: L('TRUFFLES', 'TRUFAS'),
        loot: 0x4a2e1a,
        stub: [0x7a5232, 0x6a4628, 0x8a5e38],
    },
    // Lana: ovejas que corren por su prado de un lado a otro, al azar, rebotando entre ellas; el
    // vellón les crece hasta hacerse una bola gigante y, entonces, un tiro a la bola da un ovillo
    // (y la oveja sigue, esquilada). Su campo es un prado, como el de las vacas
    wool: {
        name: L('WOOL', 'LANA'),
        icon: 'wool',
        growTime: 55,
        pasture: true,
        swell: [4, 8], // segundos que tarda en hacerse bola el vellón de cada oveja
        burst: [0xffffff, 0xfaf6ec, 0xf0e8d6, 0xfffdf6],
        chaff: [0xffffff, 0xf0e8d6, 0xe8dcc0],
        unit: L('BALLS OF WOOL', 'OVILLOS'),
        loot: 0xfaf6ec,
        stub: [0x9ad962, 0x8fd45a, 0xa8e070],
    },
    // Miel: colmenas entre flores; las abejas llevan gotas de miel brillante por el aire dando
    // vueltas. Se le dispara a la gota (no a la abeja)
    honey: {
        name: L('HONEY', 'MIEL'),
        icon: 'honey',
        growTime: 70,
        stages: [0x6fbf3a, 0x8fcc40, 0xc8b040, 0xf0a020],
        hive: 0xf0d080,
        roof: 0xb07a44,
        fruit: 0xf0a020,
        drop: 0xffb020,
        flowers: [0xff7ae0, 0xffe03a, 0x5af0ff, 0xffffff],
        burst: [0xffb020, 0xffd23f, 0xf08a1e, 0xfff3d6],
        chaff: [0xffd23f, 0x2a1a0e, 0xfff3d6],
        unit: L('DROPS', 'GOTAS'),
        loot: 0xffb020,
        stub: [0x6a9a3a, 0xff7ae0, 0xffe03a, 0x5a8a32],
    },
    // Girasoles: altos, con la cabeza que va girando; solo se le puede dar a una cabeza cuando te
    // mira (cambiar de torre importa)
    sunflower: {
        name: L('SUNFLOWERS', 'GIRASOLES'),
        icon: 'sunflower',
        growTime: 55,
        stages: [0x6fbf3a, 0x5aa83a, 0x4a9a34, 0x3d8a2c],
        leaves: [0x5aa83a, 0x4a9a34, 0x3d8a2c],
        fruit: 0xffd23f,
        center: 0x6a4020,
        unripe: 0x9ad04a,
        burst: [0xffd23f, 0xffe03a, 0x6a4020, 0xfff3d6],
        chaff: [0xffd23f, 0x3d8a2c, 0x2a1a0e],
        unit: L('FLOWERS', 'FLORES'),
        loot: 0xffd23f,
        stub: [0x4a9a34, 0x3d8a2c, 0x8a7a4a],
    },
};
