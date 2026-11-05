// Pruebas de el mapa de la granja: granero y sus niveles, mejorar campos, la casa y las partidas guardadas.
const { test, expect, openFarm, screenOf, watchErrors } = require('./helpers');

test('la granja es un mapa: el granero sube de nivel, agranda su recinto y enseña las dos rachas', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect(page.locator('#sign-wheat')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#wheat-count')).toHaveText('0');
    const p = await screenOf(page, 'map', 15, 1.4, 11);
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('#streaks')).toBeVisible();
    // Las dos rachas, activas desde el principio: granadas (recogiendo) y alienígena
    await expect(page.locator('#barn-level')).toHaveText('GRANERO NV.0/5');
    await expect(page.locator('.ks-track')).toHaveText([/RACHA DE GRANADAS/, /RACHA ALIENIGENA/]);
    await expect(page.locator('#ks-card-cluster .kc-n')).toHaveText('10SEGUIDAS');
    await expect(page.locator('#ks-card-nuke .kc-n')).toHaveText('10ALIENIGENAS');
    // Todas las fichas iguales; la tocada queda marcada y su detalle sale debajo
    const sizes = await page.locator('.kc').evaluateAll((els) => new Set(els.map((e) => `${Math.round(e.offsetWidth)}x${e.offsetHeight}`)).size);
    expect(sizes).toBe(1);
    await expect(page.locator('#ks-card-frag')).toHaveClass(/sel/);
    await page.locator('#ks-card-predator').click();
    await expect(page.locator('#ks-card-predator')).toHaveClass(/sel/);
    await expect(page.locator('#ks-card-frag')).not.toHaveClass(/sel/);
    await expect(page.locator('#kd-name')).toHaveText('MISIL PREDATOR');
    await expect(page.locator('#kd-at')).toHaveText('3 ALIENIGENAS ABATIDOS');
    await expect(page.locator('#barn-upgrade')).toBeDisabled();
    // Con 5 de trigo: nivel 1 y el recinto crece
    const hidden0 = await page.evaluate(() => game.farm.wild.reduce((n, e) => n + e.positions.filter((q) => q.hide).length, 0));
    await page.evaluate(() => { game.state.wheat = 5; game.select({ structure: 'barn' }); });
    await expect(page.locator('#barn-upgrade')).toBeEnabled();
    await page.locator('#barn-upgrade').click();
    await expect(page.locator('#streaks')).toBeHidden();
    expect(await page.evaluate(() => [game.state.barn.level, game.farm.barnLevel, game.state.wheat])).toEqual([1, 1, 0]);
    expect(await page.evaluate(() => game.farm.wild.reduce((n, e) => n + e.positions.filter((q) => q.hide).length, 0))).toBeGreaterThan(hidden0);
    // Los niveles 4 y 5 piden también tomates
    await page.evaluate(() => { game.state.items.wheat = 1000; game.state.items.tomato = 0; for (let i = 0; i < 3; i++) game.upgradeBarn(); });
    expect(await page.evaluate(() => [game.state.barn.level, game.state.canUpgradeBarn])).toEqual([3, false]);
    await page.evaluate(() => { game.state.items.tomato = 1000; game.upgradeBarn(); game.upgradeBarn(); game.select({ structure: 'barn' }); });
    expect(await page.evaluate(() => game.state.barn.level)).toBe(5);
    await expect(page.locator('#barn-upgrade')).toBeHidden();
    await expect(page.locator('#barn-next')).toHaveText('NIVEL MÁXIMO');
    await page.locator('#btn-streaks-close').click();
    await expect(page.locator('#streaks')).toBeHidden();
    // El cartel ARMAMENTO encima del granero también abre el menú
    await expect(page.locator('#sign-barn')).toHaveText('ARMAMENTO');
    await page.locator('#sign-barn').click();
    await expect(page.locator('#streaks')).toBeVisible();
    await page.locator('#btn-streaks-close').click();
    // Arrastrar desplaza el mapa (desde un trozo libre, sin carteles encima)
    const before = await page.evaluate(() => game.rig.fx + game.rig.fz);
    await page.mouse.move(300, 680);
    await page.mouse.down();
    await page.mouse.move(220, 580, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => game.rig.fx + game.rig.fz)).not.toBeCloseTo(before, 1);
    expect(errors).toEqual([]);
});

