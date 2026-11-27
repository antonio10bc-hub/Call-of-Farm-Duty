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
    // Fichas de caballo: el rodeo. Se va a caballo dando vueltas a la pista y disparando a los
    // obstáculos que salen y a los jinetes alienígenas; cada vuelta, una ficha (el id sigue siendo
    // 'tomato': así valen las partidas guardadas)
    tomato: {
        name: L('HORSE TOKENS', 'FICHAS DE CABALLO'),
        icon: 'tomato',
        growTime: 45,
        pasture: true, // (en el mapa, caballos dando vueltas a su pista)
        sand: true, // (el ruedo, de arena)
        speed: 6.5, // lo que corre el caballo (m/s, en el campo de tiro normal)
        coat: [0x8a5a34, 0xc8a070, 0x5a3a24, 0xf0e8d8],
        fruit: 0xe8b830, // (la ficha: de latón, con su herradura)
        calyx: 0x8a5a2e,
        burst: [0xffd23f, 0xe8b830, 0xfff3d6, 0xc09a62],
        chaff: [0xc09a62, 0xe0c890, 0xb8925a],
        unit: L('LAPS', 'VUELTAS'),
        loot: 0xe8b830,
        stub: [0xc8b070, 0xd8c088, 0xb8a060],
    },
    // Queso: cabras que no paran de saltar de montículo en montículo de rocas (y alguna voltereta);
    // las rocas tapan la vista y paran la bala, así que hay que ir cambiando de torre. Cuanto más
    // nivel, más montículos. Cada cabra, un queso (el id sigue siendo 'pumpkin')
    pumpkin: {
        name: L('CHEESE', 'QUESO'),
        icon: 'pumpkin',
        growTime: 60,
        pasture: true,
        rocks: [0x9a948a, 0x8a847a, 0xb0aa9e, 0x7a746a],
        moss: 0x6a9a3a,
        coat: [0xf6f3ea, 0xe8dcc0, 0xc8a878], // (blancas, crema y canela)
        horn: 0xd8c8a0,
        dark: 0x3a2e2a,
        hop: [0.5, 1.4], // segundos quieta en lo alto de un montículo entre salto y salto
        flip: 0.35, // de cada salto, los que llevan voltereta
        fruit: 0xffd23f,
        burst: [0xffd23f, 0xffe9a0, 0xe8b830, 0xfff6dc],
        chaff: [0xfff6dc, 0xf6f3ea, 0xb0aa9e],
        unit: L('CHEESES', 'QUESOS'),
        loot: 0xffd23f,
        stub: [0x8fb85a, 0x7fa84e, 0x9a948a],
    },
    // Luciérnagas: solo salen de noche (de día el campo no se puede recoger). Revolotean por un
    // prado de hierba alta, encendiéndose y apagándose; cada una es un blanco (el id sigue siendo
    // 'corn')
    corn: {
        name: L('FIREFLIES', 'LUCIÉRNAGAS'),
        icon: 'corn',
        growTime: 50,
        meadow: true,
        night: true, // (solo de noche)
        glow: 0xd8ff5a,
        glowDark: 0x9ae03a,
        body: 0x2a2a1e,
        leaves: [0x4a8a3a, 0x3d7a32, 0x5a9a42],
        fruit: 0xd8ff5a,
        burst: [0xd8ff5a, 0xf6ffb0, 0x9ae03a, 0xffffff],
        chaff: [0xd8ff5a, 0x9ae03a, 0x3d7a32],
        unit: L('FIREFLIES', 'LUCIÉRNAGAS'),
        loot: 0xd8ff5a,
        stub: [0x3d7a32, 0x4a8a3a, 0x5a9a42],
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
        meadow: true, // (su campo es un prado de hierba, no tierra arada)
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
    // Perlas: una piscifactoría (una piscina en medio del campo, con su borde de hormigón) con
    // almejas en el fondo. Están cerradas y, de vez en cuando, se abren hacia un lado: solo se le
    // puede dar a la perla con la almeja abierta y de cara a tu torre (cambiar de torre importa).
    // A ratos nadan a otro sitio dando palmadas con la concha (el id sigue siendo 'sunflower')
    sunflower: {
        name: L('PEARLS', 'PERLAS'),
        icon: 'sunflower',
        growTime: 55,
        pond: 3, // (la piscina: a este tanto de la valla)
        pool: true, // (con borde de hormigón, recta)
        shell: [0x8a9ab0, 0x7a8aa0, 0x9aa8b8],
        shellDark: 0x5a6a80,
        inside: 0xf2c8d0,
        pearl: 0xfffdf6,
        closed: [2, 5], // segundos cerrada
        open: [2.2, 3.8], // segundos abierta
        swim: 0.3, // de cada vez que se cierra, las que se van nadando a otro sitio
        fruit: 0xfffdf6,
        burst: [0xfffdf6, 0xffffff, 0xf2c8d0, 0xc0e4f8],
        chaff: [0xffffff, 0x9fdcff, 0x5ab4ff],
        unit: L('PEARLS', 'PERLAS'),
        loot: 0xfffdf6,
    },
};
