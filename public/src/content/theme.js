// Tema visual de la granja: paleta de campo (hierba, tierra, madera, trigo y cielo) con tinta
// marrón oscuro para contornos e interfaz.
export const THEME = {
    sky: 0x9fdcff, horizon: 0xd8f2ff,
    outline: 0x2a1a0e,
    grass: [0x8fd45a, 0x7fc84e, 0x9ad962], grassJitter: 0.05,
    grassFar: 0x76b848,                       // la hierba que sigue hasta el horizonte
    path: [0xd9b77a, 0xcfab6c],               // caminos de tierra
    soil: [0x8a5a34, 0x76492a],               // tierra arada de los campos (surcos)
    dust: 0xf4e6c0, clouds: 0xffffff,
    leaves: [0x4caf3c, 0x3d9a34, 0x63c04a],
    flowers: [0xffffff, 0xffe03a, 0xff8fb0],
    light: { sun: 0xfff2d6, sky: 0xdaf2ff, ground: 0x6a8a3a, sunIntensity: 2.2, hemiIntensity: 1.1 },
    // Noche de luna llena: cielo azul marino, luz de luna azulada y fría (se mezcla con la del
    // día según lo de noche que sea). Sutil: se nota que es de noche, pero se ve todo
    night: { sky: 0x1e2a5a, sun: 0xb4c4ff, sunIntensity: 1.45, hemiSky: 0x7888c0, hemiGround: 0x3a4a4a, hemiIntensity: 1.0, moon: 0xfff6d8 },
    // Ciclo de día y noche en segundos reales: day de día, night de noche y fade de transición
    // (al final de cada uno: el atardecer y el amanecer)
    cycle: { day: 240, night: 120, fade: 40 },
    // Amanecer y atardecer: sol naranja y bajo, luz cálida
    dusk: { sun: 0xffb070, sunIntensity: 1.9, hemiSky: 0xffd2b0, hemiGround: 0x5a5a3a, hemiIntensity: 1.0 },
    ambient: { kind: 'leaves', colors: [0xb6e070, 0xffe680], rate: 2 },
    music: { root: 60, scale: 'major', tempo: 118, lead: 'triangle', swing: 0.18 },
    sniperMusic: { root: 57, scale: 'dorian', tempo: 100, lead: 'triangle', arp: 'stab' },
};