test('mejorar el campo: cuesta 3 de trigo, lo hace más grande y con más matas', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('.bubble:not(.hidden)')).toHaveCount(1, { timeout: 30_000 });
    const before = await page.evaluate(() => ({ w: game.farm.fields.wheat.rect.w, d: game.farm.fields.wheat.rect.d, left: game.state.fields.wheat.left, stalks: game.farm.fields.wheat.plants.length }));
    // El cartel flotante dice el nivel y al tocarlo abre la ficha del campo
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1');
    await page.locator('#sign-wheat').click();
    await expect(page.locator('#panel-title')).toHaveText('CAMPO DE TRIGO NV.1');
    // Sin trigo suficiente no se puede mejorar
    await expect(page.locator('#panel-upgrade')).toBeDisabled();
    await page.evaluate(() => { game.state.wheat = 4; });
    await expect(page.locator('#panel-upgrade')).toBeEnabled();
    await page.locator('#panel-upgrade').click();
    expect(await page.evaluate(() => game.state.fields.wheat.level)).toBe(1);
    expect(await page.evaluate(() => game.state.wheat)).toBe(1);
    const after = await page.evaluate(() => ({ w: game.farm.fields.wheat.rect.w, d: game.farm.fields.wheat.rect.d, left: game.state.fields.wheat.left, stalks: game.farm.fields.wheat.plants.length }));
    expect(after.w * after.d).toBeGreaterThan(before.w * before.d);
    expect(after.stalks).toBeGreaterThan(before.stalks);
    expect(after.left).toBeGreaterThan(before.left);
    await expect(page.locator('#panel-title')).toHaveText('CAMPO DE TRIGO NV.2');
    await expect(page.locator('#sign-wheat')).toHaveText('NV.2');
    // En el campo de tiro salen todas las matas del nivel nuevo
    await page.locator('.bubble:not(.hidden)').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    expect(await page.evaluate(() => game.sniper.field.remaining)).toBe(after.left);
    // Se guarda: al recargar sigue en el nivel 2
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.fields.wheat.level)).toBe(1);
    expect(errors).toEqual([]);
});

test('partida guardada con las cifras de antes: los campos salen con los blancos de su nivel', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    // Trigo en nivel 5 maduro con las 32 matas de antes y tomates en nivel 3 creciendo con 11
    await page.addInitScript(() => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('cofd.farm.v4', JSON.stringify({ items: { wheat: 50, tomato: 0 }, fields: { wheat: { unlocked: true, level: 4, plantedAt: 0, left: 32 }, tomato: { unlocked: true, level: 2, plantedAt: Date.now(), left: 11 } } }));
    });
    await page.goto('/?test');
    await expect.poll(() => page.evaluate(() => window.game && [game.state.fields.wheat.left, game.state.fields.tomato.left]), { timeout: 30_000 }).toEqual([150, 22]);
    // Ya guardada con la revisión nueva: lo que se haya empezado a recoger se respeta
    await page.evaluate(() => { game.state.collect('wheat'); });
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.fields.wheat.left), { timeout: 30_000 }).toBe(149);
    expect(errors).toEqual([]);
});

