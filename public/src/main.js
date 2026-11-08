import * as THREE from 'three';
import { CONFIG } from './config.js';
import { THEME } from './content/theme.js';
import { CROPS } from './content/crops.js';
import { FARM, FIELD_BY_ID, INFO, TURRETS, toWorld } from './content/farm.js';
import { KILLSTREAKS, setStreakCounts, streakOf } from './content/killstreaks.js';
import { SHOP, SHOP_ITEMS } from './content/ufo.js';
import { ARSENAL, ARSENAL_KINDS, CLASSES } from './content/arsenal.js';
import { gearArt } from './ui/GearArt.js';
import { MERCHANT, MerchantClock } from './content/merchant.js';
import { RetroRenderer } from './render/RetroRenderer.js';
import { CameraRig } from './render/CameraRig.js';
import { Particles } from './render/Particles.js';
import { weatherParticle } from './render/weather.js';
import { Farm } from './world/Farm.js';
import { FarmState } from './game/FarmState.js';
import { WONDER } from './content/mysterybox.js';
import { Sniper } from './game/Sniper.js';
import { DayNight } from './game/DayNight.js';
import { Prologue } from './game/Prologue.js';
import { Scope } from './ui/Scope.js';
import { installPixelSprites } from './ui/PixelArt.js';
import { Sfx } from './core/Audio.js';
import { Music } from './core/Music.js';
import { Settings } from './core/Settings.js';
import { L, applyHtmlTexts, switchLang } from './core/I18n.js';
import { vibrate } from './core/Haptics.js';
import { clamp } from './core/math.js';
import { Sky } from './render/Sky.js';

const $ = (id) => document.getElementById(id);
const INK = THEME.outline;
const M = CONFIG.map;
const S = CONFIG.sniper;

Settings.load();
applyHtmlTexts();
installPixelSprites();

const sfx = new Sfx();
const music = new Music(sfx);
sfx.enabled = Settings.sfx;
music.enabled = Settings.music;

const canvas = $('view');
const renderer = new RetroRenderer(canvas, CONFIG.render);
const scope = new Scope($('scope'));
const state = new FarmState();
state.freeCosts = Settings.freeCosts;
state.freeHome = Settings.freeHome;
// En las pruebas la progresión está abierta (salvo con ?progress, para probarla)
state.gatesOff = CONFIG.test && !new URLSearchParams(location.search).has('progress');
const merchantClock = new MerchantClock(Settings.merchant || (CONFIG.test ? 'away' : null));
setStreakCounts(Settings.streaks);

// Luces de una escena (sol y cielo); se guardan para pasarlas a las de la noche
const lit = [];
// withSky: con su cúpula de cielo (las escenas en primera persona, que miran al horizonte)
function addLights(scene, withSky = true) {
    const { light } = THEME;
    const sun = new THREE.DirectionalLight(light.sun, light.sunIntensity);
    sun.position.set(-4, 10, 6);
    const hemi = new THREE.HemisphereLight(light.sky, light.ground, light.hemiIntensity);
    scene.add(sun, hemi);
    const sky = withSky ? new Sky() : null;
    if (sky) scene.add(sky.root);
    lit.push({ scene, sun, hemi, sky });
    nightApplied = -1;
}

// ---------- Día y noche ----------
// El reloj de verdad (en las pruebas, siempre de día salvo que DEBUG diga otra cosa). Cada
// fotograma las dos escenas mezclan sus luces y su cielo con los de la noche de luna llena.
const dayNight = new DayNight(Settings.daytime || (CONFIG.test ? 'day' : null));
const _cDay = new THREE.Color(), _cNight = new THREE.Color();
let nightApplied = -1, duskApplied = -1, clockT = 0, kSmooth = -1, dSmooth = -1;
const _cDusk = new THREE.Color();
function applyNight(dt = 1) {
    // Los cambios forzados (el prólogo, DEBUG) también pasan poco a poco
    const a = kSmooth < 0 ? 1 : Math.min(1, dt * 1.2);
    kSmooth = kSmooth < 0 ? dayNight.k : kSmooth + (dayNight.k - kSmooth) * a;
    dSmooth = dSmooth < 0 ? dayNight.dusk : dSmooth + (dayNight.dusk - dSmooth) * a;
    if (Math.abs(dayNight.k - kSmooth) < 0.01) kSmooth = dayNight.k; // al llegar, justo
    if (Math.abs(dayNight.dusk - dSmooth) < 0.01) dSmooth = dayNight.dusk;
    // (con la mirilla de visión nocturna puesta, de noche se ve casi como de día)
    const nv = mode === 'snipe' && sniper.stats.lens === 'night' && sniper.adsK > 0.6;
    const k = kSmooth * (nv ? 0.15 : 1), d = dSmooth * (nv ? 0.3 : 1), { light, night, dusk } = THEME;
    sniper.nightK = farm.nightK = kSmooth; // (los alienígenas brillan igual)
    if (Math.abs(k - nightApplied) < 0.002 && Math.abs(d - duskApplied) < 0.002) return;
    nightApplied = k;
    duskApplied = d;
    const mix = (out, a, b, c) => out.copy(_cDay.setHex(a)).lerp(_cNight.setHex(b), k).lerp(_cDusk.setHex(c), d);
    const num = (a, b, c) => (a + (b - a) * k) * (1 - d) + c * d;
    for (const { scene, sun, hemi, sky } of lit) {
        if (sky) {
            sky.update(k, d);
            scene.background.copy(sky.horizon);
        } else mix(scene.background, THEME.sky, night.sky, 0xf0a070);
        mix(sun.color, light.sun, night.sun, dusk.sun);
        sun.intensity = num(light.sunIntensity, night.sunIntensity, dusk.sunIntensity);
        mix(hemi.color, light.sky, night.hemiSky, dusk.hemiSky);
        mix(hemi.groundColor, light.ground, night.hemiGround, dusk.hemiGround);
        hemi.intensity = num(light.hemiIntensity, night.hemiIntensity, dusk.hemiIntensity);
    }
    document.body.classList.toggle('night', k > 0.5);
}
// Reloj del día en la interfaz: sol o luna y lo que falta para que cambie
function updateClock() {
    const el = $('daytime'), left = dayNight.left, night = dayNight.night;
    const html = `${ico(night ? 'moon' : 'sun')}<span>${left === null ? (night ? L('NIGHT', 'NOCHE') : L('DAY', 'DÍA')) : fmt(left)}</span>`;
    if (el.innerHTML !== html) el.innerHTML = html;
    el.classList.toggle('is-night', night);
}

// ---------- Granja (mapa) ----------
const farmScene = new THREE.Scene();
farmScene.background = new THREE.Color(THEME.sky);
addLights(farmScene, false);
const farm = new Farm(THEME, state.fields, state.barn.level, state.house.level, state.lands);
farmScene.add(farm.root);
const farmParticles = new Particles(farmScene, 600);
// Lo de la granja se pide en las coordenadas de siempre de cada parcela (la lógica no sabe dónde
// está en el mapa): farmFx y rig.focus lo pasan al mundo (farmParticles y rigFocus: ya en el mundo)
const farmFx = {
    spawn: (x, y, z, ...r) => { const w = toWorld(x, z, y); return farmParticles.spawn(w.x, w.y, w.z, ...r); },
    burst: (x, y, z, ...r) => { const w = toWorld(x, z, y); return farmParticles.burst(w.x, w.y, w.z, ...r); },
};
const rig = new CameraRig(M);
rig.free = true;
rig.setBounds(M.view, M.view);
rig.yaw = rig.yawTarget = M.yaw;
const rigFocus = rig.focus.bind(rig);
rig.focus = (x, z) => {
    const w = toWorld(x, z);
    rigFocus(w.x, w.z, w.y);
};
// La vista de inicio: el granero (al cargar, al llegar del prólogo...)
const BARN_DEF = FARM.structures.find((s) => s.id === 'barn');
const goHome = () => rig.focus(BARN_DEF.x, BARN_DEF.z + 1);
goHome();
rig.snap();
// La sombra de una parcela recién comprada se retira: destellos dorados por donde pasa
farm.onLandWave = (x, z) => farmFx.burst(x, 0.3, z, 3, [0xffd23f, 0xfff6b0, 0xffffff], { speed: 1.2, up: 3, size: 0.12, ttl: 0.6 });
// Bala de una torreta automática en el mapa: polvo y paja donde da (y su ruido, una de cada dos)
// Sin munición, la torreta del campo se apaga (y cada poco echa una bocanada de humo)
farm.turretEmpty = (id) => state.turretEmpty(id);
farm.onTurretOff = (x, y, z) => farmFx.burst(x, y, z, 5, [0x5a5a5a, 0x3a3a3a, 0x8a8a8a], { speed: 0.4, up: 1.4, size: 0.14, ttl: 1.1, grav: -0.6 });
farm.onTurretHit = (x, z, n) => {
    farmFx.burst(x, 0.4, z, 5, [0xffe9a0, 0xd9b77a, THEME.dust], { speed: 1.4, up: 2, size: 0.08, ttl: 0.4 });
    if (mode === 'farm' && n % 2) sfx.play('turret');
};
farm.onLand = (m) => {
    const p = m.root.position;
    farmFx.burst(p.x, 0.1, p.z, 18, [THEME.dust, 0xd9b77a], { speed: 2.4, up: 1.4, size: 0.14, ttl: 0.5 });
    rig.shake(0.18);
    sfx.play('drop');
};

// ---------- Francotirador ----------
let snipeField = null; // id del campo en el que se está (cosechando o desbloqueando)
const cropOf = (id) => CROPS[FIELD_BY_ID[id].crop];
const sniper = new Sniper(THEME, {
    sfx,
    onHit(target, nx, ny) {
        if (prologue.active) return; // en el prólogo no se recoge nada de verdad
        state.collect(snipeField);
        const x = (nx * 0.5 + 0.5) * innerWidth, y = (-ny * 0.5 + 0.5) * innerHeight;
        popPlus(x, y);
        flyItem(cropOf(snipeField).icon, x, y, $('snipe-wheat'), () => updateCounts(true));
        $('left-count').textContent = sniper.field.remaining;
    },
    onMedal({ collateral, streak, reward }) {
        if (collateral > 1) medal(`${L('COLLATERAL', 'COLATERAL')} x${collateral}`, 'collateral');
        if (streak >= 2) {
            const name = streak === 2 ? L('DOUBLE KILL', 'DOBLE KILL') : streak === 3 ? L('TRIPLE KILL', 'TRIPLE KILL') : L('MULTI KILL', 'MULTI KILL');
            medal(name, streak >= 4 ? 'multi' : '');
        }
        // Recompensa de una racha: su medalla, más grande
        if (reward) {
            const k = KILLSTREAKS.find((r) => r.id === reward);
            medal(`${k.at} · ${k.name}`, k.track === 'alien' ? 'reward alien' : 'reward');
        }
        if (collateral > 1 || streak >= 2 || reward) vibrate('kill');
    },
    // Misil Predator: la interfaz del francotirador se cambia por la del misil
    onPredator(on) {
        document.body.classList.toggle('predator', on);
    },
    onNukeCount(n) {
        const el = $('nuke-count');
        el.classList.toggle('hidden', n <= 0);
        $('nuke-n').textContent = n;
        el.classList.remove('tick');
        void el.offsetWidth;
        el.classList.add('tick');
    },
    // Bomba nuclear: fogonazo blanco largo, luego neblina amarillenta que se queda (lluvia
    // radiactiva) y, además del campo, se recoge lo maduro de toda la granja
    onNuke() {
        $('nuke-count').classList.add('hidden');
        setTimeout(() => mode === 'snipe' && document.body.classList.add('fallout'), 700);
        renderer.flash(0xffffff, 1);
        for (let k = 1; k <= 6; k++) setTimeout(() => renderer.flash(k % 2 ? 0xfff6dc : 0xffffff, 1 - k * 0.12), k * 160);
        for (const def of FARM.fields) {
            if (prologue.active || def.id === snipeField || !state.isReady(def.id)) continue;
            for (let n = state.fields[def.id].left; n > 0; n--) state.collect(def.id);
        }
        if (!prologue.active) updateCounts(true);
        setTimeout(() => banner(L('NUKE!', '¡NUCLEAR!')), 300);
    },
    // El barril ha reventado: el terreno queda limpio y desbloqueado (se guarda ya)
    // Alienígena a pie abatido: encima de su cabeza sale su +1 (como el +100 de Call of Duty), su
    // medalla y la racha alienígena da un salto
    onAlien(nx, ny) {
        killPop((nx * 0.5 + 0.5) * innerWidth, (-ny * 0.5 + 0.5) * innerHeight);
        medal(L('ALIEN DOWN!', '¡ALIEN ABATIDO!'), 'alien');
        vibrate('kill');
        const el = $('alien-streak');
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
    },
    // Un alienígena (o un ovni, con varias) se ha escapado con algo del campo: se pierde, con su -n
    // rojo donde se fue
    onStolen(target, nx, ny, n = 1) {
        if (prologue.active) return;
        for (let k = 0; k < n; k++) state.lose(snipeField);
        killPop((nx * 0.5 + 0.5) * innerWidth, (-ny * 0.5 + 0.5) * innerHeight, cropOf(snipeField).icon, 'stolen-pop', `-${n}`);
        medal(L('STOLEN!', '¡ROBADO!'), 'stolen');
        sfx.play('miss');
        $('left-count').textContent = sniper.field.remaining;
    },
    // Bala que da a un alienígena (a pie o en ovni): aspa en el centro y su chasquido
    // La caja sorpresa: aparece (aviso y su torre marcada), se le dispara desde otra torre o se va
    // Torreta del campo de tiro: ¿le queda munición? y cada mata que recoge gasta una
    turretArmed: () => !state.turretEmpty(snipeField),
    onTurretHarvest: () => turretShot(snipeField),
    onBox(what) {
        if (what === 'spawn') {
            stage(L('MYSTERY BOX!', '¡CAJA SORPRESA!'), L('JUMP TO ITS TOWER AND SHOOT IT', 'SALTA A SU TORRE Y DISPÁRALE'));
            vibrate('pickup');
        } else if (what === 'far') medal(L('FROM ITS TOWER!', '¡DESDE SU TORRE!'), 'box');
        updateBoxHud();
    },
    // El arma que ha tocado (w) o se acabó su munición (null)
    onWonder(w) {
        if (w) {
            stage(w.name, L('FROM THE MYSTERY BOX', 'DE LA CAJA SORPRESA'));
            vibrate('kill');
        } else medal(L('OUT OF AMMO: BACK TO THE RIFLE', 'SIN MUNICIÓN: OTRA VEZ EL RIFLE'), 'box');
        updateBoxHud();
    },
    onHitMarker() {
        const el = $('hitmarker');
        el.classList.remove('on');
        void el.offsetWidth;
        el.classList.add('on');
        sfx.play('hitmark');
    },
    // Ovni pequeño derribado (ya no da monedas: el oro solo lo paga el mercader)
    onUfoDown() {
        if (prologue.active) return;
        medal(L('UFO DOWN!', '¡OVNI DERRIBADO!'), 'reward');
        vibrate('kill');
    },
    onUnlock() {
        state.unlock(snipeField);
        // Fogonazo blanco a toda pantalla y, al poco, el ¡BUM!
        renderer.flash(0xfff6dc, 1);
        setTimeout(() => renderer.flash(0xffcc33, 0.7), 420);
        setTimeout(() => banner(L('BOOM!', '¡BUM!')), 150);
    },
    onFinish() {
        if (prologue.active) return;
        setTimeout(() => banner(L('ALL IN!', '¡COSECHA COMPLETA!')), 250);
        vibrate('kill');
    },
    onDone() {
        if (!prologue.active) goFarm(true);
    },
    // Prólogo: el disparo al trigo mágico
    onMagic() {
        prologue.hitMagic();
    },
    onCorner(i) {
        showCorner(i);
    },
});
addLights(sniper.scene);

// ---------- Prólogo ----------
// Una partida nueva empieza con él (en las pruebas, solo si la URL lleva ?prologue)
const fineMouse = matchMedia('(pointer: fine)').matches;
let typer = 0, typing = null;
const prologueHooks = {
    sfx,
    lights: addLights,
    flash: (c, k) => renderer.flash(c, k),
    // Bocadillo del trigo mágico, letra a letra (null lo quita)
    say(text) {
        const el = $('pro-talk');
        clearInterval(typer);
        if (!text) return el.classList.add('hidden');
        el.classList.remove('hidden', 'in');
        void el.offsetWidth;
        el.classList.add('in');
        let n = 0;
        $('pro-text').textContent = '';
        $('pro-talk').classList.remove('done');
        typing = text;
        typer = setInterval(() => {
            n += 2;
            $('pro-text').textContent = text.slice(0, n);
            if (n % 6 === 0) sfx.play('tick');
            if (n >= text.length) prologueHooks.sayFinish();
        }, 40);
    },
    // Termina de escribir la línea de golpe; true si aún se estaba escribiendo
    sayFinish() {
        clearInterval(typer);
        $('pro-talk').classList.add('done');
        if (typing === null) return false;
        $('pro-text').textContent = typing;
        typing = null;
        return true;
    },
    // Silencio dramático (la música se corta antes de la nuclear)
    silence: () => music.stop(),
    // Aviso grande de qué hacer: recolectar a mano o apuntar y disparar (null lo quita)
    prompt(kind) {
        const el = $('pro-prompt');
        if (!kind) return el.classList.add('hidden');
        el.textContent = kind === 'collect' || kind === 'magic'
            ? (fineMouse ? L('CLICK TO HARVEST', 'HAZ CLIC PARA RECOLECTAR') : L('TAP TO HARVEST', 'TOCA PARA RECOLECTAR'))
            : (fineMouse ? L('HOLD RIGHT CLICK TO AIM · RELEASE TO FIRE', 'MANTÉN EL CLIC DERECHO PARA APUNTAR · SUÉLTALO PARA DISPARAR') : L('HOLD THE AIM BUTTON · RELEASE IT TO FIRE', 'MANTÉN EL BOTÓN DE MIRA · SUÉLTALO PARA DISPARAR'));
        el.classList.toggle('aim', kind === 'aim');
        el.classList.toggle('magic', kind === 'magic'); // el del trigo mágico, de colores
        el.classList.remove('hidden');
    },
    popPlus: () => popPlus(innerWidth * 0.62, innerHeight * 0.62),
    // El trigo mágico te deja su viejo granero: primero la vista se aleja (para ver bien todo el
    // recinto) y luego aparece solo
    openBarn: () => {
        rig.focus(BARN_DEF.x, BARN_DEF.z + 1);
        rig.zoomTarget = 2.6;
        setTimeout(() => openBarn(true), 1100);
    },
    cine(on) {
        document.body.classList.toggle('cine', on);
        if (on) touch = pan = pinch = null;
    },
    // A la torre, frente a un campo de trigo enorme (el del trigo al máximo), con el rifle de serie
    enterTower() {
        const W = FIELD_BY_ID.wheat.levels[FIELD_BY_ID.wheat.levels.length - 1];
        snipeField = null;
        sniper.enter({ crop: 'wheat', count: W.sheaves, arena: W.arena, loadout: { scope: 'std', rifle: 'bolt', mag: 'std' } });
        mode = 'snipe';
        snipeStart = time;
        document.body.classList.add('sniping');
        $('snipe-ui').classList.remove('hidden');
        startMusic(THEME.sniperMusic);
    },
    // Al mapa: la granja de verdad, con todo por hacer
    toMap() {
        sniper.leave();
        sniper.ending = -1;
        if (document.exitPointerLock && locked()) document.exitPointerLock();
        document.body.classList.remove('sniping', 'predator', 'fallout', 'scoped');
        $('nuke-count').classList.add('hidden');
        $('snipe-ui').classList.add('hidden');
        $('farm-ui').classList.remove('hidden');
        $('bubbles').classList.remove('hidden');
        scope.show(false);
        mode = 'farm';
        goHome();
        rig.zoomTarget = 1.6; // algo más lejos: se ve la zona y el trigo hablando
        rig.snap();
        startMusic(THEME.music);
    },
    done() {
        rig.zoomTarget = 1.6;
        document.body.classList.remove('prologue');
        // Sigue siendo de día hasta que el reloj llegue al día de verdad
        dayNight.force = Settings.daytime || null;
        if (!dayNight.force) dayNight.hold = true;
        state.prologue = true;
        state.save();
        updateCounts();
    },
};
const prologue = new Prologue(THEME, sniper, farm, prologueHooks);
const prologueLocked = () => prologue.active && prologue.locked;

