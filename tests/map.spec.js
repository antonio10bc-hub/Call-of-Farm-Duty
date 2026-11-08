// Pruebas de el mapa de la granja: granero y sus niveles, mejorar campos, la casa y las partidas guardadas.
const { test, expect, frames, openFarm, screenOf, watchErrors } = require('./helpers');

test('la granja es un mapa: el granero (sin mejoras) abre el armamento con las dos secciones de rachas', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect(page.locator('#sign-wheat')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('#wheat-count')).toHaveText('0');
    const p = await screenOf(page, 'map', 15, 1.4, 11);
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('#streaks')).toBeVisible();
    // Dos secciones de rachas en la clase: de cultivos y de alienígenas, todas puestas de serie
    await expect(page.locator('#ks-card-cluster .kc-n')).toHaveText('10SEGUIDAS');
    await expect(page.locator('#ks-card-nuke .kc-n')).toHaveText('10ALIENIGENAS');
    await expect(page.locator('.lo-ks.on')).toHaveCount(6);
    // Tocar una la quita de la clase (y otra vez la pone)
    await page.locator('#ks-card-predator').click();
    await expect(page.locator('#ks-card-predator')).not.toHaveClass(/on/);
    expect(await page.evaluate(() => game.state.arsenal.loadout.ks.includes('predator'))).toBe(false);
    await page.locator('#ks-card-predator').click();
    await expect(page.locator('#ks-card-predator')).toHaveClass(/on/);
    // El granero no se mejora: ni botón ni nivel
    await expect(page.locator('#barn-upgrade')).toHaveCount(0);
    await page.evaluate(() => { game.state.items.wheat = 1000; game.state.items.tomato = 1000; game.upgradeBarn(); });
    expect(await page.evaluate(() => [game.state.barn.level, game.state.canUpgradeBarn])).toEqual([0, false]);
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
    await expect(page.locator('#bubbles .field-sign.ready')).toHaveCount(1, { timeout: 30_000 });
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
    await page.locator('#panel-action').click();
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
    await expect.poll(() => page.evaluate(() => window.game && [game.state.fields.wheat.left, game.state.fields.tomato.left]), { timeout: 30_000 }).toEqual([240, 40]);
    // Ya guardada con la revisión nueva: lo que se haya empezado a recoger se respeta
    await page.evaluate(() => { game.state.collect('wheat'); });
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.fields.wheat.left), { timeout: 30_000 }).toBe(239);
    expect(errors).toEqual([]);
});

