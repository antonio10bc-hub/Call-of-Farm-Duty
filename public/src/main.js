import * as THREE from 'three';
import { CONFIG } from './config.js';
import { THEME } from './content/theme.js';
import { CROPS } from './content/crops.js';
import { FARM, FIELD_BY_ID, INFO } from './content/farm.js';
import { KILLSTREAKS, MAX_EQUIPPED, setStreakCounts } from './content/killstreaks.js';
import { RetroRenderer } from './render/RetroRenderer.js';
import { CameraRig } from './render/CameraRig.js';
import { Particles } from './render/Particles.js';
import { weatherParticle } from './render/weather.js';
import { Farm } from './world/Farm.js';
import { FarmState } from './game/FarmState.js';
import { Sniper } from './game/Sniper.js';
import { Scope } from './ui/Scope.js';
import { installPixelSprites } from './ui/PixelArt.js';
import { Sfx } from './core/Audio.js';
import { Music } from './core/Music.js';
import { Settings } from './core/Settings.js';
import { L, applyHtmlTexts, switchLang } from './core/I18n.js';
import { vibrate } from './core/Haptics.js';
import { clamp } from './core/math.js';

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
setStreakCounts(Settings.streaks);

function addLights(scene) {
    const { light } = THEME;
    const sun = new THREE.DirectionalLight(light.sun, light.sunIntensity);
    sun.position.set(-4, 10, 6);
    scene.add(sun, new THREE.HemisphereLight(light.sky, light.ground, light.hemiIntensity));
}

// ---------- Granja (mapa) ----------
const farmScene = new THREE.Scene();
farmScene.background = new THREE.Color(THEME.sky);
addLights(farmScene);
const farm = new Farm(THEME, state.fields);
farmScene.add(farm.root);
const farmParticles = new Particles(farmScene, 600);
const rig = new CameraRig(M);
rig.free = true;
rig.setBounds(M.view, M.view);
rig.yaw = rig.yawTarget = M.yaw;
const home = { x: 15, z: 18 };
rig.focus(home.x, home.z);
rig.snap();
farm.onLand = (m) => {
    const p = m.root.position;
    farmParticles.burst(p.x, 0.1, p.z, 18, [THEME.dust, 0xd9b77a], { speed: 2.4, up: 1.4, size: 0.14, ttl: 0.5 });
    rig.shake(0.18);
    sfx.play('drop');
};

// ---------- Francotirador ----------
let snipeField = null; // id del campo en el que se está (cosechando o desbloqueando)
const cropOf = (id) => CROPS[FIELD_BY_ID[id].crop];
const sniper = new Sniper(THEME, {
    sfx,
    onHit(target, nx, ny) {
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
        // Recompensa de la racha: su medalla, más grande
        if (reward) {
            const k = KILLSTREAKS.find((r) => r.id === reward);
            medal(`${k.at} · ${k.name}`, 'reward');
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
            if (def.id === snipeField || !state.isReady(def.id)) continue;
            for (let n = state.fields[def.id].left; n > 0; n--) state.collect(def.id);
        }
        updateCounts(true);
        setTimeout(() => banner(L('NUKE!', '¡NUCLEAR!')), 300);
    },
    // El barril ha reventado: el terreno queda limpio y desbloqueado (se guarda ya)
    onUnlock() {
        state.unlock(snipeField);
        // Fogonazo blanco a toda pantalla y, al poco, el ¡BUM!
        renderer.flash(0xfff6dc, 1);
        setTimeout(() => renderer.flash(0xffcc33, 0.7), 420);
        setTimeout(() => banner(L('BOOM!', '¡BUM!')), 150);
    },
    onFinish() {
        setTimeout(() => banner(L('ALL IN!', '¡COSECHA COMPLETA!')), 250);
        vibrate('kill');
    },
    onDone() {
        goFarm(true);
    },
    onCorner(i) {
        showCorner(i);
    },
});
addLights(sniper.scene);

