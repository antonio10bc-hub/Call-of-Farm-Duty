// Ajustes globales del motor. Lo que pertenece a un contenido concreto (cultivos, campo,
// tema...) vive en /content, no aquí.
export const CONFIG = {
    render: {
        targetPixels: 210,  // líneas aprox. en el lado corto de la pantalla (la DS tenía 192)
        maxScale: 16,
        colorLevels: 31,    // niveles por canal: 5 bits, como la DS
        dither: 1.0,
        saturation: 1.25,
    },
    camera: {
        fov: 34,
        pitch: 58,          // grados sobre el horizonte
        sideMargin: 0.4,
        minRows: 15,
        follow: 6,
    },
    sniper: {
        fov: 62,            // vista normal en primera persona
        scopeFov: 13,       // con la mira
        eyeHeight: 3.2,     // altura de la torreta de paja
        cornerTime: 0.7,    // segundos para saltar de esquina
        aimSpeed: 0.0042,   // radianes por píxel arrastrado (se escala con el zoom)
        yawLimit: 0.95,     // giro máximo a cada lado del centro del campo
        sway: 0.004,        // vaivén de la respiración con la mira
        boltTime: 0.75,     // recarga del cerrojo entre disparos
        hitStop: 0.07,
        slowmo: 0.25,
        slowmoTime: 1.1,
    },
    sim: {
        maxFrame: 1 / 20,
    },
};