test('casa: empieza en ruinas con la parcela sucia; 3 niveles la arreglan y limpian la parcela', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect.poll(() => page.evaluate(() => window.game && game.farm.introT > 2), { timeout: 60_000 }).toBe(true);
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

test('armería: en el granero se compran con oro y se montan mirillas, rifles y cargadores, cada uno con sus pegas', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    await page.evaluate(() => game.select({ structure: 'barn' }));
    // Las clases: 5 (en partida, las dos últimas se abren con el granero), la 1 equipada
    await expect(page.locator('.lo-class')).toHaveCount(5);
    await expect(page.locator('#class-0')).toHaveClass(/on/);
    // El arma y sus accesorios abren su lista: tres listas de 5; lo de serie viene montado
    await page.locator('#slot-rifle').click();
    await expect(page.locator('#gear-picker')).toBeVisible();
    await expect(page.locator('.gear-row')).toHaveCount(3);
    await expect(page.locator('.gear')).toHaveCount(15);
    for (const id of ['scope-std', 'rifle-bolt', 'mag-std']) await expect(page.locator(`#gear-${id}`)).toHaveClass(/on/);
    // Sin oro no se compra; con oro se compra y se monta (y la lista se cierra)
    await page.locator('#gear-rifle-semi').click();
    expect(await page.evaluate(() => game.state.arsenal.loadout.rifle)).toBe('bolt');
    await page.evaluate(() => { game.state.items.gold = 40; game.select({ structure: 'barn' }); });
    const pick = async (kind, id) => { await page.locator(`#slot-${kind}`).click(); await page.locator(`#gear-${kind}-${id}`).click(); await expect(page.locator('#gear-picker')).toBeHidden(); };
    await pick('rifle', 'semi');
    await expect(page.locator('#slot-rifle')).toContainText('SEMIAUTOM');
    await pick('scope', 'dot');
    await pick('mag', 'ext');
    const lo = () => page.evaluate(() => { const l = game.state.arsenal.loadout; return { scope: l.scope, rifle: l.rifle, mag: l.mag }; });
    expect([await lo(), await page.evaluate(() => game.state.items.gold)]).toEqual([{ scope: 'dot', rifle: 'semi', mag: 'ext' }, 40 - 10 - 8 - 12]);
    // Volver a lo de serie no cuesta nada (ya es tuyo)
    await pick('rifle', 'bolt');
    await pick('rifle', 'semi');
    expect(await page.evaluate(() => game.state.items.gold)).toBe(10);
    // Otra clase: se edita aparte y se equipa con su botón
    await page.locator('#class-1').click();
    await expect(page.locator('#slot-rifle')).toContainText('DE CERROJO');
    await page.locator('#class-equip').click();
    expect(await page.evaluate(() => game.state.arsenal.active)).toBe(1);
    await page.locator('#class-0').click();
    await page.locator('#class-equip').click();
    expect(await page.evaluate(() => game.state.arsenal.active)).toBe(0);
    // En el campo de tiro el fusil va con lo montado: punto rojo (poco zoom, se sube al momento),
    // semiautomático (rápido, sin colaterales) y cargador ampliado de 18
    await page.locator('#btn-streaks-close').click();
    await page.evaluate(() => game.harvest('wheat'));
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 20_000 }).toBe('snipe');
    expect(await page.evaluate(() => { const s = game.sniper.stats; return [s.lens, s.pierce, s.size, game.sniper.ammo, game.sniper.rifle.key]; })).toEqual(['dot', 1, 18, 18, 'dot|semi|ext']);
    await expect(page.locator('#ammo-n')).toHaveText('18');
    // Cada disparo gasta una bala; R recarga
    await page.evaluate(() => { game.sniper.ammo = 3; });
    await page.keyboard.press('r');
    await expect(page.locator('#ammo')).toHaveClass(/reloading/);
    await expect.poll(() => page.evaluate(() => game.sniper.ammo), { timeout: 10_000 }).toBe(18);
    // Se guarda
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.arsenal.loadout && game.state.arsenal.loadout.rifle)).toBe('semi');
    expect(await lo()).toEqual({ scope: 'dot', rifle: 'semi', mag: 'ext' });
    expect(errors).toEqual([]);
});

