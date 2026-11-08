import { L } from '../core/I18n.js';

// La caja sorpresa (como la de Kino der Toten en el modo zombis de Black Ops): mientras se
// recoge, de vez en cuando aparece en una torre que no es la tuya, con su rayo de luz azul hasta
// el cielo y un «?» flotando encima. Si saltas a esa torre y le disparas, se abre: las armas
// giran por encima cada vez más despacio y la que toca te vuela a las manos (hasta gastar su
// munición; luego, otra vez tu rifle).
//   first   segundos hasta la primera de la partida [min, max]
//   every   segundos entre una y la siguiente [min, max]
//   stay    segundos que espera a que la abras antes de irse
//   spin    segundos que giran las armas
export const BOX = { first: [20, 40], every: [45, 90], stay: 30, spin: 3.2 };

// Las armas de la caja (todas de referencia de Black Ops):
//   ammo    munición (al gastarla, vuelve el rifle)
//   rate    segundos entre disparo y disparo
//   mode    bullet (balas, como el rifle: auto dispara sola mientras se mantiene la mira),
//           rocket, ray o bolt (proyectiles que revientan en radius al llegar; el virote de la
//           ballesta se clava y revienta a los fuse s)
//   speed   velocidad del proyectil (m/s)
//   spread  dispersión extra (radianes)
export const WONDER = [
    { id: 'mg', name: L('MACHINE GUN', 'AMETRALLADORA'), ammo: 90, rate: 0.085, mode: 'bullet', auto: true, pierce: 2, spread: 0.022, tracer: 0xffe9a0, sfx: 'shot', icon: 'w-mg' },
    { id: 'rpg', name: L('ROCKET LAUNCHER', 'LANZACOHETES'), ammo: 6, rate: 0.9, mode: 'rocket', speed: 34, radius: 3.2, sfx: 'missile', icon: 'w-rpg' },
    { id: 'ray', name: L('RAY GUN', 'PISTOLA DE RAYOS'), ammo: 20, rate: 0.26, mode: 'ray', speed: 46, radius: 1.7, sfx: 'laser', icon: 'w-ray' },
    { id: 'xbow', name: L('EXPLOSIVE CROSSBOW', 'BALLESTA EXPLOSIVA'), ammo: 8, rate: 0.7, mode: 'bolt', speed: 60, radius: 2.5, fuse: 1, sfx: 'whoosh', icon: 'w-xbow' },
];
