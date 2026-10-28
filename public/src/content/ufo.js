import { L } from '../core/I18n.js';

// El ovni: al dejar la casa al máximo cae del cielo y se estrella en un rincón de su parcela.
// Desde entonces es la tienda para personalizar la casa y la parcela, que se paga con monedas
// alienígenas: se consiguen derribando los ovnis pequeños que a veces cruzan el cielo del campo
// de tiro mientras se cosecha.
export const UFO = {
    spot: { x: 23.5, z: -23.5 }, // dónde se estrella (un rincón libre de la parcela de la casa)
    from: { x: -14, y: 18, z: -16 }, // de dónde viene, respecto a spot (por arriba de la pantalla)
    wait: 1.5,    // s de calma tras la mejora antes de empezar la cinemática
    flight: 3.2,  // s de caída
    settle: 1.8,  // s tras el choque antes de devolver el control
    // Ovnis pequeños en el campo de tiro: cada every s (entre min y max) cruza uno el cielo a
    // height m, a speed m/s; derribarlo da coins monedas
    flyer: { min: 12, max: 28, height: [7, 11], speed: 6, radius: 0.9, coins: 1 },
};

// Precio en monedas alienígenas (lo de serie no cuesta nada)
const C = (n) => (n ? { alien: n } : {});

// Catálogo de la tienda: dos secciones (CASA y PARCELA), cada una con sus categorías.
//   slot   la parte de la casa que cambia (las categorías de color: tejado, fachada, puerta y
//          marcos); cada una tiene una opción de serie (cost 0) y solo una puesta a la vez
//   soon   aún sin construir (sale en la tienda con su precio y PRONTO)
//   color  el color (o par de colores) que pone; ico: color de la muestra si no lo hay
export const SHOP = [
    {
        id: 'house', name: L('HOUSE', 'CASA'),
        cats: [
            {
                id: 'roof', slot: 'roof', name: L('ROOF', 'TEJADO'),
                items: [
                    { id: 'roof-blue', name: L('BLUE', 'AZUL'), color: [0x3f6fb0, 0x355f9a], cost: C(0) },
                    { id: 'roof-red', name: L('CLAY TILE', 'TEJA ROJA'), color: [0xb84a32, 0xa03e2a], cost: C(2) },
                    { id: 'roof-moss', name: L('MOSS GREEN', 'VERDE MUSGO'), color: [0x4f7a3a, 0x44692f], cost: C(2) },
                    { id: 'roof-slate', name: L('SLATE', 'PIZARRA'), color: [0x4a4a54, 0x3c3c46], cost: C(2) },
                    { id: 'roof-straw', name: L('THATCH', 'PAJA'), color: [0xd8b45a, 0xc49e48], cost: C(2) },
                    { id: 'roof-gold', name: L('GOLD', 'DORADO'), color: [0xffd23f, 0xe6a400], cost: C(12) },
                ],
            },
            {
                id: 'walls', slot: 'walls', name: L('WALLS', 'FACHADA'),
                items: [
                    { id: 'walls-cream', name: L('CREAM', 'CREMA'), color: 0xfff0d8, cost: C(0) },
                    { id: 'walls-white', name: L('WHITE', 'BLANCO'), color: 0xffffff, cost: C(1) },
                    { id: 'walls-yellow', name: L('YELLOW', 'AMARILLO'), color: 0xffe08a, cost: C(1) },
                    { id: 'walls-pink', name: L('PINK', 'ROSA'), color: 0xffc4cc, cost: C(1) },
                    { id: 'walls-sky', name: L('SKY BLUE', 'CELESTE'), color: 0xc4e6ff, cost: C(1) },
                    { id: 'walls-mint', name: L('MINT', 'MENTA'), color: 0xc8f0d0, cost: C(1) },
                    { id: 'walls-brick', name: L('BRICK', 'LADRILLO'), color: 0xb8583a, cost: C(4) },
                ],
            },
            {
                id: 'door', slot: 'door', name: L('DOOR', 'PUERTA'),
                items: [
                    { id: 'door-wood', name: L('WOOD', 'MADERA'), color: 0x8a5a34, cost: C(0) },
                    { id: 'door-red', name: L('RED', 'ROJA'), color: 0xc8402e, cost: C(1) },
                    { id: 'door-blue', name: L('BLUE', 'AZUL'), color: 0x3f6fb0, cost: C(1) },
                    { id: 'door-green', name: L('GREEN', 'VERDE'), color: 0x4f8a3a, cost: C(1) },
                    { id: 'door-black', name: L('BLACK', 'NEGRA'), color: 0x2e2e32, cost: C(1) },
                ],
            },
            {
                id: 'frames', slot: 'frames', name: L('WINDOW FRAMES', 'MARCOS'),
                items: [
                    { id: 'frames-white', name: L('WHITE', 'BLANCOS'), color: 0xffffff, cost: C(0) },
                    { id: 'frames-green', name: L('GREEN', 'VERDES'), color: 0x4f8a3a, cost: C(1) },
                    { id: 'frames-red', name: L('RED', 'ROJOS'), color: 0xc8402e, cost: C(1) },
                    { id: 'frames-blue', name: L('BLUE', 'AZULES'), color: 0x3f6fb0, cost: C(1) },
                ],
            },
            {
                id: 'type', soon: true, name: L('HOUSE TYPE', 'TIPO DE CASA'),
                items: [
                    { id: 'type-attic', name: L('ATTIC HOUSE', 'CON BUHARDILLA'), cost: C(8), ico: 0x3f6fb0 },
                    { id: 'type-cabin', name: L('LOG CABIN', 'CABAÑA DE TRONCOS'), cost: C(12), ico: 0x8a5a34 },
                    { id: 'type-two', name: L('TWO STOREYS', 'DOS PLANTAS'), cost: C(15), ico: 0xfff0d8 },
                    { id: 'type-ufo', name: L('UFO HOUSE', 'CASA OVNI'), cost: C(30), ico: 0x9aa8b8 },
                ],
            },
            {
                id: 'windows', soon: true, name: L('WINDOWS', 'VENTANAS'),
                items: [
                    { id: 'win-shutters', name: L('SHUTTERS', 'CONTRAVENTANAS'), cost: C(1), ico: 0x4f8a3a },
                    { id: 'win-boxes', name: L('FLOWER BOXES', 'JARDINERAS'), cost: C(2), ico: 0xff8fb0 },
                    { id: 'win-round', name: L('PORTHOLES', 'OJOS DE BUEY'), cost: C(2), ico: 0x9fdcff },
                    { id: 'win-stained', name: L('STAINED GLASS', 'VIDRIERAS'), cost: C(4), ico: 0xffd23f },
                ],
            },
            {
                id: 'chimney', soon: true, name: L('CHIMNEY', 'CHIMENEA'),
                items: [
                    { id: 'chim-stone', name: L('STONE', 'DE PIEDRA'), cost: C(2), ico: 0x9a948c },
                    { id: 'chim-metal', name: L('METAL', 'DE METAL'), cost: C(2), ico: 0x6a6a72 },
                    { id: 'chim-double', name: L('DOUBLE', 'DOBLE'), cost: C(3), ico: 0xb0503a },
                    { id: 'chim-rainbow', name: L('RAINBOW SMOKE', 'HUMO DE COLORES'), cost: C(5), ico: 0xff8fb0 },
                ],
            },
            {
                id: 'porch', soon: true, name: L('PORCH', 'PORCHE'),
                items: [
                    { id: 'porch-rail', name: L('WITH RAILING', 'CON BARANDILLA'), cost: C(3), ico: 0xfff3e0 },
                    { id: 'porch-roof', name: L('COVERED', 'CUBIERTO'), cost: C(5), ico: 0x8a5a34 },
                    { id: 'porch-deck', name: L('DECK WITH TABLE', 'TERRAZA CON MESA'), cost: C(7), ico: 0xb07a44 },
                ],
            },
        ],
    },
    {
        id: 'plot', name: L('PLOT', 'PARCELA'),
        cats: [
            {
                id: 'water', soon: true, name: L('WATER', 'AGUA'),
                items: [
                    { id: 'pool', name: L('POOL', 'PISCINA'), cost: C(8), ico: 0x6fc8e8 },
                    { id: 'pond', name: L('DUCK POND', 'ESTANQUE CON PATOS'), cost: C(5), ico: 0x4fa8c8 },
                    { id: 'fountain', name: L('FOUNTAIN', 'FUENTE'), cost: C(6), ico: 0xc4e6ff },
                    { id: 'birdbath', name: L('BIRD BATH', 'BEBEDERO DE PÁJAROS'), cost: C(2), ico: 0x9a948c },
                    { id: 'hottub', name: L('HOT TUB', 'JACUZZI'), cost: C(10), ico: 0x8adcf0 },
                ],
            },
            {
                id: 'garden', soon: true, name: L('GARDEN', 'JARDÍN'),
                items: [
                    { id: 'apple', name: L('APPLE TREE', 'MANZANO'), cost: C(2), ico: 0xc8402e },
                    { id: 'orange', name: L('ORANGE TREE', 'NARANJO'), cost: C(2), ico: 0xff9a1f },
                    { id: 'cherry', name: L('CHERRY BLOSSOM', 'CEREZO EN FLOR'), cost: C(3), ico: 0xffb0c8 },
                    { id: 'willow', name: L('WEEPING WILLOW', 'SAUCE LLORÓN'), cost: C(4), ico: 0x7fbf4a },
                    { id: 'hedge', name: L('TRIMMED HEDGE', 'SETO RECORTADO'), cost: C(1), ico: 0x3d7a2c },
                    { id: 'flowerbed', name: L('FLOWER BED', 'PARTERRE DE FLORES'), cost: C(1), ico: 0xffe03a },
                    { id: 'roses', name: L('ROSE BUSHES', 'ROSALES'), cost: C(2), ico: 0xff3e5e },
                    { id: 'pumpkins', name: L('PUMPKIN PATCH', 'HUERTO DE CALABAZAS'), cost: C(2), ico: 0xe8902a },
                ],
            },
            {
                id: 'play', soon: true, name: L('PLAY', 'JUEGOS'),
                items: [
                    { id: 'swing', name: L('SWING', 'COLUMPIO'), cost: C(2), ico: 0xc8402e },
                    { id: 'slide', name: L('SLIDE', 'TOBOGÁN'), cost: C(3), ico: 0xffd23f },
                    { id: 'trampoline', name: L('TRAMPOLINE', 'CAMA ELÁSTICA'), cost: C(4), ico: 0x3f6fb0 },
                    { id: 'treehouse', name: L('TREE HOUSE', 'CASITA DEL ÁRBOL'), cost: C(7), ico: 0x8a5a34 },
                    { id: 'sandbox', name: L('SANDBOX', 'ARENERO'), cost: C(2), ico: 0xe8d090 },
                    { id: 'seesaw', name: L('SEESAW', 'BALANCÍN'), cost: C(2), ico: 0x4f8a3a },
                    { id: 'goal', name: L('FOOTBALL GOAL', 'PORTERÍA'), cost: C(2), ico: 0xffffff },
                ],
            },
            {
                id: 'build', soon: true, name: L('BUILDINGS', 'ESTRUCTURAS'),
                items: [
                    { id: 'gazebo', name: L('GAZEBO', 'CENADOR'), cost: C(5), ico: 0xfff3e0 },
                    { id: 'greenhouse', name: L('GREENHOUSE', 'INVERNADERO'), cost: C(6), ico: 0xc4f0e0 },
                    { id: 'windmill', name: L('WINDMILL', 'MOLINO DE VIENTO'), cost: C(9), ico: 0xd8d0c0 },
                    { id: 'doghouse', name: L('DOGHOUSE (WITH DOG)', 'CASETA CON PERRO'), cost: C(4), ico: 0xc8402e },
                    { id: 'well', name: L('WELL', 'POZO'), cost: C(3), ico: 0x9a948c },
                    { id: 'shed', name: L('TOOL SHED', 'COBERTIZO'), cost: C(4), ico: 0xb07a44 },
                    { id: 'pergola', name: L('PERGOLA AND HAMMOCK', 'PÉRGOLA CON HAMACA'), cost: C(4), ico: 0x8a5a34 },
                    { id: 'bbq', name: L('BARBECUE', 'BARBACOA'), cost: C(2), ico: 0x3a3a3a },
                ],
            },
            {
                id: 'decor', soon: true, name: L('DECOR', 'DECORACIÓN'),
                items: [
                    { id: 'gnomes', name: L('GARDEN GNOMES', 'GNOMOS'), cost: C(1), ico: 0xc8402e },
                    { id: 'flamingos', name: L('PINK FLAMINGOS', 'FLAMENCOS ROSAS'), cost: C(1), ico: 0xff8fb0 },
                    { id: 'scarecrow', name: L('SCARECROW', 'ESPANTAPÁJAROS'), cost: C(2), ico: 0xd8b45a },
                    { id: 'lamps', name: L('GARDEN LAMPS', 'FAROLAS'), cost: C(1), ico: 0xfff0a0 },
                    { id: 'picket', name: L('WHITE PICKET FENCE', 'VALLA BLANCA'), cost: C(3), ico: 0xffffff },
                    { id: 'mailbox', name: L('MAILBOX', 'BUZÓN'), cost: C(1), ico: 0x3f6fb0 },
                    { id: 'bunting', name: L('BUNTING', 'BANDERINES'), cost: C(1), ico: 0xffd23f },
                    { id: 'goldhen', name: L('GOLDEN HEN STATUE', 'ESTATUA DE GALLINA DORADA'), cost: C(10), ico: 0xffd23f },
                ],
            },
            {
                id: 'alien', soon: true, name: L('OUT OF THIS WORLD', 'DE OTRO MUNDO'),
                items: [
                    { id: 'crop-circle', name: L('CROP CIRCLE', 'CÍRCULO EN EL CÉSPED'), cost: C(4), ico: 0x8fd45a },
                    { id: 'meteor', name: L('METEORITE', 'METEORITO'), cost: C(6), ico: 0x6a5a4a },
                    { id: 'antenna', name: L('ALIEN ANTENNA', 'ANTENA ALIENÍGENA'), cost: C(8), ico: 0x7dff4a },
                    { id: 'alien-doll', name: L('ALIEN PLUSHIE', 'MUÑECO ALIEN'), cost: C(2), ico: 0x7dff4a },
                ],
            },
        ],
    },
];

export const SHOP_ITEMS = Object.fromEntries(SHOP.flatMap((s) => s.cats.flatMap((c) => c.items.map((it) => [it.id, { ...it, cat: c }]))));
// Lo que lleva la casa de serie en cada parte
export const DEFAULT_LOOK = Object.fromEntries(SHOP[0].cats.filter((c) => c.slot).map((c) => [c.slot, c.items[0].id]));
