import { L } from '../core/I18n.js';

// La armería del granero: 5 mirillas, 5 rifles y 5 cargadores que se compran con monedas de oro
// (el primero de cada uno viene de serie) y se montan en el fusil. Cada uno con sus pegas: unos
// pegan más fuerte pero van más lentos, otros apuntan antes pero ven menos, etc.
//   price   monedas de oro
//   look    cómo es (para su dibujo en la tienda y el fusil en primera persona)
// Mirillas:
//   fov     campo de visión con la mira (grados: menos = más zoom)
//   ads     segundos que tarda en subirse al ojo
//   sway    vaivén y temblor de la mira (1 = el de antes; menos = más firme)
//   lens    cómo es la retícula (cross, dot, chevron, mil o night: verde y se ve de noche)
// Rifles:
//   bolt    segundos entre disparo y disparo
//   pierce  cuántos blancos atraviesa una bala (colateral)
//   damage  tiros que quita a lo que aguanta varios (calabazas)
//   recoil  cuánto salta la vista al disparar (1 = el de antes)
//   hip     dispersión sin mira (1 = la de antes; menos = mejor a la cadera)
// Cargadores:
//   size    balas; al acabarse se recarga solo en reload s (R recarga antes)
//   regen   (célula alienígena) sin recargar: una bala nueva cada regen s
export const ARSENAL = {
    scope: [
        { id: 'std', price: 0, fov: 10.5, ads: 0.22, sway: 0.85, lens: 'cross', name: L('STANDARD', 'ESTÁNDAR'), desc: L('A GOOD ALL-ROUNDER.', 'BUENA PARA TODO.'),
            look: { len: 0.44, r: 0.09, body: 0x34373e, ring: 0xd9b04a, glass: 0x9fdcff } },
        { id: 'dot', price: 8, fov: 24, ads: 0.1, sway: 0.45, lens: 'dot', name: L('RED DOT', 'PUNTO ROJO'), desc: L('LITTLE ZOOM, BUT UP IN A FLASH.', 'POCO ZOOM, PERO SE SUBE AL INSTANTE.'),
            look: { len: 0.16, r: 0.1, body: 0x2a2a2a, ring: 0x2a2a2a, glass: 0xff3a2a, open: true } },
        { id: 'tac', price: 15, fov: 8.5, ads: 0.18, sway: 0.6, lens: 'chevron', name: L('TACTICAL', 'TÁCTICA'), desc: L('MORE ZOOM AND VERY STEADY.', 'MÁS ZOOM Y MUY FIRME.'),
            look: { len: 0.36, r: 0.11, body: 0x5a6a3a, ring: 0x3a4a2a, glass: 0x7dff4a } },
        { id: 'long', price: 25, fov: 5.2, ads: 0.36, sway: 1.15, lens: 'mil', name: L('LONG RANGE', 'LARGO ALCANCE'), desc: L('HUGE ZOOM; SLOW AND SHAKY.', 'ZOOM ENORME; LENTA Y TEMBLONA.'),
            look: { len: 0.7, r: 0.12, body: 0x1e2a33, ring: 0xc8c0b0, glass: 0x5aa8ff } },
        { id: 'night', price: 40, fov: 8, ads: 0.24, sway: 0.7, lens: 'night', name: L('NIGHT VISION', 'VISIÓN NOCTURNA'), desc: L('SEES AT NIGHT AS IF IT WERE DAY.', 'DE NOCHE VE COMO SI FUERA DE DÍA.'),
            look: { len: 0.4, r: 0.12, body: 0x2a3a2a, ring: 0x7dff4a, glass: 0x7dff4a, box: true } },
    ],
    rifle: [
        { id: 'bolt', price: 0, bolt: 0.6, pierce: 4, damage: 1, recoil: 1, hip: 1, name: L('BOLT ACTION', 'DE CERROJO'), desc: L('THE FARM CLASSIC.', 'EL CLÁSICO DE LA GRANJA.'),
            look: { wood: 0xb0703a, wood2: 0x7a4824, metal: 0x5c6068, barrel: 0.7, thick: 0.06 } },
        { id: 'semi', price: 10, bolt: 0.24, pierce: 1, damage: 1, recoil: 0.7, hip: 0.85, name: L('SEMI-AUTO', 'SEMIAUTOMÁTICO'), desc: L('FIRES FAST, BUT NO COLLATERALS.', 'DISPARA RÁPIDO, PERO SIN COLATERALES.'),
            look: { wood: 0x3a3a3a, wood2: 0x2a2a2a, metal: 0x5c6068, barrel: 0.55, thick: 0.06, rail: true } },
        { id: 'carbine', price: 20, bolt: 0.38, pierce: 2, damage: 1, recoil: 0.8, hip: 0.4, name: L('CARBINE', 'CARABINA'), desc: L('SHORT: GREAT WITHOUT SCOPE.', 'CORTA: MUY BUENA SIN MIRA.'),
            look: { wood: 0x8a5a2a, wood2: 0x5a3a1a, metal: 0x6a7a5a, barrel: 0.38, thick: 0.07 } },
        { id: 'anti', price: 30, bolt: 1.2, pierce: 99, damage: 3, recoil: 1.9, hip: 1.3, name: L('ANTI-MATERIEL', 'ANTIMATERIAL'), desc: L('GOES THROUGH EVERYTHING. HEAVY.', 'LO ATRAVIESA TODO. PESADO.'),
            look: { wood: 0x4a4a42, wood2: 0x2e2e28, metal: 0x34373e, barrel: 1.05, thick: 0.1, brake: true } },
        { id: 'alien', price: 50, bolt: 0.42, pierce: 6, damage: 2, recoil: 0.5, hip: 0.7, tracer: 0x7dff4a, name: L('ALIEN RIFLE', 'RIFLE ALIENÍGENA'), desc: L('GREEN BOLTS. LIGHT AND DEADLY.', 'RAYOS VERDES. LIGERO Y LETAL.'),
            look: { wood: 0x6a4a9a, wood2: 0x3e2a5e, metal: 0x9aa8b8, barrel: 0.62, thick: 0.08, glow: 0x7dff4a } },
    ],
    mag: [
        { id: 'std', price: 0, size: 10, reload: 1.3, name: L('STANDARD', 'ESTÁNDAR'), desc: L('10 ROUNDS.', '10 BALAS.'),
            look: { w: 0.07, h: 0.14, d: 0.1, color: 0x34373e } },
        { id: 'fast', price: 6, size: 6, reload: 0.5, name: L('QUICK', 'RÁPIDO'), desc: L('FEW ROUNDS, RELOADS IN NO TIME.', 'POCAS BALAS, RECARGA EN UN MOMENTO.'),
            look: { w: 0.07, h: 0.09, d: 0.08, color: 0xd9b04a } },
        { id: 'ext', price: 12, size: 18, reload: 2.2, name: L('EXTENDED', 'AMPLIADO'), desc: L('MANY ROUNDS, SLOWER RELOAD.', 'MUCHAS BALAS, RECARGA MÁS LENTA.'),
            look: { w: 0.07, h: 0.26, d: 0.1, color: 0x34373e, bend: true } },
        { id: 'drum', price: 20, size: 40, reload: 3.6, name: L('DRUM', 'TAMBOR'), desc: L('40 ROUNDS. TAKES AGES TO RELOAD.', '40 BALAS. TARDA UNA ETERNIDAD EN RECARGAR.'),
            look: { w: 0.14, h: 0.2, d: 0.2, color: 0x5c6068, drum: true } },
        { id: 'cell', price: 35, size: 8, regen: 0.55, name: L('ALIEN CELL', 'CÉLULA ALIEN'), desc: L('NEVER RELOADS: ROUNDS REGROW.', 'NUNCA RECARGA: LAS BALAS SE REGENERAN.'),
            look: { w: 0.09, h: 0.13, d: 0.12, color: 0x3e2a5e, glow: 0x7dff4a } },
    ],
};

export const ARSENAL_KINDS = ['scope', 'rifle', 'mag'];
export const DEFAULT_LOADOUT = { scope: 'std', rifle: 'bolt', mag: 'std' };
export const arsenalItem = (kind, id) => ARSENAL[kind].find((x) => x.id === id) || ARSENAL[kind][0];

// Lo que da al fusil un equipo { scope, rifle, mag }
export function loadoutStats(loadout = DEFAULT_LOADOUT) {
    const s = arsenalItem('scope', loadout.scope), r = arsenalItem('rifle', loadout.rifle), m = arsenalItem('mag', loadout.mag);
    return {
        zoom: s.fov, ads: s.ads, steady: s.sway, lens: s.lens,
        bolt: r.bolt, pierce: r.pierce, damage: r.damage, recoil: r.recoil, hip: r.hip, tracer: r.tracer || 0xfff6dc,
        size: m.size, reload: m.reload || 0, regen: m.regen || 0,
    };
}
