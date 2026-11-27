import { L } from '../core/I18n.js';

// La armería del granero: 8 mirillas, 27 armas (rifles, pistolas, subfusiles, ametralladoras y
// escopetas) y 7 cargadores que se compran con monedas de oro
// (el primero de cada uno viene de serie) y se montan en el fusil. Cada uno con sus pegas: unos
// pegan más fuerte pero van más lentos, otros apuntan antes pero ven menos, etc.
//   price   monedas de oro
//   look    cómo es (para su dibujo en la tienda y el fusil en primera persona)
// Mirillas:
//   fov     campo de visión con la mira (grados: menos = más zoom)
//   ads     segundos que tarda en subirse al ojo
//   sway    vaivén y temblor de la mira (1 = el de antes; menos = más firme)
//   lens    cómo es la retícula (cross, dot, chevron, mil o night: verde y se ve de noche)
//   optic   cómo se apunta: tube (de francotirador: el visor tapa la pantalla), reflex (punto
//           rojo) o acog (visor corto): se mira a través del arma y solo se ve su retícula; iron
//           (sin mirilla): con el alza y el punto de mira del arma, como las de la caja
// Rifles:
//   bolt    segundos entre disparo y disparo
//   pierce  cuántos blancos atraviesa una bala (colateral)
//   damage  tiros que quita a lo que aguanta varios (calabazas)
//   recoil  cuánto salta la vista al disparar (1 = el de antes)
//   hip     dispersión sin mira (1 = la de antes; menos = mejor a la cadera)
//   (las que no son rifles: además, girar la vista y la mira recién subida las desvían mucho
//   menos: la dispersión dura es cosa del francotirador)
//   auto    automática: dispara sola mientras se mantiene el gatillo (subfusiles, ametralladoras)
//   pellets perdigones por disparo (escopetas), repartidos en un cono de cone radianes
//   range   alcance en metros (las escopetas no llegan lejos; sin él, 80)
//   sfx     el sonido del disparo (sin él, el del rifle)
//   ammo    cuántas veces más balas le caben con cada cargador (las ametralladoras ligeras: 5)
// Además de los rifles, el «arma» puede ser una pistola, un subfusil, una ametralladora o una
// escopeta (look.type: cómo se dibuja): mirillas y cargadores valen para todas
// Cargadores:
//   size    balas; al acabarse se recarga solo en reload s (R recarga antes)
//   (look de las armas: nostock sin culata, foregrip empuñadura delantera, shroud camisa del
//   cañón con agujeros, belt caja de cinta al costado; cat: 'smg' para el filtro de subfusiles)
//   regen   (célula alienígena) sin recargar: una bala nueva cada regen s
export const ARSENAL = {
    scope: [
        { id: 'none', price: 0, optic: 'iron', fov: 46, ads: 0.14, sway: 0.5, lens: null, name: L('NO SCOPE', 'SIN MIRILLA'), desc: L('JUST THE GUN: AIM DOWN ITS IRON SIGHTS.', 'SOLO EL ARMA: SE APUNTA CON SU ALZA.'),
            look: { none: true } },
        { id: 'std', price: 0, fov: 10.5, ads: 0.22, sway: 0.85, lens: 'cross', name: L('STANDARD', 'ESTÁNDAR'), desc: L('A GOOD ALL-ROUNDER.', 'BUENA PARA TODO.'),
            look: { len: 0.44, r: 0.09, body: 0x34373e, ring: 0xd9b04a, glass: 0x9fdcff } },
        { id: 'dot', price: 8, optic: 'reflex', fov: 40, ads: 0.1, sway: 0.4, lens: 'dot', name: L('RED DOT', 'PUNTO ROJO'), desc: L('NO ZOOM: JUST A RED DOT. UP IN A FLASH.', 'SIN ZOOM: SOLO UN PUNTO ROJO. SE SUBE AL INSTANTE.'),
            look: { len: 0.16, r: 0.1, body: 0x2a2a2a, ring: 0x2a2a2a, glass: 0xff3a2a, open: true } },
        { id: 'holo', price: 12, optic: 'reflex', fov: 36, ads: 0.12, sway: 0.45, lens: 'ring', name: L('HOLOGRAPHIC', 'HOLOGRÁFICA'), desc: L('A RING AND A DOT: EASY TO TRACK MOVING TARGETS.', 'UN ARO Y UN PUNTO: FÁCIL SEGUIR BLANCOS QUE SE MUEVEN.'),
            look: { len: 0.2, r: 0.1, body: 0x34373e, ring: 0x34373e, glass: 0xff5a3a, open: true, hood: true } },
        { id: 'tac', price: 15, optic: 'acog', fov: 24, ads: 0.18, sway: 0.55, lens: 'chevron', name: L('ACOG', 'ACOG'), desc: L('A SHORT SCOPE: SOME ZOOM AND YOU STILL SEE AROUND.', 'VISOR CORTO: ALGO DE ZOOM Y SE SIGUE VIENDO ALREDEDOR.'),
            look: { len: 0.3, r: 0.11, body: 0x5a6a3a, ring: 0x3a4a2a, glass: 0xffa23a, acog: true } },
        { id: 'low', price: 18, fov: 16, ads: 0.17, sway: 0.6, lens: 'cross', name: L('LOW POWER', 'BAJO AUMENTO'), desc: L('A LITTLE ZOOM, QUICK TO THE EYE.', 'POCO ZOOM, SE SUBE ENSEGUIDA.'),
            look: { len: 0.3, r: 0.085, body: 0x4a4a42, ring: 0x8a8a7a, glass: 0x9fdcff } },
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
        // Pistolas: rápidas y muy buenas sin mira, pero sin colaterales
        { id: 'pistol', price: 5, bolt: 0.2, pierce: 1, damage: 1, recoil: 0.45, hip: 0.18, sfx: 'pistol', name: L('PISTOL', 'PISTOLA'), desc: L('LIGHT AND QUICK. GREAT FROM THE HIP.', 'LIGERA Y RÁPIDA. MUY BUENA SIN MIRA.'),
            look: { type: 'pistol', wood: 0x2a2a2a, wood2: 0x3a3a3a, metal: 0x5c6068, barrel: 0.12, thick: 0.05 } },
        { id: 'makarov', price: 7, bolt: 0.24, pierce: 2, damage: 1, recoil: 0.55, hip: 0.2, sfx: 'pistol', name: L('MAKAROV', 'MAKAROV'), desc: L('SMALL, BUT EACH ROUND GOES THROUGH TWO.', 'PEQUEÑA, PERO CADA BALA ATRAVIESA DOS.'),
            look: { type: 'pistol', wood: 0x6a3a1a, wood2: 0x4a4a42, metal: 0x4a4a42, barrel: 0.14, thick: 0.05 } },
        { id: 'cz75', price: 14, auto: true, bolt: 0.11, pierce: 1, damage: 1, recoil: 0.4, hip: 0.22, sfx: 'pistol', name: L('CZ75 AUTO', 'CZ75 AUTO'), desc: L('MACHINE PISTOL: HOLD THE TRIGGER.', 'PISTOLA AMETRALLADORA: MANTÉN EL GATILLO.'),
            look: { type: 'pistol', wood: 0x3a3a3a, wood2: 0x2a2a2a, metal: 0x9aa8b8, barrel: 0.16, thick: 0.05 } },
        { id: 'revolver', price: 22, bolt: 0.55, pierce: 3, damage: 2, recoil: 1.4, hip: 0.25, sfx: 'pistol', name: L('MAGNUM', 'MAGNUM'), desc: L('A REVOLVER THAT HITS LIKE A RIFLE.', 'UN REVÓLVER QUE PEGA COMO UN RIFLE.'),
            look: { type: 'pistol', wood: 0x8a5a2a, wood2: 0x5a3a1a, metal: 0x9aa8b8, barrel: 0.24, thick: 0.06, cylinder: true } },
        { id: 'golden', price: 45, bolt: 0.3, pierce: 6, damage: 3, recoil: 0.9, hip: 0.15, sfx: 'pistol', tracer: 0xffd84a, name: L('GOLDEN GUN', 'PISTOLA DE ORO'), desc: L('ONE SHOT, A WHOLE ROW.', 'UN TIRO, UNA FILA ENTERA.'),
            look: { type: 'pistol', wood: 0xd9b04a, wood2: 0xb08a2a, metal: 0xffd84a, barrel: 0.2, thick: 0.06 } },
        // Subfusiles y ametralladoras: automáticas (se mantiene el gatillo); gastan mucho cargador
        { id: 'smg', price: 9, cat: 'smg', auto: true, bolt: 0.09, pierce: 1, damage: 1, recoil: 0.3, hip: 0.28, sfx: 'smg', name: L('SMG', 'SUBFUSIL'), desc: L('AUTOMATIC: HOLD THE TRIGGER.', 'AUTOMÁTICO: MANTÉN EL GATILLO.'),
            look: { type: 'mg', wood: 0x34373e, wood2: 0x2a2a2a, metal: 0x5c6068, barrel: 0.22, thick: 0.05, short: true } },
        { id: 'mp5k', price: 12, cat: 'smg', auto: true, bolt: 0.08, pierce: 1, damage: 1, recoil: 0.26, hip: 0.24, sfx: 'smg', name: L('MP5K', 'MP5K'), desc: L('COMPACT AND STEADY: NO STOCK, ALL CONTROL.', 'COMPACTO Y FIRME: SIN CULATA, TODO CONTROL.'),
            look: { type: 'mg', wood: 0x2a2a2a, wood2: 0x34373e, metal: 0x34373e, barrel: 0.18, thick: 0.05, short: true, nostock: true, foregrip: true } },
        { id: 'skorpion', price: 14, cat: 'smg', auto: true, bolt: 0.06, pierce: 1, damage: 1, recoil: 0.45, hip: 0.32, sfx: 'smg', name: L('SKORPION', 'SKORPION'), desc: L('THE FASTEST FIRE IN THE BARN. IT KICKS.', 'EL QUE MÁS RÁPIDO DISPARA DEL GRANERO. DA COCES.'),
            look: { type: 'mg', wood: 0x6a3a1a, wood2: 0x4a2a14, metal: 0x4a4a42, barrel: 0.14, thick: 0.045, short: true, nostock: true } },
        { id: 'ak74u', price: 20, cat: 'smg', auto: true, bolt: 0.1, pierce: 2, damage: 1, recoil: 0.42, hip: 0.3, sfx: 'smg', name: L('AK-74U', 'AK-74U'), desc: L('A SHORT AK: EACH ROUND GOES THROUGH TWO.', 'UN AK CORTO: CADA BALA ATRAVIESA DOS.'),
            look: { type: 'mg', wood: 0x9a5a2a, wood2: 0x6a3a1a, metal: 0x4a4a42, barrel: 0.26, thick: 0.06, short: true, brake: true } },
        { id: 'spectre', price: 26, cat: 'smg', auto: true, bolt: 0.075, pierce: 1, damage: 1, recoil: 0.2, hip: 0.15, sfx: 'smg', name: L('SPECTRE', 'SPECTRE'), desc: L('BARELY KICKS. THE BEST FROM THE HIP.', 'APENAS RETROCEDE. EL MEJOR SIN MIRA.'),
            look: { type: 'mg', wood: 0x2a2a2a, wood2: 0x2a2a2a, metal: 0x5c6068, barrel: 0.24, thick: 0.05, short: true, rail: true, shroud: true } },
        { id: 'assault', price: 18, auto: true, bolt: 0.12, pierce: 2, damage: 1, recoil: 0.4, hip: 0.38, sfx: 'smg', name: L('ASSAULT RIFLE', 'FUSIL DE ASALTO'), desc: L('AUTOMATIC, AND EACH ROUND GOES THROUGH TWO.', 'AUTOMÁTICO, Y CADA BALA ATRAVIESA DOS.'),
            look: { type: 'mg', wood: 0x8a5a2a, wood2: 0x5a3a1a, metal: 0x4a4a42, barrel: 0.45, thick: 0.06, handle: true } },
        { id: 'ak47', price: 22, auto: true, bolt: 0.15, pierce: 1, damage: 2, recoil: 0.6, hip: 0.42, sfx: 'smg', name: L('AK-47', 'AK-47'), desc: L('HEAVY ROUNDS: EACH ONE HITS TWICE.', 'BALAS PESADAS: CADA UNA PEGA DOBLE.'),
            look: { type: 'mg', wood: 0xa0602a, wood2: 0x6a3a1a, metal: 0x4a4a42, barrel: 0.42, thick: 0.06 } },
        { id: 'famas', price: 26, auto: true, bolt: 0.08, pierce: 2, damage: 1, recoil: 0.35, hip: 0.4, sfx: 'smg', name: L('FAMAS', 'FAMAS'), desc: L('FIRES LIKE AN SMG, REACHES LIKE A RIFLE.', 'DISPARA COMO UN SUBFUSIL, LLEGA COMO UN FUSIL.'),
            look: { type: 'mg', wood: 0x34373e, wood2: 0x2a2a2a, metal: 0x4a4a42, barrel: 0.36, thick: 0.055, handle: true, short: true } },
        { id: 'lmg', price: 32, ammo: 5, auto: true, bolt: 0.07, pierce: 3, damage: 1, recoil: 0.35, hip: 0.55, sfx: 'smg', name: L('MACHINE GUN', 'AMETRALLADORA'), desc: L('A HAIL OF LEAD: 5 TIMES THE ROUNDS.', 'UNA LLUVIA DE PLOMO: 5 VECES MÁS BALAS.'),
            look: { type: 'mg', wood: 0x5a6a3a, wood2: 0x3a4a2a, metal: 0x34373e, barrel: 0.75, thick: 0.08, bipod: true, rail: true } },
        { id: 'stoner', price: 35, ammo: 5, auto: true, bolt: 0.08, pierce: 3, damage: 1, recoil: 0.28, hip: 0.5, sfx: 'smg', name: L('STONER 63', 'STONER 63'), desc: L('A LIGHT MACHINE GUN THAT HOLDS STEADY.', 'UNA AMETRALLADORA LIGERA QUE NO SE MUEVE.'),
            look: { type: 'mg', wood: 0x34373e, wood2: 0x2a2a2a, metal: 0x5c6068, barrel: 0.62, thick: 0.07, bipod: true, belt: true } },
        // (las pesadas: balas que pegan doble y atraviesan filas; mejor con la caja de cinta)
        { id: 'hk21', price: 42, ammo: 5, auto: true, bolt: 0.1, pierce: 4, damage: 2, recoil: 0.55, hip: 0.65, sfx: 'smg', name: L('HK21', 'HK21'), desc: L('HEAVY: HITS TWICE AND CHEWS THROUGH ROWS.', 'PESADA: PEGA DOBLE Y SE COME LAS FILAS.'),
            look: { type: 'mg', wood: 0x2a2a2a, wood2: 0x34373e, metal: 0x34373e, barrel: 0.8, thick: 0.09, bipod: true, belt: true, rail: true } },
        { id: 'm60', price: 48, ammo: 5, auto: true, bolt: 0.12, pierce: 6, damage: 2, recoil: 0.7, hip: 0.75, sfx: 'smg', name: L('M60', 'M60'), desc: L('THE BIG ONE: HEAVY LEAD THROUGH A WHOLE ROW.', 'LA GORDA: PLOMO PESADO A TRAVÉS DE UNA FILA ENTERA.'),
            look: { type: 'mg', wood: 0x5a6a3a, wood2: 0x3a4a2a, metal: 0x34373e, barrel: 0.85, thick: 0.1, bipod: true, belt: true, shroud: true, handle: true } },
        // Escopetas: varios perdigones de un tiro, pero de corto alcance
        { id: 'pump', price: 11, bolt: 0.85, pellets: 8, cone: 0.06, range: 26, pierce: 1, damage: 1, recoil: 1.3, hip: 0.22, sfx: 'shotgun', name: L('PUMP SHOTGUN', 'ESCOPETA DE CORREDERA'), desc: L('A FISTFUL OF PELLETS. SHORT RANGE.', 'UN PUÑADO DE PERDIGONES. CORTO ALCANCE.'),
            look: { type: 'shotgun', wood: 0xb0703a, wood2: 0x7a4824, metal: 0x34373e, barrel: 0.6, thick: 0.06, pump: true } },
        { id: 'double', price: 16, bolt: 0.35, pellets: 10, cone: 0.08, range: 20, pierce: 1, damage: 1, recoil: 1.6, hip: 0.25, sfx: 'shotgun', name: L('DOUBLE BARREL', 'DE DOS CAÑONES'), desc: L('THE FARMER\'S FAVOURITE. FAST, VERY CLOSE.', 'LA DEL GRANJERO. RÁPIDA, MUY DE CERCA.'),
            look: { type: 'shotgun', wood: 0x8a5a2a, wood2: 0x5a3a1a, metal: 0x5c6068, barrel: 0.55, thick: 0.05, double: true } },
        { id: 'hs10', price: 20, bolt: 0.3, pellets: 6, cone: 0.1, range: 18, pierce: 1, damage: 1, recoil: 0.9, hip: 0.15, sfx: 'shotgun', name: L('HS10', 'HS10'), desc: L('A ONE-HANDED SHOTGUN. WIDE AND VERY CLOSE.', 'UNA ESCOPETA DE UNA MANO. ABIERTA Y MUY DE CERCA.'),
            look: { type: 'shotgun', wood: 0x2a2a2a, wood2: 0x34373e, metal: 0x5c6068, barrel: 0.3, thick: 0.07, short: true, nostock: true, pump: true } },
        { id: 'spas', price: 28, bolt: 0.45, pellets: 9, cone: 0.045, range: 34, pierce: 1, damage: 1, recoil: 1.2, hip: 0.22, sfx: 'shotgun', name: L('SPAS-12', 'SPAS-12'), desc: L('SEMI-AUTO, TIGHT SPREAD: REACHES FURTHER.', 'SEMIAUTOMÁTICA Y CERRADA: LLEGA MÁS LEJOS.'),
            look: { type: 'shotgun', wood: 0x2a2a2a, wood2: 0x34373e, metal: 0x34373e, barrel: 0.55, thick: 0.065, pump: true, shroud: true } },
        { id: 'autoshot', price: 38, auto: true, bolt: 0.28, pellets: 7, cone: 0.06, range: 30, pierce: 2, damage: 1, recoil: 1, hip: 0.28, sfx: 'shotgun', name: L('AUTO SHOTGUN', 'ESCOPETA AUTOMÁTICA'), desc: L('SHOTGUN BLASTS, NON-STOP.', 'ESCOPETAZOS SIN PARAR.'),
            look: { type: 'shotgun', wood: 0x34373e, wood2: 0x2a2a2a, metal: 0x4a4a42, barrel: 0.5, thick: 0.07, rail: true } },
    ],
    mag: [
        { id: 'std', price: 0, size: 10, reload: 1.3, name: L('STANDARD', 'ESTÁNDAR'), desc: L('10 ROUNDS.', '10 BALAS.'),
            look: { w: 0.07, h: 0.14, d: 0.1, color: 0x34373e } },
        { id: 'fast', price: 6, size: 6, reload: 0.5, name: L('QUICK', 'RÁPIDO'), desc: L('FEW ROUNDS, RELOADS IN NO TIME.', 'POCAS BALAS, RECARGA EN UN MOMENTO.'),
            look: { w: 0.07, h: 0.09, d: 0.08, color: 0xd9b04a } },
        { id: 'dual', price: 9, size: 12, reload: 0.85, name: L('DUAL MAG', 'DOBLE CARGADOR'), desc: L('TWO TAPED MAGS: 12 ROUNDS, QUICK RELOAD.', 'DOS CARGADORES PEGADOS: 12 BALAS, RECARGA RÁPIDA.'),
            look: { w: 0.07, h: 0.15, d: 0.09, color: 0x34373e, dual: true } },
        { id: 'ext', price: 12, size: 18, reload: 2.2, name: L('EXTENDED', 'AMPLIADO'), desc: L('MANY ROUNDS, SLOWER RELOAD.', 'MUCHAS BALAS, RECARGA MÁS LENTA.'),
            look: { w: 0.07, h: 0.26, d: 0.1, color: 0x34373e, bend: true } },
        { id: 'drum', price: 20, size: 40, reload: 3.6, name: L('DRUM', 'TAMBOR'), desc: L('40 ROUNDS. TAKES AGES TO RELOAD.', '40 BALAS. TARDA UNA ETERNIDAD EN RECARGAR.'),
            look: { w: 0.14, h: 0.2, d: 0.2, color: 0x5c6068, drum: true } },
        { id: 'box', price: 28, size: 75, reload: 5, name: L('BELT BOX', 'CAJA DE CINTA'), desc: L('75 ROUNDS ON A BELT. FOR THE HEAVY ONES.', '75 BALAS EN CINTA. PARA LAS PESADAS.'),
            look: { w: 0.16, h: 0.15, d: 0.2, color: 0x5a6a3a, box: true } },
        { id: 'cell', price: 35, size: 8, regen: 0.55, name: L('ALIEN CELL', 'CÉLULA ALIEN'), desc: L('NEVER RELOADS: ROUNDS REGROW.', 'NUNCA RECARGA: LAS BALAS SE REGENERAN.'),
            look: { w: 0.09, h: 0.13, d: 0.12, color: 0x3e2a5e, glow: 0x7dff4a } },
    ],
};

