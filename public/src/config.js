// Ajustes globales del motor. Lo que pertenece a un contenido concreto (cultivos, campo,
// tema, edificios...) vive en /content, no aquí.
export const CONFIG = {
    render: {
        targetPixels: 340,  // líneas aprox. en el lado corto de la pantalla: píxel fino
        maxScale: 16,
        colorLevels: 31,    // niveles por canal (5 bits)
        dither: 0.8,
        saturation: 1.12,
    },
    // Mapa de la granja: vista isométrica en diagonal, con desplazamiento y zoom
    map: {
        fov: 30,
        pitch: 52,          // grados sobre el horizonte
        yaw: Math.PI / 4,   // mirando en diagonal, como un juego de gestión
        sideMargin: 0.5,
        minRows: 22,        // en pantallas apaisadas se ve al menos esto de fondo
        follow: 9,
        view: 15,           // casillas que caben de ancho con zoom 1
        zoomMin: 0.55,
        zoomMax: 1.7,
    },
    sniper: {
        fov: 62,            // vista normal en primera persona
        scopeFov: 12,       // con la mira
        cornerTime: 0.9,    // segundos para saltar de esquina
        aimSpeed: 0.0016,   // radianes por píxel arrastrado con la mira (se escala con el zoom)
        yawLimit: 1.0,      // giro máximo a cada lado del centro del campo
        sway: 0.004,        // vaivén de la respiración con la mira
        boltTime: 0.7,      // recarga del cerrojo entre disparos
        flickTime: 350,     // ms: un deslizamiento más rápido que esto cambia de esquina
        flickDist: 55,      // px
        hitStop: 0.07,
        slowmo: 0.25,
        slowmoTime: 1.1,
    },
    sim: {
        maxFrame: 1 / 20,
    },
};