renderer.onResize = (w, h) => {
    rig.resize(w / h);
    sniper.camera.aspect = w / h;
    sniper.camera.updateProjectionMatrix();
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

function updateCounts(bump = false) {
    $('wheat-count').textContent = state.items.wheat;
    $('tomato-count').textContent = state.items.tomato;
    // El contador de tomates sale cuando ya hay campo de tomates
    $('farm-tomato').classList.toggle('hidden', !state.fields.tomato.unlocked && !state.items.tomato);
    // En el campo de tiro, el contador es el del cultivo que se recoge
    const hud = snipeField && !sniper.unlocking ? FIELD_BY_ID[snipeField].crop : 'wheat';
    $('hud-wheat').textContent = state.items[hud];
    $('hud-ico').className = `ico ${CROPS[hud].icon}-ico`;
    refreshSigns();
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

// Lo recogido (espiga o tomate pixelado) vuela a saltos hasta el contador
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

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

// Encima de cada campo: un cartel flotante con su nivel (tocarlo abre su ficha para mejorarlo)
// y, cuando está maduro, la burbuja de RECOGER. En un terreno bloqueado el cartel lleva un
// candado; cuando ya se puede desbloquear dice ¡DESBLOQUEAR! y tocarlo lleva al barril.
const signs = {}, bubbles = {};
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
armory.innerHTML = `${ico('ks-grenade')}<span>${L('ARMORY', 'ARMAMENTO')}</span>`;

for (const def of FARM.fields) {
    const id = def.id;
    bubbles[id] = uiButton('bubble hidden', () => harvest(id));
    bubbles[id].innerHTML = `${ico(CROPS[def.crop].icon)}<span>${L('HARVEST!', '¡RECOGER!')}</span>`;
    signs[id] = uiButton('field-sign hidden', () => (state.canUnlock(id) ? startUnlock(id) : select({ field: id })));
    signs[id].id = `sign-${id}`;
}

function refreshSigns() {
    for (const def of FARM.fields) {
        const id = def.id, el = signs[id], f = state.fields[id];
        const can = state.canUnlock(id);
        el.classList.toggle('locked', !f.unlocked && !can);
        el.classList.toggle('can-unlock', can);
        el.classList.toggle('can-up', state.canUpgrade(id));
        const html = f.unlocked
            ? `<span class="sign-level">${L('LV', 'NV')}.${f.level + 1}</span><i class="sign-up"></i>`
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
    if (show) {
        const barn = farm.byId.barn;
        // (el cartel ya sube un poco por su cuenta: con esto queda justo sobre el tejado)
        _b.set(barn.def.x, barn.top - 1.4, barn.def.z).project(rig.camera);
        armory.style.left = `${(_b.x * 0.5 + 0.5) * innerWidth}px`;
        armory.style.top = `${(-_b.y * 0.5 + 0.5) * innerHeight}px`;
    }
    for (const def of FARM.fields) {
        const id = def.id, bubble = bubbles[id], sign = signs[id];
        const on = show && state.isReady(id);
        if (on && bubble.classList.contains('hidden')) {
            bubble.classList.remove('hidden');
            sfx.play('itemSpawn');
        } else if (!on) bubble.classList.add('hidden');
        sign.classList.toggle('hidden', !show);
        if (!show) continue;
        farm.fieldTop(id, _b).project(rig.camera);
        const x = `${(_b.x * 0.5 + 0.5) * innerWidth}px`, y = `${(-_b.y * 0.5 + 0.5) * innerHeight}px`;
        sign.style.left = bubble.style.left = x;
        sign.style.top = bubble.style.top = y;
    }
}

// Ficha del edificio o del campo tocado
function select(what) {
    // El granero es el cuartel de las rachas de bajas: abre su menú
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
    const what = def.crop === 'tomato' ? L('TOMATOES', 'TOMATES') : L('BUNDLES', 'MATAS');
    text.textContent = ready
        ? L(`RIPE! ${f.left} ${what} TO HARVEST.`, `¡MADURO! ${f.left} ${what} PARA RECOGER.`)
        : `${L('GROWING... READY IN', 'CRECIENDO... LISTO EN')} ${fmt((1 - p) * crop.growTime)}`;
    bar.parentElement.classList.remove('hidden');
    bar.style.width = `${Math.round(p * 20) * 5}%`;
    act.classList.toggle('hidden', !ready);
    act.classList.remove('unlock-btn');
    $('action-ico').className = `ico ${crop.icon}-ico`;
    $('action-label').textContent = L('HARVEST!', '¡RECOGER!');
    // Mejora: más grande y con más blancos, pagando lo que pida (trigo, tomates...)
    const maxed = state.maxed(id);
    up.classList.remove('hidden');
    up.disabled = !state.canUpgrade(id);
    $('upgrade-label').textContent = maxed ? L('MAX LEVEL', 'NIVEL MÁXIMO') : L('UPGRADE', 'MEJORAR');
    const cost = maxed ? '' : Object.entries(state.cost(id)).map(([c, n]) => `<span class="upgrade-cost${state.items[c] < n ? ' short' : ''}">${ico(CROPS[c].icon)}<b>${n}</b></span>`).join('');
    if ($('upgrade-cost').innerHTML !== cost) $('upgrade-cost').innerHTML = cost;
    up.classList.toggle('maxed', maxed);
}

function upgradeField(id) {
    if (mode !== 'farm' || !state.upgrade(id)) return;
    farm.setLevel(id, state.fields[id].level);
    const f = farm.fields[id].rect;
    rig.focus(f.cx, f.cz + 1);
    rig.shake(0.14);
    for (let k = 0; k < 6; k++) farmParticles.burst(f.x + Math.random() * f.w, 0.2, f.z + Math.random() * f.d, 6, [THEME.dust, 0xd9b77a, 0xffe03a], { speed: 2, up: 1.6, size: 0.12, ttl: 0.5 });
    sfx.play('power');
    vibrate('pickup');
    updateCounts();
    const what = FIELD_BY_ID[id].crop === 'tomato' ? L('TOMATOES', 'TOMATES') : L('BUNDLES', 'MATAS');
    stage(L('FIELD UPGRADED!', '¡CAMPO MEJORADO!'), `${what}: ${state.sheaves(id)}`);
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
        for (let k = 0; k < 10; k++) farmParticles.burst(f.x + Math.random() * f.w, 0.2, f.z + Math.random() * f.d, 6, [THEME.dust, 0x8a5a34, 0x6f8a3a], { speed: 2.4, up: 2, size: 0.14, ttl: 0.6 });
        setTimeout(() => stage(L('LAND CLEARED!', '¡TERRENO LIMPIO!'), `${FIELD_BY_ID[v.id].name} ${L('UNLOCKED', 'DESBLOQUEADO')}`), 300);
        return true;
    }
    return false;
}

// Barra de la racha de bajas: cuántas lleva, lo que le queda a la barra y la siguiente recompensa
function updateStreak() {
    const n = sniper.streak, el = $('streak');
    el.classList.toggle('hidden', n <= 0 || sniper.unlocking);
    if (n <= 0) return;
    $('streak-n').textContent = n;
    $('streak-fill').style.width = `${Math.round(Math.max(0, sniper.streakT / sniper.streakMax) * 40) * 2.5}%`;
    el.classList.toggle('low', sniper.streakT < 1);
    // La siguiente de las equipadas en el granero
    const next = KILLSTREAKS.filter((k) => sniper.equipped.includes(k.id) && k.at > n).sort((a, b) => a.at - b.at)[0];
    $('streak-next').textContent = next ? `${L('NEXT', 'SIGUIENTE')}: ${next.at} ${next.name}` : sniper.equipped.length ? L('MAX STREAK!', '¡RACHA MÁXIMA!') : L('NO STREAKS: EQUIP THEM IN THE BARN', 'SIN RACHAS: EQUÍPALAS EN EL GRANERO');
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
    const free = ids.find((id) => state.canUnlock(id));
    if (free) startUnlock(free);
}

function enterSnipe() {
    const unlock = goSnipe.unlock;
    const def = FIELD_BY_ID[snipeField], arena = def.levels[state.fields[snipeField].level].arena;
    sniper.enter(unlock ? { unlock: true } : { crop: def.crop, count: state.fields[snipeField].left, arena, streaks: [...state.streaks] });
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
let pan = null, pinch = null, touch = null, edge = null;

function unitsPerPx() {
    return (rig.halfWidth * rig.zoom * 2) / innerWidth;
}

function panBy(dx, dy) {
    const u = unitsPerPx(), y = rig.yaw, sp = Math.sin((M.pitch * Math.PI) / 180);
    // Derecha de la pantalla y "hacia dentro" sobre el suelo
    const rx = Math.cos(y), rz = -Math.sin(y), fx = -Math.sin(y), fz = -Math.cos(y);
    const B = FARM.bounds;
    rig.fx = clamp(rig.fx - rx * dx * u + fx * dy * u / sp, B.x0 + 2, B.x1 - 2);
    rig.fz = clamp(rig.fz - rz * dx * u + fz * dy * u / sp, B.z0 + 2, B.z1 - 2);
}

function zoomBy(k) {
    rig.zoomTarget = clamp(rig.zoomTarget * k, M.zoomMin, M.zoomMax);
}

function isUi(e) {
    return e.target.closest && e.target.closest('button, .panel, .screen');
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
    if (isUi(e)) return;
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
    if (e.clientX < S.edgeSwipe || e.clientX > innerWidth - S.edgeSwipe) {
        edge = { id: e.pointerId, x: e.clientX, y: e.clientY };
        return;
    }
    if (!touch) touch = { id: e.pointerId, lx: e.clientX, ly: e.clientY, ax: e.clientX, ay: e.clientY, still: performance.now(), t: performance.now(), moved: false };
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
    if (mode !== 'snipe') return;
    if (e.pointerType === 'mouse' && locked()) {
        sniper.look(e.movementX, e.movementY, S.lookMouse);
        return;
    }
    if (edge && e.pointerId === edge.id) {
        const dx = e.clientX - edge.x, dy = e.clientY - edge.y;
        if (Math.abs(dx) > S.flickDist && Math.abs(dx) > Math.abs(dy)) {
            // Desde el borde izquierdo: torre de la izquierda; desde el derecho: la de la derecha
            sniper.goSide(dx > 0 ? -1 : 1);
            edge = null;
        }
        return;
    }
    if (touch && e.pointerId === touch.id) {
        sniper.look(e.clientX - touch.lx, e.clientY - touch.ly, touch.mouse ? S.lookMouse : S.lookTouch);
        touch.lx = e.clientX;
        touch.ly = e.clientY;
        // Si el dedo se mueve, vuelve a contar el rato que lleva quieto
        if (Math.hypot(e.clientX - touch.ax, e.clientY - touch.ay) > S.holdSlop) {
            touch.ax = e.clientX;
            touch.ay = e.clientY;
            touch.still = performance.now();
            touch.moved = true;
        }
    }
});

function endPointer(e, cancel) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (mode === 'farm' && pan && e.pointerId === pan.id) {
        if (!pan.moved && !cancel) tapMap(e.clientX, e.clientY);
        pan = null;
    }
    if (edge && e.pointerId === edge.id) edge = null;
    if (touch && e.pointerId === touch.id && !touch.mouse) {
        const t = touch;
        touch = null;
        if (mode !== 'snipe' || cancel) return sniper.release(false);
        if (sniper.scoped) sniper.release(true);
        // Toque rápido sin mover el dedo: disparo desde la cadera (sin mira, impreciso)
        else if (!t.moved && performance.now() - t.t < S.tapTime) sniper.fire();
    }
}
addEventListener('pointerup', (e) => endPointer(e, false));
addEventListener('pointercancel', (e) => endPointer(e, true));

// Botones del ratón en primera persona (mousedown/mouseup también ven el segundo botón
// cuando ya hay otro pulsado, cosa que pointerdown no hace)
addEventListener('mousedown', (e) => {
    if (mode !== 'snipe' || isUi(e)) return;
    lockMouse();
    if (e.button === 2) sniper.setAds(true);
    else if (e.button === 0) {
        if (locked()) sniper.fire();
        else touch = { id: 'mouse', mouse: true, lx: e.clientX, ly: e.clientY, ax: e.clientX, ay: e.clientY, still: Infinity };
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
    if (mode === 'farm') zoomBy(Math.exp(e.deltaY * 0.0012));
}, { passive: true });

// Dedo quieto un momento: sube el arma
function holdCheck() {
    if (mode === 'snipe' && touch && !touch.mouse && !sniper.scoped && !sniper.ks.predator && performance.now() - touch.still > S.holdTime) sniper.setAds(true);
}

function tapMap(x, y) {
    ray.setFromCamera(ndcOf(x, y), rig.camera);
    const hit = farm.pick(ray);
    if (!hit) return select(null);
    if (hit.field && state.isReady(hit.field) && selected && selected.field === hit.field) return harvest(hit.field);
    select(hit);
}

// Teclado: WASD/flechas miran, espacio/enter mantiene la mira (soltar dispara), Q/E saltan a la
// torre de la izquierda/derecha, Esc baja la mira o vuelve a la granja (con el ratón bloqueado, Esc lo suelta), H vuelve.
const keys = new Set();
addEventListener('keydown', (e) => {
    sfx.unlock();
    const k = e.key.toLowerCase();
    keys.add(k);
    if (e.repeat) return;
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
    if (state.canUnlock(selected.field)) startUnlock(selected.field);
    else harvest(selected.field);
});
tapBtn('panel-upgrade', () => selected && selected.field && upgradeField(selected.field));
tapBtn('panel-close', () => select(null));
tapBtn('btn-settings', () => {
    sfx.play('ui');
    $('settings').classList.remove('hidden');
});
tapBtn('btn-settings-close', () => {
    sfx.play('ui');
    $('settings').classList.add('hidden');
});

// ---------- Granero: elegir las rachas de bajas (como mucho MAX_EQUIPPED) ----------
const ksCards = {};
for (const k of KILLSTREAKS) {
    const card = document.createElement('button');
    card.className = 'ks-card';
    card.id = `ks-card-${k.id}`;
    card.innerHTML = `<i class="ks-ico" style="--ico: var(--px-${k.icon})"></i><span class="ks-info"><b>${k.name}</b><span class="ks-kills"></span><small>${k.desc}</small></span><em></em>`;
    card.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.toggleStreak(k.id)) {
            // Ya hay dos: hay que quitar una antes
            sfx.play('miss');
            const info = $('ks-pick-info');
            info.classList.remove('warn');
            void info.offsetWidth;
            info.classList.add('warn');
            return;
        }
        sfx.play(state.streaks.includes(k.id) ? 'reloaded' : 'ui');
        refreshStreaks();
    });
    $('ks-cards').appendChild(card);
    ksCards[k.id] = card;
}