test('casa: empieza en ruinas con la parcela sucia; 3 niveles la arreglan y limpian la parcela', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect.poll(() => page.evaluate(() => window.game && game.farm.introT > 2)).toBe(true);
    expect(await page.evaluate(() => [game.state.house.level, game.farm.byId.house.ruin.visible, game.farm.byId.house.whole.visible])).toEqual([0, true, false]);
    const wildHidden = () => page.evaluate(() => game.farm.wild.reduce((n, e) => n + e.positions.filter((q) => q.hide).length, 0));
    const before = await wildHidden();
    // (desde la vista de inicio la casa queda fuera de la pantalla del móvil: su ficha, directa)
    await page.evaluate(() => game.select({ structure: 'house' }));
    await expect(page.locator('#panel-title')).toHaveText('CASA NV.0/3');
    await expect(page.locator('#sign-house')).toContainText('CASA');
    await expect(page.locator('#panel-upgrade')).toBeDisabled();
    await page.evaluate(() => { game.state.items.wheat = 100; game.state.items.tomato = 100; });
    await expect(page.locator('#panel-upgrade')).toBeEnabled();
    await page.locator('#panel-upgrade').click();
    // Nivel 1: la casita arreglada y limpio alrededor
    expect(await page.evaluate(() => [game.state.house.level, game.farm.byId.house.ruin.visible, game.farm.byId.house.whole.visible])).toEqual([1, false, true]);
    const l1 = await wildHidden();
    expect(l1).toBeGreaterThan(before);
    await page.locator('#panel-upgrade').click();
    await page.locator('#panel-upgrade').click();
    await expect(page.locator('#panel-title')).toHaveText('CASA NV.3/3');
    expect(await wildHidden()).toBeGreaterThan(l1);
    // Al nivel 3 la parcela entera está limpia: nada abandonado dentro
    expect(await page.evaluate(() => game.farm.floor.tiles.filter((t) => t.k && t.k.wild && t.r < 0 && t.c >= 0 && t.c < 30).length)).toBe(0);
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.house.level)).toBe(3);
    expect(errors).toEqual([]);
});

test('rifle: en el granero se mejoran la mira, la estabilidad y el cerrojo con cosecha', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    await page.evaluate(() => game.select({ structure: 'barn' }));
    await expect(page.locator('#streaks')).toBeVisible();
    await page.locator('#barn-tab-rifle').click();
    await expect(page.locator('#barn-rifle')).toBeVisible();
    await expect(page.locator('#barn-ks')).toBeHidden();
    // Sin cosecha no se mejora; con 4 de trigo, la mira sube al nivel 1
    await expect(page.locator('#rf-up-zoom')).toBeDisabled();
    await page.evaluate(() => { game.state.items.wheat = 4; game.select({ structure: 'barn' }); });
    await expect(page.locator('#rf-up-zoom')).toBeEnabled();
    await expect(page.locator('#rf-card-zoom .rf-val')).toHaveText('ZOOM x5.3 → x6.1');
    await page.locator('#rf-up-zoom').click();
    expect(await page.evaluate(() => [game.state.rifle.zoom, game.state.items.wheat])).toEqual([1, 0]);
    await expect(page.locator('#rf-card-zoom .pip.on')).toHaveCount(1);
    await expect(page.locator('#rf-up-zoom')).toBeDisabled();
    // Los dos últimos niveles piden tomates
    await page.evaluate(() => { game.state.items.wheat = 1000; for (let i = 0; i < 3; i++) game.state.upgradeRifle('bolt'); });
    expect(await page.evaluate(() => [game.state.rifle.bolt, game.state.canUpgradeRifle('bolt')])).toEqual([3, false]);
    await page.evaluate(() => { game.state.items.tomato = 1000; game.state.upgradeRifle('bolt'); game.state.upgradeRifle('bolt'); game.state.upgradeRifle('steady'); game.select({ structure: 'barn' }); });
    await expect(page.locator('#rf-up-bolt')).toHaveText('MÁX');
    // En el campo de tiro el rifle va con sus mejoras
    await page.locator('#btn-streaks-close').click();
    await page.evaluate(() => game.harvest('wheat'));
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    expect(await page.evaluate(() => game.sniper.stats)).toEqual({ zoom: 10.5, steady: 0.8, bolt: 0.33 });
    // Se guarda
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.rifle)).toEqual({ zoom: 1, steady: 1, bolt: 5 });
    expect(errors).toEqual([]);
});

