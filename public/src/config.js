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
        fov: 64,            // vista normal en primera persona
        scopeFov: 12,       // con la mira
        cornerTime: 0.9,    // segundos para saltar de torre
        lookTouch: 0.0062,  // radianes por píxel al arrastrar el dedo para mirar
        lookMouse: 0.0024,  // radianes por píxel de ratón (cursor bloqueado)
        lookPad: 2.6,       // radianes por segundo con el stick a tope
        adsSlow: 0.3,       // con la mira la vista se mueve más despacio (además del zoom)
        adsTime: 0.24,      // segundos para subir el arma al ojo
        holdTime: 150,      // ms con el dedo quieto para apuntar
        tapTime: 180,       // ms: un toque más corto que esto dispara desde la cadera
        // Precisión (radianes de dispersión). La bala sale a cualquier punto de un cono:
        hipSpread: 0.2,     // sin mira (no scope): solo acierta de cerca o con suerte
        moveSpread: 0.5,    // extra (proporción) mientras se salta de torre
        lookSpread: 0.07,   // extra por cada rad/s que se está girando la vista (hay que asentarla)
        lookSpreadMax: 0.15,
        adsReady: 0.95,     // desde este punto de la subida del arma ya no hay dispersión de cadera
        settleTime: 0.5,    // s que tarda la mira en asentarse desde ese punto
        settleSpread: 0.03, // imprecisión de la mira recién subida (se va en settleTime)
        settleSway: 0.012,  // temblor de la mira recién subida
        holdSlop: 9,        // px que puede moverse el dedo y seguir "quieto"
        edgeSwipe: 40,      // px desde el borde donde un deslizamiento cambia de torre
        flickDist: 60,      // px de ese deslizamiento
        pitchMin: -1.25,
        pitchMax: 0.7,
        sway: 0.0055,       // vaivén de la respiración con la mira
        recoil: 0.07,       // radianes que sube la vista al disparar (sin mira)
        boltTime: 0.7,      // recarga del cerrojo entre disparos
        hitStop: 0.07,
        slowmo: 0.25,
        slowmoTime: 1.1,
    },
    sim: {
        maxFrame: 1 / 20,
    },
};