function refreshStreaks() {
    const full = state.streaks.length >= MAX_EQUIPPED;
    for (const k of KILLSTREAKS) {
        const card = ksCards[k.id], on = state.streaks.includes(k.id);
        card.classList.toggle('on', on);
        card.classList.toggle('full', full && !on);
        card.querySelector('.ks-kills').textContent = `${k.at} ${L('KILLS', 'BAJAS')}`;
        card.querySelector('em').textContent = on ? L('EQUIPPED', 'EQUIPADA') : L('EQUIP', 'EQUIPAR');
    }
    $('ks-pick-info').textContent = `${L(`PICK UP TO ${MAX_EQUIPPED}`, `ELIGE HASTA ${MAX_EQUIPPED}`)} · ${state.streaks.length}/${MAX_EQUIPPED}`;
}

function openStreaks() {
    sfx.play('ui');
    refreshStreaks();
    $('streaks').classList.remove('hidden');
}

tapBtn('btn-streaks-close', () => {
    sfx.play('ui');
    $('streaks').classList.add('hidden');
});
tapBtn('btn-lang', switchLang);
tapBtn('btn-debug', () => {
    sfx.play('ui');
    $('debug').classList.remove('hidden');
});
tapBtn('btn-debug-close', () => {
    sfx.play('ui');
    $('debug').classList.add('hidden');
});
// Depuración: cuántas bajas pide cada racha (- / +), y volver a las normales
const ksRows = {};
for (const k of KILLSTREAKS) {
    const row = document.createElement('div');
    row.className = 'ks-row';
    row.innerHTML = `<span>${k.name}</span><button class="ks-step" data-d="-1">-</button><b id="ks-${k.id}"></b><button class="ks-step" data-d="1">+</button>`;
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
// Depuración: todos los terrenos bloqueados, limpios y sembrados de golpe (sin requisitos)
tapBtn('btn-unlock-all', () => {
    const ids = FARM.fields.map((f) => f.id).filter((id) => state.unlock(id, Date.now(), true));
    sfx.play(ids.length ? 'power' : 'miss');
    if (!ids.length) return;
    $('debug').classList.add('hidden');
    while (revealUnlocked());
    rig.focus(home.x, home.z);
    setTimeout(() => stage(L('ALL UNLOCKED!', '¡TODO DESBLOQUEADO!'), ids.map((id) => FIELD_BY_ID[id].name).join(' · ')), 350);
});
tapBtn('ks-default', () => {
    Settings.set('streaks', null);
    setStreakCounts(null);
    refreshStreakRows();
    refreshStreaks();
    sfx.play('ui');
});
refreshStreakRows();
// Borrar el progreso: el primer toque arma el botón y el segundo (antes de 3 s) borra y recarga
let resetArmed = 0;
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
        if (key === 'freeCosts') {
            state.freeCosts = on;
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
} catch { /* sin almacenamiento */ }

// ---------- Bucle ----------
let last = performance.now();
let uiT = 0;
const _w = new THREE.Vector3();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(CONFIG.sim.maxFrame, (now - last) / 1000);
    last = now;
    time += dt;
    pollPad(dt);
    keyInput(dt);
    holdCheck();

    if (mode === 'farm' || mode === 'toSnipe') {
        const progress = Object.fromEntries(FARM.fields.map((f) => [f.id, state.progress(f.id)]));
        farm.update(dt, time, progress);
        if (mode === 'toSnipe') {
            modeT += dt;
            renderer.flash(INK, Math.max(0, (modeT - 0.35) / 0.4));
            if (modeT > 0.8) enterSnipe();
        }
        uiT -= dt;
        if (uiT <= 0) {
            uiT = 0.25;
            refreshPanel();
        }
        // Humo de la chimenea y del tractor; destellos sobre el campo maduro
        if (Math.random() < dt * 5) {
            const h = farm.byId.house;
            h.root.localToWorld(_w.copy(h.chimney));
            farmParticles.spawn(_w.x, _w.y, _w.z, 0.2 + Math.random() * 0.2, 0.7, 0.1, 0.18 + Math.random() * 0.1, 2.2, Math.random() < 0.5 ? 0xe8e4dc : 0xcfc8c0, -0.1);
        }
        // Destellos sobre los campos maduros (más cuanto más grande es el campo)
        for (const v of farm.views) {
            const f = v.rect;
            if (progress[v.id] < 1 || Math.random() > dt * 4 * Math.sqrt((f.w * f.d) / 20)) continue;
            weatherParticle(farmParticles, 'sparkle', f.x + Math.random() * f.w, f.z + Math.random() * f.d, Math.random() < 0.5 ? 0xffffff : 0xffe03a);
            farmParticles.y[farmParticles.n - 1] = 1.1;
        }
        if (Math.random() < dt * THEME.ambient.rate) {
            const c = THEME.ambient.colors;
            weatherParticle(farmParticles, THEME.ambient.kind, rig.fx + (Math.random() - 0.5) * 20, rig.fz + (Math.random() - 0.5) * 20, c[(Math.random() * c.length) | 0]);
        }
        farmParticles.update(dt);
        farmParticles.sync();
        rig.update(dt);
        placeBubbles();
        renderer.render(farmScene, rig.camera, dt);
    }
    if (mode === 'snipe' || mode === 'toFarm') {
        sniper.update(dt);
        $('snipe-ui').classList.toggle('scoped', sniper.scoped);
        document.body.classList.toggle('scoped', sniper.scoped);
        scope.show(sniper.fov < (S.fov + S.scopeFov) * 0.5);
        scope.setReady(sniper.canFire);
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

updateCounts();
requestAnimationFrame(frame);
// La portada (título) se queda un momento aunque cargue rápido
setTimeout(() => (window.__loaded = true), 900);

if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Para las pruebas (Playwright)
window.game = { state, sniper, farm, rig, get mode() { return mode; }, harvest, startUnlock, revealUnlocked, upgradeField, goFarm, select, updateCounts };
