// Simulación de la economía con un jugador medio: lee los números de verdad del juego
// (public/src/content) y juega solo, a base de viajes al campo de tiro, entregas a los
// mercaderes y compras. Saca cuándo llega a cada hito (niveles de campo, parcelas, torretas,
// niveles del pueblo) y de dónde sale y a dónde va el oro.
//   node scripts/economy-sim.mjs [--runs 20] [--seed 1] [--log]
// Supuestos del jugador medio (A): segundos por blanco en el campo de tiro según el cultivo
// (con más nivel, el campo es más denso y se tarda algo menos por blanco), lo que se pierde por
// fallos y alienígenas, la parte del oro que se va a la armería, etc. Son estimaciones: ajústalas
// si se mide algo mejor en partidas de verdad.
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// El juego es ESM en un paquete commonjs: sus archivos se cargan como módulos
register('data:text/javascript,' + encodeURIComponent(`
import { readFileSync } from 'node:fs';
export async function load(url, ctx, next) {
    if (url.includes('/public/src/')) return { format: 'module', source: readFileSync(new URL(url)), shortCircuit: true };
    return next(url, ctx);
}`));
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const src = new URL('../public/src/content/', import.meta.url);
const { FARM, TURRETS } = await import(new URL('farm.js', src));
const { CROPS } = await import(new URL('crops.js', src));
const MS = await import(new URL('merchants.js', src));
const { MERCHANT, RARE } = await import(new URL('merchant.js', src));
const ML = await import(new URL('merchantLife.js', src));
const { WELL, wellPool } = await import(new URL('well.js', src));
const { CLASSES } = await import(new URL('arsenal.js', src));
const { MERCHANTS, VILLAGE_LEVELS, PER_LEVEL, TOWN_PERKS, PERK_LEVEL, MEDALS, DECOR, EXCLUSIVE } = MS;

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const RUNS = arg('runs', 20), LOG = process.argv.includes('--log');

// ---------- Los jugadores (arquetipos) ----------
// El medio es la base; cada arquetipo cambia lo suyo (spt: multiplica los segundos por blanco)
const BASE = {
    prologue: 180,      // s hasta tener el trigo listo para sembrar
    over: 14,           // s por viaje al campo de tiro (entrar, cambiar de torre, salir)
    hit: 0.88,          // de cada campo, lo que acaba recogiendo (fallos, robos)
    spt: { wheat: 0.85, tomato: 7, corn: 1.2, pumpkin: 2.6, milk: 2.4, egg: 2.2, fish: 2.4, truffle: 2.8, wool: 2.3, honey: 1.8, sunflower: 2.7 },
    dense: 0.07,        // cada nivel del campo, eso menos por blanco (más denso, granadas)
    deliver: 6,         // s por entrega o compra
    arsenal: 0.2,       // del oro que gana, lo que se gasta en la armería (pozo y clases)
    classes: 4,         // clases que compra
    urgentOk: 0.7,      // urgentes que entrega a tiempo
    impulse: 0.4,       // compra un objeto del pueblo aunque ahorre para una parcela si cuesta menos de esta parte de su oro
    decorFirst: false,  // el pueblo antes que las parcelas
    session: 45 * 60,   // s de juego al día
};
export const PROFILES = {
    medio: { name: 'Medio', desc: '45 min/día, puntería normal, reparte el oro', mod: {} },
    casual: { name: 'Casual (móvil)', desc: '15 min/día, apunta despacio, falla y compra lo que ve', mod: { session: 15 * 60, sptK: 1.5, hit: 0.75, over: 20, urgentOk: 0.3, arsenal: 0.1, classes: 2, impulse: 0.8 } },
    hardcore: { name: 'Optimizador', desc: '2 h/día, rápido y certero, va a por el oro', mod: { session: 120 * 60, sptK: 0.7, hit: 0.95, over: 9, urgentOk: 0.95, arsenal: 0.15, classes: 5, impulse: 0.2 } },
    decorador: { name: 'Decorador', desc: '45 min/día, el pueblo antes que nada, ni mira la armería', mod: { sptK: 1.1, arsenal: 0.05, classes: 1, impulse: 1, decorFirst: true } },
    tirador: { name: 'Tirador', desc: '1 h/día, buena puntería, gasta en armas y clases', mod: { session: 60 * 60, sptK: 0.75, hit: 0.93, arsenal: 0.45, classes: 10, impulse: 0.25, urgentOk: 0.6 } },
};
const profileOf = (id) => {
    const m = PROFILES[id].mod, A = { ...BASE, ...m };
    A.spt = Object.fromEntries(Object.entries(BASE.spt).map(([c, v]) => [c, v * (m.sptK || 1)]));
    return A;
};
let A = profileOf('medio');