renderer.onResize = (w, h) => {
    rig.resize(w / h);
    sniper.camera.aspect = w / h;
    sniper.camera.updateProjectionMatrix();
    prologue.resize(w / h);
    scope.resize(w, h, canvas.style.width.replace('px', ''), canvas.style.height.replace('px', ''));
};
renderer.resize();

// ---------- Interfaz ----------
let mode = 'farm'; // 'farm' | 'toSnipe' | 'snipe' | 'toFarm'
let modeT = 0;
let time = 0;
let selected = null; // { structure } | { field: id }
const ray = new THREE.Raycaster();
const ndcOf = (x, y) => {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
};
const ico = (icon) => `<span class="ico ${icon}-ico"></span>`;
// Lo que cuesta algo, en sus pastillas (cultivos y oro); short: en rojo lo que no llega
const costHtml = (cost) => Object.entries(cost).map(([c, n]) => `<span class="upgrade-cost${state.items[c] < n ? ' short' : ''}">${ico(c === 'gold' ? 'gold' : CROPS[c].icon)}<b>${n}</b></span>`).join('');

// ---------- Progresión ----------
// Lo que ya está abierto (lo nuevo lo anuncian los regalos del trigo mágico: ver «La historia»)
function refreshGates() {
    merchantClock.locked = !state.open('merchant');
    // El granero y lo suyo (el silo, el tractor y todo el recinto): sin abrir no está (solo su
    // cartel para abrirlo)
    for (const id of ['barn', 'silo', 'tractor']) farm.byId[id].root.visible = state.open('barn');
    farm.compoundOn = state.open('barn');
    farm.setLandsOpen(state.open('lands'));
}

// Aparición mágica, como el trigo mágico: un rayo de luz de colores baja del cielo en (x, z), se
// abre un anillo en el suelo y lo de parts (cada uno, { o: su objeto, x, z: dónde, delay }) sale
// de la tierra girando, en ola desde el centro, con chispas en espiral; al final, estallido de
// colores, fogonazo y temblor. Lo usan el granero (con todo su recinto) y la casa
const RAINBOW = [0xff3e5e, 0xff9a1f, 0xffe03a, 0x7dff4a, 0x3ac8ff, 0x9a5aff];
const reveals = [];
function magicReveal(x, z, parts, { beamW = 5, ring = 9 } = {}) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(beamW, 60, beamW * 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    farm.world(x, 30, z, beam.position);
    beam.scale.set(0.0001, 1, 0.0001);
    const rg = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 20, 1), new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    rg.rotation.x = -Math.PI / 2;
    farm.world(x, 0.08, z, rg.position);
    farmScene.add(beam, rg);
    for (const p of parts) {
        Object.assign(p, { y: p.o.position.y, ry: p.o.rotation.y, s: p.o.scale.x, up: false });
        p.o.scale.setScalar(0.0001); // (bajo tierra hasta que le toque)
    }
    const end = 2 + Math.max(0, ...parts.map((p) => p.delay || 0));
    reveals.push({ t: 0, x, z, beam, ring: rg, ringK: ring, parts, boom: false, end });
    sfx.play('secret');
}

// El granero se abre con magia (y con él su silo, su tractor y todo el recinto, en ola)
function openBarn(quiet = false) {
    if (!state.openBarn()) return;
    const b = farm.byId.barn;
    refreshGates();
    rig.focus(b.def.x, b.def.z + 1);
    const parts = ['barn', 'silo', 'tractor'].map((id) => ({ o: farm.byId[id].root, x: farm.byId[id].def.x, z: farm.byId[id].def.z, delay: 0 }));
    for (const c of farm.compoundPieces) parts.push({ o: c.g, x: c.x, z: c.z, delay: 0.5 + Math.hypot(c.x - b.def.x, c.z - b.def.z) * 0.06 });
    magicReveal(b.def.x, b.def.z, parts, { ring: 16 });
    updateCounts();
    if (!quiet) setTimeout(() => stage(L('BARN UNLOCKED!', '¡GRANERO DESBLOQUEADO!'), L('NOW CLEAR THE WHEAT FIELD', 'AHORA LIMPIA EL CAMPO DE TRIGO')), 300);
}

function updateBarnFx(dt) {
    for (const E of [...reveals]) {
        E.t += dt;
        const t = E.t;
        // El rayo: se ensancha, late con los colores del arcoíris y se cierra
        const bw = t < 0.4 ? t / 0.4 : t < 1.3 ? 1 : Math.max(0, 1 - (t - 1.3) / 0.5);
        E.beam.scale.set(Math.max(0.0001, bw * (0.9 + Math.sin(t * 30) * 0.1)), 1, Math.max(0.0001, bw));
        E.beam.material.color.setHSL((t * 1.5) % 1, 1, 0.7);
        E.ring.scale.setScalar(1 + t * E.ringK);
        E.ring.material.opacity = Math.max(0, 1 - t / 1.6);
        // Cada pieza sale de la tierra girando y crece con un rebote (las de lejos, más tarde)
        for (const p of E.parts) {
            const k = Math.min(1, Math.max(0, (t - 0.35 - (p.delay || 0)) / 0.9));
            const back = k <= 0 ? 0 : 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
            p.o.scale.setScalar(Math.max(0.0001, back * p.s));
            p.o.position.y = p.y - 3 * (1 - Math.min(1, k * 1.3));
            p.o.rotation.y = p.ry + (1 - k) ** 2 * Math.PI * 4;
            if (k > 0.75 && !p.up && p.delay) {
                p.up = true;
                farmFx.burst(p.x, 1.2, p.z, 24, RAINBOW, { speed: 4, up: 4, size: 0.16, ttl: 0.9, grav: 6 });
                if (Math.random() < 0.5) sfx.play('pop');
            }
        }
        if (t < 1.5) for (let n = 0; n < 4; n++) {
            const a = time * 7 + n * 1.6, h = (t * 4 + n) % 7;
            farmFx.spawn(E.x + Math.sin(a) * 3.4, h, E.z + Math.cos(a) * 3.4, 0, 1.4, 0, 0.18, 0.7, RAINBOW[(Math.random() * RAINBOW.length) | 0], 0);
        }
        if (!E.boom && t > 1.25) {
            E.boom = true;
            farmFx.burst(E.x, 2, E.z, 140, RAINBOW, { speed: 7, up: 6, size: 0.22, ttl: 1.4, grav: 6 });
            renderer.flash(0xffffff, 0.6);
            rig.shake(0.6);
            sfx.play('unlock');
            vibrate('kill');
        }
        if (t > E.end) {
            farmScene.remove(E.beam, E.ring);
            for (const o of [E.beam, E.ring]) {
                o.geometry.dispose();
                o.material.dispose();
            }
            for (const p of E.parts) {
                p.o.scale.setScalar(p.s);
                p.o.position.y = p.y;
                p.o.rotation.y = p.ry;
            }
            reveals.splice(reveals.indexOf(E), 1);
        }
    }
}

function updateCounts(bump = false) {
    refreshGates();
    for (const c of Object.keys(CROPS)) $(`${c}-count`).textContent = state.items[c];
    // Monedas de oro: salen en cuanto hay alguna (o en cuanto ha venido el comerciante)
    $('gold-count').textContent = $('merchant-gold').textContent = state.items.gold;
    $('farm-gold').classList.toggle('hidden', !state.items.gold && !farm.camp.present);
    // Los contadores de los demás cultivos salen cuando ya hay su campo (o algo recogido)
    for (const f of FARM.fields) if (f.crop !== 'wheat') $(`farm-${f.crop}`).classList.toggle('hidden', !state.fields[f.id].unlocked && !state.items[f.crop]);
    // En el campo de tiro, el contador es el del cultivo que se recoge
    const hud = snipeField && !sniper.unlocking ? FIELD_BY_ID[snipeField].crop : 'wheat';
    $('hud-wheat').textContent = state.items[hud];
    $('hud-ico').className = `ico ${CROPS[hud].icon}-ico`;
    refreshSigns();
    refreshArmory();
    if (bump) {
        for (const id of [hud === 'tomato' ? 'farm-tomato' : 'farm-wheat', 'snipe-wheat']) {
            const el = $(id);
            el.classList.remove('bump');
            void el.offsetWidth;
            el.classList.add('bump');
        }
        sfx.play('coin');
    }
}

function banner(text, cls = '') {
    const el = $('banner');
    el.className = 'banner';
    el.textContent = text;
    void el.offsetWidth;
    el.className = `banner show ${cls}`;
}

// Medallas de la partida (colateral, doble/triple/multi kill): pequeñas, arriba, se apilan
function medal(text, cls = '') {
    if (prologue.active) return; // en el prólogo, sin carteles (colateral, multibaja...)
    const feed = $('medals');
    const el = document.createElement('div');
    el.className = `medal ${cls}`;
    el.textContent = text;
    feed.prepend(el);
    while (feed.children.length > 3) feed.lastChild.remove();
    setTimeout(() => el.remove(), 1600);
    sfx.play(cls === 'multi' ? 'power' : 'spot');
}

function stage(name, sub) {
    $('stage-name').textContent = name;
    $('stage-sub').textContent = sub;
    const el = $('stage');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
}

function popPlus(x, y) {
    const el = document.createElement('div');
    el.className = 'pop-plus';
    el.textContent = '+1';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

// +1 de un alienígena abatido, con su cara, encima de su cabeza; sube y se va. (Con otro icono y
// clase, el +1 de lo que recogen las torretas en el mapa)
function killPop(x, y, icon = 'alien', cls = '', text = '+1') {
    const el = document.createElement('div');
    el.className = `kill-pop ${cls}`;
    el.innerHTML = `${ico(icon)}<b>${text}</b>`;
    // (con la mira el zoom deja la cabeza fuera: que no se salga de la pantalla)
    el.style.left = `${Math.min(innerWidth - 50, Math.max(50, x))}px`;
    el.style.top = `${Math.min(innerHeight - 60, Math.max(140, y))}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// Lo recogido (espiga o tomate pixelado) vuela a saltos hasta el contador
// ¡Trato hecho con el mercader! Su retrato salta y gira, se le cae la careta un momento (¡ups!) y,
// si se le paga (coins: el contador del que salen), las monedas de cartón le vuelan a las manos.
// Si está en el mapa, en 3D hace lo mismo, con confeti de colores
function merchantDeal(sheet, coins = null) {
    const p = sheet.querySelector('.merchant-portrait');
    p.classList.remove('deal');
    void p.offsetWidth;
    p.classList.add('deal');
    if (coins) {
        const r = coins.getBoundingClientRect();
        for (let k = 0; k < 4; k++) setTimeout(() => flyItem('gold', r.x + r.width / 2, r.y + r.height / 2, p, () => sfx.play('coin')), k * 80);
    }
    setTimeout(() => sfx.play('hitmark'), 550);
    if (farm.camp.celebrate()) {
        const S = MERCHANT.stall;
        setTimeout(() => farmFx.burst(S.x, 2.2, S.z, 40, [0xff3e5e, 0xffe03a, 0x7dff4a, 0x3ac8ff, 0xc8955a], { speed: 3, up: 4, size: 0.12, ttl: 1.2, grav: 6 }), 450);
    }
}

function flyItem(icon, x, y, target, done) {
    const el = document.createElement('i');
    el.className = `fly-item ${icon}-ico`;
    document.body.appendChild(el);
    const r = target.getBoundingClientRect();
    const tx = r.left + 20, ty = r.top + r.height / 2;
    const anim = el.animate([
        { left: `${x}px`, top: `${y}px`, transform: 'scale(1.6)' },
        { left: `${x + (tx - x) * 0.2}px`, top: `${y - 60}px`, transform: 'scale(1.3)', offset: 0.3 },
        { left: `${tx}px`, top: `${ty}px`, transform: 'scale(.8)' },
    ], { duration: 650, easing: 'steps(8)' });
    anim.onfinish = () => {
        el.remove();
        done();
    };
}

function showCorner(i) {
    [...$('corners').children].forEach((el, k) => el.classList.toggle('on', k === i));
}

// En las marcas de las torres, la de la caja sorpresa (en azul, latiendo)
function updateBoxHud() {
    const t = sniper.box.state === 'idle' ? sniper.box.tower : -1;
    [...$('corners').children].forEach((el, k) => el.classList.toggle('box', k === t));
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

// Encima de cada campo: un cartel flotante con su nivel (tocarlo abre su ficha para mejorarlo)
// y, cuando está maduro, la burbuja de RECOGER. En un terreno bloqueado el cartel lleva un
// candado; cuando ya se puede desbloquear dice ¡DESBLOQUEAR! y tocarlo lleva al barril.
const signs = {}, wasReady = {};
const uiButton = (cls, onTap) => {
    const b = document.createElement('button');
    b.className = cls;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        sfx.unlock();
        onTap();
    });
    $('bubbles').appendChild(b);
    return b;
};
// Cartel del granero: es el armamento (las rachas de bajas); tocarlo abre su menú
const armory = uiButton('field-sign armory-sign hidden', () => select({ structure: 'barn' }));
armory.id = 'sign-barn';
// Cartel de la casa: su nivel en piezas y la flecha verde si se puede mejorar; abre su ficha
const houseSign = uiButton('field-sign house-sign hidden', () => select({ structure: 'house' }));
// Cartel encima de la casa al máximo: abre la tienda para personalizarla (la lleva el
// mercader). Hasta abrirla la primera vez es una admiración; después, su cara
const ufoSign = uiButton('field-sign ufo-sign hidden', () => openShop());
ufoSign.id = 'sign-ufo';
// Cartel del comerciante encima de su puesto: con él, su nombre (y la flecha si hay algún encargo
// que se puede entregar); sin él, lo que falta para que vuelva
const merchantSign = uiButton('field-sign merchant-sign hidden', () => openMerchant());
merchantSign.id = 'sign-merchant';
// ---------- Dock (abajo, en el centro) ----------
// Botones cuadrados de solo icono para ir a cada sitio: el granero, los campos (va pasando por
// los que piden algo), la casa y el mercader. Si la cámara ya está allí, abre su ficha. Un
// cuadradito rojo avisa de que hay algo que hacer.
const dock = document.createElement('div');
dock.className = 'dock';
dock.id = 'dock';
$('farm-ui').appendChild(dock);
const dockGo = (x, z, open) => {
    const w = toWorld(x, z);
    if (Math.hypot(rig.fx - w.x, rig.fz - w.z) < 3) return open();
    leaveMap(false);
    select(null);
    rig.focus(x, z);
    sfx.play('ui');
};
const fieldNeeds = (id) => state.isReady(id) || state.canUnlock(id) || state.canUpgrade(id);
const DOCK = [
    { id: 'barn', icon: 'ks-grenade', label: L('ARMORY', 'ARMAMENTO'), show: () => state.open('barn'), alert: () => state.canUpgradeBarn,
        go: () => { const b = farm.byId.barn.def; dockGo(b.x, b.z + 1, () => select({ structure: 'barn' })); } },
    { id: 'fields', icon: 'wheat', label: L('FIELDS', 'CAMPOS'), show: () => true, alert: () => FARM.fields.some((f) => fieldNeeds(f.id)),
        go: () => toggleFieldsPop() },
    { id: 'house', icon: 'home', label: L('FARMHOUSE', 'CASA'), show: () => state.open('house'), alert: () => state.canUpgradeHouse,
        go: () => { const h = farm.byId.house.def; dockGo(h.x, h.z, () => select({ structure: 'house' })); } },
    { id: 'merchant', icon: 'merchant', label: L('MERCHANT', 'MERCADER'), show: () => !merchantClock.locked, alert: () => farm.camp.open && state.ordersFor(merchantClock.visit).some((o) => state.canDeliver(o)),
        go: () => dockGo(MERCHANT.stall.x, MERCHANT.stall.z, () => openMerchant()) },
];
for (const d of DOCK) {
    d.el = uiButton('dock-btn', d.go);
    d.el.id = `dock-${d.id}`;
    d.el.title = d.label;
    d.el.setAttribute('aria-label', d.label);
    d.el.innerHTML = `${ico(d.icon)}<i class="dock-dot"></i>`;
    dock.appendChild(d.el);
}
// CAMPOS abre otra barra igual justo encima, con una ficha por cultivo desbloqueado (su icono, su
// nivel en rayitas y el cuadradito rojo si está listo); tocar una lleva la cámara a su campo (y, si
// ya estás allí, abre su ficha)
const fieldsPop = document.createElement('div');
fieldsPop.className = 'dock-pop hidden';
fieldsPop.id = 'fields-pop';
fieldsPop.addEventListener('pointerdown', (e) => e.stopPropagation());
dock.appendChild(fieldsPop);
function toggleFieldsPop(open = fieldsPop.classList.contains('hidden')) {
    fieldsPop.classList.toggle('hidden', !open);
    DOCK.find((d) => d.id === 'fields').el.classList.toggle('on', open);
    if (!open) return;
    sfx.play('ui');
    fieldsPop.innerHTML = '';
    const ids = FARM.fields.map((f) => f.id).filter((id) => state.fields[id].unlocked);
    if (!ids.length) fieldsPop.innerHTML = `<span class="dock-pop-empty">${L('NO CROPS YET', 'AÚN SIN CULTIVOS')}</span>`;
    for (const id of ids) {
        const def = FIELD_BY_ID[id], f = state.fields[id], ready = state.isReady(id);
        const b = uiButton(`dock-btn dock-pop-btn${ready ? ' alert' : ''}`, () => {
            toggleFieldsPop(false);
            const r = farm.views.find((v) => v.id === id).rect;
            dockGo(r.cx, r.cz, () => select({ field: id }));
        });
        b.id = `pop-${id}`;
        b.title = CROPS[def.crop].name;
        b.innerHTML = `${ico(CROPS[def.crop].icon)}<span class="sr">${CROPS[def.crop].name}</span><i class="dock-dot"></i><span class="pips">${def.levels.map((_, i) => `<i class="pip${i <= f.level ? ' on' : ''}"></i>`).join('')}</span>`;
        fieldsPop.appendChild(b);
    }
}
// Tocar fuera lo cierra
addEventListener('pointerdown', (e) => {
    if (!fieldsPop.classList.contains('hidden') && !e.target.closest('#dock')) toggleFieldsPop(false);
}, true);
function refreshDock() {
    for (const d of DOCK) {
        d.el.classList.toggle('hidden', !d.show());
        d.el.classList.toggle('alert', !!d.alert());
    }
}
function refreshMerchantSign() {
    const here = farm.camp.open, left = merchantClock.left;
    const can = here && state.ordersFor(merchantClock.visit).some((o) => state.canDeliver(o));
    const html = `${ico('gold')}<span>${here ? MERCHANT.name : left === null ? L('AWAY', 'FUERA') : fmt(left)}</span><i class="sign-up"></i>`;
    if (merchantSign.innerHTML !== html) merchantSign.innerHTML = html;
    merchantSign.classList.toggle('away', !here);
    merchantSign.classList.toggle('can-up', can);
}
function refreshUfoSign() {
    ufoSign.classList.toggle('met', state.ufo.met);
    ufoSign.innerHTML = state.ufo.met ? ico('merchant') : '<span>!</span>';
}
refreshUfoSign();
houseSign.id = 'sign-house';

// Con el nivel del granero (y de la casa) en piezas y la flecha verde si se puede mejorar
function refreshArmory() {
    const hl = state.house.level, hmax = FARM.house.levels.length - 1;
    const hp = Array.from({ length: hmax }, (_, i) => `<i class="pip${i < hl ? ' on' : ''}"></i>`).join('');
    // (bloqueada, como un terreno: su candado, hasta que la abre el trigo mágico)
    const hopen = state.open('house');
    const hhtml = hopen ? `${ico('home')}<span>${L('FARMHOUSE', 'CASA')}</span><span class="pips">${hp}</span><i class="sign-up"></i>` : `${ico('lock')}<span>${L('LOCKED', 'BLOQUEADO')}</span>`;
    if (houseSign.innerHTML !== hhtml) houseSign.innerHTML = hhtml;
    houseSign.classList.toggle('locked', !hopen);
    houseSign.classList.toggle('can-up', state.canUpgradeHouse);
    const html = !state.open('barn') ? `${ico('barrel')}<span>${L('UNLOCK BARN!', '¡DESBLOQUEAR GRANERO!')}</span>`
        : `${ico('ks-grenade')}<span>${L('ARMORY', 'ARMAMENTO')}</span><i class="sign-up"></i>`;
    if (armory.innerHTML !== html) armory.innerHTML = html;
    armory.classList.toggle('can-unlock', !state.open('barn'));
    armory.classList.toggle('can-up', state.canUpgradeBarn || ARSENAL_KINDS.some((k) => ARSENAL[k].some((x) => !state.ownsGear(k, x.id) && state.items.gold >= state.gearPrice(k, x.id))));
}

for (const def of FARM.fields) {
    const id = def.id;
    signs[id] = uiButton('field-sign hidden', () => (state.canUnlock(id) ? startUnlock(id) : select({ field: id })));
    signs[id].id = `sign-${id}`;
}

function refreshSigns() {
    refreshDock();
    for (const def of FARM.fields) {
        const id = def.id, el = signs[id], f = state.fields[id];
        const can = state.canUnlock(id);
        // Parcela sin comprar: EN VENTA con su precio en oro (cuando la progresión las abre; antes,
        // con su candado como cualquier terreno)
        const land = state.landOf(id), forSale = !!land && !state.lands[land.id] && state.open('lands');
        el.classList.toggle('locked', !f.unlocked && !can && !forSale);
        el.classList.toggle('can-unlock', can);
        el.classList.toggle('for-sale', forSale);
        el.classList.toggle('can-up', state.canUpgrade(id) || state.canBuyTurrets(id) || (state.turretEmpty(id) && state.canReloadTurret(id)) || (forSale && state.canBuyLand(land.id)));
        el.classList.toggle('turret-empty', state.turretEmpty(id));
        const html = f.unlocked
            ? `${ico(CROPS[def.crop].icon)}${f.turrets ? ico('turret') : ''}<span class="sign-level">${L('LV', 'NV')}.${f.level + 1}</span><span class="grow"><i></i></span><i class="sign-ready"></i><i class="sign-up"></i>`
            : forSale ? `${ico('gold')}<span>${state.landPrice(land.id)}</span><i class="sign-up"></i>`
            : can ? `${ico('barrel')}<span>${L('UNLOCK!', '¡DESBLOQUEAR!')}</span>` : `${ico('lock')}<span>${L('LOCKED', 'BLOQUEADO')}</span>`;
        if (el.innerHTML !== html) el.innerHTML = html;
        if (f.unlocked) el.style.setProperty('--sign', `#${def.levels[f.level].sign.toString(16).padStart(6, '0')}`);
        else el.style.removeProperty('--sign');
    }
}