test('torreta: con el campo al máximo, la mejora extra pone una torreta que va de esquina en esquina y recoge sola (sin sumar a la racha)', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    // Al nivel 5 la mejora pasa a ser TORRETA, con su precio
    await page.evaluate(() => { game.state.wheat = 12; for (let i = 0; i < 4; i++) game.upgradeField('wheat'); game.state.wheat = 0; game.select({ field: 'wheat' }); });
    await expect(page.locator('#upgrade-label')).toHaveText('TORRETA');
    await expect(page.locator('#panel-upgrade')).toBeDisabled();
    await page.evaluate(() => { game.state.wheat = 40; });
    await expect(page.locator('#panel-upgrade')).toBeEnabled();
    await page.locator('#panel-upgrade').click();
    expect(await page.evaluate(() => [game.state.fields.wheat.turrets, !!game.farm.fields.wheat.turret, game.farm.fields.wheat.bases.length, game.state.wheat])).toEqual([true, true, 4, 0]);
    await expect(page.locator('#upgrade-label')).toHaveText('AUTOMÁTICO');
    await expect(page.locator('#sign-wheat .turret-ico')).toHaveCount(1);
    // En el mapa no paran de disparar a ráfagas y recogen solas lo maduro, con su +1 de trigo
    await page.evaluate(() => {
        window.autoPops = 0;
        new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains('auto-pop')) window.autoPops++; }))).observe(document.body, { childList: true });
    });
    await expect.poll(() => page.evaluate(() => game.farm.shots.length), { timeout: 5_000 }).toBeGreaterThan(0);
    const left = await page.evaluate(() => game.state.fields.wheat.left);
    await expect.poll(() => page.evaluate(() => game.state.wheat), { timeout: 12_000 }).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.autoPops)).toBeGreaterThan(0);
    expect(await page.evaluate(() => game.state.fields.wheat.left)).toBeLessThan(left);
    // En el campo de tiro, un mástil en cada torre y la torreta en uno, recogiendo matas sin sumar a la racha
    await page.evaluate(() => { game.select(null); game.harvest('wheat'); });
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await page.evaluate(() => { game.sniper.flyers.next = Infinity; game.sniper.walkers.reset(); game.sniper.walkers.next = Infinity; });
    expect(await page.evaluate(() => [!!game.sniper.turrets.turret, game.sniper.turrets.masts.length])).toEqual([true, 4]);
    // Salta siempre al mástil de al lado (nunca en diagonal), y en el mapa a la esquina de al lado
    const sides = await page.evaluate(() => {
        const out = [], T = game.sniper.turrets, v = game.farm.fields.wheat, ft = v.turret;
        for (let k = 0; k < 16; k++) {
            let a = T.turret.corner;
            T.turret.hop = null;
            T.hop();
            out.push((T.turret.corner - a + 4) % 4);
            a = ft.corner;
            ft.hop = null;
            ft.tgt = null;
            ft.hopT = 0;
            game.farm.updateTurrets(v, 0.016, false);
            out.push((ft.corner - a + 4) % 4);
        }
        return [...new Set(out)].sort();
    });
    expect(sides.every((d) => d === 1 || d === 3)).toBe(true);
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
    const total = await page.evaluate(() => game.sniper.field.remaining);
    await expect.poll(() => page.evaluate(() => game.sniper.field.remaining), { timeout: 15_000 }).toBeLessThan(total - 1);
    expect(await page.evaluate(() => game.sniper.streak)).toBe(0);
    // Se guarda
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && !!game.farm.fields.wheat.turret)).toBe(true);
    expect(errors).toEqual([]);
});