// ---------- Reglas (las del juego, en content/ y game/FarmState.js) ----------
const FIELDS = FARM.fields, FB = Object.fromEntries(FIELDS.map((f) => [f.id, f]));
const SALE = FARM.lands.filter((l) => l.sale || l.price);
const fieldCost = (f, to) => (f.levels[to] && f.levels[to].cost) || f.cost || {};
const landPrice = (S, id) => (FARM.landPrices ? FARM.landPrices[Object.values(S.lands).filter(Boolean).length] : SALE.find((l) => l.id === id).price);
const decorPrice = (S, d) => (MS.decorPrice ? MS.decorPrice(d, S.village.length) : d.gold);
const wishCost = (S) => { const base = WELL.step !== undefined ? WELL.cost + WELL.step * S.wished : WELL.cost; return S.perks.tech ? Math.round(base * TOWN_PERKS.tech.wish) : base; };
const reloadCost = (f) => f.reload || TURRETS.reload;
const villageLv = (n) => MS.villageLevel(n);
const trustLevel = ML.trustLevel;

function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519 + (s | 1)) + 0x6d2b79f5) >>> 0) / 4294967296;
}

function sim(seed) {
    const R = rng(seed * 7919 + 13);
    const S = {
        t: 0, items: Object.fromEntries([...Object.keys(CROPS), 'gold'].map((c) => [c, 0])),
        fields: Object.fromEntries(FIELDS.map((f) => [f.id, { lv: 0, on: false, ripe: 0, turret: false, ammo: 0, tAcc: 0 }])),
        lands: Object.fromEntries(SALE.map((l) => [l.id, false])), village: [], wished: 0, owned: new Set(), classes: 1,
        merchantOpen: false, sold: false, landsOpen: false, villageLv: 0, medals: new Set(), wallet: 0,
        M: Object.fromEntries(MERCHANTS.map((d) => [d.id, { trust: 0, streak: 0, missed: 0, mood: 'neutral', visit: -1, orders: [], gift: null, visits: 0 }])),
        perks: {},
        src: {}, sink: {}, ms: [], hour: [],
    };
    const gain = (k, n) => { S.items.gold += n; S.src[k] = (S.src[k] || 0) + n; const h = Math.floor(S.t / 3600); S.hour[h] = (S.hour[h] || 0) + n; };
    const spend = (k, n) => { S.items.gold -= n; S.sink[k] = (S.sink[k] || 0) + n; };
    const mile = (name) => { S.ms.push([name, S.t]); if (LOG) console.log((S.t / 60).toFixed(1).padStart(7), 'min', name); };
    const sheaves = (id) => FB[id].levels[S.fields[id].lv].sheaves;
    const maxed = (id) => S.fields[id].lv >= FB[id].levels.length - 1;
    const rate = (c) => MERCHANT.rate[c] || 0.5;

    // Las visitas de cada mercader: tramos de slot s, con probabilidad p, se queda stay s
    const visitOf = (d, t) => {
        const n = Math.floor(t / d.slot), h = rng(seed * 31 + n * 977 + d.id.length * 101 + d.angle);
        if (h() >= d.p) return null;
        const stay = Math.min(d.slot * 0.9, d.stay * (S.perks.grove ? TOWN_PERKS.grove.stay : 1)), from = n * d.slot + h() * (d.slot - stay);
        return t >= from && t < from + stay ? n : null;
    };

    function unlock(id) {
        const F = S.fields[id];
        F.on = true;
        F.ripe = S.t;
        mile(`${id} abierto`);
    }

    // La mejora que va a buscar (el campo abierto más atrasado): lo que guarda para ella
    function plan() {
        const open = FIELDS.filter((f) => S.fields[f.id].on && !maxed(f.id));
        if (open.length) return open.sort((a, b) => S.fields[a.id].lv - S.fields[b.id].lv)[0];
        const tur = FIELDS.filter((f) => S.fields[f.id].on && !S.fields[f.id].turret && f.turrets);
        return tur.length ? { turret: tur[0] } : null;
    }
    const reserve = () => { const f = plan(); return !f ? {} : f.turret ? f.turret.turrets : fieldCost(f, S.fields[f.id].lv + 1); };
    const affordable = (cost, res = {}) => Object.entries(cost).every(([c, n]) => S.items[c] - (res[c] || 0) >= n);

    function buyStuff() {
        let did = true;
        while (did) {
            did = false;
            // Mejoras de campo (todas las que pueda, la más atrasada primero)
            for (const f of FIELDS.filter((x) => S.fields[x.id].on && !maxed(x.id)).sort((a, b) => S.fields[a.id].lv - S.fields[b.id].lv)) {
                const c = fieldCost(f, S.fields[f.id].lv + 1);
                if (affordable(c)) {
                    for (const [k, n] of Object.entries(c)) { S.items[k] -= n; S.sink[`crop:${k}`] = (S.sink[`crop:${k}`] || 0) + n; }
                    S.fields[f.id].lv++;
                    mile(`${f.id} nivel ${S.fields[f.id].lv + 1}`);
                    if (FIELDS.every((x) => S.fields[x.id].on && maxed(x.id))) mile('granjas al máximo');
                    did = true;
                    break;
                }
            }
            if (did) continue;
            // Desbloqueos de la historia
            if (!S.fields.tomato.on && maxed('wheat')) { unlock('tomato'); did = true; continue; }
            if (!S.merchantOpen && S.fields.tomato.on && maxed('tomato')) { S.merchantOpen = true; S.firstVisit = S.t; mile('mercaderes'); }
            // Parcelas (la más barata primero)
            if (S.landsOpen) {
                const free = SALE.filter((l) => !S.lands[l.id]);
                if (free.length) {
                    const l = free.sort((a, b) => landPrice(S, a.id) - landPrice(S, b.id))[0], p = landPrice(S, l.id);
                    if (S.items.gold >= p * (A.decorFirst ? 2 : 1)) { // (el decorador, solo si le sobra el doble)
                        spend('parcelas', p);
                        S.lands[l.id] = true;
                        unlock(FIELDS.find((f) => f.locked && f.locked.land === l.id).id);
                        did = true;
                        continue;
                    }
                }
            }
            // Torretas (con el campo al máximo; sin tocar lo que guarda para la siguiente mejora)
            for (const f of FIELDS) {
                const F = S.fields[f.id];
                const pl = plan();
                if (F.on && maxed(f.id) && !F.turret && f.turrets && affordable(f.turrets, pl && pl.turret === f ? {} : reserve())) {
                    for (const [k, n] of Object.entries(f.turrets)) { S.items[k] -= n; S.sink[`crop:${k}`] = (S.sink[`crop:${k}`] || 0) + n; }
                    F.turret = true;
                    F.ammo = TURRETS.ammo;
                    mile(`torreta ${f.id}`);
                    did = true;
                }
            }
            // Recargas
            for (const f of FIELDS) {
                const F = S.fields[f.id], c = reloadCost(f);
                if (F.turret && F.ammo <= 0 && S.items.gold >= c) { spend('recargas', c); F.ammo = TURRETS.ammo; did = true; }
            }
            // La armería (con su parte del oro): clases y deseos del pozo
            const pool = wellPool().length - S.owned.size;
            if (S.classes < A.classes && S.wallet >= CLASSES[S.classes].price && S.items.gold >= CLASSES[S.classes].price) {
                S.wallet -= CLASSES[S.classes].price;
                spend('clases', CLASSES[S.classes].price);
                S.classes++;
                did = true;
            } else if (pool > 0 && S.wallet >= wishCost(S) && S.items.gold >= wishCost(S)) {
                const c = wishCost(S), P = wellPool(), w = P.reduce((n, p) => n + p.tier.w, 0);
                let x = R() * w, pick = P[P.length - 1];
                for (const p of P) if ((x -= p.tier.w) < 0) { pick = p; break; }
                const key = `${pick.kind}:${pick.id}`, dup = S.owned.has(key), back = dup ? Math.ceil(c * WELL.refund) : 0;
                S.wallet -= c - back;
                spend('pozo', c - back);
                if (!dup) { S.owned.add(key); S.wished++; if (S.owned.size === wellPool().length) mile('armería completa (pozo)'); }
                did = true;
            }
        }
    }

    function villageCheck() {
        const lv = villageLv(S.village.length);
        while (S.villageLv < lv) {
            S.villageLv++;
            gain('niveles del pueblo', VILLAGE_LEVELS[S.villageLv].gold);
            mile(`pueblo nivel ${S.villageLv}`);
        }
        S.perks = Object.fromEntries(Object.keys(TOWN_PERKS).filter((k) => S.villageLv >= PERK_LEVEL[k]).map((k) => [k, true]));
        for (const m of MEDALS) {
            if (S.medals.has(m.id)) continue;
            const fake = { story: { sold: S.sold }, flags: { gift: S.giftGot, market: false }, trustOf: (id) => trustLevel(S.M[id].trust), village: S.village };
            if (m.test(fake)) { S.medals.add(m.id); gain('logros', m.gold); }
        }
    }

    // Los encargos de una visita (como FarmState.newOrders, sin celos ni mercado)
    function newOrders(d, visit) {
        const M = S.M[d.id], lv = trustLevel(M.trust);
        const fields = FIELDS.filter((f) => S.fields[f.id].on);
        const fav = fields.find((f) => f.crop === d.fav), fav2 = d.fav2 && fields.find((f) => f.crop === d.fav2);
        const rare = (Math.imul(visit | 0, 2654435761) >>> 0) % RARE.every === 1;
        const pay = (1 + ML.TRUST_PAY * (lv - 1)) * ML.MOOD_PAY[M.mood] * (rare ? RARE.pay : 1) * d.pay * (S.perks.market ? TOWN_PERKS.market.pay : 1);
        const [a, b] = MERCHANT.size, big = d.mother ? 1.6 : 1;
        const size = (f, k = 1) => Math.max(MERCHANT.min, Math.round((sheaves(f.id) * (a + R() * (b - a)) * k * big) / MERCHANT.step) * MERCHANT.step);
        const gold = (want) => Math.ceil(Object.entries(want).reduce((g, [c, n]) => g + n * rate(c) * (c === d.fav || c === d.fav2 ? MS.FAV_PAY : 1), 0) * pay);
        const orders = [];
        for (let k = 0; k < MERCHANT.orders - (M.mood === 'serious' ? 1 : 0); k++) {
            const f = k === 0 && fav ? fav : k === 1 && fav2 ? fav2 : fields[(k + visit) % fields.length], n = size(f);
            orders.push({ want: { [f.crop]: n }, gold: gold({ [f.crop]: n }) });
        }
        if (lv >= 2 && fields.length >= 2) {
            const items = {};
            for (let k = 0; k < Math.min(fields.length, lv >= 4 ? 3 : 2); k++) { const f = fields[(k + visit + 1) % fields.length]; items[f.crop] = size(f, 0.6); }
            orders[orders.length - 1] = { want: items, gold: Math.ceil(gold(items) * ML.BASKET_PAY), kind: 'basket' };
        }
        if (lv >= 3 && orders.length > 1) { orders[1].kind = 'urgent'; orders[1].gold *= R() < A.urgentOk ? ML.URGENT.pay : 1; }
        const sp = ML.specialVisit ? ML.specialVisit(lv, visit) : lv >= 2 && (lv >= 4 || visit % 2 === 0);
        if (sp) {
            const f = fav || fields[fields.length - 1], n = size(f, ML.SPECIAL.size);
            const reward = MS.decorOf(d.id).map((x) => x.id).find((x) => !S.village.includes(x) && x !== M.gift) || null;
            orders.push({ want: { [f.crop]: n }, gold: reward ? gold({ [f.crop]: n }) : Math.ceil(gold({ [f.crop]: n }) * ML.SPECIAL.gold), reward, kind: 'special' });
        }
        M.orders = orders;
    }

    function merchants() {
        if (!S.merchantOpen) return;
        for (const d of MERCHANTS) {
            const M = S.M[d.id];
            let v = visitOf(d, S.t);
            if (d.id === 'm0' && S.t - S.firstVisit < d.stay) v = 1e6; // (la primera, tras su llamada)
            if (v === null) {
                if (M.visit !== -1 && M.here) {
                    // Se va: cuenta cómo fue la visita
                    M.here = false;
                    const done = M.orders.filter((o) => o.done).length;
                    if (done === M.orders.length) { M.streak++; M.missed = 0; M.mood = 'happy'; if (M.streak % ML.GIFT_EVERY === 0) M.gift = MS.decorOf(d.id).map((x) => x.id).find((x) => !S.village.includes(x)) || ML.GIFT_GOLD || 30; }
                    else { M.streak = 0; M.missed = done ? 0 : M.missed + 1; M.mood = M.missed >= 2 ? 'serious' : 'neutral'; }
                }
                continue;
            }
            if (M.visit !== v) { M.visit = v; M.here = true; M.visits++; newOrders(d, v); }
            // El regalo de la racha
            if (M.gift !== null) {
                if (typeof M.gift === 'number') gain('regalos', M.gift);
                else if (!S.village.includes(M.gift)) { S.village.push(M.gift); S.src['objetos regalados'] = (S.src['objetos regalados'] || 0) + 1; }
                M.gift = null;
                S.giftGot = true;
            }
            // Entregar lo que se pueda (sin tocar lo que guarda para la siguiente mejora)
            const res = reserve();
            for (const o of M.orders) {
                if (o.done || !affordable(o.want, res)) continue;
                for (const [c, n] of Object.entries(o.want)) S.items[c] -= n;
                o.done = true;
                gain('encargos', o.gold);
                S.wallet += o.gold * A.arsenal;
                S.t += A.deliver;
                if (o.reward && !S.village.includes(o.reward)) { S.village.push(o.reward); S.src['objetos de especiales'] = (S.src['objetos de especiales'] || 0) + 1; }
                M.trust += (o.kind === 'special' || o.kind === 'basket' ? 2 : 1) + (S.perks.park ? TOWN_PERKS.park.trust : 0);
                if (M.orders.every((q) => q.done)) M.trust++;
                if (!S.sold) { S.sold = true; S.landsOpen = true; mile('primera venta: parcelas a la venta'); }
            }
            // Comprar en su tienda (con lo que no va a la armería)
            const stock = MS.decorOf(d.id).filter((x) => !S.village.includes(x.id));
            if (d.mother) { const ex = MS.exclusiveFor(v, S.village); if (ex) stock.push(MS.DECOR_BY_ID[ex]); }
            stock.sort((x, y) => decorPrice(S, x) - decorPrice(S, y));
            for (const it of stock) {
                const p = decorPrice(S, it), free = SALE.filter((l) => !S.lands[l.id]), land = free.length ? Math.min(...free.map((l) => landPrice(S, l.id))) : 0;
                // (las parcelas van antes, pero lo barato lo compra aunque esté ahorrando)
                if (S.items.gold - S.wallet >= p && (A.decorFirst || p <= A.impulse * (S.items.gold - S.wallet) || S.items.gold - S.wallet - land >= p)) { spend('pueblo', p); S.village.push(it.id); S.t += A.deliver; } else break;
            }
            villageCheck();
        }
    }

    // Lo que sube de nivel: un viaje al campo de tiro
    function trip() {
        const night = (S.t % 360) >= 240;
        const ready = FIELDS.filter((f) => { const F = S.fields[f.id]; return F.on && S.t >= F.ripe && (!CROPS[f.crop].night || night); });
        if (!ready.length) { S.t += 5; return; }
        const res = reserve(), M = S.merchantOpen ? MERCHANTS.flatMap((d) => (S.M[d.id].here ? S.M[d.id].orders.filter((o) => !o.done) : [])) : [];
        const wanted = (c) => (res[c] || 0) - S.items[c] > 0 ? 4 : M.some((o) => o.want[c] > S.items[c]) ? 2 : S.items[c] > 600 ? 0.3 : 1;
        const score = (f) => { const F = S.fields[f.id], n = sheaves(f.id), dt = A.over + n * A.spt[f.crop] * Math.max(0.6, 1 - A.dense * F.lv); return (n / dt) * (rate(f.crop) + 0.15) * wanted(f.crop); };
        const f = ready.sort((a, b) => score(b) - score(a))[0], F = S.fields[f.id], n = sheaves(f.id);
        const dt = A.over + n * A.spt[f.crop] * Math.max(0.6, 1 - A.dense * F.lv);
        S.items[f.crop] += Math.round(n * A.hit);
        S.t += dt;
        F.ripe = S.t + CROPS[f.crop].growTime;
    }

    // Las torretas recogen solas (una mata cada TURRETS.every s, lo que deja crecer su campo)
    function turrets(dt) {
        for (const f of FIELDS) {
            const F = S.fields[f.id];
            if (!F.turret || F.ammo <= 0) continue;
            const n = sheaves(f.id), per = n / (CROPS[f.crop].growTime + n * TURRETS.every);
            F.tAcc += per * dt * (CROPS[f.crop].night ? 1 / 3 : 1);
            const k = Math.min(F.ammo, Math.floor(F.tAcc));
            F.tAcc -= k;
            F.ammo -= k;
            S.items[f.crop] += k;
        }
    }

    S.t = A.prologue;
    unlock('wheat');
    const END = 60 * 3600;
    while (S.t < END) {
        const t0 = S.t;
        buyStuff();
        merchants();
        trip();
        turrets(S.t - t0);
        if (FIELDS.every((f) => S.fields[f.id].on && maxed(f.id) && S.fields[f.id].turret) && S.villageLv >= VILLAGE_LEVELS.length - 1) break;
    }
    S.end = S.t;
    return S;
}