const _b = new THREE.Vector3();
function placeBubbles() {
    const show = mode === 'farm' && farm.introT > 1.6;
    armory.classList.toggle('hidden', !show);
    houseSign.classList.toggle('hidden', !show);
    merchantSign.classList.toggle('hidden', !show || merchantClock.locked);
    if (show) {
        farm.world(MERCHANT.stall.x, 3.1, MERCHANT.stall.z, _b).project(rig.camera);
        merchantSign.style.left = `${Math.round((_b.x * 0.5 + 0.5) * innerWidth)}px`;
        merchantSign.style.top = `${Math.round((-_b.y * 0.5 + 0.5) * innerHeight)}px`;
    }
    const ufoOn = show && state.open('shop') && state.houseMaxed && !cine; // (la tienda, con la casa al máximo)
    ufoSign.classList.toggle('hidden', !ufoOn);
    if (ufoOn) {
        const h = farm.byId.house;
        farm.world(h.def.x + 2.4, h.top + 0.8, h.def.z - 2.4, _b).project(rig.camera);
        ufoSign.style.left = `${Math.round((_b.x * 0.5 + 0.5) * innerWidth)}px`;
        ufoSign.style.top = `${Math.round((-_b.y * 0.5 + 0.5) * innerHeight)}px`;
    }
    if (show) {
        const house = farm.byId.house;
        farm.world(house.def.x, (house.level ? house.top : 1.8) - 1.2, house.def.z, _b).project(rig.camera);
        houseSign.style.left = `${Math.round((_b.x * 0.5 + 0.5) * innerWidth)}px`;
        houseSign.style.top = `${Math.round((-_b.y * 0.5 + 0.5) * innerHeight)}px`;
        const barn = farm.byId.barn;
        // (el cartel ya sube un poco por su cuenta: con esto queda justo sobre el tejado)
        farm.world(barn.def.x, barn.top - 1.4, barn.def.z, _b).project(rig.camera);
        armory.style.left = `${Math.round((_b.x * 0.5 + 0.5) * innerWidth)}px`;
        armory.style.top = `${Math.round((-_b.y * 0.5 + 0.5) * innerHeight)}px`;
    }
    for (const def of FARM.fields) {
        // Un solo medallón por cultivo: creciendo (barrita que se llena) o listo (amarillo con
        // su «!»); al tocarlo, la ficha de abajo con RECOGER y lo que le falta
        const id = def.id, sign = signs[id], f = state.fields[id];
        const ready = f.unlocked && state.isReady(id);
        if (show && ready && !wasReady[id]) sfx.play('itemSpawn');
        wasReady[id] = show && ready;
        sign.classList.toggle('ready', ready);
        sign.classList.toggle('hidden', !show);
        if (show && f.unlocked) {
            const bar = sign.querySelector('.grow > i');
            const w = `${ready ? 100 : Math.round(state.progress(id) * 10) * 10}%`;
            if (bar && bar.style.width !== w) bar.style.width = w;
        }
        if (!show) continue;
        farm.fieldTop(id, _b).project(rig.camera);
        const x = `${Math.round((_b.x * 0.5 + 0.5) * innerWidth)}px`, y = `${Math.round((-_b.y * 0.5 + 0.5) * innerHeight)}px`;
        sign.style.left = x;
        sign.style.top = y;
    }
    // Las parcelas que aún no tienen cultivo: su candado en el centro
    for (const l of SOON_LANDS) {
        l.sign.classList.toggle('hidden', !show);
        if (!show) continue;
        farm.world((l.rect[0] + l.rect[2]) / 2, 2.2, (l.rect[1] + l.rect[3]) / 2, _b).project(rig.camera);
        l.sign.style.left = `${Math.round((_b.x * 0.5 + 0.5) * innerWidth)}px`;
        l.sign.style.top = `${Math.round((-_b.y * 0.5 + 0.5) * innerHeight)}px`;
    }
}
// Las parcelas de PRONTO (sin cultivo aún): bloqueadas, con su candado como un terreno; tocarlas
// lo dice
const SOON_LANDS = FARM.lands.filter((l) => l.soon).map((l) => {
    const sign = uiButton('field-sign locked hidden', () => {
        sfx.play('miss');
        medal(L('LOCKED: COMING SOON', 'BLOQUEADA: PRÓXIMAMENTE'));
    });
    sign.id = `sign-land-${l.id}`;
    sign.innerHTML = `${ico('lock')}<span>${L('LOCKED', 'BLOQUEADO')}</span>`;
    return { ...l, sign };
});

// Ficha del edificio o del campo tocado
function select(what) {
    // El granero es el cuartel de las rachas de bajas: abre su menú (sin abrir, se abre)
    if (what && (what.structure === 'barn' || what.structure === 'silo') && !state.open('barn')) return openBarn();
    if (what && what.structure === 'barn') {
        select(null);
        farm.byId.barn.select();
        rig.focus(farm.byId.barn.def.x, farm.byId.barn.def.z + 1);
        return openStreaks();
    }
    selected = what;
    const panel = $('panel');
    if (!what) {
        panel.classList.add('hidden');
        return;
    }
    sfx.play('ui');
    panel.classList.remove('hidden', 'in');
    void panel.offsetWidth;
    panel.classList.add('in');
    if (what.structure) {
        const m = farm.byId[what.structure];
        m.select();
        rig.focus(m.def.x, m.def.z + 1);
    } else {
        const f = farm.fields[what.field].rect;
        rig.focus(f.cx, f.cz + 1);
    }
    refreshPanel();
}

function refreshPanel() {
    if (!selected) return;
    const title = $('panel-title'), text = $('panel-text'), bar = $('panel-bar'), act = $('panel-action'), up = $('panel-upgrade');
    if (selected.structure === 'house') return refreshHousePanel(title, text, bar, act, up);
    if (selected.structure) {
        const m = farm.byId[selected.structure];
        title.textContent = m.def.name;
        text.textContent = INFO[selected.structure];
        bar.parentElement.classList.add('hidden');
        act.classList.add('hidden');
        up.classList.add('hidden');
        return;
    }
    const id = selected.field, def = FIELD_BY_ID[id], f = state.fields[id], crop = CROPS[def.crop];
    // Parcela en venta: qué hay dentro y el botón de comprarla con oro
    const land = state.landOf(id);
    if (!f.unlocked && land && !state.lands[land.id] && !state.open('lands')) {
        // (aún no está a la venta: bloqueada)
        title.textContent = `${land.name} · ${L('LOCKED', 'BLOQUEADA')}`;
        text.textContent = L('FULL OF JUNK AND NOT FOR SALE... YET.', 'LLENA DE PORQUERÍA Y SIN DUEÑO... DE MOMENTO NO SE VENDE.');
        bar.parentElement.classList.add('hidden');
        act.classList.add('hidden');
        up.classList.add('hidden');
        return;
    }
    if (!f.unlocked && land && !state.lands[land.id]) {
        title.textContent = land.name;
        text.textContent = L(`FOR SALE. FULL OF JUNK, BUT IT HAS ROOM FOR A ${def.name}. PAY IN GOLD FROM THE MERCHANT, THEN BLOW UP ITS BARREL.`, `EN VENTA. LLENA DE PORQUERÍA, PERO CABE UN ${def.name}. SE PAGA CON EL ORO DEL COMERCIANTE Y LUEGO SE VUELA SU BARRIL.`);
        bar.parentElement.classList.add('hidden');
        act.classList.remove('hidden');
        act.classList.add('unlock-btn');
        act.disabled = !state.canBuyLand(land.id);
        $('action-ico').className = 'ico gold-ico';
        $('action-label').textContent = `${L('BUY', 'COMPRAR')} ${state.landPrice(land.id)}`;
        up.classList.add('hidden');
        return;
    }
    act.disabled = false;
    // Terreno bloqueado: qué falta para desbloquearlo (el otro campo al máximo) o el botón
    if (!f.unlocked) {
        const can = state.canUnlock(id);
        title.textContent = def.locked.name;
        bar.parentElement.classList.toggle('hidden', can);
        if (can) text.textContent = L('FULL OF RUSTY JUNK. HIT THE RED BARREL FROM FAR AWAY TO BLOW IT ALL UP!', 'LLENO DE CHATARRA OXIDADA. ¡DALE AL BARRIL ROJO DESDE LEJOS PARA VOLARLO TODO!');
        else {
            const after = FIELD_BY_ID[def.locked.after], af = state.fields[after.id];
            text.textContent = L(`FULL OF RUSTY JUNK. MAX OUT THE ${after.name} (LV.${after.levels.length}) TO UNLOCK IT.`, `LLENO DE CHATARRA OXIDADA. SUBE EL ${after.name} AL NIVEL MÁXIMO (NV.${after.levels.length}) PARA DESBLOQUEARLO.`);
            bar.style.width = `${Math.round(((af.level + 1) / after.levels.length) * 20) * 5}%`;
        }
        act.classList.toggle('hidden', !can);
        act.classList.add('unlock-btn');
        $('action-ico').className = 'ico barrel-ico';
        $('action-label').textContent = L('UNLOCK!', '¡DESBLOQUEAR!');
        up.classList.add('hidden');
        return;
    }
    const p = state.progress(id), ready = state.isReady(id);
    title.textContent = `${def.name} ${L('LV', 'NV')}.${f.level + 1}`;
    const what = crop.unit;
    text.textContent = (ready
        ? L(`RIPE! ${f.left} ${what} TO HARVEST.`, `¡MADURO! ${f.left} ${what} PARA RECOGER.`)
        : `${L('GROWING... READY IN', 'CRECIENDO... LISTO EN')} ${fmt((1 - p) * crop.growTime)}`)
        + (!f.turrets ? '' : f.ammo > 0
            ? ` ${L(`THE TURRET HARVESTS IT BY ITSELF (AMMO ${f.ammo}/${TURRETS.ammo}).`, `LA TORRETA LO RECOGE SOLA (MUNICIÓN ${f.ammo}/${TURRETS.ammo}).`)}`
            : ` ${L('THE TURRET IS OUT OF AMMO: RELOAD IT WITH GOLD.', 'LA TORRETA SE HA QUEDADO SIN MUNICIÓN: RECÁRGALA CON ORO.')}`);
    bar.parentElement.classList.remove('hidden');
    bar.style.width = `${Math.round(p * 20) * 5}%`;
    act.classList.toggle('hidden', !ready);
    act.classList.remove('unlock-btn');
    $('action-ico').className = `ico ${crop.icon}-ico`;
    $('action-label').textContent = L('HARVEST!', '¡RECOGER!');
    // Mejora: más grande y con más blancos, pagando lo que pida (trigo, tomates...). Con el
    // campo al máximo, la mejora extra: sus torretas automáticas
    // Con la torreta puesta, el botón es su recarga (con oro), y llena: AUTOMÁTICO
    const maxed = state.maxed(id), turrets = maxed && !f.turrets, armed = !!f.turrets;
    const full = armed && f.ammo >= TURRETS.ammo, reload = armed && !full;
    up.classList.remove('hidden');
    up.classList.toggle('turret-up', turrets || reload);
    up.classList.toggle('turret-empty', armed && f.ammo <= 0);
    up.disabled = reload ? !state.canReloadTurret(id) : turrets ? !state.canBuyTurrets(id) : !state.canUpgrade(id);
    $('upgrade-label').innerHTML = full ? `${ico('turret')}${L('AUTOMATED', 'AUTOMÁTICO')}` : reload ? `${ico('turret')}${L('RELOAD', 'RECARGAR')}` : turrets ? `${ico('turret')}${L('TURRET', 'TORRETA')}` : L('UPGRADE', 'MEJORAR');
    const price = reload ? { gold: state.reloadCost(id) } : full ? {} : turrets ? state.turretCost(id) : state.cost(id);
    const cost = Object.entries(price).map(([c, n]) => `<span class="upgrade-cost${state.items[c] < n ? ' short' : ''}">${ico(c === 'gold' ? 'gold' : CROPS[c].icon)}<b>${n}</b></span>`).join('');
    if ($('upgrade-cost').innerHTML !== cost) $('upgrade-cost').innerHTML = cost;
    up.classList.toggle('maxed', full);
}

