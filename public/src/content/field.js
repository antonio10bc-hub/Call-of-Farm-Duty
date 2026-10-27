// Campo de tiro: un cuadrilátero de lados distintos. Las torretas están en sus esquinas
// (en el orden de las agujas del reloj vistas desde arriba: deslizar salta a la vecina).
export const FIELD = {
    corners: [
        { x: 0, z: 0 },
        { x: 19, z: -2 },
        { x: 23, z: 15 },
        { x: -3, z: 12 },
    ],
    towerOut: 1.6,     // la torreta queda algo por fuera de la esquina
    margin: 1.4,       // los haces no aparecen pegados al borde
    // Desbloqueo: el montón de chatarra con el barril rojo, al fondo (lejos de la torre 0, desde
    // la que se dispara sin poder cambiar de torre)
    pile: { x: 19.5, z: 11 },
};
