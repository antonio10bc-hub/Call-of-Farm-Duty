// Sprites pixelados de la interfaz (moneda, trofeo, destellos), dibujados píxel a píxel
// para que la UI tenga el mismo aspecto que el juego. Se pintan en canvas pequeños y se
// escalan con image-rendering: pixelated, nunca suavizados.

const INK = '#2a1a0e';
// La moneda de oro... de cartón: un círculo de cartón recortado a mano (canto ondulado de cartón
// corrugado), pintado de amarillo con cera a brochazos (se ve el cartón por los huecos) y un $
// garabateado con rotulador. Muy falsa, pero es la moneda oficial.
const CARD = { edge: '#8a5a2e', dark: '#a8763e', base: '#c8955a', paint: '#ffd23f', paint2: '#f2b830', pen: '#6a3a1a' };
// size: lado del sprite en píxeles; half: media anchura (para la moneda girando: de frente = size/2 - 1)
function drawCoin(ctx, half, S = 16) {
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

const SPRITES = {
    // La casa: tejado rojo con sus tejas, chimenea, ventana encendida y la puerta
    home: {
        rows: ['.....KK.....', '....KRRK.KK.', '...KRRRRKSK.', '..KRRDRRRKK.', '.KRRRRRDRRK.', 'KRDRRRRRRRRK', 'KKKKKKKKKKKK', '.KWWWWWWWWK.', '.KWKKKWKKKK.', '.KWKYKWKNNK.', '.KWKKKWKNNK.', 'KKKKKKKKKKKK'],
        pal: { K: INK, R: '#e8452e', D: '#b8321e', S: '#9a948c', W: '#fff3d6', Y: '#ffd23f', N: '#a8642e' },
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
    // Huevo: blanco crema con su brillo
    egg: {
        rows: ['...KKKK...', '..KWWWWK..', '.KWLWWWWK.', '.KWLWWWWK.', 'KWWWWWWWWK', 'KWWWWWWWWK', 'KWWWWWWCWK', 'KWWWWWWCWK', '.KWWWWCCK.', '..KKKKKK..'],
        pal: { K: INK, W: '#fff6e6', L: '#ffffff', C: '#e8d8b8' },
    },
    // Pez: plateado con el vientre claro, su ojo y la cola
    fish: {
        rows: ['..........', '....KKK...', '..KKBBBK.K', '.KBWBBBBKB', 'KBBBBBBBBK', 'KWWWWWWBKB', '.KWWWWWK.K', '..KKKKK...', '..........', '..........'],
        pal: { K: '#2a1a0e', B: '#7aa0c8', W: '#e8f0f6' },
    },
    // Trufa: un terrón oscuro con sus vetas
    truffle: {
        rows: ['..........', '...KKKK...', '..KDTDDK..', '.KDDTDTDK.', 'KDTDDDDTDK', 'KDDDTDDDDK', 'KDTDDDTDDK', '.KDDTDDDK.', '..KKKKKK..', '..........'],
        pal: { K: '#1e120a', D: '#5a3a22', T: '#8a6040' },
    },
    // Ovillo de lana: la bola con sus vueltas de hilo y la hebra suelta
    wool: {
        rows: ['...KKKK...', '..KWWWWK..', '.KWCCWWCK.', 'KWWWCWCWWK', 'KWCWWCWWWK', 'KCWWCWWCWK', 'KWWCWWCWWK', '.KWWCCWWK.', '..KKKKKKK.', '........KK'],
        pal: { K: INK, W: '#fffdf6', C: '#d8cbb0' },
    },
    // Tarro de miel: con su tapa de tela y una gota que cae
    honey: {
        rows: ['..KKKKKK..', '.KRRRRRRK.', '..KKKKKK..', '.KHHHHHHK.', 'KHLHHHHHDK', 'KHLHHHHHDK', 'KHHHHHHDDK', 'KHHHHHDDDK', '.KHHHDDDK.', '..KKKKKK..'],
        pal: { K: INK, R: '#c8402e', H: '#ffb020', L: '#ffe08a', D: '#e08a10' },
    },
    // Girasol: pétalos amarillos alrededor del centro marrón, con su tallo
    sunflower: {
        rows: ['...Y..Y...', '.YYKKKKYY.', '.YKBBBBKY.', 'YKBDBBDBKY', '.KBBDDBBK.', 'YKBDBBDBKY', '.YKBBBBKY.', '.YYKKKKYY.', '...Y.GG...', '....GG....'],
        pal: { K: INK, Y: '#ffd23f', B: '#8a5a2a', D: '#5a3a1a', G: '#5aa83a' },
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
    // El pozo de los deseos: tejadillo rojo, postes, el corro de piedra gris y el agua que brilla
    well: {
        rows: ['..KKKKKK..', '.KRRRRRRK.', 'KRRRRRRRRK', '.KWK..KWK.', '.KW....WK.', 'KKKKKKKKKK', 'KSSBBBBSSK', 'KSLSSLSSLK', 'KSSLSSLSSK', '.KKKKKKKK.'],
        pal: { K: INK, R: '#c8402e', W: '#8a5a2a', S: '#9a948a', L: '#b8b2a8', B: '#5af0ff' },
    },
    // El campo de tiro de pruebas: una diana roja y blanca con su flecha clavada
    target: {
        rows: ['..KKKKKK..', '.KRRRRRRK.', 'KRRWWWWRRK', 'KRWWRRWWRK', 'KRWRRKRWRK', 'KRWRKYRWRK', 'KRWWRRWWRK', 'KRRWWWWRRK', '.KRRRRRRK.', '..KKKKKK..'],
        pal: { K: INK, R: '#e8402e', W: '#fff3d6', Y: '#ffd23f' },
    },
    // Botón AJUSTES: un engranaje de 8 dientes con su agujero
    gear: {
        rows: ['....KKKK....', '.KK.KLGK.KK.', '.KLKKLGKKGK.', '.KKLLGGGGKK.', 'KKLGKKKKGGKK', 'KLGGK..KGGGK', 'KLGGK..KGGGK', 'KKGGKKKKGGKK', '.KKGGGGGGKK.', '.KGKKGGKKGK.', '.KK.KGGK.KK.', '....KKKK....'],
        pal: { K: INK, G: '#8a98a8', L: '#c8d0d8' },
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
    // Lo alienígena: su cara (racha alienígena) y el alienígena en su nave (tienda de la casa)
    alien: {
        rows: ['..KKKKKK..', '.KGGGGGGK.', 'KGWGGGGGGK', 'KGKKGGKKGK', 'KGKKGGKKGK', 'KGGGGGGGGK', 'KGGGKKGGGK', '.KGGGGGGK.', '..KKKKKK..'],
        pal: { K: INK, G: '#7dff4a', W: '#d8ffb0' },
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

// Deja los sprites como variables CSS (--px-coin, --px-wheat...) para usarlos en el CSS.
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