test('torreta: con el campo al máximo, la mejora extra pone una torreta que va de esquina en esquina y recoge sola (sin sumar a la racha); se gasta y se recarga con oro', { tag: '@full' }, async ({ page }) => {
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
    expect(await page.evaluate(() => [game.state.fields.wheat.turrets, !!game.farm.fields.wheat.turret, game.farm.fields.wheat.bases.length, game.state.wheat, game.state.fields.wheat.ammo])).toEqual([true, true, 4, 0, 60]);
    const left = await page.evaluate(() => game.state.fields.wheat.left);
    await page.evaluate(() => game.select({ field: 'wheat' }));
    await expect(page.locator('#upgrade-label')).toHaveText('AUTOMÁTICO');
    await page.evaluate(() => game.select(null));
    await expect(page.locator('#sign-wheat .turret-ico')).toHaveCount(1);
    // En el mapa no paran de disparar a ráfagas y recogen solas lo maduro, con su +1 de trigo
    await page.evaluate(() => {
        window.autoPops = 0;
        new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains('auto-pop')) window.autoPops++; }))).observe(document.body, { childList: true });
    });
    // (cuando acaba de bajar en paracaídas)
    await expect.poll(() => page.evaluate(() => !game.farm.fields.wheat.drop), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => game.farm.shots.length), { timeout: 5_000 }).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => game.state.wheat), { timeout: 12_000 }).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.autoPops)).toBeGreaterThan(0);
    expect(await page.evaluate(() => game.state.fields.wheat.left)).toBeLessThan(left);
    // Cada mata gasta una de su munición; sin ella se para (su cartel parpadea en rojo) y el botón
    // pasa a RECARGAR, que se paga con oro
    expect(await page.evaluate(() => game.state.fields.wheat.ammo)).toBeLessThan(60);
    await page.evaluate(() => { game.state.fields.wheat.ammo = 1; game.state.items.gold = 0; });
    await expect.poll(() => page.evaluate(() => game.state.fields.wheat.ammo), { timeout: 12_000 }).toBe(0);
    await expect(page.locator('#medals')).toContainText('TORRETA SIN MUNICIÓN');
    await expect(page.locator('#sign-wheat')).toHaveClass(/turret-empty/);
    await expect.poll(() => page.evaluate(() => [game.farm.fields.wheat.turret.off, game.farm.fields.wheat.turret.offK])).toEqual([true, 1]);
    const stopped = await page.evaluate(() => game.state.wheat);
    await page.evaluate(() => game.select({ field: 'wheat' }));
    await expect(page.locator('#upgrade-label')).toHaveText('RECARGAR');
    await expect(page.locator('#upgrade-cost')).toContainText('6');
    await expect(page.locator('#panel-upgrade')).toBeDisabled();
    expect(await page.evaluate(() => game.state.wheat)).toBe(stopped);
    await page.evaluate(() => { game.state.items.gold = 10; game.select({ field: 'wheat' }); });
    await expect(page.locator('#panel-upgrade')).toBeEnabled();
    await page.locator('#panel-upgrade').click();
    expect(await page.evaluate(() => [game.state.fields.wheat.ammo, game.state.items.gold])).toEqual([60, 4]);
    await expect(page.locator('#upgrade-label')).toHaveText('AUTOMÁTICO');
    await expect(page.locator('#sign-wheat')).not.toHaveClass(/turret-empty/);
    await expect.poll(() => page.evaluate(() => game.farm.fields.wheat.turret.off)).toBe(false);
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
    // Lo que recoge en el campo de tiro también gasta munición; sin ella, se para
    expect(await page.evaluate(() => game.state.fields.wheat.ammo)).toBeLessThan(60);
    await page.evaluate(() => { game.state.fields.wheat.ammo = 0; });
    await expect.poll(() => page.evaluate(() => game.sniper.turrets.turret.target)).toBe(null);
    const still = await page.evaluate(() => game.sniper.field.remaining);
    await frames(page, 30);
    expect(await page.evaluate(() => game.sniper.field.remaining)).toBe(still);
    // Se guarda (con su munición)
    await page.evaluate(() => { game.state.fields.wheat.ammo = 33; game.state.save(); });
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && !!game.farm.fields.wheat.turret)).toBe(true);
    expect(await page.evaluate(() => game.state.fields.wheat.ammo)).toBe(33);
    expect(errors).toEqual([]);
});

test('comerciante: su ovni disfrazado de coche recorre el surco, sale él, pide cosecha y paga en oro; luego se va', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => game.farm.introT > 2.5)).toBe(true);
    // Sin él (en las pruebas empieza fuera): su zona vacía y el cartel dice que está fuera
    expect(await page.evaluate(() => [game.farm.camp.present, game.farm.camp.ufo.visible, game.farm.camp.man.visible])).toEqual([false, false, false]);
    await expect(page.locator('#sign-merchant')).toContainText('FUERA');
    // Llega: el ovni entra volando, recorre el surco pegado al suelo y sale él (con su aviso)
    await page.evaluate(() => { game.merchantClock.force = 'here'; });
    await expect(page.locator('#stage')).toContainText('MERCADER');
    await expect.poll(() => page.evaluate(() => game.farm.camp.gliding), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => game.farm.camp.open), { timeout: 15_000 }).toBe(true);
    // Parado al final del surco, con él en su sitio junto a la mesa
    expect(await page.evaluate(() => {
        const c = game.farm.camp, u = c.ufo.position, m = c.man.position;
        return [c.ufo.visible, c.man.visible, c.goods.visible, Math.round(u.x * 10) / 10, Math.round(m.x * 10) / 10];
    })).toEqual([true, true, true, 38.1, 34.7]);
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
    // Se va: vuelve a entrar en el ovni, que sale por el surco y despega
    await page.evaluate(() => { game.merchantClock.force = 'away'; });
    await expect.poll(() => page.evaluate(() => game.farm.camp.ufo.visible), { timeout: 15_000 }).toBe(false);
    expect(errors).toEqual([]);
});

