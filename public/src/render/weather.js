// Una partícula del clima de un tema (nieve, lluvia, polvo, brasas, pétalos, estrellas...)
// en (x, z). La usan la partida (alrededor de la cámara) y el mapa de la campaña (sobre cada isla).
export function weatherParticle(particles, kind, x, z, color) {
    const r = Math.random;
    switch (kind) {
        case 'snow': particles.spawn(x, 5 + r() * 2, z, 0.3 + r() * 0.3, -1.4 - r(), 0.1, 0.07 + r() * 0.05, 4.5, color, 0); break;
        case 'leaves': particles.spawn(x, 5 + r() * 2, z, 0.8 + r() * 0.6, -1 - r() * 0.5, 0.2, 0.1 + r() * 0.05, 5, color, 0); break;
        case 'sparkle': particles.spawn(x, 0.05, z, 0, 0.4, 0, 0.06, 0.8, color, 0); break;
        case 'rain': particles.spawn(x, 6 + r() * 2, z, -0.4, -10, 0.3, 0.05, 0.75, color, 0); break;
        case 'dust': particles.spawn(x - 3, 0.15 + r(), z, 2.5 + r() * 1.5, 0.1, 0.4, 0.05 + r() * 0.04, 1.8, color, 0); break;
        case 'embers': particles.spawn(x, 0.05, z, (r() - 0.5) * 0.4, 1 + r() * 1.2, (r() - 0.5) * 0.4, 0.05 + r() * 0.05, 1.8, color, -0.3); break;
        case 'petals': particles.spawn(x, 4 + r() * 2, z, 0.6 + r() * 0.4, -0.6 - r() * 0.3, 0.2, 0.07, 6, color, 0); break;
        // Por debajo del suelo: solo se ven sobre el "mar" del espacio
        case 'stars': particles.spawn(x, -0.7, z, 0, 0, 0, 0.07 + r() * 0.07, 1 + r() * 1.5, color, 0); break;
    }
}