test('comerciante: llega por su camino, monta el puesto, pide cosecha y paga en oro; luego se va', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => game.farm.introT > 2.5)).toBe(true);
    // Sin él (en las pruebas empieza fuera): su zona vacía y el cartel dice que está fuera
    expect(await page.evaluate(() => [game.farm.camp.present, game.farm.camp.wagon.visible])).toEqual([false, false]);
    await expect(page.locator('#sign-merchant')).toContainText('FUERA');
    // Llega: el carro entra por el camino y monta el puesto (con su aviso)
    await page.evaluate(() => { game.merchantClock.force = 'here'; });
    await expect(page.locator('#stage')).toContainText('MERCADER');
    await expect.poll(() => page.evaluate(() => game.farm.camp.open), { timeout: 15_000 }).toBe(true);
    expect(await page.evaluate(() => [game.farm.camp.wagon.visible, game.farm.camp.man.visible, game.farm.camp.fireLit])).toEqual([true, true, true]);
    await expect(page.locator('#sign-merchant')).toContainText('MERCADER');
    // Sus encargos: 3, de lo que da la granja; sin cosecha no se entregan (la cámara va a su zona:
    // desde el principio queda fuera de la pantalla del móvil)
    await page.evaluate(() => { game.rig.focus(37, -15); game.rig.zoomTarget = 0.8; });
    await page.locator('#sign-merchant').click();
    await expect(page.locator('#merchant')).toBeVisible();
    await expect(page.locator('.order')).toHaveCount(3);
    await expect(page.locator('#order-0 button')).toBeDisabled();
    const o = await page.evaluate(() => game.state.ordersFor(game.merchantClock.visit)[0]);
    expect(o.crop).toBe('wheat');
    // Con la cosecha justa: se entrega, se cobra en oro y queda HECHO
    await page.evaluate((n) => { game.state.items.wheat = n; }, o.n);
    await expect(page.locator('#order-0 button')).toBeEnabled();
    await page.locator('#order-0 button').click();
    expect(await page.evaluate(() => [game.state.items.wheat, game.state.items.gold])).toEqual([0, o.gold]);
    await expect(page.locator('#order-0')).toHaveClass(/done/);
    await expect(page.locator('#gold-count')).toHaveText(String(o.gold));
    // Se guarda (los encargos de esta visita, con lo entregado, y el oro)
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && [game.state.items.gold, game.state.merchant.orders[0].done])).toEqual([o.gold, true]);
    // Se va: recoge el puesto y su carro sale por el camino
    await page.evaluate(() => { game.merchantClock.force = 'away'; });
    await expect.poll(() => page.evaluate(() => game.farm.camp.wagon.visible), { timeout: 15_000 }).toBe(false);
    expect(errors).toEqual([]);
});

test('cuadrícula de 3×3 parcelas: las de PRONTO, abandonadas y en sombra; el botón MAPA lo enseña todo y vuelve', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    // Las de las esquinas y la de abajo: abandonadas, en sombra y sin nada que comprar
    for (const [id, x, z] of [['nw', -15, -15], ['sw', -15, 45], ['south', 5, 45], ['se', 45, 45]]) {
        expect(await page.evaluate(([id, x, z]) => [game.farm.shadeOf(id, x, z), game.farm.kindAt(x, z) && game.farm.kindAt(x, z).wild, id in game.state.lands], [id, x, z])).toEqual([1, true, false]);
    }
    // Vista global y vuelta
    const zoom0 = await page.evaluate(() => game.rig.zoomTarget);
    await page.locator('#btn-map').click();
    await expect(page.locator('#btn-map')).toHaveClass(/on/);
    expect(await page.evaluate(() => [game.rig.zoomTarget > 4.5, game.rig.fx, game.rig.fz])).toEqual([true, 15, 15]);
    await page.locator('#btn-map').click();
    await expect(page.locator('#btn-map')).not.toHaveClass(/on/);
    expect(await page.evaluate(() => game.rig.zoomTarget)).toBe(zoom0);
    expect(errors).toEqual([]);
});
