// Sprites pixelados de la interfaz (moneda, trofeo, destellos), dibujados píxel a píxel
// para que la UI tenga el mismo aspecto que el juego. Se pintan en canvas pequeños y se
// escalan con image-rendering: pixelated, nunca suavizados.

const INK = '#2a1a0e';
// La moneda de oro... de cartón: un círculo de cartón recortado a mano (canto ondulado de cartón
// corrugado), pintado de amarillo con cera a brochazos (se ve el cartón por los huecos) y un $
// garabateado con rotulador. Muy falsa, pero es la moneda oficial.
const CARD = { edge: '#8a5a2e', dark: '#a8763e', base: '#c8955a', paint: '#ffd23f', paint2: '#f2b830', pen: '#6a3a1a' };
// size: lado del sprite en píxeles; half: media anchura (para la moneda girando: de frente = size/2 - 1)
export function drawCoin(ctx, half, S = 16) {
    const c = (S - 1) / 2, ry = S / 2 - 0.1, rx = Math.min(ry, half + 0.9);
    ctx.clearRect(0, 0, S, S);
    // Recortada a tijera: el radio sube y baja un poco con el ángulo
    const inside = (x, y) => {
        if (x < 0 || y < 0 || x >= S || y >= S) return false;
        const a = Math.atan2(y - c, x - c), k = 1 - 0.07 * Math.max(0, Math.sin(a * 3 + 1.3));
        return ((x - c) / (rx * k)) ** 2 + ((y - c) / (ry * k)) ** 2 <= 1;
    };
    // El $ de rotulador en el centro (en la pequeña, un garabato)
    const D = S >= 14 ? ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'] : ['.#.', '##.', '.##', '.#.'];
    const dx = Math.round(c - (D[0].length - 1) / 2), dy = Math.round(c - (D.length - 1) / 2);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        const nx = (x - c) / rx, ny = (y - c) / ry, d = Math.hypot(nx, ny);
        // La pintura no llega al borde y está dada a mano: su límite sube y baja
        const a = Math.atan2(ny, nx), lim = 0.66 + 0.08 * Math.sin(a * 5 + 0.7);
        let col;
        if (edge) col = INK;
        else if (half <= 1) col = (y % 2) ? CARD.dark : CARD.base;                 // de canto: el corrugado
        else if (d > lim) col = (Math.round(a * 4) % 2) ? CARD.dark : CARD.base;  // cartón sin pintar
        else {
            col = nx + ny > 0.45 ? CARD.paint2 : CARD.paint;
            const px = x - dx, py = y - dy;
            if (half >= 5 && D[py] && D[py][px] === '#') col = CARD.pen;
        }
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
    }
}
export const COIN_SPIN = [7, 6, 4, 1, 4, 6];

