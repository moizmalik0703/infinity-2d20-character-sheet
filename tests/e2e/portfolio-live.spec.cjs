const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const site = process.env.PORTFOLIO_URL || 'https://moizmalik0703.github.io/infinity-2d20-character-sheet/';
test.setTimeout(120000);
test.use({viewport:{width:1440,height:900}, trace:'retain-on-failure', screenshot:'only-on-failure'});

async function openPortfolio(page) {
  await page.goto(site, {waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('#v80VehicleWorkshop').waitFor({state:'attached',timeout:45000});
  await expect(page.locator('#v80Catalog')).toHaveCount(1);
}
async function addVehicle(page,name) {
  await page.locator('#v80Catalog').selectOption(name);
  await page.locator('#v80AddVehicle').click();
  await expect(page.locator('#v80Roster option')).toHaveCount(1);
}

test('01 live deployment — V80 mounts with V79 provenance and unchanged loadout slots',async({page})=>{
  const errors=[];
  page.on('pageerror', e=>errors.push(String(e)));
  await openPortfolio(page);
  const result=await page.evaluate(()=>{
    const vehicles=DATA.equipment.filter(e=>e.type==='Vehicle');
    const audit=DATA.equipment.filter(e=>e.provenanceAudit?.version==='V79');
    const verified=audit.filter(e=>e.provenanceAudit.status==='core-verified').length;
    const related=audit.filter(e=>e.provenanceAudit.status==='related-core-only').length;
    const unresolved=audit.filter(e=>e.provenanceAudit.status==='unverified').length;
    return {
      build:document.documentElement.dataset.infinityBuild,
      count:vehicles.length, upgrades:DATA.vehicleWorkshop.upgrades.length,
      loaded:!!document.getElementById('v80VehicleWorkshop'),
      weapons:document.querySelectorAll('select[data-weapon-select]').length,
      equipment:document.querySelectorAll('select[data-equipment-select]').length,
      vehicleSlots:vehicles.filter(e=>e.loadoutEligible!==false).length,
      verified, related, unresolved, audited:audit.length
    };
  });
  expect(result.build).toBe('v80-vehicle-tag-workshop');
  expect(result.loaded).toBe(true);
  expect(result.count).toBe(37);
  expect(result.upgrades).toBe(50);
  expect(result.weapons).toBe(5);
  expect(result.equipment).toBe(10);
  expect(result.vehicleSlots).toBe(0);
  expect([result.audited,result.verified,result.related,result.unresolved]).toEqual([261,141,42,78]);
  expect(errors).toEqual([]);
});

test('02 garage — actual clicks, independent loadout, real hardpoint capacity',async({page})=>{
  await openPortfolio(page);
  await page.locator('input[data-field="characterName"]').fill('V80-BROWSER-QA-TEST');
  const before=await page.evaluate(()=>[...document.querySelectorAll('select[data-weapon-select],select[data-equipment-select]')].map(x=>x.value));
  await addVehicle(page,'Car');
  await page.locator('#v80Nickname').fill('QA Rover');
  await page.locator('#v80Pilot').fill('Rabbit');
  await page.locator('#v80Structure').fill('9');
  await page.locator('#v80Notes').fill('Test garage independence.');
  await page.locator('#v80UpgradeCategory').selectOption('Chassis');
  await page.locator('#v80Upgrade').selectOption('Automaintenance');
  await expect(page.locator('#v80Install')).toBeEnabled();
  await page.locator('#v80Install').click();
  await expect(page.locator('#v80Installed li')).toHaveCount(1);
  await page.locator('#v80Upgrade').selectOption('Automaintenance');
  await page.locator('#v80Install').click();
  await expect(page.locator('#v80Installed li')).toHaveCount(2);
  await expect(page.locator('#v80Install')).toBeDisabled();
  await expect(page.locator('#v80Hardpoints')).toContainText('Chassis 2/2');
  const after=await page.evaluate(()=>[...document.querySelectorAll('select[data-weapon-select],select[data-equipment-select]')].map(x=>x.value));
  expect(after).toEqual(before);
  await page.waitForTimeout(1100);
  const stored=await page.evaluate(()=>{
    const saves=Object.keys(localStorage).filter(k=>k.startsWith('infinity2d20-character-save:'));
    return saves.map(k=>JSON.parse(localStorage.getItem(k))).find(s=>s.characterName==='V80-BROWSER-QA-TEST');
  });
  expect(stored).toBeTruthy();
  const garage=JSON.parse(stored.vehicleWorkshopJson);
  expect(garage).toHaveLength(1);
  expect(garage[0]).toMatchObject({name:'Car',nickname:'QA Rover',pilot:'Rabbit',currentStructure:9});
  expect(garage[0].upgrades).toHaveLength(2);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#v80Roster').waitFor({state:'attached'});
  await expect(page.locator('#v80Roster option')).toHaveCount(1);
  await expect(page.locator('#v80Nickname')).toHaveValue('QA Rover');
  await expect(page.locator('#v80Structure')).toHaveValue('9');
});

test('03 TAGs cannot silently gain unlisted hardpoints; dossier downloads',async({page})=>{
  await openPortfolio(page);
  await addVehicle(page,'Cutter TAG');
  await expect(page.locator('#v80OwnedProfile')).toContainText('Cutter TAG');
  await expect(page.locator('#v80Hardpoints')).toContainText('Chassis 0/0');
  await expect(page.locator('#v80Install')).toBeDisabled();
  await page.locator('#v80UpgradeCategory').selectOption('Weapons');
  await expect(page.locator('#v80Install')).toBeDisabled();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#v80Download').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toContain('cutter-tag');
  const f=await download.path();
  const txt=fs.readFileSync(f,'utf8');
  expect(txt).toContain('Cutter TAG');
  expect(txt).toContain('Available hardpoints');
});

test('04 export/import XML roundtrip preserves garage',async({page})=>{
  await openPortfolio(page);
  await page.locator('input[data-field="characterName"]').fill('QA-XML-V80');
  await addVehicle(page,'Car');
  await page.locator('#v80Nickname').fill('XML Runner');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportXmlBtn').click();
  const dl=await downloadPromise;
  const xml=fs.readFileSync(await dl.path(),'utf8');
  expect(xml).toContain('vehicleWorkshopJson');
  expect(xml).toContain('XML Runner');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#v80RemoveVehicle').click();
  await expect(page.locator('#v80Roster option')).toHaveCount(0);
  await page.locator('#importXmlFile').setInputFiles({name:'qa-v80.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
  await expect(page.locator('#v80Roster option')).toHaveCount(1);
  await expect(page.locator('#v80Nickname')).toHaveValue('XML Runner');
});

test('05 mobile viewport — garage controls fit and remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openPortfolio(page);
  const bounds=await page.locator('#v80VehicleWorkshop').boundingBox();
  expect(bounds).toBeTruthy();
  expect(bounds.width).toBeLessThanOrEqual(410);
  await page.locator('#v80Catalog').selectOption('Motorcycle');
  await page.locator('#v80AddVehicle').click();
  await expect(page.locator('#v80Roster option')).toHaveCount(1);
});

test('06 new character starts with an empty vehicle garage, not the last character\'s assets',async({page})=>{
  await openPortfolio(page);
  await page.locator('input[data-field="characterName"]').fill('V80-QA-OLD-CHARACTER');
  await addVehicle(page,'Car');
  await expect(page.locator('#v80Roster option')).toHaveCount(1);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#newSheetBtn').click();
  await expect(page.locator('input[data-field="characterName"]')).toHaveValue('');
  await expect(page.locator('#v80Roster option')).toHaveCount(0);
  // Reopen the outgoing character: its vehicle should be preserved, not deleted.
  await page.locator('#characterSlotSelect').selectOption('v80-qa-old-character');
  await expect(page.locator('input[data-field="characterName"]')).toHaveValue('V80-QA-OLD-CHARACTER');
  await expect(page.locator('#v80Roster option')).toHaveCount(1);
});

test('07 printable portfolio references the separate vehicle garage',async({page})=>{
  await openPortfolio(page);
  await page.locator('input[data-field="characterName"]').fill('QA-PRINT-GARAGE');
  await addVehicle(page,'Car');
  await page.locator('#v80Nickname').fill('Campaign Rover');
  await page.evaluate(()=>buildPrintPortfolio());
  await expect(page.locator('#printPortfolio')).toContainText('Vehicle / TAG Garage');
  await expect(page.locator('#printPortfolio')).toContainText('Campaign Rover');
});