// Comprar la parcela de un campo con oro: ya es tuya (la sombra se retira desde su poste, que
// salta, y se iza tu bandera) y queda lista para volar su barril
function buyLand(id) {
    const land = state.landOf(id);
    if (!land || !state.buyLand(land.id)) return sfx.play('miss');
    select(null);
    farm.ownLand(land.id);
    const [x0, z0, x1, z1] = land.rect;
    rig.focus((land.post.x * 2 + (x0 + x1) / 2) / 3, (land.post.z * 2 + (z0 + z1) / 2) / 3);
    rig.zoomTarget = 1.35;
    rig.shake(0.12);
    sfx.play('power');
    setTimeout(() => sfx.play('achievement'), 350);
    vibrate('pickup');
    updateCounts();
    stage(L('IT IS YOURS!', '¡AHORA ES TUYA!'), L('IT IS FILTHY: BLOW UP ITS BARREL TO CLEAR IT', 'ESTÁ SUCIA: VUELA SU BARRIL PARA LIMPIARLA'));
    refreshPanel();
}

// Torreta automática: aparecen sacos en las 4 esquinas del campo, la torreta en uno de ellos, y
// desde ya lo recoge sola
function buyTurrets(id, force = false) {
    if (mode !== 'farm' || !state.buyTurrets(id, force)) return;
    farm.setTurrets(id);
    const f = farm.fields[id].rect;
    select(null);
    rig.focus(f.cx, f.cz + 1);
    sfx.play('whoosh');
    vibrate('pickup');
    updateCounts();
}
// Cada golpe de la llegada de la torreta (Farm.updateDrop): polvo, sonido y temblor; al final, su cartel
farm.onDrop = (kind, x, z) => {
    if (kind === 'bag') {
        farmFx.burst(x, 0.3, z, 16, [THEME.dust, 0x8a7a5a], { speed: 2.2, up: 1.6, size: 0.14, ttl: 0.5 });
        rig.shake(0.12);
        sfx.play('crateBreak');
    } else if (kind === 'land') {
        farmFx.burst(x, 0.6, z, 30, [THEME.dust, 0x6a7a5a, 0xffffff], { speed: 3, up: 2.4, size: 0.16, ttl: 0.7 });
        rig.shake(0.25);
        sfx.play('boom');
        vibrate('kill');
    } else {
        farmFx.burst(x, 1.4, z, 24, [0xffe03a, 0xff9a1f, 0xffffff], { speed: 4, up: 5, size: 0.1, ttl: 0.6 });
        sfx.play('power');
        stage(L('TURRET ONLINE!', '¡TORRETA EN MARCHA!'), L('IT HARVESTS THE FIELD BY ITSELF', 'RECOGE EL CAMPO SOLA'));
        refreshPanel();
    }
};

// Recogida automática en el mapa: cada campo con torretas, mientras está maduro, recoge una mata
// cada poco (lo de las torretas no suma a las rachas). El campo en el que estás disparando lo
// recogen sus torretas en el campo de tiro.
const autoT = {};
function autoHarvest(dt) {
    for (const def of FARM.fields) {
        const id = def.id;
        if (!state.fields[id].turrets || (mode !== 'farm' && id === snipeField) || !state.isReady(id) || state.turretEmpty(id)) continue;
        if ((autoT[id] = (autoT[id] || 0) + dt) < TURRETS.every) continue;
        autoT[id] = 0;
        state.collect(id);
        turretShot(id);
        updateCounts();
        // En el mapa, un +1 con el cultivo sale de donde acaban de acribillar
        const at = mode === 'farm' && farm.turretSpot(id);
        if (at) {
            farm.world(at.x, 1.4, at.z, _b).project(rig.camera);
            if (_b.z < 1) killPop((_b.x * 0.5 + 0.5) * innerWidth, (-_b.y * 0.5 + 0.5) * innerHeight, CROPS[def.crop].icon, 'auto-pop');
        }
    }
}

// Cada mata que recoge una torreta gasta una de su munición; al acabarse, se para y lo avisa
function turretShot(id) {
    if (!state.useTurretAmmo(id)) return;
    if (!state.turretEmpty(id)) {
        if (selected && selected.field === id) refreshPanel();
        return;
    }
    medal(`${L('TURRET OUT OF AMMO', 'TORRETA SIN MUNICIÓN')}: ${CROPS[FIELD_BY_ID[id].crop].name || FIELD_BY_ID[id].name}`, 'empty');
    sfx.play('warn');
    refreshSigns();
    refreshPanel();
}

// Recargar la torreta de un campo con oro: las monedas vuelan del contador y se pone en marcha
function reloadTurret(id) {
    if (mode !== 'farm' || !state.reloadTurret(id)) return sfx.play('miss');
    sfx.play('coin');
    setTimeout(() => sfx.play('reloaded'), 160);
    vibrate('pickup');
    medal(L('TURRET RELOADED', 'TORRETA RECARGADA'), 'reward');
    updateCounts();
    refreshSigns();
    refreshPanel();
}

function upgradeField(id) {
    if (mode !== 'farm' || !state.upgrade(id)) return;
    farm.setLevel(id, state.fields[id].level);
    const f = farm.fields[id].rect;
    rig.focus(f.cx, f.cz + 1);
    rig.shake(0.14);
    for (let k = 0; k < 6; k++) farmFx.burst(f.x + Math.random() * f.w, 0.2, f.z + Math.random() * f.d, 6, [THEME.dust, 0xd9b77a, 0xffe03a], { speed: 2, up: 1.6, size: 0.12, ttl: 0.5 });
    sfx.play('power');
    vibrate('pickup');
    updateCounts();
    stage(L('FIELD UPGRADED!', '¡CAMPO MEJORADO!'), `${CROPS[FIELD_BY_ID[id].crop].unit}: ${state.sheaves(id)}`);
    refreshPanel();
}

// Un campo desbloqueado en el campo de tiro: en el mapa se va la chatarra y brotan las plantas
function revealUnlocked() {
    for (const v of farm.views) {
        if (!v.locked || !state.fields[v.id].unlocked) continue;
        farm.unlock(v.id);
        updateCounts();
        const f = v.rect;
        rig.focus(f.cx, f.cz + 1);
        rig.shake(0.2);
        for (let k = 0; k < 10; k++) farmFx.burst(f.x + Math.random() * f.w, 0.2, f.z + Math.random() * f.d, 6, [THEME.dust, 0x8a5a34, 0x6f8a3a], { speed: 2.4, up: 2, size: 0.14, ttl: 0.6 });
        setTimeout(() => stage(L('LAND CLEARED!', '¡TERRENO LIMPIO!'), `${FIELD_BY_ID[v.id].name} ${L('UNLOCKED', 'DESBLOQUEADO')}`), 300);
        return true;
    }
    return false;
}

// Racha de granadas (arriba): cuántas lleva, lo que le queda a la barra y la siguiente granada.
// Racha alienígena (a la izquierda): cuántos alienígenas lleva y por dónde va hacia cada recompensa
function updateStreak() {
    const n = sniper.streak, el = $('streak');
    el.classList.toggle('hidden', n <= 0 || sniper.unlocking || !sniper.tracks.crop);
    if (n > 0) {
        $('streak-n').textContent = n;
        $('streak-fill').style.width = `${Math.round(Math.max(0, sniper.streakT / sniper.streakMax) * 40) * 2.5}%`;
        el.classList.toggle('low', sniper.streakT < 1);
        const next = sniper.streaks('crop').find((k) => k.at > n);
        $('streak-next').textContent = next ? `${L('NEXT', 'SIGUIENTE')}: ${next.at} ${next.short}` : L('MAX STREAK!', '¡RACHA MÁXIMA!');
    }
    // Lo que queda en el campo (también baja cuando roban)
    const left = String(sniper.field.remaining);
    if (!sniper.unlocking && $('left-count').textContent !== left) $('left-count').textContent = left;
    const a = sniper.aliens, steps = sniper.streaks('alien');
    $('alien-streak').classList.toggle('hidden', sniper.unlocking || !sniper.tracks.alien || !steps.length);
    if (!steps.length) return;
    $('as-n').textContent = a;
    renderAlienTower(steps);
    // Las rayas se encienden de una en una; la recompensa que viene, parpadeando
    if (alienLit !== a) {
        alienLit = a;
        alienSegs.forEach((seg, i) => seg.classList.toggle('on', i < a));
        const next = steps.find((x) => x.at > a);
        for (const k of steps) {
            const row = $(`as-${k.id}`);
            row.classList.toggle('done', a >= k.at);
            row.classList.toggle('next', k === next);
        }
    }
}

// Torre de la racha alienígena: una raya por alienígena hasta la última recompensa, de abajo a
// arriba, con el icono de cada recompensa junto a su raya (se rehace solo si DEBUG cambia los
// números)
let alienTowerKey = '', alienSegs = [], alienLit = -1;
function renderAlienTower(steps) {
    const key = steps.map((k) => `${k.id}${k.at}`).join();
    if (key === alienTowerKey) return;
    alienTowerKey = key;
    alienLit = -1;
    const top = steps[steps.length - 1].at, rows = [];
    for (let n = 1; n <= top; n++) {
        const k = steps.find((x) => x.at === n);
        rows.push(`<div class="as-row${k ? ' as-mile' : ''}"${k ? ` id="as-${k.id}"` : ''}><i class="as-seg"></i>${k ? `<i class="ks-ico" style="--ico: var(--px-${k.icon})"></i><b>${k.at}</b>` : ''}</div>`);
    }
    $('as-tower').innerHTML = rows.reverse().join('');
    alienSegs = [...$('as-tower').querySelectorAll('.as-seg')].reverse();
}

// Guiando el misil: altura en la interfaz
function updatePredator() {
    const p = sniper.ks.predator;
    if (p) $('pred-alt').textContent = `${L('ALT', 'ALT')} ${Math.max(0, Math.round(p.y))}M`;
}

function startMusic(cfg) {
    if (Settings.music) music.start(cfg, 7);
}

// ---------- Transiciones ----------
let snipeStart = 0;
// Al campo de tiro: a cosechar (harvest) o a desbloquear un terreno (startUnlock)
function goSnipe(id, unlock) {
    sfx.unlock();
    sfx.play('go');
    vibrate('pickup');
    snipeField = id;
    goSnipe.unlock = unlock;
    // Con ratón, este mismo clic bloquea el cursor: al entrar ya se mira moviéndolo
    if (matchMedia('(pointer: fine)').matches) lockMouse();
    mode = 'toSnipe';
    modeT = 0;
    select(null);
    const f = farm.fields[id].rect;
    rig.focus(f.cx, f.cz);
    rig.zoomTarget = M.zoomMin * 0.8;
}

function harvest(id) {
    if (mode === 'farm' && state.isReady(id)) goSnipe(id, false);
}

function startUnlock(id) {
    if (mode === 'farm' && state.canUnlock(id)) goSnipe(id, true);
}

// Teclado y mando: recoge el primer campo listo o, si no hay, desbloquea el primer terreno que se pueda
function quickAction() {
    const ids = FARM.fields.map((f) => f.id);
    const ready = ids.find((id) => state.isReady(id));
    if (ready) return harvest(ready);
    if (!state.open('barn')) return openBarn();
    const free = ids.find((id) => state.canUnlock(id));
    if (free) startUnlock(free);
}

function enterSnipe() {
    const unlock = goSnipe.unlock;
    const def = FIELD_BY_ID[snipeField], arena = def.levels[state.fields[snipeField].level].arena;
    sniper.tracks = { crop: state.open('grenades'), alien: state.open('aliens') };
    sniper.ksIds = state.arsenal.loadout.ks; // las rachas de la clase equipada
    sniper.flyersOn = state.open('ufos'); // los ovnis pequeños, desde que hay tomates
    sniper.walkersOn = state.open('aliens'); // los alienígenas a pie, desde el trigo a nivel 3
    sniper.boxOn = state.open('box'); // la caja sorpresa, desde el trigo al máximo
    sniper.enter(unlock ? { unlock: true, loadout: state.arsenal.loadout } : { crop: def.crop, count: state.fields[snipeField].left, arena, loadout: state.arsenal.loadout, turrets: state.fields[snipeField].turrets });
    document.body.classList.remove('fallout');
    mode = 'snipe';
    snipeStart = time;
    renderer.flash(INK, 1);
    $('farm-ui').classList.add('hidden');
    $('bubbles').classList.add('hidden');
    $('snipe-ui').classList.remove('hidden');
    document.body.classList.add('sniping');
    document.body.classList.toggle('unlocking', unlock);
    $('left-count').textContent = sniper.field.remaining;
    showCorner(0);
    updateCounts();
    startMusic(THEME.sniperMusic);
    $('nuke-count').classList.add('hidden');
    const msg = unlock ? L('SHOOT THE RED BARREL!', '¡DISPARA AL BARRIL ROJO!') : L('HARVEST!', '¡A COSECHAR!');
    setTimeout(() => mode === 'snipe' && banner(msg, 'go'), 450);
}

function goFarm(done = false) {
    if (mode !== 'snipe') return;
    mode = 'toFarm';
    modeT = 0;
    touch = null;
    sniper.release(false);
    if (document.exitPointerLock && locked()) document.exitPointerLock();
    if (!done) sfx.play('ui');
    goFarm.done = done;
}

function enterFarm() {
    const unlocking = sniper.unlocking;
    sniper.leave();
    if (document.exitPointerLock && locked()) document.exitPointerLock();
    document.body.classList.remove('predator', 'fallout');
    $('nuke-count').classList.add('hidden');
    mode = 'farm';
    renderer.flash(INK, 1);
    scope.show(false);
    document.body.classList.remove('sniping', 'unlocking');
    $('snipe-ui').classList.add('hidden');
    $('farm-ui').classList.remove('hidden');
    $('bubbles').classList.remove('hidden');
    rig.zoomTarget = 1;
    const id = snipeField;
    snipeField = null;
    updateCounts();
    startMusic(THEME.music);
    if (revealUnlocked()) return;
    if (goFarm.done && !unlocking) {
        const f = farm.fields[id].rect, crop = cropOf(id);
        farm.byId.barn.select();
        setTimeout(() => stage(L('HARVEST DONE!', '¡COSECHA HECHA!'), `${crop.name}: ${state.items[FIELD_BY_ID[id].crop]}`), 300);
        rig.focus(f.cx, f.cz);
    }
}

// ---------- Entrada ----------
// Mapa: arrastrar desplaza, pellizcar o la rueda hacen zoom, tocar selecciona.
// Francotirador (como un shooter): la vista es libre y la mirilla está siempre en el centro.
//   Dedo: arrastrar mira; dejarlo quieto un momento sube el arma (apunta), moverlo con la
//   mira puesta la desplaza despacio y soltarlo dispara. Deslizar desde un borde cambia de torre.
//   Ratón: el cursor se bloquea y moverlo mira; mantener el botón derecho apunta y soltarlo
//   dispara; el izquierdo dispara al momento.
const pointers = new Map();
let pan = null, pinch = null, touch = null, aimTouch = null;

function unitsPerPx() {
    return (rig.halfWidth * rig.zoom * 2) / innerWidth;
}

function panBy(dx, dy) {
    const u = unitsPerPx(), y = rig.yaw, sp = Math.sin((M.pitch * Math.PI) / 180);
    // Derecha de la pantalla y "hacia dentro" sobre el suelo
    const rx = Math.cos(y), rz = -Math.sin(y), fx = -Math.sin(y), fz = -Math.cos(y);
    // (sin salirse del valle: se limita en el plano de la pantalla, u de lado y v de fondo)
    const V = FARM.valley, [pu, pv] = V.toUV(rig.fx - rx * dx * u + fx * dy * u / sp, rig.fz - rz * dx * u + fz * dy * u / sp);
    [rig.fx, rig.fz] = V.toXZ(clamp(pu, 8, V.w - 8), clamp(pv, 14, V.h - 6));
}

// Vista global: toda la cuadrícula de parcelas (encuadrada al ancho y al alto de la pantalla);
// otra vez el botón (o acercar), de vuelta a donde se estaba
let mapView = null; // { x, z, zoom } de antes
function enterMap() {
    if (mode !== 'farm' || inCine() || mapView) return;
    select(null);
    mapView = { x: rig.fx, z: rig.fz, y: rig.fy, zoom: rig.zoomTarget };
    // Todo el valle: de lado a lado (en vertical, recortando un poco los lados para que no quede
    // diminuto) y del pie de las montañas a la llanura de abajo
    const V = FARM.valley, portrait = innerHeight > innerWidth;
    // (un poco hacia el fondo: que se vean las montañas de arriba)
    rigFocus(...V.toXZ(V.w / 2, V.h / 2 - 12), 0);
    rig.zoomTarget = Math.max((V.w * (portrait ? 0.72 : 1)) / (rig.halfWidth * 2), (V.h + 24) / (rig.halfDepth * 2)) * 1.05;
    $('btn-map').classList.add('on');
    sfx.play('ui');
}
function leaveMap(back = true) {
    if (!mapView) return;
    if (back) {
        rigFocus(mapView.x, mapView.z, mapView.y);
        rig.zoomTarget = mapView.zoom;
    }
    mapView = null;
    $('btn-map').classList.remove('on');
}
function zoomBy(k) {
    rig.zoomTarget = clamp(rig.zoomTarget * k, M.zoomMin, Math.max(M.zoomMax, mapView ? rig.zoomTarget : 0));
    if (mapView && k < 1) leaveMap(false);
}

function isUi(e) {
    return e.target.closest && e.target.closest('button, .panel, .screen, .ufo-shop, .merchant-sheet');
}

const locked = () => document.pointerLockElement === canvas;
function lockMouse() {
    if (locked() || !canvas.requestPointerLock) return;
    try {
        const r = canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
    } catch { /* sin bloqueo: se mira arrastrando */ }
}
document.addEventListener('pointerlockchange', () => document.body.classList.toggle('locked', locked()));

addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (!music.playing && Settings.music && sfx.ctx) startMusic(mode === 'snipe' ? THEME.sniperMusic : THEME.music);
    if (mode === 'prologue') return prologue.tap();
    // Con el trigo mágico hablando, tocar pasa el texto
    if (prologue.talking) return prologue.next();
    if (isUi(e) || inCine() || prologueLocked()) return;
    if (mode === 'farm') {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
            pan = null;
        } else pan = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
        return;
    }
    if (mode !== 'snipe' || e.pointerType === 'mouse') return; // el ratón va por mousedown
    if (!touch) touch = { id: e.pointerId, lx: e.clientX, ly: e.clientY, ax: e.clientX, ay: e.clientY, t: performance.now(), moved: false };
});

addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) {
        p.x = e.clientX;
        p.y = e.clientY;
    }
    if (mode === 'farm') {
        if (pinch && pointers.size >= 2) {
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            zoomBy(pinch.d / d);
            pinch.d = d;
        } else if (pan && e.pointerId === pan.id) {
            const dx = e.clientX - pan.lx, dy = e.clientY - pan.ly;
            pan.lx = e.clientX;
            pan.ly = e.clientY;
            if (Math.hypot(e.clientX - pan.x, e.clientY - pan.y) > 8) pan.moved = true;
            if (pan.moved) panBy(dx, dy);
        }
        return;
    }
    if (mode !== 'snipe' || prologueLocked()) return;
    if (e.pointerType === 'mouse' && locked()) {
        sniper.look(e.movementX, e.movementY, S.lookMouse);
        return;
    }
    // El dedo del botón de mira también mueve la vista (se afina sin soltarlo)
    if (aimTouch && e.pointerId === aimTouch.id) {
        sniper.look(e.clientX - aimTouch.lx, e.clientY - aimTouch.ly, S.lookTouch);
        aimTouch.lx = e.clientX;
        aimTouch.ly = e.clientY;
        return;
    }
    if (touch && e.pointerId === touch.id) {
        sniper.look(e.clientX - touch.lx, e.clientY - touch.ly, touch.mouse ? S.lookMouse : S.lookTouch);
        touch.lx = e.clientX;
        touch.ly = e.clientY;
        if (Math.hypot(e.clientX - touch.ax, e.clientY - touch.ay) > S.holdSlop) touch.moved = true;
    }
});

function endPointer(e, cancel) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (mode === 'farm' && pan && e.pointerId === pan.id) {
        if (!pan.moved && !cancel) tapMap(e.clientX, e.clientY);
        pan = null;
    }
    // Soltar el botón de mira dispara (cancelado, solo la baja)
    if (aimTouch && e.pointerId === aimTouch.id) {
        aimTouch = null;
        $('btn-aim').classList.remove('on');
        if (mode === 'snipe') sniper.release(!cancel);
        return;
    }
    if (touch && e.pointerId === touch.id && !touch.mouse) {
        const t = touch;
        touch = null;
        if (mode !== 'snipe' || cancel) return;
        // Toque rápido sin mover el dedo: dispara (con la mira subida, apuntando; sin ella, desde
        // la cadera, impreciso). Mover la vista nunca dispara
        if (!t.moved && performance.now() - t.t < S.tapTime) {
            if (sniper.scoped) sniper.release(true);
            else sniper.fire();
        }
    }
}
addEventListener('pointerup', (e) => endPointer(e, false));
addEventListener('pointercancel', (e) => endPointer(e, true));

// Botones del ratón en primera persona (mousedown/mouseup también ven el segundo botón
// cuando ya hay otro pulsado, cosa que pointerdown no hace)
addEventListener('mousedown', (e) => {
    if (mode !== 'snipe' || isUi(e) || prologueLocked()) return;
    lockMouse();
    if (e.button === 2) sniper.setAds(true);
    else if (e.button === 0) {
        if (locked()) sniper.fire();
        else touch = { id: 'mouse', mouse: true, lx: e.clientX, ly: e.clientY };
    }
});
addEventListener('mousemove', (e) => {
    if (mode === 'snipe' && touch && touch.mouse && !locked()) {
        sniper.look(e.clientX - touch.lx, e.clientY - touch.ly, S.lookMouse);
        touch.lx = e.clientX;
        touch.ly = e.clientY;
    }
});
addEventListener('mouseup', (e) => {
    if (e.button === 0 && touch && touch.mouse) touch = null;
    if (mode === 'snipe' && e.button === 2 && sniper.scoped) sniper.release(true);
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
    if (mode === 'farm' && !inCine()) zoomBy(Math.exp(e.deltaY * 0.0012));
}, { passive: true });

// Botón de mira (pantallas táctiles): mantenerlo sube el arma, deslizar el dedo afina la
// puntería y soltarlo dispara. La vista se mueve arrastrando en cualquier sitio (con otro dedo
// también, mientras se mantiene la mira)
$('btn-aim').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    sfx.unlock();
    if (mode !== 'snipe' || prologueLocked() || aimTouch) return;
    aimTouch = { id: e.pointerId, lx: e.clientX, ly: e.clientY };
    $('btn-aim').classList.add('on');
    sniper.setAds(true);
});

function tapMap(x, y) {
    ray.setFromCamera(ndcOf(x, y), rig.camera);
    const hit = farm.pick(ray);
    if (!hit) return select(null);
    if (hit.merchant) return openMerchant();
    if (hit.field && state.isReady(hit.field) && selected && selected.field === hit.field) return harvest(hit.field);
    select(hit);
}

// El menú de más arriba, cerrado como con su botón (true si había alguno)
const MENUS = [['gear-picker', 'picker-close'], ['streaks', 'btn-streaks-close'], ['debug', 'btn-debug-close'], ['settings', 'btn-settings-close'], ['ufo-shop', 'ufo-close'], ['merchant', 'merchant-close']];
function closeTopMenu() {
    const m = MENUS.find(([id]) => !$(id).classList.contains('hidden'));
    if (!m) return false;
    $(m[1]).click();
    return true;
}

// Teclado: WASD/flechas miran, espacio/enter mantiene la mira (soltar dispara), Q/E saltan a la
// torre de la izquierda/derecha, Esc baja la mira o vuelve a la granja (con el ratón bloqueado, Esc lo suelta), H vuelve.
const keys = new Set();
addEventListener('keydown', (e) => {
    sfx.unlock();
    const k = e.key.toLowerCase();
    // Esc cierra el menú que esté abierto (como su botón de VOLVER o su X), el de más arriba primero
    if (k === 'escape' && !e.repeat && closeTopMenu()) return;
    if (prologue.talking && !e.repeat && (k === ' ' || k === 'enter')) return prologue.next();
    if (inCine()) return;
    keys.add(k);
    if (e.repeat) return;
    if (mode === 'prologue') return (k === ' ' || k === 'enter') && prologue.tap();
    if (prologueLocked()) return;
    if (mode === 'farm') {
        if (k === 'escape') select(null);
        if (k === 'enter' || k === ' ') quickAction();
        return;
    }
    if (mode !== 'snipe') return;
    if (k === ' ' || k === 'enter') sniper.setAds(true);
    else if (k === 'escape' || k === 'backspace') sniper.scoped ? sniper.release(false) : goFarm();
    else if (k === 'h') goFarm();
    else if (k === 'q') sniper.goSide(-1);
    else if (k === 'e') sniper.goSide(1);
    else if (k === 'r') sniper.reload();
});
addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (mode === 'snipe' && (k === ' ' || k === 'enter')) sniper.release(true);
});

function keyInput(dt) {
    const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    if (!x && !y) return;
    if (mode === 'snipe') sniper.look(x, y, S.lookPad * 0.6 * dt);
    else if (mode === 'farm') panBy(-x * dt * 500, -y * dt * 500);
}

// Mando: sticks miran (con curva de respuesta), LT apunta (soltarlo dispara), RT/A disparan,
// LB/RB cambian de torre, B baja la mira o sale. En la granja el stick desplaza el mapa y A
// recoge el primer campo maduro (o desbloquea el primer terreno que se pueda).
const padPrev = [];
const curve = (v) => (Math.abs(v) < 0.15 ? 0 : Math.sign(v) * ((Math.abs(v) - 0.15) / 0.85) ** 2);
function pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p);
    if (!pad) return;
    // A pasa los textos del trigo mágico
    if (prologue.talking && pad.buttons[0] && pad.buttons[0].pressed && !padPrev[0]) prologue.next();
    if (inCine() || prologueLocked() || prologue.talking) return pad.buttons.forEach((b, i) => (padPrev[i] = b.pressed));
    const pressed = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    const down = (i) => pressed(i) && !padPrev[i];
    const up = (i) => !pressed(i) && padPrev[i];
    const ax = curve(pad.axes[0] || 0) + curve(pad.axes[2] || 0), ay = curve(pad.axes[1] || 0) + curve(pad.axes[3] || 0);
    if (mode === 'farm') {
        if (ax || ay) panBy(-ax * dt * 600, -ay * dt * 600);
        if (down(0)) quickAction();
    } else if (mode === 'snipe') {
        if (ax || ay) sniper.look(ax, ay, S.lookPad * dt);
        if (down(6)) sniper.setAds(true);
        if (up(6)) sniper.release(true);
        if (down(7) || down(0)) sniper.fire();
        if (down(1)) sniper.scoped ? sniper.release(false) : goFarm();
        if (down(4) || down(14)) sniper.goSide(-1);
        if (down(5) || down(15)) sniper.goSide(1);
    }
    pad.buttons.forEach((b, i) => (padPrev[i] = b.pressed));
}

// Botones
const tapBtn = (id, fn) => $(id).addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.unlock();
    fn();
});
tapBtn('btn-home', () => goFarm());
tapBtn('btn-prev', () => sniper.goSide(-1));
tapBtn('btn-next', () => sniper.goSide(1));
tapBtn('panel-action', () => {
    if (!selected || !selected.field) return;
    const land = state.landOf(selected.field);
    if (land && !state.lands[land.id]) return buyLand(selected.field);
    if (state.canUnlock(selected.field)) startUnlock(selected.field);
    else harvest(selected.field);
});
tapBtn('panel-upgrade', () => {
    if (!selected) return;
    if (selected.field) {
        if (state.fields[selected.field].turrets) reloadTurret(selected.field);
        else if (state.maxed(selected.field)) buyTurrets(selected.field);
        else upgradeField(selected.field);
    }
    else if (selected.structure === 'house') upgradeHouse();
});
tapBtn('panel-close', () => select(null));
tapBtn('btn-map', () => {
    if (mapView) {
        leaveMap();
        sfx.play('ui');
    } else enterMap();
});
tapBtn('btn-settings', () => {
    sfx.play('ui');
    $('settings').classList.remove('hidden');
});
tapBtn('btn-settings-close', () => {
    sfx.play('ui');
    $('settings').classList.add('hidden');
});

// ---------- El ovni ----------
// Cinemática del mapa (la usa el prólogo; con locked se bloquea el control)
let cine = null; // { t, locked }
const inCine = () => !!(cine && cine.locked);

// Sin nubes delante con la tienda abierta
function shopClouds() {
    const clear = !$('ufo-shop').classList.contains('hidden');
    farm.cloudMesh.visible = farm.cloudHull.visible = !clear;
}

// La casa con lo que lleva puesto de la tienda (colores de tejado, fachada, puerta y marcos)
function applyLook() {
    const colors = {};
    for (const [slot, id] of Object.entries(state.home.look)) colors[slot] = SHOP_ITEMS[id].color;
    farm.byId.house.setLook(colors);
    farm.plot.setPlaced(state.home.placed);
}

// La cámara encuadra en la mitad de arriba (la tienda tapa la de abajo) un punto de la parcela
function frameShop(x, z, zoom) {
    // (el desplazamiento, ya en el mundo: si no, podría caer fuera de la parcela)
    const w = toWorld(x, z);
    rigFocus(w.x + 4 * zoom, w.z + 4 * zoom, w.y);
    rig.zoomTarget = zoom;
}

// ---------- Tienda para personalizar la casa ----------
// La lleva el mercader (con su máscara). Hoja abajo con él y tus monedas de oro; arriba se ve la
// casa (la cámara la encuadra) y cada cambio se ve en directo. Secciones CASA y PARCELA.
const shop = { tab: SHOP[0].id, cat: SHOP[0].cats[0].id };
const ZORG = {
    hello: [
        L('FELLOW HUMAN! I ALSO DO HOUSES. VERY HUMAN HOUSES.', '¡COMPAÑERO HUMANO! TAMBIÉN HAGO CASAS. CASAS MUY HUMANAS.'),
        L('GOLD COINS ONLY. 100% REAL GOLD. DO NOT GET THEM WET.', 'SOLO MONEDAS DE ORO. ORO 100% AUTÉNTICO. NO LAS MOJES.'),
        L('YOUR HOUSE IS... CUTE. LET ME FIX IT.', 'TU CASA ES... MONA. DÉJAME ARREGLARLA.'),
    ],
    poor: L('NOT ENOUGH GOLD, FELLOW HUMAN.', 'TE FALTA ORO, COMPAÑERO HUMANO.'),
    soon: L('STILL BUILDING THAT ONE... COME BACK SOON.', 'ESO AÚN LO ESTOY FABRICANDO... VUELVE PRONTO.'),
    thanks: L('A VERY HUMAN CHOICE!', '¡UNA ELECCIÓN MUY HUMANA!'),
};
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

function say(text, warn = false) {
    $('ufo-line').textContent = text;
    const t = $('ufo-line').parentElement;
    t.classList.remove('warn');
    if (warn) {
        void t.offsetWidth;
        t.classList.add('warn');
    }
}

function openShop() {
    if (mode !== 'farm' || inCine() || !state.open('shop') || !state.houseMaxed) return;
    if (!state.ufo.met) {
        state.ufo.met = true;
        state.save();
        refreshUfoSign();
    }
    select(null);
    sfx.play('ui');
    const h = farm.byId.house;
    if (shop.tab === 'house') frameShop(h.def.x, h.def.z, 0.72);
    else frameShop(15, -15, 1.5);
    say(ZORG.hello[(Math.random() * ZORG.hello.length) | 0]);
    renderShop();
    const el = $('ufo-shop');
    el.classList.remove('hidden', 'in');
    void el.offsetWidth;
    el.classList.add('in');
}

function renderShop() {
    $('ufo-coins').textContent = state.items.gold;
    const sec = SHOP.find((x) => x.id === shop.tab);
    if (!sec.cats.some((c) => c.id === shop.cat)) shop.cat = sec.cats[0].id;
    $('ufo-tabs').innerHTML = SHOP.map((x) => `<button class="ufo-tab${x.id === shop.tab ? ' on' : ''}" data-tab="${x.id}">${x.name}</button>`).join('');
    $('ufo-cats').innerHTML = sec.cats.map((c) => `<button class="ufo-cat${c.id === shop.cat ? ' on' : ''}${c.soon ? ' soon' : ''}" data-cat="${c.id}">${c.name}</button>`).join('');
    const cat = sec.cats.find((c) => c.id === shop.cat);
    $('ufo-items').innerHTML = cat.items.map((it) => {
        const owned = state.owns(it.id), on = cat.slot ? state.home.look[cat.slot] === it.id : state.home.placed.includes(it.id);
        const [c1, c2] = Array.isArray(it.color) ? it.color : [it.color ?? it.ico, it.color ?? it.ico];
        const n = state.itemCost(it.id).gold || 0, short = !owned && !cat.soon && state.items.gold < n;
        const tag = cat.soon ? `${n}<span class="ico gold-ico"></span> · ${L('SOON', 'PRONTO')}`
            : on ? L('ON', 'PUESTO') : owned ? L('WEAR', 'PONER') : `${n}<span class="ico gold-ico"></span>`;
        return `<button class="shop-card${on ? ' on' : ''}${cat.soon ? ' soon' : ''}${short ? ' short' : ''}" data-id="${it.id}" id="shop-${it.id}">`
            + `<i class="swatch" style="--c1:${hex(c1)};--c2:${hex(c2)}"></i><b>${it.name}</b><em>${tag}</em></button>`;
    }).join('');
}

$('ufo-shop').addEventListener('click', (e) => {
    e.stopPropagation();
    const t = e.target.closest('[data-tab], [data-cat], [data-id]');
    if (!t) return;
    if (t.dataset.tab) {
        shop.tab = t.dataset.tab;
        shop.cat = SHOP.find((x) => x.id === shop.tab).cats[0].id;
        sfx.play('ui');
        // CASA: la casa de cerca; PARCELA: toda la parcela
        const h = farm.byId.house;
        if (shop.tab === 'house') frameShop(h.def.x, h.def.z, 0.72);
        else frameShop(15, -15, 1.5);
        return renderShop();
    }
    if (t.dataset.cat) {
        shop.cat = t.dataset.cat;
        sfx.play('ui');
        return renderShop();
    }
    const it = SHOP_ITEMS[t.dataset.id];
    if (it.cat.soon) return sfx.play('miss'), say(ZORG.soon, true);
    const had = state.owns(it.id);
    if (!state.buyOrWear(it.id)) return sfx.play('miss'), say(ZORG.poor, true);
    applyLook();
    // Lo de la parcela: la cámara va a su hueco para verlo aparecer
    if (it.at) {
        frameShop(it.at.x, it.at.z, 0.9);
        if (state.home.placed.includes(it.id)) for (let k = 0; k < 4; k++) farmFx.burst(it.at.x + (Math.random() - 0.5) * 2, 0.3, it.at.z + (Math.random() - 0.5) * 2, 8, [THEME.dust, 0x7dff4a, 0xffffff], { speed: 2.4, up: 2.4, size: 0.14, ttl: 0.6 });
    } else farm.byId.house.select();
    sfx.play(had ? 'ui' : 'shieldGet');
    if (!had) {
        say(ZORG.thanks);
        merchantDeal($('ufo-shop'), $('ufo-coins'));
    }
    updateCounts();
    renderShop();
});
$('ufo-shop').addEventListener('pointerdown', (e) => e.stopPropagation());
tapBtn('ufo-close', () => {
    sfx.play('ui');
    $('ufo-shop').classList.add('hidden');
    rig.zoomTarget = 1;
});