export const ARSENAL_KINDS = ['scope', 'rifle', 'mag'];
export const DEFAULT_LOADOUT = { scope: 'std', rifle: 'bolt', mag: 'std' };

// Clases (como en Call of Duty): conjuntos con nombre de rifle, mirilla, cargador y las rachas de
// bajas que se llevan (de cultivos y alienígenas). Se usa la equipada. Solo la primera viene de
// serie; las demás se desbloquean con monedas de oro (price)
export const CLASSES = [
    { name: ['SNIPER', 'FRANCOTIRADOR'], price: 0 },
    { name: ['HARVESTER', 'COSECHADOR'], price: 10 },
    { name: ['ALIEN SCARER', 'ESPANTAALIENS'], price: 20 },
    { name: ['CLASS 4', 'CLASE 4'], price: 35 },
    { name: ['CLASS 5', 'CLASE 5'], price: 50 },
    { name: ['CLASS 6', 'CLASE 6'], price: 70 },
    { name: ['CLASS 7', 'CLASE 7'], price: 90 },
    { name: ['CLASS 8', 'CLASE 8'], price: 120 },
    { name: ['CLASS 9', 'CLASE 9'], price: 150 },
    { name: ['CLASS 10', 'CLASE 10'], price: 200 },
];
// El nombre de una clase: el que le haya puesto el jugador o el de serie
export const className = (c, i) => (c && c.name) || L(...CLASSES[i].name);