// ---------- Varias partidas: la mediana de cada hito ----------
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const fmt = (s) => (s === Infinity ? '—' : s < 3600 ? `${(s / 60).toFixed(0)} min` : `${(s / 3600).toFixed(1)} h`);
function runAll(id) {
    A = profileOf(id);
    return Array.from({ length: RUNS }, (_, i) => sim(i + arg('seed', 1)));
}
const msAt = (runs, n) => med(runs.map((r) => (r.ms.find((m) => m[0] === n) || [n, Infinity])[1]));

if (process.argv.includes('--all')) {
    // Comparativa: los hitos clave de cada arquetipo (horas de juego y días)
    const KEY = [['wheat nivel 5', 'Trigo al máx.'], ['tomato nivel 5', 'Rodeo al máx.'], ['primera venta: parcelas a la venta', 'Primera venta'], ['pueblo nivel 1', 'Pueblo 1'], ['pueblo nivel 5', 'Pueblo 5'], ['sunflower abierto', 'Última parcela'], ['granjas al máximo', 'Granjas al máx.'], ['pueblo nivel 8', 'Pueblo 8'], ['pueblo nivel 10', 'Pueblo 10']];
    const ids = Object.keys(PROFILES), all = Object.fromEntries(ids.map((id) => [id, runAll(id)]));
    const json = {};
    console.log('Hito'.padEnd(16) + ids.map((id) => PROFILES[id].name.padStart(18)).join(''));
    for (const [k, name] of KEY) {
        console.log(name.padEnd(16) + ids.map((id) => { const t = msAt(all[id], k), A0 = profileOf(id); (json[id] ||= {})[name] = t; return `${fmt(t)} (d${t === Infinity ? '-' : Math.ceil(t / A0.session)})`.padStart(18); }).join(''));
    }
    const sum = (runs, k) => { const o = {}; for (const r of runs) for (const [a, b] of Object.entries(r[k])) o[a] = (o[a] || 0) + b / RUNS; return o; };
    for (const id of ids) {
        const src = sum(all[id], 'src'), sink = sum(all[id], 'sink');
        console.log(`\n${PROFILES[id].name}: entra ${Math.round(Object.values(src).reduce((a, b) => a + b, 0))} oro · gasta ${Object.entries(sink).filter(([a]) => !a.startsWith('crop:')).map(([a, b]) => `${a} ${Math.round(b)}`).join(' · ')}`);
    }
    if (process.argv.includes('--json')) console.log(JSON.stringify(json));
    process.exit(0);
}