const SPRITES = {
    trophy: {
        rows: [
            '.KKKKKKKKKK.',
            'KK.KYYYYYK.K',
            'K..KWYYYOK.K',
            'K..KWYYYOK.K',
            '.K.KYYYYOK.K',
            '..KKYYYOOKK.',
            '....KYYOK...',
            '.....KOK....',
            '.....KOK....',
            '....KYYOK...',
            '...KKKKKKK..',
            '...KOOOOOK..',
            '...KKKKKKK..',
        ],
        pal: { K: INK, Y: '#ffd23f', O: '#e6a400', W: '#fff4b0' },
    },
    starOn: {
        rows: ['.....K.....', '....KYK....', '....KYK....', 'KKKKKWYKKKK', 'KYYYYWYYYYK', '.KYYYYYYYK.', '..KYYYYYK..',
            '..KYYKYYK..', '.KYYK.KYYK.', '.KYK...KYK.', '.KK.....KK.'],
        pal: { K: INK, Y: '#ffd23f', W: '#fff4b0' },
    },
    starOff: {
        rows: ['.....K.....', '....KYK....', '....KYK....', 'KKKKKYYKKKK', 'KYYYYYYYYYK', '.KYYYYYYYK.', '..KYYYYYK..',
            '..KYYKYYK..', '.KYYK.KYYK.', '.KYK...KYK.', '.KK.....KK.'],
        pal: { K: INK, Y: '#3b2d6b' },
    },
    skull: {
        rows: ['..KKKKKKKK..', '.KWWWWWWWWK.', 'KWWWWWWWWWWK', 'KWRRKWWKRRWK', 'KWRRKWWKRRWK', 'KWWWWKKWWWWK',
            '.KWWWWWWWWK.', '..KWKWKWKK..', '..KWKWKWKK..', '...KKKKKK...'],
        pal: { K: INK, W: '#ffffff', R: '#ff1a3a' },
    },
    // Casita del botón de volver (Ajustes)
    // La casa: tejado rojo con sus tejas, chimenea, ventana encendida y la puerta
    home: {
        rows: ['.....KK.....', '....KRRK.KK.', '...KRRRRKSK.', '..KRRDRRRKK.', '.KRRRRRDRRK.', 'KRDRRRRRRRRK', 'KKKKKKKKKKKK', '.KWWWWWWWWK.', '.KWKKKWKKKK.', '.KWKYKWKNNK.', '.KWKKKWKNNK.', 'KKKKKKKKKKKK'],
        pal: { K: INK, R: '#e8452e', D: '#b8321e', S: '#9a948c', W: '#fff3d6', Y: '#ffd23f', N: '#a8642e' },
    },
    // Mejoras de supervivencia (vida, recarga, daño, velocidad)
    upHeart: {
        rows: ['............', '..KK....KK..', '.KRRK..KRRK.', 'KRWRRKKRRRRK', 'KRWRRRRRRRRK', 'KRRRRRRRRRRK', '.KRRRRRRRRK.', '..KRRRRRRK..', '...KRRRRK...', '....KRRK....', '.....KK.....', '............'],
        pal: { K: INK, R: '#ff3e5e', W: '#ffd0d8' },
    },
    upReload: {
        rows: ['............', '.KK..KK..KK.', 'KYYKKYYKKYYK', 'KYYKKYYKKYYK', 'KOOKKOOKKOOK', 'KOOKKOOKKOOK', 'KOOKKOOKKOOK', 'KKKKKKKKKKKK', '........K...', 'KKKKKKKKWK..', 'KWWWWWWWWWK.', 'KKKKKKKKWK..'],
        pal: { K: INK, Y: '#ffd23f', O: '#e6a400', W: '#ffffff' },
    },
    upDamage: {
        rows: ['.....K......', '....KOK.....', '....KOOK.K..', '...KOOYOKOK.', '..KOOYYOOOK.', '.KOOYYWYOOK.', '.KOYYWWYYOK.', '.KOYYWWYYOK.', '.KOOYYYYOOK.', '..KOOOOOOK..', '...KKKKKK...', '............'],
        pal: { K: INK, O: '#ff6a00', Y: '#ffd23f', W: '#ffffff' },
    },
    upShield: {
        rows: ['..KKKKKKKK..', '.KBBBBBBBBK.', '.KBWWBBBBBK.', '.KBWBBBBBBK.', '.KBBBBBBBBK.', '.KBBBBBBBBK.', '..KBBBBBBK..', '..KBBBBBBK..', '...KBBBBK...', '....KBBK....', '.....KK.....', '............'],
        pal: { K: INK, B: '#6ff6ff', W: '#ffffff' },
    },
    upMagnet: {
        rows: ['............', '.KKKK..KKKK.', '.KRRK..KBBK.', '.KRRK..KBBK.', '.KRRK..KBBK.', '.KRRK..KBBK.', '.KRRKKKKBBK.', '.KRRRRRRRRK.', '..KRRRRRRK..', '...KKKKKK...', '.W.......W..', '..W.....W...'],
        pal: { K: INK, R: '#ff3e5e', B: '#d0dcff', W: '#ffe03a' },
    },
    upSpeed: {
        rows: ['............', '.KK...KK....', '.KCK..KCK...', '..KCK..KCK..', '...KCK..KCK.', '....KCK..KCK', '....KCK..KCK', '...KCK..KCK.', '..KCK..KCK..', '.KCK..KCK...', '.KK...KK....', '............'],
        pal: { K: INK, C: '#23e0d6' },
    },
    // Pestañas de "Mi Tanque": gorro, pintura, estela, baile y mascota
    tabHat: {
        rows: ['.....KK.....', '....KWWK....', '.....KK.....', '....KPPK....', '....KYYK....', '...KPPPPK...',
            '...KYYYYK...', '..KPPPPPPK..', '..KYYYYYYK..', '.KPPPPPPPPK.', 'KKKKKKKKKKKK', '............'],
        pal: { K: INK, W: '#ffffff', P: '#ff3e8e', Y: '#ffe03a' },
    },
    tabPaint: {
        rows: ['...KKKKKK...', '..K......K..', '.KKKKKKKKKK.', '.KPPPPPPPPK.', '.KPPPPPPPPK.', '.KKPKKKKPKK.',
            '.KWPWWWWPLK.', '.KWPWWWWWLK.', '.KWWWWWWWLK.', '.KWWWWWWWLK.', '..KKKKKKKK..', '............'],
        pal: { K: INK, W: '#e2dcff', L: '#b9b0d8', P: '#23e0d6' },
    },
    tabTrail: {
        rows: ['............', '............', '.......KKKK.', 'PPPP..KWWYYK', '......KWYYYK', '.YYYYYKYYYYK',
            '......KYYYOK', 'CCCC..KYYOOK', '.......KKKK.', '............', '............', '............'],
        pal: { K: INK, W: '#fff4b0', Y: '#ffd23f', O: '#e6a400', P: '#ff3e8e', C: '#23e0d6' },
    },
    tabDance: {
        rows: ['...KKKKKKKK.', '...KPPPPPPK.', '...KPKKKKPK.', '...KPK..KPK.', '...KPK..KPK.', '...KPK..KPK.',
            '.KKKPK.KKPK.', 'KPPPPKKPPPK.', 'KPPPPKPPPPK.', 'KPPPKKPPPK..', '.KKK..KKK...', '............'],
        pal: { K: INK, P: '#7b5cff' },
    },
    tabPet: {
        rows: ['..KKK..KKK..', '..KPK..KPK..', '..KKK..KKK..', 'KKK......KKK', 'KPK.KKKK.KPK', 'KKKKPPPPKKKK',
            '...KPPPPK...', '..KPPPPPPK..', '..KPPPPPPK..', '..KPPPPPPK..', '...KKKKKK...', '............'],
        pal: { K: INK, P: '#ff9a1f' },
    },
    // Panel lateral del ordenador: bala del cargador y objetos que llevas
    pwBullet: {
        rows: ['..KKK...', '.KWYYK..', '.KYYYK..', '.KYYOK..', '.KYYOK..', 'KKKKKKK.', 'KOOOOOK.', 'KOOOOOK.', 'KKKKKKK.'],
        pal: { K: INK, W: '#fff4b0', Y: '#ffd23f', O: '#e6a400' },
    },
    pwBounce: {
        rows: ['...KKKKKK...', '..KPPPPPPK..', '.KPWWPPPPPK.', '.KPWPPPPPPK.', '.KPPPPPPPPK.', '.KPPPPPPPPK.', '..KPPPPPPK..', '...KKKKKK...', '............', '.K..K..K..K.', '..KK.KK.KK..', '............'],
        pal: { K: INK, P: '#ff4fd8', W: '#ffffff' },
    },
    pwTriple: {
        rows: ['.KK..KK..KK.', 'KCCKKCCKKCCK', 'KWCKKWCKKWCK', 'KCCKKCCKKCCK', 'KCCKKCCKKCCK', 'KBBKKBBKKBBK', 'KBBKKBBKKBBK', 'KKKKKKKKKKKK', '............', '.K...K...K..', 'K...K....K..', '............'],
        pal: { K: INK, C: '#6ff6ff', W: '#ffffff', B: '#2a8bff' },
    },
    pwNuke: {
        rows: ['.......KK...', '......KYK...', '....KKKK....', '...KYYYYK...', '..KYKKKKYK..', '.KYKYYYYKYK.', '.KYKYKKYKYK.', '.KYKYKKYKYK.', '.KYKYYYYKYK.', '..KYKKKKYK..', '...KYYYYK...', '....KKKK....'],
        pal: { K: INK, Y: '#ffe600' },
    },
    pwRadar: {
        rows: ['KKKKKKKKKKKK', 'KDDDDDDDDDDK', 'KDDDDGDDDDDK', 'KDDDDGDDDWDK', 'KDDDDGDDDDDK', 'KDGGGGGGGGDK', 'KDDDDGDDDDDK', 'KDWDDGDDDDDK', 'KDDDDGDDDDDK', 'KDDDDDDDDDDK', 'KKKKKKKKKKKK', '............'],
        pal: { K: INK, D: '#0b3d22', G: '#7dff4a', W: '#ffffff' },
    },
    pwCloak: {
        rows: ['...KKKKKK...', '..KLLLLLLK..', '.KLLLLLLLLK.', '.KLKKLLKKLK.', '.KLKKLLKKLK.', '.KLLLLLLLLK.', '.KLLLLLLLLK.', '.KLLLLLLLLK.', '.KLLLLLLLLK.', '.KLKLLKLLKK.', '.KK.KK.KK...', '............'],
        pal: { K: INK, L: '#e2dcff' },
    },
    // Call of Farm Duty: haz de trigo (contador) y bala del rifle
    wheat: {
        rows: ['.K..K..K.', 'KYKKWKKYK', 'KYYKYKYYK', '.KYYYYYK.', '..KYYOK..', '..KRRRK..', '..KYYOK..', '.KYOYOYK.', 'KYOKYKOYK', 'KKK.K.KKK'],
        pal: { K: INK, Y: '#ffd23f', O: '#e6a400', W: '#fff4b0', R: '#ff3e5e' },
    },
    // Tomate (contador), barril rojo (desbloqueo) y candado (terreno bloqueado)
    tomato: {
        rows: ['...KK....', '..KGGK...', '.KKGGKKK.', 'KRRKGKRRK', 'KRWRRRRRK', 'KRWRRRRDK', 'KRRRRRRDK', 'KRRRRRDDK', '.KRRDDDK.', '..KKKKK..'],
        pal: { K: INK, G: '#4caf3c', R: '#e8352a', D: '#c0281e', W: '#ffb0a0' },
    },
    barrel: {
        rows: ['.KKKKKK.', 'KRRRRRRK', 'KKKKKKKK', 'KRWRRRRK', 'KYYYYYYK', 'KRWRRRRK', 'KKKKKKKK', 'KRRRRRDK', '.KKKKKK.'],
        pal: { K: INK, R: '#d8302a', D: '#a8201a', W: '#ff9a8a', Y: '#ffcc33' },
    },
    // Cultivos de las parcelas que se compran: calabaza y mazorca
    pumpkin: {
        rows: ['....KK....', '....KGK...', '..KKKKKK..', '.KOOYOOOK.', 'KOOYOOOODK', 'KOYOOOOODK', 'KOOOOOODDK', 'KOOOOODDDK', '.KODODDDK.', '..KKKKKK..'],
        pal: { K: INK, G: '#5a7a2a', O: '#f08a1e', D: '#d06a10', Y: '#ffc070' },
    },
    // Cubo de leche: de chapa con su asa y la leche asomando
    milk: {
        rows: ['..KKKKKK..', '.K......K.', 'K.KKKKKK.K', 'KKWWWWWWKK', 'KMWWWWWWMK', 'KMMMMMMMMK', '.KMLMMMMK.', '.KMLMMMMK.', '.KMMMMMDK.', '..KKKKKK..'],
        pal: { K: INK, W: '#ffffff', M: '#a8b8c8', L: '#d8e4f0', D: '#7a8898' },
    },
    corn: {
        rows: ['....KK....', '...KYYK...', '..KYWYYK..', '..KYYYYK..', '..KYYYOK..', '.GKYYYYKG.', 'GGKYYYOKGG', '.GGKYOKGG.', '..GGKKGG..', '...GGGG...'],
        pal: { K: INK, Y: '#ffd23f', O: '#e8b830', W: '#fff3a0', G: '#7ab83a' },
    },
    // El trigo mágico del prólogo: espigas de todos los colores con su atadura dorada
    magic: {
        rows: ['.R..O..Y..G.', 'RRKOOKYYKGG.', '.RKOKKKYKG..', '..KKCKBKKP..', '...KCCBBPK..', '....KKKKK...', '....KYYYK...', '....KCBPK...', '...KCKBKPK..', '..KCK.K.KPK.', '.KK..K..KK..', '............'],
        pal: { K: INK, R: '#ff3e5e', O: '#ff9a1f', Y: '#ffe03a', G: '#7dff4a', C: '#23e0d6', B: '#3a7ec8', P: '#b46bff' },
    },
    merchant: {
        // El alienígena disfrazado: antenas por encima del sombrero, la cabeza verde y la careta
        // de humano (cara pintada, bigote) sujeta con su goma, y la gabardina
        rows: ['..Y......Y..', '...G....G...', '...KKKKKK...', '..KHHHHHHK..', 'KKKRRRRRRKKK', '.KGSSSSSSGK.', '.KBSESSESBK.', '.KGSSSSSSGK.', '.KGSMMMMSGK.', '.KGSSPPSSGK.', '..KKKKKKKK..', '.KCCCGGCCCK.', 'KCCCCCCCCCCK'],
        pal: { K: INK, Y: '#ffe03a', G: '#7dff4a', H: '#4a3a2a', R: '#c8402e', S: '#f3c8a0', E: INK, B: '#3a3a3a', M: '#6a3a22', P: '#c8402e', C: '#8a6a4a' },
    },
    // El mercader sin la careta (se le ha caído): cara verde y ojos negros enormes
    merchantOops: {
        rows: ['..Y......Y..', '...G....G...', '...KKKKKK...', '..KHHHHHHK..', 'KKKRRRRRRKKK', '.KGGGGGGGGK.', '.KGKKGGKKGK.', '.KGKKGGKKGK.', '.KGKKGGKKGK.', '.KGGGGGGGGK.', '..KKKKKKKK..', '.KCCCGGCCCK.', 'KCCCCCCCCCCK'],
        pal: { K: INK, Y: '#ffe03a', G: '#7dff4a', H: '#4a3a2a', R: '#c8402e', C: '#8a6a4a' },
    },
    // Una bala (contador del cargador)
    ammo: {
        rows: ['...KK...', '..KYYK..', '..KYYK..', '.KKKKKK.', '.KBBBBK.', '.KBWBBK.', '.KBWBBK.', '.KBBBBK.', '.KBBBBK.', '.KKKKKK.'],
        pal: { K: INK, Y: '#c87a3a', B: '#ffd23f', W: '#fff6b0' },
    },
    // Botón MAPA: un plano doblado con sus parcelas
    map: {
        rows: ['KKKKKKKKKK', 'KGGKYYKGGK', 'KGGKYYKGGK', 'KKKKKKKKKK', 'KGGKBBKOOK', 'KGGKBBKOOK', 'KKKKKKKKKK', 'KGGKYYKGGK', 'KGGKYYKGGK', 'KKKKKKKKKK'],
        pal: { K: INK, G: '#5a9e32', Y: '#e8c050', B: '#c8402e', O: '#8a5a34' },
    },
    // Reloj del día: sol y luna llena
    sun: {
        rows: ['Y...Y...Y', '.Y.YYY.Y.', '..YYYYY..', '.YYWYYYY.', 'YYYYYYYYY', '.YYYYYYO.', '..YYYYO..', '.Y.YOO.Y.', 'Y...Y...Y'],
        pal: { Y: '#ffd23f', O: '#ff9a1f', W: '#fff6b0' },
    },
    moon: {
        rows: ['..KKKKK..', '.KWWWWWK.', 'KWWCWWWWK', 'KWWWWWCWK', 'KWCWWWWWK', 'KWWWWCWWK', 'KWWWWWWWK', '.KWWWWWK.', '..KKKKK..'],
        pal: { K: INK, W: '#fff6d8', C: '#d8d0b0' },
    },
    // Torretas automáticas de un campo (la mejora extra con el campo al máximo)
    turret: {
        rows: ['..KKKKK...', '.KGGGGGK..', '.KGLGGGKKK', '.KGGGGGMMK', '.KGGGGGKKK', '..KKKKK...', '...KMMK...', '..KMKKMK..', '.KMK..KMK.', 'KKK....KKK'],
        pal: { K: INK, G: '#6a7a5a', L: '#8a9a7a', M: '#4a4a4a' },
    },
    lock: {
        rows: ['..KKKK..', '.KWKKWK.', '.KK..KK.', 'KKKKKKKK', 'KYYYYYYK', 'KYWKKYOK', 'KYYKKYOK', 'KYYYYOOK', 'KKKKKKKK'],
        pal: { K: INK, Y: '#ffd23f', O: '#e6a400', W: '#fff4b0' },
    },
    round: {
        rows: ['..KK..', '.KWYK.', '.KYYK.', '.KYOK.', '.KYOK.', 'KKKKKK', 'KOOOOK', 'KOOOOK', 'KKKKKK'],
        pal: { K: INK, W: '#fff4b0', Y: '#ffd23f', O: '#e6a400' },
    },
    // Mirilla del francotirador
    reticle: {
        rows: ['....KKKKK....', '..KKCCRCCKK..', '.KCC..R..CCK.', '.KC...R...CK.', 'KC....R....CK', 'KC.........CK', 'KRRRR.W.RRRRK', 'KC.........CK', 'KC....R....CK', '.KC...R...CK.', '.KCC..R..CCK.', '..KKCCRCCKK..', '....KKKKK....'],
        pal: { K: INK, C: '#fff3d6', R: '#c8402e', W: '#ffffff' },
    },
    // Rachas de bajas (menú del granero): granada, misil, bombardero y bomba nuclear
    ksGrenade: {
        rows: ['.....KKK....', '....KYYK.KK.', '...KKKKKKOK.', '..KGGGGGGK..', '.KGLGGGGGGK.', '.KGLGGGGGGK.', '.KGGGGGGGGK.', '.KDDDDDDDDK.', '.KGGGGGGGGK.', '.KGGGGGGGDK.', '..KGGGGGDK..', '...KKKKKK...'],
        pal: { K: INK, G: '#5a7a3a', L: '#8aa85a', D: '#3a5a2a', Y: '#c8c0b0', O: '#ffd23f' },
    },
    ksCluster: {
        rows: ['.KK....KK...', 'KGGK..KGGK..', 'KGLK..KGLK..', 'KGGK..KGGK..', '.KK....KK...', '.....KK.....', '....KGGK....', '...KGLGGK...', '...KGGGGK...', '...KYYYYK...', '...KGGGGK...', '....KKKK....'],
        pal: { K: INK, G: '#7a7a6a', L: '#a8a898', Y: '#ffd23f' },
    },
    ksFire: {
        rows: ['.....YO.....', '....YOOY....', '....OROO....', '...KKKKKK...', '..KRRRRRRK..', '.KRLRRRRRRK.', '.KRLRRRRRRK.', '.KDDDDDDDDK.', '.KRRRRRRRRK.', '.KRRRRRRRDK.', '..KRRRRRDK..', '...KKKKKK...'],
        pal: { K: INK, Y: '#ffe03a', O: '#ff9a1f', R: '#c8402e', L: '#ff7a5a', D: '#8a2a1e' },
    },
    ksPredator: {
        rows: ['....KYYK....', '.....KK.....', '....KRRK....', '....KRRK....', '....KWWK....', '....KWWK....', '..KRKWWKRK..', '..KRKWWKRK..', '...KKWWKK...', '....KWWK....', '....KWWK....', '.....KK.....'],
        pal: { K: INK, W: '#d8dce2', R: '#c8402e', Y: '#ffd23f' },
    },
    ksBomber: {
        rows: ['.....KK.....', '....KGGK....', '....KGGK....', 'KKKKKGGKKKKK', 'KGGGGGGGGGGK', 'KKKKKGGKKKKK', '....KGGK....', '....KGGK....', '...KKGGKK...', '..KGGGGGGK..', '...KKKKKK...', '............'],
        pal: { K: INK, G: '#6a7a5a' },
    },
    ksNuke: {
        rows: ['..KKKKKKKK..', '.KOOYYYYOOK.', 'KOYYWWWYYYOK', 'KOOYYYYYYOOK', '.KKKOYYOKKK.', '....KYYK....', '....KOYK....', '....KYOK....', '...KOYYOK...', '.KKOOYYOOKK.', 'KOOOOOOOOOOK', 'KKKKKKKKKKKK'],
        pal: { K: INK, Y: '#ffd23f', O: '#ff9a1f', W: '#fff4b0' },
    },
    // Mejoras del rifle (menú del granero): mira, estabilidad (nivel de burbuja) y cerrojo (balas)
    rfZoom: {
        rows: ['...KKKKKK...', '..KBBBRBBK..', '.KBBBBRBBWK.', 'KBBBBBRBBBBK', 'KBBBBBRBBBBK', 'KRRRRR.RRRRK', 'KBBBBBRBBBBK', 'KBBBBBRBBBBK', '.KBBBBRBBBK.', '..KBBBRBBK..', '...KKKKKK...', '............'],
        pal: { K: INK, B: '#6ab0e0', R: '#c8402e', W: '#e8f6ff' },
    },
    rfSteady: {
        rows: ['............', '............', '............', 'KKKKKKKKKKKK', 'KGGGKWWKGGGK', 'KGGGKWWKGGGK', 'KDDDKDDKDDDK', 'KKKKKKKKKKKK', '..KMMMMMMK..', '..KKKKKKKK..', '............', '............'],
        pal: { K: INK, G: '#9ad84a', W: '#ffffff', D: '#5a9e32', M: '#a8957a' },
    },
    rfBolt: {
        rows: ['.K...K...K..', 'KCK.KCK.KCK.', 'KCK.KCK.KCK.', 'KKK.KKK.KKK.', 'KYK.KYK.KYK.', 'KYK.KYK.KYK.', 'KYK.KYK.KYK.', 'KYK.KYK.KYK.', 'KYK.KYK.KYK.', 'KDK.KDK.KDK.', 'KKK.KKK.KKK.', '............'],
        pal: { K: INK, C: '#c87a3a', Y: '#ffd23f', D: '#c89a2a' },
    },
    // El ovni: moneda alienígena, luz de alarma del cartel y el alienígena en su nave (tienda)
    alien: {
        rows: ['..KKKKKK..', '.KGGGGGGK.', 'KGWGGGGGGK', 'KGKKGGKKGK', 'KGKKGGKKGK', 'KGGGGGGGGK', 'KGGGKKGGGK', '.KGGGGGGK.', '..KKKKKK..'],
        pal: { K: INK, G: '#7dff4a', W: '#d8ffb0' },
    },
    alarm: {
        rows: ['...KKKK...', '..KRRWRK..', '.KRRRWRRK.', '.KRRRRRRK.', '.KRRRRRRK.', 'KKKKKKKKKK', 'KGGGGGGGGK', 'KKKKKKKKKK'],
        pal: { K: INK, R: '#ff2a1a', W: '#ffd0c0', G: '#9aa8b8' },
    },
    ufoAlien: {
        rows: ['.....KKKKK.....', '....KCCCCCK....', '...KCCGGGCCK...', '...KCGKGKGCK...', '...KCGGGGGCK...', '..KKKKKKKKKKK..', '.KMMMMMMMMMMMK.', 'KMYMMRMMYMMRMMK', '.KMMMMMMMMMMMK.', '..KKDDDDDDDKK..', '....KK...KK....'],
        pal: { K: INK, C: '#9fdcff', G: '#7dff4a', M: '#9aa8b8', D: '#4a5868', Y: '#ffe03a', R: '#ff3e5e' },
    },
    // Diana del logo (la O de CALL OF): anillos rojo y crema, sencilla para que se lea en grande
    target: {
        rows: ['....KKKKK....', '..KKRRRRRKK..', '.KRRRRRRRRRK.', '.KRRCCCCCRRK.', 'KRRCCRRRCCRRK', 'KRRCRRRRRCRRK', 'KRRCRRWRRCRRK',
            'KRRCRRRRRCRRK', 'KRRCCRRRCCRRK', '.KRRCCCCCRRK.', '.KRRRRRRRRRK.', '..KKRRRRRKK..', '....KKKKK....'],
        pal: { K: INK, R: '#c8402e', C: '#fff3d6', W: '#ffffff' },
    },
    sparkA: {
        rows: ['...W...', '...W...', '...Y...', 'WWYWYWW', '...Y...', '...W...', '...W...'],
        pal: { W: '#ffffff', Y: '#ffe03a' },
    },
    sparkB: {
        rows: ['.......', '.......', '...Y...', '..YWY..', '...Y...', '.......', '.......'],
        pal: { W: '#ffffff', Y: '#ffe03a' },
    },
};

function spriteUrl({ rows, pal }) {
    const cv = document.createElement('canvas');
    cv.width = rows[0].length;
    cv.height = rows.length;
    const ctx = cv.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (!pal[ch]) return;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(x, y, 1, 1);
    }));
    return `url(${cv.toDataURL()})`;
}

// Deja los sprites como variables CSS (--px-coin, --px-trophy...) para usarlos en el CSS.
export function installPixelSprites() {
    const root = document.documentElement.style;
    const cv = Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
    drawCoin(cv.getContext('2d'), 7);
    root.setProperty('--px-coin', `url(${cv.toDataURL()})`);
    const g = Object.assign(document.createElement('canvas'), { width: 12, height: 12 });
    drawCoin(g.getContext('2d'), 5, 12);
    root.setProperty('--px-gold', `url(${g.toDataURL()})`);
    for (const [name, def] of Object.entries(SPRITES)) {
        root.setProperty(`--px-${name.replace(/[A-Z]/, (m) => '-' + m.toLowerCase())}`, spriteUrl(def));
    }
}