// Tipos de arma (el filtro del selector): por cómo se dibuja (look.type); los subfusiles, por cat
export const WEAPON_CATS = [
    { id: 'rifle', name: L('RIFLES', 'RIFLES') },
    { id: 'pistol', name: L('PISTOLS', 'PISTOLAS') },
    { id: 'smg', name: L('SMGS', 'SUBFUSILES') },
    { id: 'mg', name: L('MACHINE GUNS', 'AMETRALLADORAS') },
    { id: 'shotgun', name: L('SHOTGUNS', 'ESCOPETAS') },
];
export const weaponCat = (it) => it.cat || it.look.type || 'rifle';
export const arsenalItem = (kind, id) => ARSENAL[kind].find((x) => x.id === id) || ARSENAL[kind][0];

// Lo que da al fusil un equipo { scope, rifle, mag }
export function loadoutStats(loadout = DEFAULT_LOADOUT) {
    const s = arsenalItem('scope', loadout.scope), r = arsenalItem('rifle', loadout.rifle), m = arsenalItem('mag', loadout.mag);
    return {
        zoom: s.fov, ads: s.ads, steady: s.sway, lens: s.lens, optic: s.optic || 'tube',
        bolt: r.bolt, pierce: r.pierce, damage: r.damage, recoil: r.recoil, hip: r.hip, tracer: r.tracer || 0xfff6dc,
        auto: !!r.auto, light: !!r.look.type, pellets: r.pellets || 1, cone: r.cone || 0, range: r.range || 80, sfx: r.sfx || 'snipe',
        size: m.size * (r.ammo || 1), reload: m.reload || 0, regen: m.regen || 0,
    };
}