const profile = process.argv.includes('--profile') ? process.argv[process.argv.indexOf('--profile') + 1] : 'medio';
const runs = runAll(profile);
console.log(`Jugador: ${PROFILES[profile].name} (${PROFILES[profile].desc})`);
const names = [...new Set(runs.flatMap((r) => r.ms.map((m) => m[0])))];
const at = names.map((n) => [n, med(runs.map((r) => (r.ms.find((m) => m[0] === n) || [n, Infinity])[1])), runs.filter((r) => r.ms.some((m) => m[0] === n)).length]).sort((a, b) => a[1] - b[1]);
const days = (s) => (s === Infinity ? '' : `día ${Math.ceil(s / A.session)}`);
console.log('Hito'.padEnd(34), 'mediana'.padStart(9), ` sesión (${A.session / 60} min/día)`);
for (const [n, s, k] of at) console.log(n.padEnd(34), fmt(s).padStart(9), ` ${days(s)}${k < RUNS ? `  (${k}/${RUNS} partidas)` : ''}`);
const sum = (k) => { const o = {}; for (const r of runs) for (const [a, b] of Object.entries(r[k])) o[a] = (o[a] || 0) + b / RUNS; return o; };
console.log('\nFuentes de oro (media por partida):', Object.entries(sum('src')).map(([a, b]) => `${a} ${Math.round(b)}`).join(' · '));
console.log('Gastos (media por partida):', Object.entries(sum('sink')).map(([a, b]) => `${a} ${Math.round(b)}`).join(' · '));
console.log('Oro ganado por hora de juego (mediana):', Array.from({ length: 24 }, (_, h) => med(runs.map((r) => r.hour[h] || 0))).map((g, h) => `${h + 1}h:${Math.round(g)}`).join(' '));
console.log('Fin de partida (mediana):', fmt(med(runs.map((r) => r.end))));
if (process.argv.includes('--dump')) { const r = runs[0]; console.log(r.items, Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, [v.lv, v.turret, v.ammo]]))); }
