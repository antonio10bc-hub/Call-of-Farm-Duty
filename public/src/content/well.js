import { L } from '../core/I18n.js';
import { ARSENAL, ARSENAL_KINDS } from './arsenal.js';

// El pozo de los deseos: un pozo de piedra en la esquina de las vacas, junto al granero. Se echa
// una moneda de oro (cost) y sale al azar una pieza de la armería que aún no tienes (mirilla, rifle
// o cargador): es la única forma de conseguirlas (las de serie, ya se tienen). Las baratas salen
// más; las caras, menos (tiers: hasta qué precio de la armería es de cada rareza y su peso)
export const WELL = { cost: 15 };
export const TIERS = [
    { id: 'common', max: 12, w: 6, color: 0x9aa8b8, name: L('COMMON', 'COMÚN') },
    { id: 'rare', max: 25, w: 3, color: 0x3a8ad8, name: L('RARE', 'RARA') },
    { id: 'epic', max: Infinity, w: 1, color: 0xb87dff, name: L('EPIC', 'ÉPICA') },
];
export const tierOf = (it) => TIERS.find((t) => it.price <= t.max);

// Lo que aún puede salir: todo lo de la armería que no es de serie y no tienes
export function wellPool(owns) {
    return ARSENAL_KINDS.flatMap((kind) => ARSENAL[kind].filter((it) => it.price && !owns(kind, it.id)).map((it) => ({ kind, id: it.id, it, tier: tierOf(it) })));
}

// Una tirada: al azar entre lo que queda, según el peso de su rareza
export function wishPick(pool, rnd = Math.random) {
    const total = pool.reduce((n, p) => n + p.tier.w, 0);
    let x = rnd() * total;
    for (const p of pool) if ((x -= p.tier.w) < 0) return p;
    return pool[pool.length - 1] || null;
}