// ---------- Comerciante ----------
// Su reloj (en las pruebas, fuera salvo que DEBUG diga otra cosa). Cuando llega o se va, su ovni
// disfrazado de coche entra o sale por el surco (si se está en el mapa, con aviso)
farm.camp.setPresent(merchantClock.here, false);
function updateMerchant(dt) {
    const here = merchantClock.here;
    if (here !== farm.camp.present) {
        farm.camp.setPresent(here, farm.introT > 2);
        if (mode === 'farm' && farm.introT > 2) {
            stage(here ? L('THE MERCHANT IS HERE!', '¡HA LLEGADO EL MERCADER!') : L('THE MERCHANT LEFT', 'EL MERCADER SE HA IDO'), here ? L('HE WANTS CROPS FOR GOLD', 'PIDE COSECHA A CAMBIO DE ORO') : L('HE WILL BE BACK SOON', 'VOLVERÁ PRONTO'));
            sfx.play(here ? 'bounceGet' : 'ui');
        }
        if (!here) $('merchant').classList.add('hidden');
        updateCounts();
    }
    // El ovni levanta polvo y tierra al ir por el surco
    if (farm.camp.gliding && Math.random() < dt * 30) {
        const D = farm.camp.dust;
        farmFx.burst(D.x, D.y, D.z + (Math.random() - 0.5) * 1.6, 3, [THEME.dust, 0x8a5a34, 0xa8885a], { speed: 1.6, up: 1.4, size: 0.14, ttl: 0.6 });
    }
}

// Hoja del comerciante: él, sus monedas, cuánto le queda y sus encargos (cultivo y cuánto → oro)
function openMerchant() {
    if (mode !== 'farm' || inCine()) return;
    select(null);
    sfx.play('ui');
    rig.focus(MERCHANT.stall.x + 2, MERCHANT.stall.z + 3);
    rig.zoomTarget = 0.85;
    merchantSay(farm.camp.open ? MERCHANT.lines.hello[(Math.random() * MERCHANT.lines.hello.length) | 0] : MERCHANT.lines.away);
    renderMerchant();
    const el = $('merchant');
    el.classList.remove('hidden', 'in');
    void el.offsetWidth;
    el.classList.add('in');
}

function merchantSay(text, warn = false) {
    $('merchant-line').textContent = text;
    const t = $('merchant-line').parentElement;
    t.classList.remove('warn');
    if (warn) {
        void t.offsetWidth;
        t.classList.add('warn');
    }
}

function renderMerchant() {
    $('merchant-gold').textContent = state.items.gold;
    const here = farm.camp.open, left = merchantClock.left;
    $('merchant-timer').textContent = left === null ? '' : here ? `${L('LEAVES IN', 'SE VA EN')} ${fmt(left)}` : `${L('BACK IN', 'VUELVE EN')} ${fmt(left)}`;
    if (!here) {
        $('merchant-orders').innerHTML = `<div class="merchant-away">${L('NOBODY HERE BUT THE OLD CRASH FURROW. HE COMES BACK "BY CAR" WITH NEW ORDERS EVERY FEW MINUTES.', 'AQUÍ SOLO ESTÁ EL SURCO. VUELVE "EN COCHE" CON ENCARGOS NUEVOS CADA POCOS MINUTOS.')}</div>`;
        return;
    }
    $('merchant-orders').innerHTML = state.ordersFor(merchantClock.visit).map((o, i) => {
        const can = state.canDeliver(o), need = o.n - state.items[o.crop];
        const label = o.done ? L('DONE', 'HECHO') : can ? L('DELIVER', 'ENTREGAR') : `${L('NEED', 'FALTAN')} ${need}`;
        return `<div class="order${o.done ? ' done' : ''}" id="order-${i}"><span class="order-want">${ico(CROPS[o.crop].icon)}<b>${o.n}</b></span><span class="order-arrow">&gt;</span>`
            + `<span class="order-pay">${ico('gold')}<b>+${o.gold}</b></span><button data-i="${i}"${o.done || !can ? ' disabled' : ''}>${label}</button></div>`;
    }).join('');
}


$('merchant').addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    if (!state.deliver(merchantClock.visit, Number(b.dataset.i))) return sfx.play('miss'), merchantSay(MERCHANT.lines.short, true);
    sfx.play('coin');
    setTimeout(() => sfx.play('coin'), 120);
    vibrate('pickup');
    const all = state.ordersFor(merchantClock.visit).every((o) => o.done);
    merchantSay(all ? MERCHANT.lines.done : MERCHANT.lines.thanks);
    const r = b.getBoundingClientRect();
    for (let k = 0; k < 3; k++) setTimeout(() => flyItem('gold', r.x + r.width / 2, r.y, $('merchant-gold'), () => {}), k * 90);
    merchantDeal($('merchant'));
    updateCounts(true);
    renderMerchant();
});
$('merchant').addEventListener('pointerdown', (e) => e.stopPropagation());
tapBtn('merchant-close', () => {
    sfx.play('ui');
    $('merchant').classList.add('hidden');
    rig.zoomTarget = 1;
});

// ---------- Granero: subirlo de nivel y ver las dos rachas de bajas (activas siempre) ----------
// (el granero ya no se mejora: el menú solo tiene las clases)
function refreshStreaks() {}

// Ficha de la casa: su nivel, qué hace el siguiente y su mejora
function refreshHousePanel(title, text, bar, act, up) {
    const lv = state.house.level, max = FARM.house.levels.length - 1;
    if (!state.open('house')) {
        title.textContent = `${L('FARMHOUSE', 'CASA')} · ${L('LOCKED', 'BLOQUEADA')}`;
        text.textContent = L('IN RUINS AND BURIED IN JUNK. MAYBE SOMEONE WILL HAVE AN IDEA FOR IT ONE DAY...', 'EN RUINAS Y LLENA DE PORQUERÍA. QUIZÁ ALGÚN DÍA ALGUIEN TENGA UNA IDEA PARA ELLA...');
        bar.parentElement.classList.add('hidden');
        act.classList.add('hidden');
        up.classList.add('hidden');
        return;
    }
    title.textContent = `${L('FARMHOUSE', 'CASA')} ${L('LV', 'NV')}.${lv}/${max}`;
    text.textContent = [
        L('IN RUINS, AND THE WHOLE PLOT FULL OF JUNK. FIX IT UP!', 'EN RUINAS Y CON TODA LA PARCELA LLENA DE PORQUERÍA. ¡ARRÉGLALA!'),
        L('FIXED UP. NEXT: CLEAR MOST OF THE PLOT.', 'ARREGLADA. SIGUIENTE: LIMPIAR GRAN PARTE DE LA PARCELA.'),
        L('NEXT: CLEAR THE WHOLE PLOT.', 'SIGUIENTE: LIMPIAR TODA LA PARCELA.'),
        L('HOME SWEET HOME.', 'HOGAR, DULCE HOGAR.'),
    ][lv];
    bar.parentElement.classList.add('hidden');
    act.classList.add('hidden');
    up.classList.remove('hidden');
    up.disabled = !state.canUpgradeHouse;
    up.classList.toggle('maxed', state.houseMaxed);
    $('upgrade-label').textContent = state.houseMaxed ? L('MAX LEVEL', 'NIVEL MÁXIMO') : lv === 0 ? L('FIX UP', 'ARREGLAR') : L('CLEAR', 'LIMPIAR');
    const cost = Object.entries(state.houseCost()).map(([c, n]) => `<span class="upgrade-cost${state.items[c] < n ? ' short' : ''}">${ico(CROPS[c].icon)}<b>${n}</b></span>`).join('');
    if ($('upgrade-cost').innerHTML !== cost) $('upgrade-cost').innerHTML = cost;
}

function upgradeHouse() {
    if (mode !== 'farm' || !state.upgradeHouse()) return;
    farm.setHouseLevel(state.house.level);
    const h = farm.byId.house, c = FARM.house.levels[state.house.level].clear;
    rig.focus(h.def.x, h.def.z + 1);
    rig.shake(0.3);
    houseFx(h.def.x, h.def.z, c);
    sfx.play('power');
    vibrate('pickup');
    updateCounts();
    stage(state.house.level === 1 ? L('HOUSE FIXED!', '¡CASA ARREGLADA!') : L('PLOT CLEARED!', '¡PARCELA LIMPIA!'), `${L('FARMHOUSE', 'CASA')} ${L('LV', 'NV')}.${state.house.level}`);
    refreshPanel();
}

// Arreglar o limpiar la casa: una onda dorada sale de la casa barriendo la parcela (a su paso,
// polvo, hierbajos y chispas, del centro hacia fuera), la casa bota y suelta confeti
function houseFx(x, z, c) {
    const R = Math.max(c[2] - c[0], c[3] - c[1]) * 0.7;
    const rg = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24, 1), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    rg.rotation.x = -Math.PI / 2;
    farm.world(x, 0.1, z, rg.position);
    farmScene.add(rg);
    let t = 0;
    const tick = () => {
        t += 0.05;
        const k = Math.min(1, t / 0.9);
        rg.scale.setScalar(1 + k * R);
        rg.material.opacity = 1 - k;
        // A su paso: polvo y hierbajos por el aire, y chispas doradas
        for (let n = 0; n < 5; n++) {
            const a = Math.random() * Math.PI * 2, d = k * R * (0.85 + Math.random() * 0.2);
            const px = Math.min(c[2], Math.max(c[0], x + Math.cos(a) * d)), pz = Math.min(c[3], Math.max(c[1], z + Math.sin(a) * d));
            farmFx.burst(px, 0.3, pz, 4, [THEME.dust, 0x8a5a34, 0x6f8a3a, 0xffe03a], { speed: 2.2, up: 2.6, size: 0.14, ttl: 0.6 });
        }
        if (k < 1) return setTimeout(tick, 50);
        farmScene.remove(rg);
        rg.geometry.dispose();
        rg.material.dispose();
    };
    tick();
    farm.byId.house.select();
    farmFx.burst(x, 3, z, 60, RAINBOW, { speed: 5, up: 5, size: 0.16, ttl: 1.1, grav: 6 });
    renderer.flash(0xfff6d8, 0.25);
    setTimeout(() => sfx.play('achievement'), 300);
}

// Subir el granero: se cierra el menú para ver crecer el recinto en el mapa
function upgradeBarn() {
    if (!state.upgradeBarn()) return;
    $('streaks').classList.add('hidden');
    farm.setBarnLevel(state.barn.level);
    const b = farm.byId.barn;
    rig.focus(b.def.x, b.def.z + 1);
    rig.shake(0.2);
    const y = FARM.barn.levels[state.barn.level].yard;
    for (let k = 0; k < 14; k++) farmFx.burst(y[0] + Math.random() * (y[2] - y[0]), 0.2, y[1] + Math.random() * (y[3] - y[1]), 6, [THEME.dust, 0x8a5a34, 0x6f8a3a], { speed: 2.4, up: 2, size: 0.14, ttl: 0.6 });
    sfx.play('power');
    vibrate('pickup');
    updateCounts();
    stage(L('BARN UPGRADED!', '¡GRANERO MEJORADO!'), `${L('BARN', 'GRANERO')} ${L('LV', 'NV')}.${state.barn.level}`);
}

function openStreaks() {
    sfx.play('ui');
    loEdit = state.arsenal.active;
    refreshStreaks();
    refreshRifle();
    $('gear-picker').classList.add('hidden');
    $('streaks').classList.remove('hidden');
}

// ---------- Armamento: las clases (como «Crear clase» de Call of Duty, simplificado) ----------
// A la izquierda las clases; a la derecha la que se edita: el arma principal, sus accesorios y dos
// secciones de rachas de bajas (de cultivos y de alienígenas) que se ponen o quitan tocándolas.
// Tocar el arma o un accesorio abre su lista (se compra con oro y se monta en esta clase).
// EQUIPAR CLASE: la que se lleva al campo de tiro.
const pips = (n) => Array.from({ length: 5 }, (_, i) => `<i class="pip${i < n ? ' on' : ''}"></i>`).join('');
const clampPip = (v) => Math.max(1, Math.min(5, Math.round(v)));
const GEAR = {
    scope: { title: L('SCOPE', 'MIRILLA'), stats: (x) => [[L('ZOOM', 'ZOOM'), clampPip(S.fov / x.fov / 2.5)], [L('SPEED', 'RAPIDEZ'), clampPip((0.42 - x.ads) / 0.065)], [L('STEADY', 'PULSO'), clampPip((1.35 - x.sway) / 0.18)]] },
    rifle: { title: L('RIFLE', 'RIFLE'), stats: (x) => [[L('FIRE RATE', 'CADENCIA'), clampPip(1.2 / x.bolt)], [L('PIERCE', 'PERFORA'), [1, 2, 4, 6, 99].indexOf(x.pierce) + 1], [L('DAMAGE', 'DAÑO'), clampPip(x.damage * 2 - 1)]] },
    mag: { title: L('MAGAZINE', 'CARGADOR'), stats: (x) => [[L('ROUNDS', 'BALAS'), x.size <= 6 ? 1 : x.size <= 10 ? 2 : x.size <= 18 ? 3 : 5], [L('RELOAD', 'RECARGA'), x.regen ? 5 : clampPip((4.1 - x.reload) / 0.75)]] },
};
let loEdit = 0;          // la clase que se está editando
const gearCards = {}, loSlots = {}, ksBtns = {}, classBtns = [];
const cls = () => state.arsenal.classes[loEdit];
// Las clases
CLASSES.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'lo-class';
    b.id = `class-${i}`;
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        // Bloqueada: se desbloquea con oro (si llega; si no, bota)
        if (!state.classOpen(i)) {
            if (!state.buyClass(i)) {
                sfx.play('miss');
                b.classList.remove('bump');
                void b.offsetWidth;
                b.classList.add('bump');
                return;
            }
            sfx.play('coin');
            vibrate('pickup');
            updateCounts();
        }
        loEdit = i;
        sfx.play('ui');
        $('gear-picker').classList.add('hidden');
        refreshRifle();
    });
    $('lo-classes').appendChild(b);
    classBtns.push(b);
});
// Arma principal y accesorios (cada hueco abre su lista)
for (const kind of ['rifle', 'scope', 'mag']) {
    const b = document.createElement('button');
    b.className = `lo-slot lo-${kind}`;
    b.id = `slot-${kind}`;
    b.innerHTML = `<img alt=""><span><small>${GEAR[kind].title}</small><b></b></span><em>${L('CHANGE', 'CAMBIAR')} &gt;</em>`;
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        sfx.play('ui');
        openPicker(kind);
    });
    $(kind === 'rifle' ? 'lo-main' : 'lo-acc').appendChild(b);
    loSlots[kind] = b;
}
// Las rachas: dos secciones (cultivos y alienígenas); tocar una la pone o la quita de la clase
for (const track of ['crop', 'alien']) {
    for (const k of KILLSTREAKS.filter((x) => x.track === track)) {
        const b = document.createElement('button');
        b.className = `lo-ks lo-ks-${track}`;
        b.id = `ks-card-${k.id}`;
        b.title = k.desc;
        b.innerHTML = `<i class="ks-ico" style="--ico: var(--px-${k.icon})"></i><span class="kc-n"><b>${k.at}</b><small>${track === 'alien' ? L('ALIENS', 'ALIENÍGENAS') : L('IN A ROW', 'SEGUIDAS')}</small></span><span class="kc-name">${k.short}</span><em></em>`;
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.open(track === 'alien' ? 'aliens' : 'grenades')) return sfx.play('miss'); // (aún bloqueadas)
            state.toggleStreak(loEdit, k.id);
            sfx.play(cls().ks.includes(k.id) ? 'reloaded' : 'ui');
            refreshRifle();
        });
        $(`lo-ks-${track}`).appendChild(b);
        ksBtns[k.id] = b;
    }
}
tapBtn('class-equip', () => {
    if (!state.useClass(loEdit)) return sfx.play('miss');
    sfx.play('reloaded');
    vibrate('pickup');
    refreshRifle();
});
// La lista de un tipo de pieza (en esta clase)
let pickKind = 'rifle';
for (const kind of ARSENAL_KINDS) {
    const row = document.createElement('div');
    row.className = 'gear-row';
    row.dataset.kind = kind;
    row.innerHTML = `<div class="gear-strip" id="gear-${kind}"></div>`;
    $('gear-rows').appendChild(row);
    for (const it of ARSENAL[kind]) {
        const card = document.createElement('button');
        card.className = 'gear';
        card.id = `gear-${kind}-${it.id}`;
        card.innerHTML = `<img alt="" src="${gearArt(kind, it)}"><b>${it.name}</b><span class="gear-stats">${GEAR[kind].stats(it).map(([n, v]) => `<span class="gear-stat"><span>${n}</span><span class="pips">${pips(v)}</span></span>`).join('')}</span><em></em>`;
        card.title = it.desc;
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            if (cls()[kind] === it.id) return $('gear-picker').classList.add('hidden');
            const had = state.ownsGear(kind, it.id);
            if (!state.equipGear(kind, it.id, loEdit)) {
                sfx.play('miss');
                card.classList.remove('bump');
                void card.offsetWidth;
                card.classList.add('bump');
                return;
            }
            sfx.play(had ? 'reloaded' : 'coin');
            vibrate('pickup');
            updateCounts();
            $('gear-picker').classList.add('hidden');
            refreshRifle();
        });
        $(`gear-${kind}`).appendChild(card);
        gearCards[`${kind}:${it.id}`] = card;
    }
}
function openPicker(kind) {
    pickKind = kind;
    $('picker-title').textContent = GEAR[kind].title;
    refreshRifle();
    $('gear-picker').classList.remove('hidden');
}
tapBtn('picker-close', () => {
    sfx.play('ui');
    $('gear-picker').classList.add('hidden');
});
function refreshRifle() {
    const c = cls(), A = state.arsenal;
    $('gear-gold').textContent = state.items.gold;
    CLASSES.forEach((def, i) => {
        const b = classBtns[i], open = state.classOpen(i);
        const price = state.classPrice(i);
        const html = open ? `<b>${L(...def.name)}</b>${i === A.active ? `<em>${L('EQUIPPED', 'EQUIPADA')}</em>` : ''}`
            : `<b>${ico('lock')}${L(...def.name)}</b><em class="${state.items.gold < price ? 'short' : ''}">${ico('gold')}${price} · ${L('UNLOCK', 'DESBLOQUEAR')}</em>`;
        if (b.innerHTML !== html) b.innerHTML = html;
        b.classList.toggle('on', i === loEdit);
        b.classList.toggle('lock', !open);
    });
    $('class-name').textContent = L(...CLASSES[loEdit].name);
    const eq = $('class-equip'), using = A.active === loEdit;
    eq.disabled = using;
    eq.textContent = using ? L('EQUIPPED', 'EQUIPADA') : L('EQUIP CLASS', 'EQUIPAR CLASE');
    for (const kind of ['rifle', 'scope', 'mag']) {
        // (el arma principal, con la foto del fusil entero tal cual va montado)
        const it = ARSENAL[kind].find((x) => x.id === c[kind]), slot = loSlots[kind], img = slot.querySelector('img');
        const src = kind === 'rifle' ? gearArt('loadout', { scope: c.scope, rifle: c.rifle, mag: c.mag }) : gearArt(kind, it);
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
        slot.querySelector('b').textContent = it.name;
    }
    // Las rachas: bloqueadas hasta que las regala el trigo mágico (las de cultivos con el trigo a
    // nivel 2; las alienígenas, a nivel 3)
    for (const track of ['crop', 'alien']) {
        const open = state.open(track === 'alien' ? 'aliens' : 'grenades');
        $(`lo-ks-${track}`).closest('.lo-sec').classList.toggle('locked', !open);
        $(`lo-ks-${track}`).closest('.lo-sec').dataset.lock = open ? '' : track === 'alien' ? L('LOCKED · WHEAT LV.3', 'BLOQUEADAS · TRIGO NV.3') : L('LOCKED · WHEAT LV.2', 'BLOQUEADAS · TRIGO NV.2');
    }
    for (const k of KILLSTREAKS) {
        const on = c.ks.includes(k.id);
        ksBtns[k.id].title = state.open(k.track === 'alien' ? 'aliens' : 'grenades') ? k.desc : ''; // (bloqueada: ni su descripción)
        ksBtns[k.id].classList.toggle('on', on);
        ksBtns[k.id].querySelector('em').textContent = on ? L('ON', 'PUESTA') : L('OFF', 'QUITADA');
    }
    for (const row of document.querySelectorAll('.gear-row')) row.classList.toggle('hidden', row.dataset.kind !== pickKind);
    for (const kind of ARSENAL_KINDS) {
        for (const it of ARSENAL[kind]) {
            const card = gearCards[`${kind}:${it.id}`], on = c[kind] === it.id, owned = state.ownsGear(kind, it.id), price = state.gearPrice(kind, it.id);
            card.classList.toggle('on', on);
            card.classList.toggle('owned', owned && !on);
            card.classList.toggle('short', !owned && state.items.gold < price);
            card.classList.toggle('empty', !owned);
            const em = on ? L('EQUIPPED', 'MONTADO') : owned ? L('USE', 'USAR') : `${ico('lock')}${ico('gold')}${price}`; // (bloqueada: su candado y su precio)
            if (card.querySelector('em').innerHTML !== em) card.querySelector('em').innerHTML = em;
        }
    }
}

