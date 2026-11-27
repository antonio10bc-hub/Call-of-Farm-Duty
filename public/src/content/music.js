// La música de cada sitio (ver core/Music.js): todas comparten la base (tonalidad, acordes, tempo
// y bajo) y cada una cambia solo su capa propia, para que se reconozca dónde estás sin cambiar de
// canción. Motivos de 32 pasos (dos compases): '.' silencio, '0'-'9' grado sobre el acorde.
//   La granja (el mapa): tranquila, para tenerla de fondo: piano eléctrico y una marimba suelta
//   El pueblo (el menú de los mercaderes): un acordeón y algo de ritmo, de mercado
//   El pozo de los deseos: celesta y nada de percusión, un poco mágico
//   Cada campo de tiro: la misma base, con acción (más rápida, batería, bajo que empuja), y su
//   instrumento y su motivo bien delante
const t = (o) => o;
// Los campos de tiro: la misma canción, con acción (más rápida, con batería y bajo que empuja; la
// base del menú muy por detrás y la capa propia delante)
const ACTION = { action: 1, tempo: 104, base: 0.3 };
const field = (o) => ({ ...ACTION, bass: 'drive', ...o });
export const THEMES = {
    // La granja: de fondo, sin protagonismo
    farm: t({ keys: 'chords', bass: 'soft', perc: 'shaker', sig: { inst: 'mallet', motif: '4.......2...0...........b.......', oct: 1, vol: 0.7 } }),
    // El pueblo y el pozo: la base del menú por detrás y lo suyo delante (como en los campos)
    village: t({ base: 0.35, lead: 1.7, keys: 'stab', bass: 'oompah', perc: 'brush', sig: { inst: 'accordion', motif: '4...4.5.4...2.......2...2.4.2...', oct: 1 } }),
    well: t({ base: 0.4, lead: 1.5, keys: 'arp', bass: 'soft', perc: 'none', sig: { inst: 'bell', motif: '7.......4.......9...........4...', oct: 2, vol: 0.8 } }),
    // Los campos de tiro (por cultivo)
    // Trigo: guitarra arpegiada (el del principio: el más «de granja»)
    wheat: field({ keys: 'none', perc: 'groove', sig: { inst: 'pluck', motif: '0.2.4.2.7.4.2.4.0.2.4.2.7.4.9.7.', oct: 1 } }),
    // Rodeo: guitarra country al galope (cascos de madera)
    tomato: field({ keys: 'stab', bass: 'oompah', perc: 'hooves', sig: { inst: 'pluck', motif: '0.4.7.4.0.4.7.9.7.4.2.4.0...0...', oct: 1 } }),
    // Cabras: marimba saltarina y cascos de madera
    pumpkin: field({ keys: 'stab', bass: 'bounce', perc: 'hooves', sig: { inst: 'mallet', motif: '0.4.0.4..7.4....0.4.0.4..7.9....', oct: 1 } }),
    // Luciérnagas (de noche): celesta suelta, sin ritmo, todo oscuro
    corn: field({ action: 0.6, keys: 'arp', perc: 'none', dark: true, sig: { inst: 'bell', motif: '7.......4...........9.......2...', oct: 2 } }),
    // Perlas: piano eléctrico líquido y gotas
    sunflower: field({ keys: 'arp', perc: 'brush', drops: true, sig: { inst: 'keys', motif: '2...4...7.....4.2.......0.......', oct: 2 } }),
    // Vacas: acordeón perezoso
    milk: field({ keys: 'none', perc: 'brush', sig: { inst: 'accordion', motif: '4.......5.4.2...0.......2.......', oct: 1 } }),
    // Ovejas: flauta suave y mullida
    wool: field({ keys: 'chords', perc: 'brush', sig: { inst: 'flute', motif: '0...2...4.....2.4.......7.....4.', oct: 2 } }),
    // Gallinas: pizzicato que picotea
    egg: field({ keys: 'none', perc: 'tick', sig: { inst: 'pizz', motif: '0.0.4.4.2.2.0...0.0.4.4.7...4...', oct: 2 } }),
    // Cerdos: tuba que bota y marimba grave
    truffle: field({ keys: 'stab', bass: 'bounce', bassInst: 'tuba', perc: 'groove', sig: { inst: 'mallet', motif: '0.......4.......0.......b.......', oct: 0 } }),
    // Peces: guitarrita aguda (ukelele) y gotas
    fish: field({ keys: 'none', perc: 'shaker', drops: true, sig: { inst: 'pluck', motif: '4.2.0.2.4.4.4...2.2.2...4.7.7...', oct: 2 } }),
    // Abejas: zumbido de abejorro y arpa de celesta
    honey: field({ keys: 'arp', perc: 'brush', sig: { inst: 'buzz', motif: '0.......2...4.......4...2...0...', oct: 1 } }),
    // Campo de pruebas y terreno abandonado: la base con ritmo, sin capa propia
    range: field({ keys: 'stab', perc: 'groove', sig: null }),
};

// El tema del campo de tiro de un cultivo (o del terreno que se desbloquea)
export const themeOf = (crop) => THEMES[crop] || THEMES.range;