test('parcelas repartidas por el valle: las de PRONTO, abandonadas y en sombra; el botón MAPA lo enseña todo y vuelve', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    // Las de las esquinas y la de abajo: abandonadas, en sombra y sin nada que comprar
    for (const [id, x, z] of [['sw', -15, 45], ['south', 5, 45], ['se', 45, 45]]) {
        expect(await page.evaluate(([id, x, z]) => [game.farm.shadeOf(id, x, z), game.farm.kindAt(x, z) && game.farm.kindAt(x, z).wild, id in game.state.lands], [id, x, z])).toEqual([1, true, false]);
    }
    // Vista global y vuelta
    const zoom0 = await page.evaluate(() => game.rig.zoomTarget);
    await page.locator('#btn-map').click();
    await expect(page.locator('#btn-map')).toHaveClass(/on/);
    // (centrada en todo el valle, un poco hacia las montañas del fondo)
    expect(await page.evaluate(() => [game.rig.zoomTarget > 4.5, Math.round(game.rig.fx * 10) / 10, Math.round(game.rig.fz * 10) / 10])).toEqual([true, -8.5, -8.5]);
    await page.locator('#btn-map').click();
    await expect(page.locator('#btn-map')).not.toHaveClass(/on/);
    expect(await page.evaluate(() => game.rig.zoomTarget)).toBe(zoom0);
    expect(errors).toEqual([]);
});

test('claro del comerciante: un bosque con el surco del ovni, sin niveles ni mejoras', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    // El claro (con el surco) está limpio; el resto de su parcela es bosque. Siempre 3 encargos
    expect(await page.evaluate(() => [game.farm.kindAt(45, -19).yard, game.farm.kindAt(50, -26).wild, game.state.ordersFor(1).length, 'village' in game.state])).toEqual([true, true, 3, false]);
    // Su hoja no tiene mejora
    await page.evaluate(() => game.openMerchant());
    await expect(page.locator('#merchant')).toBeVisible();
    await expect(page.locator('#village-up')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('dock: CAMPOS abre encima otra barra con los cultivos desbloqueados y tocar uno lleva la cámara a su campo', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await page.evaluate(() => { game.state.unlock('tomato', Date.now(), true); while (game.revealUnlocked()); game.rig.focus(15, -15); });
    await page.locator('#dock-fields').click();
    await expect(page.locator('#fields-pop')).toBeVisible();
    await expect(page.locator('.dock-pop-btn')).toHaveText([/TRIGO/, /TOMATES/]);
    await page.locator('#pop-tomato').click();
    await expect(page.locator('#fields-pop')).toBeHidden();
    // (la cámara va al centro del campo, en su sitio del valle)
    const r = await page.evaluate(() => { const v = game.farm.views.find((q) => q.id === 'tomato').rect, w = game.farm.world(v.cx, 0, v.cz); return { cx: w.x, cz: w.z }; });
    await expect.poll(() => page.evaluate(() => [Math.round(game.rig.fx), Math.round(game.rig.fz)])).toEqual([Math.round(r.cx), Math.round(r.cz)]);
    // Tocar fuera lo cierra
    await page.locator('#dock-fields').click();
    await page.mouse.click(200, 200);
    await expect(page.locator('#fields-pop')).toBeHidden();
    expect(errors).toEqual([]);
});
