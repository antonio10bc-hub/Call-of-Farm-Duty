// Tema visual de la isla (de momento solo la pradera inicial). Misma estructura que los temas
// de Tank-less: mar, espuma, isla, contorno, suelo, luces, clima y música.
export const THEME = {
    sky: 0x8fdcff, sea: 0x3fb8ff, foam: 0xf0fbff, island: 0x8a5a34, outline: 0x1b0b33,
    floor: [0x9ae86e, 0x86d85e], floorJitter: 0.04,
    soil: [0x8a5a34, 0x7a4c2a],     // tierra arada de las parcelas
    dust: 0xf4ffd8, clouds: 0xffffff,
    bush: [0x3fbf4a, 0x2e9e40, 0x5cd85a],
    flowers: [0xff6fb5, 0xffe03a, 0xffffff, 0xb46bff],
    light: { sun: 0xfff6dc, sky: 0xdaf2ff, ground: 0x5a9a3a, sunIntensity: 2.3, hemiIntensity: 1.15 },
    ambient: { kind: 'petals', colors: [0xff9fd0, 0xffffff, 0xffe680], rate: 6 },
    music: { root: 60, scale: 'major', tempo: 122, lead: 'triangle' },
    // En la torreta: algo más tenso, mismo timbre
    sniperMusic: { root: 57, scale: 'dorian', tempo: 104, lead: 'triangle', arp: 'stab' },
    sound: { ground: 'grass' },
};