// Balas del cargador en el campo de tiro (y la barra de la recarga)
function updateAmmo() {
    const el = $('ammo'), st = sniper.stats, reloading = sniper.reloadT > 0;
    el.classList.toggle('special', !!sniper.special);
    // (la pistola de rayos, sobrecalentada: lo dice en rojo hasta que se enfría)
    const hot = !!sniper.special && sniper.overheat > 0;
    el.classList.toggle('hot', hot);
    const name = sniper.special ? (hot ? L('OVERHEATED', 'SOBRECALENTADA') : sniper.special.name) : '';
    if ($('ammo-name').textContent !== name) $('ammo-name').textContent = name;
    el.classList.toggle('reloading', reloading);
    el.classList.toggle('low', sniper.ammo <= Math.max(1, st.size * 0.25));
    $('ammo-n').textContent = sniper.ammo;
    $('ammo-max').textContent = `/${st.size}`;
    if (reloading) $('ammo-fill').style.width = `${Math.round((1 - sniper.reloadT / st.reload) * 10) * 10}%`;
}
tapBtn('ammo', () => sniper.reload());

tapBtn('btn-streaks-close', () => {
    sfx.play('ui');
    $('streaks').classList.add('hidden');
});
tapBtn('btn-lang', switchLang);
tapBtn('btn-debug', () => {
    sfx.play('ui');
    refreshDebug();
    $('debug').classList.remove('hidden');
});
// Todo lo del debug al día (al abrirlo y tras cada cambio)
function refreshDebug() {
    refreshUnlockRows();
    refreshHomeRows();
    refreshMerchantDbg();
    refreshFieldRows();
    refreshSnipeDbg();
}
// En las pantallas estrechas, una columna cada vez: pestañas con el título de cada una
{
    const boxes = [...document.querySelectorAll('#debug .debug-box')];
    // (la pestaña abierta se recuerda, también al recargar desde el debug)
    const show = (i) => {
        boxes.forEach((b, k) => {
            b.classList.toggle('on', k === i);
            tabs[k].classList.toggle('on', k === i);
        });
        try {
            sessionStorage.setItem('cofd.debugTab', String(i));
        } catch { /* sin almacenamiento */ }
    };
    const tabs = boxes.map((b, i) => {
        const t = document.createElement('button');
        t.className = 'debug-tab';
        t.textContent = b.querySelector('.debug-box-title').textContent;
        t.addEventListener('click', (e) => {
            e.stopPropagation();
            sfx.play('ui');
            show(i);
        });
        $('debug-tabs').appendChild(t);
        return t;
    });
    let first = 0;
    try {
        first = Math.min(boxes.length - 1, Number(sessionStorage.getItem('cofd.debugTab')) || 0);
    } catch { /* sin almacenamiento */ }
    show(first);
}
// El campo de tiro lee los ajustes de depuración (caja sorpresa, vacas, alienígenas)
sniper.debug = Settings;
tapBtn('btn-debug-close', () => {
    sfx.play('ui');
    $('debug').classList.add('hidden');
});
// Depuración: la hora (la del reloj, o día o noche fijos; se recuerda)
const DAYTIMES = [null, 'day', 'night'];
function refreshDaytimeBtn() {
    $('dbg-daytime').textContent = { day: L('DAY', 'DÍA'), night: L('NIGHT', 'NOCHE') }[dayNight.force] || L('AUTO', 'AUTO');
}
tapBtn('dbg-daytime', () => {
    const next = DAYTIMES[(DAYTIMES.indexOf(dayNight.force) + 1) % DAYTIMES.length];
    dayNight.force = next;
    Settings.set('daytime', next);
    refreshDaytimeBtn();
    updateClock();
    sfx.play('ui');
});
refreshDaytimeBtn();
// Depuración: el comerciante (el del reloj, o aquí o fuera fijos; se recuerda) y monedas de oro
const MERCHANT_MODES = [null, 'here', 'away'];
function refreshMerchantDbg() {
    $('dbg-merchant').textContent = { here: L('HERE', 'AQUÍ'), away: L('AWAY', 'FUERA') }[merchantClock.force] || L('AUTO', 'AUTO');
    $('dbg-gold').textContent = state.items.gold;
}
tapBtn('dbg-merchant', () => {
    const next = MERCHANT_MODES[(MERCHANT_MODES.indexOf(merchantClock.force) + 1) % MERCHANT_MODES.length];
    merchantClock.force = next;
    Settings.set('merchant', next);
    refreshMerchantDbg();
    sfx.play('ui');
});
for (const b of $('gold-row').querySelectorAll('.ks-step')) {
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        state.items.gold = Math.min(9999, Math.max(0, state.items.gold + Number(b.dataset.d)));
        state.save();
        updateCounts();
        refreshMerchantDbg();
        sfx.play('coin');
    });
}
refreshMerchantDbg();
// Depuración: +100 de cada cosecha (para probar mejoras)
tapBtn('btn-crops', () => {
    for (const c of Object.keys(CROPS)) state.items[c] = Math.min(99999, (state.items[c] || 0) + 100);
    state.save();
    updateCounts();
    refreshPanel();
    sfx.play('coin');
});
// Depuración: el nivel de cada campo (- / +; lo desbloquea si hace falta) y madurarlo todo
const fieldRows = {};
for (const def of FARM.fields) {
    const row = document.createElement('div');
    row.className = 'ks-row';
    row.innerHTML = `<span>${CROPS[def.crop].name || def.name}</span><button class="ks-step" data-d="-1">-</button><b></b><button class="ks-step" data-d="1">+</button>`;
    for (const b of row.querySelectorAll('.ks-step')) {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            setFieldLevel(def.id, state.fields[def.id].level + Number(b.dataset.d));
        });
    }
    $('field-rows').appendChild(row);
    fieldRows[def.id] = row;
}
function refreshFieldRows() {
    for (const def of FARM.fields) {
        const f = state.fields[def.id], row = fieldRows[def.id];
        row.querySelector('b').textContent = f.unlocked ? `${f.level + 1}·${state.sheaves(def.id)}` : '-';
        row.classList.toggle('changed', f.unlocked && state.maxed(def.id));
    }
}
function setFieldLevel(id, n) {
    const def = FIELD_BY_ID[id], st = state.fields[id];
    n = Math.min(def.levels.length - 1, Math.max(0, n));
    if (!st.unlocked) {
        state.unlock(id, Date.now(), true);
        while (revealUnlocked());
    }
    if (n === st.level && st.unlocked) return sfx.play('miss');
    st.level = n;
    st.left = state.sheaves(id);
    state.save();
    farm.setLevel(id, n);
    sfx.play('power');
    updateCounts();
    refreshPanel();
    refreshDebug();
}
tapBtn('btn-ripen', () => {
    for (const def of FARM.fields) {
        const st = state.fields[def.id];
        if (!st.unlocked) continue;
        st.plantedAt = 0;
        st.left = state.sheaves(def.id);
    }
    state.save();
    updateCounts();
    refreshPanel();
    sfx.play('power');
});
// Depuración: la munición de todas las torretas, a cero o llena
for (const [id, full] of [['dbg-ammo-empty', false], ['dbg-ammo-full', true]]) {
    tapBtn(id, () => {
        for (const def of FARM.fields) {
            const st = state.fields[def.id];
            if (st.turrets) st.ammo = full ? TURRETS.ammo : 0;
        }
        state.save();
        updateCounts();
        refreshPanel();
        sfx.play(full ? 'reloaded' : 'warn');
    });
}
// Depuración del campo de tiro: la caja sorpresa (cuándo sale, qué da, con qué arma se empieza),
// las vacas (normales o con la ubre llena) y los alienígenas y ovnis (sí o no). Se recuerdan.
const cycle = (list, now) => list[(list.indexOf(now) + 1) % list.length];
const wonderName = (id) => (WONDER.find((w) => w.id === id) || {}).name;
function refreshSnipeDbg() {
    $('dbg-box-rate').textContent = Settings.boxFast ? L('RIGHT AWAY', 'ENSEGUIDA') : L('NORMAL', 'NORMAL');
    $('dbg-box-pick').textContent = wonderName(Settings.boxPick) || L('RANDOM', 'AL AZAR');
    $('dbg-start-wonder').textContent = wonderName(Settings.startWonder) || L('RIFLE', 'FUSIL');
    $('dbg-cows').textContent = Settings.cowsFull ? L('FULL UDDERS', 'UBRES LLENAS') : L('NORMAL', 'NORMAL');
    $('dbg-aliens').textContent = Settings.noAliens ? L('NO', 'NO') : L('YES', 'SÍ');
    for (const [id, on] of [['dbg-box-rate', Settings.boxFast], ['dbg-box-pick', Settings.boxPick], ['dbg-start-wonder', Settings.startWonder], ['dbg-cows', Settings.cowsFull], ['dbg-aliens', Settings.noAliens]]) $(id).classList.toggle('set', !!on);
}
const WONDER_IDS = [null, ...WONDER.map((w) => w.id)];
for (const [id, step] of [
    ['dbg-box-rate', () => Settings.set('boxFast', !Settings.boxFast)],
    ['dbg-box-pick', () => Settings.set('boxPick', cycle(WONDER_IDS, Settings.boxPick))],
    ['dbg-start-wonder', () => Settings.set('startWonder', cycle(WONDER_IDS, Settings.startWonder))],
    ['dbg-cows', () => Settings.set('cowsFull', !Settings.cowsFull)],
    ['dbg-aliens', () => Settings.set('noAliens', !Settings.noAliens)],
]) {
    tapBtn(id, () => {
        step();
        refreshSnipeDbg();
        sfx.play('ui');
    });
}
refreshSnipeDbg();
// Depuración: cuántas bajas pide cada racha (- / +), y volver a las normales
const ksRows = {};
for (const k of KILLSTREAKS) {
    const row = document.createElement('div');
    row.className = 'ks-row';
    row.innerHTML = `<span>${k.track === 'alien' ? '<i class="ico alien-ico"></i> ' : ''}${k.short}</span><button class="ks-step" data-d="-1">-</button><b id="ks-${k.id}"></b><button class="ks-step" data-d="1">+</button>`;
    for (const b of row.querySelectorAll('.ks-step')) {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            setStreakCount(k, k.at + Number(b.dataset.d));
        });
    }
    $('ks-rows').appendChild(row);
    ksRows[k.id] = row.querySelector('b');
}
function refreshStreakRows() {
    for (const k of KILLSTREAKS) {
        ksRows[k.id].textContent = k.at;
        ksRows[k.id].parentElement.classList.toggle('changed', k.at !== k.normalAt);
    }
}
function setStreakCount(k, n) {
    const counts = { ...(Settings.streaks || {}), [k.id]: Math.min(99, Math.max(1, n)) };
    Settings.set('streaks', counts);
    setStreakCounts(counts);
    refreshStreakRows();
    refreshStreaks();
    sfx.play('ui');
}
// Depuración: todos los terrenos bloqueados, limpios y sembrados de golpe (sin requisitos), y el
// rifle al máximo
tapBtn('btn-unlock-all', () => {
    if (!state.barn.open) {
        state.openBarn();
        refreshGates();
    }
    // (y toda la historia: rachas, caja, mercader, casa y parcelas; y todas las clases)
    for (const k of ['crop', 'alien', 'box', 'merchant', 'sold', 'house']) state.story[k] = true;
    state.arsenal.classOwned = CLASSES.map((_, i) => i);
    state.save();
    refreshGates();
    const ids = FARM.fields.map((f) => f.id).filter((id) => state.unlock(id, Date.now(), true));
    const rifle = state.ownAllGear();
    sfx.play(ids.length || rifle ? 'power' : 'miss');
    refreshUnlockRows();
    if (!ids.length && !rifle) return;
    $('debug').classList.add('hidden');
    while (revealUnlocked());
    goHome();
    updateCounts();
    const what = [...ids.map((id) => FIELD_BY_ID[id].name), ...(rifle ? [L('FULL ARMORY', 'ARMERÍA COMPLETA')] : [])];
    setTimeout(() => stage(L('ALL UNLOCKED!', '¡TODO DESBLOQUEADO!'), what.join(' · ')), 350);
});

// Depuración: desbloquear de uno en uno cada terreno y el rifle al máximo
const unlockables = [
    ...FARM.fields.filter((f) => f.locked).map((f) => ({
        id: `field-${f.id}`, name: f.name,
        done: () => state.fields[f.id].unlocked,
        run: () => {
            state.unlock(f.id, Date.now(), true);
            $('debug').classList.add('hidden');
            revealUnlocked();
        },
    })),
    { id: 'arsenal', name: L('FULL ARMORY', 'ARMERÍA COMPLETA'), done: () => ARSENAL_KINDS.every((k) => ARSENAL[k].every((x) => state.ownsGear(k, x.id))), run: () => state.ownAllGear() },
    // Torreta de cada campo: lo desbloquea y lo sube al máximo si hace falta
    ...FARM.fields.map((f) => ({
        id: `turrets-${f.id}`, name: `${L('TURRET', 'TORRETA')}: ${CROPS[f.crop].name || f.name}`,
        done: () => state.fields[f.id].turrets,
        run: () => {
            $('debug').classList.add('hidden');
            if (!state.fields[f.id].unlocked) {
                state.unlock(f.id, Date.now(), true);
                revealUnlocked();
            }
            const st = state.fields[f.id];
            st.level = f.levels.length - 1;
            st.left = Math.max(st.left, state.sheaves(f.id));
            farm.setLevel(f.id, st.level);
            buyTurrets(f.id, true);
        },
    })),
];
const unlockBtns = {};
for (const u of unlockables) {
    const row = document.createElement('div');
    row.className = 'ks-row unlock-row';
    row.innerHTML = `<span>${u.name}</span><button class="unlock-one" id="unlock-${u.id}"></button>`;
    const b = row.querySelector('button');
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (u.done()) return;
        u.run();
        sfx.play('power');
        updateCounts();
        refreshUnlockRows();
    });
    $('unlock-rows').appendChild(row);
    unlockBtns[u.id] = b;
}
function refreshUnlockRows() {
    for (const u of unlockables) {
        const b = unlockBtns[u.id], done = u.done();
        b.disabled = done;
        b.textContent = done ? L('DONE', 'YA') : L('UNLOCK', 'DESBLOQUEAR');
    }
}
tapBtn('ks-default', () => {
    Settings.set('streaks', null);
    setStreakCounts(null);
    refreshStreakRows();
    refreshStreaks();
    sfx.play('ui');
});
refreshStreakRows();

