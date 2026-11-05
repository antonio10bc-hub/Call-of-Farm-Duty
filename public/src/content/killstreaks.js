import { L } from '../core/I18n.js';

// Dos rachas de bajas, las dos activas siempre (sin equipar nada):
//   crop   la de granadas (como en Call of Duty): cada blanco recogido suma 1 y rellena la
//          barra, que se vacía cada vez más deprisa; si llega a vaciarse, la racha se pierde. Al
//          llegar a cada número se lanza su granada sola (lo que recoge también suma)
//   alien  la alienígena: cada alienígena abatido (los que cruzan el campo andando o corriendo y
//          los ovnis pequeños) suma 1; no se pierde con el tiempo, se acumula durante la partida
//          y vuelve a 0 al entrar otra vez al campo
//   at     bajas que hacen falta (se puede cambiar en DEBUG)
//   icon   sprite del menú del granero y de la interfaz (--px-<icon>)
export const KILLSTREAKS = [
    { id: 'frag', track: 'crop', at: 5, icon: 'ks-grenade', name: L('FRAG GRENADE', 'GRANADA DE FRAGMENTACIÓN'), short: L('FRAG', 'FRAGMENTACIÓN'), desc: L('FLIES BY ITSELF TO THE BIGGEST BUNCH.', 'SALE SOLA HACIA EL GRUPO MÁS GORDO.') },
    { id: 'cluster', track: 'crop', at: 10, icon: 'ks-cluster', name: L('CLUSTER GRENADE', 'GRANADA DE RACIMO'), short: L('CLUSTER', 'RACIMO'), desc: L('SPLITS INTO MINI GRENADES THAT SPREAD OUT.', 'SE ABRE EN MINI GRANADAS QUE SE REPARTEN.') },
    { id: 'fire', track: 'crop', at: 15, icon: 'ks-fire', name: L('FIRE GRENADE', 'GRANADA INCENDIARIA'), short: L('FIRE', 'INCENDIARIA'), desc: L('LEAVES A FIRE THAT BURNS EVERYTHING AROUND.', 'DEJA UN FUEGO QUE QUEMA TODO ALREDEDOR.') },
    { id: 'predator', track: 'alien', at: 3, icon: 'ks-predator', name: L('PREDATOR MISSILE', 'MISIL PREDATOR'), short: L('PREDATOR', 'PREDATOR'), desc: L('STEER A MISSILE FROM THE SKY.', 'GUÍA UN MISIL DESDE EL CIELO.') },
    { id: 'bomber', track: 'alien', at: 6, icon: 'ks-bomber', name: L('BOMBER', 'BOMBARDERO'), short: L('BOMBER', 'BOMBARDERO'), desc: L('A HUGE PLANE BOMBS THE FIELD.', 'UN AVIÓN ENORME BOMBARDEA EL CAMPO.') },
    { id: 'nuke', track: 'alien', at: 10, icon: 'ks-nuke', name: L('NUKE', 'BOMBA NUCLEAR'), short: L('NUKE', 'NUCLEAR'), desc: L('COUNTDOWN... AND IT HARVESTS EVERYTHING.', 'CUENTA ATRÁS... Y LO RECOGE TODO.') },
];

// Las de cada racha, de la primera a la última (con los números de ahora, que DEBUG cambia)
export const streakOf = (track) => KILLSTREAKS.filter((k) => k.track === track).sort((a, b) => a.at - b.at);

for (const k of KILLSTREAKS) k.normalAt = k.at;

// Depuración: bajas que pide cada racha ({ id: n }); lo que no venga, su valor normal
export function setStreakCounts(counts) {
    for (const k of KILLSTREAKS) k.at = counts && counts[k.id] > 0 ? counts[k.id] : k.normalAt;
}

export const KS = {
    // Barra de la racha de granadas: segundos para vaciarse = time * decay^(racha - 1), nunca
    // menos de min (permisiva: da tiempo a buscar la siguiente mata)
    bar: { time: 6, decay: 0.95, min: 2.6 },
    // Granadas: salen delante de la cámara (para verlas salir) y vuelan en arco hasta el blanco
    // con más vecinos. Fragmentación: recoge lo que pille en radius. Racimo: revienta pequeña y
    // suelta bombs mini granadas que saltan hacia fuera (spread m/s) y revientan con radius cada
    // una. Incendiaria: deja un fuego de radius que dura time s y quema lo que haya dentro cada tick s
    grenade: { radius: 2, flight: 1.4, arc: 3 },
    cluster: { radius: 1.2, bombs: 6, spread: 4.5, bombRadius: 1.6 },
    fire: { radius: 3.2, time: 5, tick: 0.45 },
    // Misil Predator: vista cenital desde height; baja solo a speed (boost con el gatillo) y se
    // guía moviendo la vista (steer: metros por unidad de giro)
    predator: { height: 48, speed: 7, boost: 32, steer: 9, radius: 3.8 },
    // Bombardero: cruza el campo a height y suelta una bomba cada every segundos
    bomber: { height: 13, speed: 17, every: 0.2, radius: 1.9 },
    // Bomba nuclear: cuenta atrás mientras la bomba cae desde height (la vista la sigue) y,
    // al tocar el suelo, lo recoge todo (el campo, los alienígenas y lo maduro de toda la granja)
    nuke: { countdown: 5, height: 70 },
    // Alienígenas ladrones a pie: uno cada every [min, max] s (más en campos más grandes), como
    // mucho max a la vez; cada uno a su paso (m/s): andando, al trote o corriendo. De noche salen
    // (1 + night) veces más seguidos y caben nightMax más a la vez
    walkers: { every: [2.5, 6], max: 4, speeds: [1.4, 2.6, 4.2], night: 1, nightMax: 2 },
};