// ---------- Depuración de la casa (la tabla de la derecha) ----------
// Lo que necesita recargar la página (bajar de nivel o repetir la cinemática del ovni: la
// parcela vuelve a ensuciarse al construirse) se guarda, recarga y vuelve a abrir el debug
function reloadToDebug() {
    state.save();
    try {
        sessionStorage.setItem('cofd.reopenDebug', '1');
    } catch { /* sin almacenamiento */ }
    location.reload();
}
function refreshHomeRows() {
    $('home-level').textContent = state.house.level;
}
// La casa directamente al nivel n (subir se ve en el mapa; bajar recarga)
function setHomeLevel(n) {
    n = Math.min(FARM.house.levels.length - 1, Math.max(0, n));
    if (n === state.house.level) return sfx.play('miss');
    const down = n < state.house.level;
    state.setHouseLevel(n);
    if (down) return reloadToDebug();
    farm.setHouseLevel(n);
    sfx.play('power');
    refreshHomeRows();
    refreshPanel();
}
// La casa al máximo ya (con ella sale la tienda para personalizarla)
function maxHouseNow() {
    if (state.houseMaxed) return false;
    state.setHouseLevel(FARM.house.levels.length - 1);
    farm.setHouseLevel(state.house.level);
    updateCounts();
    return true;
}
for (const [row, step] of [['home-level-row', (d) => setHomeLevel(state.house.level + d)]]) {
    for (const b of $(row).querySelectorAll('.ks-step')) {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            step(Number(b.dataset.d));
        });
    }
}
// Todo lo de la casa: nivel máximo y la tienda entera comprada y puesta
tapBtn('btn-home-all', () => {
    const crashed = maxHouseNow();
    const bought = state.unlockHome();
    applyLook();
    updateCounts();
    refreshHomeRows();
    sfx.play(crashed || bought ? 'power' : 'miss');
    if (!crashed && !bought) return;
    $('debug').classList.add('hidden');
    rig.focus(15, -15);
    setTimeout(() => stage(L('ALL UNLOCKED!', '¡TODO DESBLOQUEADO!'), `${L('FARMHOUSE', 'CASA')} · ${L('HOUSE SHOP', 'TIENDA DE LA CASA')}`), 350);
});
// La casa de serie: colores de siempre y la parcela vacía (lo comprado se olvida)
tapBtn('btn-home-reset', () => {
    state.resetHome();
    applyLook();
    sfx.play('ui');
    refreshHomeRows();
});
// Borrar el progreso: el primer toque arma el botón y el segundo (antes de 3 s) borra y recarga
let resetArmed = 0;
tapBtn('btn-prologue', () => {
    state.prologue = false;
    state.save();
    location.reload();
});
tapBtn('btn-reset', () => {
    const el = $('btn-reset');
    if (!resetArmed) {
        sfx.play('ui');
        el.classList.add('armed');
        el.textContent = L('SURE? TAP AGAIN', '¿SEGURO? TOCA OTRA VEZ');
        resetArmed = setTimeout(() => {
            resetArmed = 0;
            el.classList.remove('armed');
            el.textContent = L('RESET PROGRESS', 'BORRAR PROGRESO');
        }, 3000);
        return;
    }
    clearTimeout(resetArmed);
    FarmState.reset();
    // Que la partida que sigue en memoria no vuelva a guardarse antes de recargar
    state.save = () => {};
    location.reload();
});
for (const el of document.querySelectorAll('.toggle')) {
    const key = el.dataset.key;
    el.classList.toggle('off', !Settings[key]);
    el.addEventListener('click', () => {
        const on = Settings.toggle(key);
        el.classList.toggle('off', !on);
        if (key === 'sfx') sfx.enabled = on;
        if (key === 'freeCosts' || key === 'freeHome') {
            state[key] = on;
            updateCounts();
            refreshPanel();
        }
        if (key === 'music') {
            music.enabled = on;
            if (on) startMusic(mode === 'snipe' ? THEME.sniperMusic : THEME.music);
            else music.stop();
        }
        sfx.play('ui');
    });
}
try {
    if (sessionStorage.getItem('cofd.reopenSettings')) {
        sessionStorage.removeItem('cofd.reopenSettings');
        $('settings').classList.remove('hidden');
    }
    if (sessionStorage.getItem('cofd.reopenDebug')) {
        sessionStorage.removeItem('cofd.reopenDebug');
        refreshDebug();
        $('debug').classList.remove('hidden');
    }
} catch { /* sin almacenamiento */ }

// ---------- La historia: los regalos del trigo mágico y la llamada del mercader ----------
// Cuando toca (y con la granja tranquila: sin menús ni cinemáticas), el trigo mágico brota en el
// mapa, habla y deja su regalo: con el trigo a nivel 2, las rachas de cultivos; a nivel 3, las
// alienígenas (y empiezan a venir alienígenas); al máximo, la caja sorpresa. Con los tomates al
// máximo llama el mercader y viene por primera vez; tras la primera venta, el trigo mágico abre la
// casa (y las parcelas, a la venta). Cada cosa, una vez (state.story)
const STORY = {
    crop: {
        when: () => state.fields.wheat.unlocked && state.fields.wheat.level >= 1,
        at: () => farm.fields.wheat.rect,
        lines: [
            L("YOU'RE DOING REALLY WELL!", '¡LO ESTÁS HACIENDO MUY BIEN!'),
            L('I HAVE A GIFT FOR YOU.', 'TENGO UN REGALO PARA TI.'),
            L('HARVEST IN A ROW AND YOU WILL EARN GRENADES.', 'RECOGE SEGUIDO Y GANARÁS GRANADAS.'),
            L('YOU CAN SEE AND MANAGE YOUR STREAKS IN THE ARMORY, IN YOUR BARN.', 'PUEDES VER Y GESTIONAR TUS RACHAS EN EL ARMAMENTO, EN TU GRANERO.'),
        ],
        gift: 1,
        stage: [L('NEW: CROP STREAKS!', '¡NUEVO: RACHAS DE CULTIVOS!'), L('HARVEST IN A ROW TO EARN GRENADES', 'RECOGE SEGUIDO PARA GANAR GRANADAS')],
    },
    alien: {
        when: () => state.fields.wheat.unlocked && state.fields.wheat.level >= 2,
        at: () => farm.fields.wheat.rect,
        lines: [
            L('CAREFUL...', 'TEN CUIDADO...'),
            L('SOMETIMES THEY TRY TO STEAL YOUR CROPS.', 'A VECES INTENTAN ROBARTE LOS CULTIVOS.'),
            L("I'LL LEAVE YOU A SECRET TOOL TO HELP YOU DEFEND THEM.", 'TE DEJO UNA HERRAMIENTA SECRETA PARA FACILITARTE LA DEFENSA.'),
            L('SHOOT THE THIEVES TO EARN IT. YOU WILL FIND IT IN THE ARMORY, WITH YOUR OTHER STREAKS.', 'ABATE A LOS LADRONES PARA GANARLA. LA TIENES EN EL ARMAMENTO, CON TUS OTRAS RACHAS.'),
        ],
        gift: 2,
        stage: [L('NEW: ALIEN STREAKS!', '¡NUEVO: RACHAS ALIENÍGENAS!'), L('SHOOT THE THIEVES: MISSILE, BOMBER AND NUKE', 'ABATE A LOS LADRONES: MISIL, BOMBARDERO Y NUCLEAR')],
    },
    box: {
        when: () => state.fields.wheat.unlocked && state.maxed('wheat'),
        at: () => farm.fields.wheat.rect,
        lines: [
            L('YOUR WHEAT IS AT ITS BEST!', '¡TU TRIGO ESTÁ AL MÁXIMO!'),
            L('ONE MORE UPGRADE AND YOU CAN AUTOMATE IT.', 'SI LO SUBES UN NIVEL MÁS, PODRÁS AUTOMATIZARLO.'),
            L("AND FOR NEXT TIME, I'LL LEAVE YOU A GIFT TO MAKE HARVESTING EASIER.", 'Y PARA LA PRÓXIMA VEZ, TE DEJO UN REGALO QUE TE AYUDARÁ A COSECHAR MÁS FÁCILMENTE.'),
        ],
        gift: 2,
        stage: [L('NEW: MYSTERY BOX!', '¡NUEVO: CAJA SORPRESA!'), L('IT SHOWS UP ON A TOWER: JUMP THERE AND SHOOT IT', 'SALE EN UNA TORRE: SALTA A ELLA Y DISPÁRALE')],
    },
    house: {
        when: () => state.story.sold,
        at: () => ({ cx: farm.byId.house.def.x, cz: farm.byId.house.def.z + 4.5 }),
        lines: [
            L('YOUR FIRST SALE! WELL DONE.', '¡TU PRIMERA VENTA! BIEN HECHO.'),
            L('I HAVE AN IDEA FOR THAT MONEY...', 'SE ME OCURRE UNA IDEA PARA USAR ESE DINERO...'),
            L('A HOUSE OF YOUR OWN! AND WITH GOLD YOU CAN BUY ANY PLOT YOU LIKE.', '¡TU PROPIA CASA! Y CON EL ORO PODRÁS COMPRAR LAS PARCELAS QUE QUIERAS.'),
        ],
        gift: 2,
        give: () => revealHouse(),
        stage: [L('HOUSE UNLOCKED!', '¡CASA DESBLOQUEADA!'), L('AND THE PLOTS ARE FOR SALE', 'Y LAS PARCELAS, A LA VENTA')],
    },
};
let storyBusy = false;
const menuOpen = () => ['streaks', 'debug', 'settings', 'ufo-shop', 'merchant', 'call'].some((id) => !$(id).classList.contains('hidden'));
function checkStory() {
    if (state.gatesOff || storyBusy || mode !== 'farm' || inCine() || prologue.active || farm.introT < 2.5 || reveals.length || menuOpen()) return;
    const step = ['crop', 'alien', 'box'].find((k) => !state.story[k] && STORY[k].when());
    if (step) return magicVisit(step);
    if (!state.story.merchant && state.fields.tomato.unlocked && state.maxed('tomato')) return merchantCall();
    if (!state.story.house && STORY.house.when()) return magicVisit('house');
}

// El trigo mágico brota donde toca, habla y deja su regalo (con su cartel)
function magicVisit(step) {
    const S = STORY[step], r = S.at();
    storyBusy = true;
    select(null);
    leaveMap(false);
    rig.focus(r.cx, r.cz - 1.5); // (el trigo flota alto: la vista algo por detrás, para que se vea entero)
    rig.zoomTarget = 1.2;
    // (el regalo, al decirlo; su cartel grande, cuando ya se ha ido)
    prologue.visit(r.cx, r.cz, S.lines, {
        [S.gift]: () => {
            state.tell(step);
            if (S.give) S.give();
            sfx.play('achievement');
            vibrate('pickup');
            updateCounts();
        },
    }, () => {
        storyBusy = false;
        rig.zoomTarget = 1;
        updateCounts();
        setTimeout(() => stage(...S.stage), 200);
    });
}

// La llamada del mercader: suena hasta que se contesta; habla, cuelga y viene por primera vez
const CALL = [
    L('HELLO, NEIGHBOUR! I AM THE MERCHANT. A HUMAN, LIKE YOU. VERY NORMAL.', '¡HOLA, VECINO! SOY EL MERCADER. UN HUMANO, COMO TÚ. MUY NORMAL.'),
    L('WORD IS YOU GROW SPLENDID TOMATOES.', 'ME HAN DICHO QUE TIENES UNOS TOMATES ESTUPENDOS.'),
    L('I BUY CROPS AT A GOOD PRICE: IN GOLD COINS. REAL GOLD.', 'TE COMPRO LA COSECHA A BUEN PRECIO: EN MONEDAS DE ORO. DE ORO DE VERDAD.'),
    L("I'M ON MY WAY, BY CAR. DROP BY MY STALL WHENEVER YOU LIKE.", 'VOY PARA ALLÁ, EN MI COCHE. PÁSATE POR MI PUESTO CUANDO QUIERAS.'),
];
let callAt = -1, ringT = 0;
function merchantCall() {
    storyBusy = true;
    select(null);
    callAt = -1;
    $('call').classList.add('ringing');
    $('call').classList.remove('hidden');
    $('call-btn').textContent = L('ANSWER', 'CONTESTAR');
    ringT = 0;
    vibrate('kill');
}
function updateCall(dt) {
    if ($('call').classList.contains('hidden') || callAt >= 0) return;
    if ((ringT -= dt) <= 0) {
        ringT = 1.1;
        sfx.play('radar');
        vibrate('pickup');
    }
}
$('call').addEventListener('pointerdown', (e) => e.stopPropagation());
tapBtn('call-btn', () => {
    sfx.play('ui');
    if (++callAt < CALL.length) {
        $('call').classList.remove('ringing');
        $('call-line').textContent = CALL[callAt];
        $('call-btn').textContent = callAt === CALL.length - 1 ? L('HANG UP', 'COLGAR') : L('NEXT', 'SIGUIENTE');
        return;
    }
    // Cuelga: ya es de la granja y viene ya (el ovni-coche entra por su surco)
    $('call').classList.add('hidden');
    state.tell('merchant');
    refreshGates();
    merchantClock.arriveNow();
    rig.focus(MERCHANT.stall.x + 2, MERCHANT.stall.z + 3);
    rig.zoomTarget = 1.2;
    storyBusy = false;
    updateCounts();
});

// La casa se desbloquea con magia (la de antes, en ruinas, sale de la tierra girando); desde
// ahora se arregla y se mejora, y las parcelas están a la venta
function revealHouse() {
    const h = farm.byId.house;
    refreshGates();
    magicReveal(h.def.x, h.def.z, [{ o: h.root, x: h.def.x, z: h.def.z, delay: 0 }], { beamW: 4, ring: 12 });
    rig.focus(h.def.x, h.def.z + 1);
}

// ---------- Bucle ----------
let last = performance.now();
let uiT = 0;
const _w = new THREE.Vector3();
let paused = false;
function frame(now) {
    if (paused) return; // las pruebas lo paran al acabar
    requestAnimationFrame(frame);
    // En modo prueba, como mucho a CONFIG.test.fps (el tiempo de juego sigue al real)
    if (CONFIG.test && now - last < 1000 / CONFIG.test.fps - 1) return;
    const dt = Math.min(CONFIG.sim.maxFrame, (now - last) / 1000);
    last = now;
    time += dt;
    applyNight(dt);
    if ((clockT -= dt) <= 0) {
        clockT = 0.25;
        updateClock();
        if (mode === 'farm') refreshDock();
    }
    pollPad(dt);
    keyInput(dt);
    if (prologue.active) prologue.update(dt, time, farmParticles);
    if (mode === 'prologue') {
        if (prologue.scene) renderer.render(prologue.scene, prologue.camera, dt);
        return;
    }

    autoHarvest(dt);
    if (mode === 'farm') {
        checkStory();
        updateCall(dt);
    }
    if (mode === 'farm' || mode === 'toSnipe') {
        const progress = Object.fromEntries(FARM.fields.map((f) => [f.id, state.progress(f.id)]));
        farm.update(dt, time, progress);
        if (mode === 'toSnipe') {
            modeT += dt;
            renderer.flash(INK, Math.max(0, (modeT - 0.35) / 0.4));
            if (modeT > 0.8) enterSnipe();
        }
        updateMerchant(dt);
        uiT -= dt;
        if (uiT <= 0) {
            uiT = 0.25;
            refreshPanel();
            refreshMerchantSign();
            if (!$('merchant').classList.contains('hidden')) renderMerchant();
        }
        // Humo de la chimenea y del tractor; destellos sobre el campo maduro
        // (la casa en ruinas no echa humo)
        if (state.house.level > 0 && Math.random() < dt * 5) {
            const h = farm.byId.house;
            h.root.localToWorld(_w.copy(h.chimney));
            farmParticles.spawn(_w.x, _w.y, _w.z, 0.2 + Math.random() * 0.2, 0.7, 0.1, 0.18 + Math.random() * 0.1, 2.2, Math.random() < 0.5 ? 0xe8e4dc : 0xcfc8c0, -0.1);
        }
        // Destellos sobre los campos maduros (más cuanto más grande es el campo)
        for (const v of farm.views) {
            const f = v.rect;
            if (progress[v.id] < 1 || Math.random() > dt * 4 * Math.sqrt((f.w * f.d) / 20)) continue;
            weatherParticle(farmFx, 'sparkle', f.x + Math.random() * f.w, f.z + Math.random() * f.d, Math.random() < 0.5 ? 0xffffff : 0xffe03a);
            farmParticles.y[farmParticles.n - 1] = 1.1 + toWorld(f.x, f.z).y;
        }
        if (Math.random() < dt * THEME.ambient.rate) {
            const c = THEME.ambient.colors;
            weatherParticle(farmParticles, THEME.ambient.kind, rig.fx + (Math.random() - 0.5) * 20, rig.fz + (Math.random() - 0.5) * 20, c[(Math.random() * c.length) | 0]);
        }
        farmParticles.update(dt);
        farmParticles.sync();
        rig.update(dt);
        updateBarnFx(dt);
        shopClouds();
        placeBubbles();
        renderer.render(farmScene, rig.camera, dt);
    }
    if (mode === 'snipe' || mode === 'toFarm') {
        sniper.update(dt);
        // (las armas de la caja no llevan mirilla de francotirador: se apunta con la suya y la
        // mirilla de siempre en el centro)
        const sniperScope = sniper.scoped && !sniper.special;
        $('snipe-ui').classList.toggle('scoped', sniperScope);
        document.body.classList.toggle('scoped', sniperScope);
        scope.show(!sniper.special && sniper.fov < (S.fov + sniper.stats.zoom) * 0.5);
        if (sniper.stats.lens) scope.setLens(sniper.stats.lens);
        scope.setReady(sniper.canFire);
        updateAmmo();
        // La mirilla se abre con la dispersión: así se ve cuánto puede fallar el tiro
        const spreadPx = (Math.tan(sniper.spread) / Math.tan((sniper.fov * Math.PI) / 360)) * (innerHeight / 2);
        $('reticle').style.setProperty('--spread', `${Math.max(5, Math.round(spreadPx))}px`);
        $('snipe-hint').classList.toggle('gone', sniper.moving || sniper.scoped || time - snipeStart > 6);
        updateStreak();
        updatePredator();
        if (mode === 'toFarm') {
            modeT += dt;
            renderer.flash(INK, Math.min(1, modeT / 0.35));
            if (modeT > 0.4) enterFarm();
        }
        if (mode !== 'farm') renderer.render(sniper.scene, sniper.camera, dt);
    }
}

// La casa como se dejó en la tienda
applyLook();
updateCounts();
if (!state.prologue && (!CONFIG.test || new URLSearchParams(location.search).has('prologue'))) {
    mode = 'prologue';
    document.body.classList.add('prologue');
    dayNight.force = 'dusk'; // el prólogo, al atardecer
    prologue.start();
}
requestAnimationFrame(frame);
// La portada (título) se queda un momento aunque cargue rápido
setTimeout(() => (window.__loaded = true), 900);

if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Para las pruebas (Playwright)
window.game = { state, sniper, farm, rig, prologue, dayNight, merchantClock, openMerchant, get mode() { return mode; }, harvest, startUnlock, revealUnlocked, upgradeField, upgradeBarn, upgradeHouse, openShop, get cine() { return cine; }, goFarm, select, updateCounts, pause: () => (paused = true) };
