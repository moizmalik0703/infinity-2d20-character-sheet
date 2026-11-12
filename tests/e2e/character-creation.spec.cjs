const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const site = process.env.PORTFOLIO_URL || 'https://moizmalik0703.github.io/infinity-2d20-character-sheet/';

test.setTimeout(120000);
test.use({ viewport:{ width:1440, height:900 }, screenshot:'only-on-failure', trace:'retain-on-failure' });

async function openSheet(page) {
  const jsErrors = [];
  page.on('pageerror', e=>jsErrors.push(String(e)));
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('#v80VehicleWorkshop').waitFor({state:'attached',timeout:45000});
  await page.locator('select[data-equipment-select="0"]').waitFor({state:'attached'});
  return jsErrors;
}
function autoDialogs(page) {page.on('dialog',dialog=>dialog.accept());}
async function populateManualPanO(page,name='QA-PAN0-OPERATIVE') {
  await page.locator('input[data-field="characterName"]').fill(name);
  await page.locator('input[data-field="player"]').fill('Browser QA');
  await page.locator('select[data-field="faction"]').selectOption('PanOceania');
  await page.locator('select[data-field="homeworld"]').selectOption('Varuna');
  await page.locator('select[data-field="career"]').selectOption('Fusilier');
  await page.locator('select[data-main-skill="Coordination"]').selectOption('10');
  await page.locator('select[data-focus="Observation"]').selectOption('+2');
  await page.locator('select[data-trait-select="0"]').selectOption({index:1});
  await page.locator('select[data-talent-select="0"]').selectOption({index:1});
  await page.locator('select[data-weapon-select="0"]').selectOption('Combi Rifle (BS)');
  await page.locator('select[data-weapon-select="1"]').selectOption('Pistol (Normal)');
  const items=['Armour - Combat Medium','Comlog','MediKit','Backpack','Grappling Hook'];
  for(let i=0;i<items.length;i++)
    await page.locator('select[data-equipment-select="'+i+'"]').selectOption(items[i]);
  await page.locator('input[data-weapon-note="0"]').fill('Calibrated sight');
  await page.locator('input[data-equipment-note="0"]').fill('Armor serial 149');
  await page.locator('textarea[data-field="scratchNotes"]').fill('Investigate strange signal.');
}

test('A complete manual PanO operative: faction, career, skills, focus, traits, gear, save, reload, print',async({page})=>{
  autoDialogs(page);
  const errors=await openSheet(page);
  const rating = skill => page.locator('[data-rating="'+skill+'"]').innerText();
  const before=Number(await rating('Ballistics'));
  const otherBefore=Number(await rating('Observation'));
  await populateManualPanO(page,'QA-MANUAL-V81');
  expect(Number(await rating('Ballistics'))-before).toBe(3);
  expect(Number(await rating('Pilot'))).toBe(Number(await rating('Spacecraft')));
  expect(Number(await rating('Observation'))).toBe(otherBefore);
  await expect(page.locator('select[data-focus="Coordination"]')).toHaveCount(0);
  await expect(page.locator('select[data-focus="Observation"]')).toHaveValue('+2');
  await expect(page.locator('select[data-field="armour"]')).toHaveValue('10');
  await expect(page.locator('select[data-field="homeworld"]')).toHaveValue('Varuna');
  await page.locator('#saveBtn').click();
  await expect(page.locator('#autosaveStatus')).toContainText('Saved');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#v80VehicleWorkshop').waitFor({state:'attached'});
  await expect(page.locator('input[data-field="characterName"]')).toHaveValue('QA-MANUAL-V81');
  await expect(page.locator('select[data-field="career"]')).toHaveValue('Fusilier');
  await expect(page.locator('select[data-field="homeworld"]')).toHaveValue('Varuna');
  await expect(page.locator('select[data-equipment-select="0"]')).toHaveValue('Armour - Combat Medium');
  await expect(page.locator('select[data-equipment-select="4"]')).toHaveValue('Grappling Hook');
  await expect(page.locator('input[data-weapon-note="0"]')).toHaveValue('Calibrated sight');
  await expect(page.locator('input[data-equipment-note="0"]')).toHaveValue('Armor serial 149');
  await expect(page.locator('select[data-field="armour"]')).toHaveValue('10');
  await page.evaluate(()=>buildPrintPortfolio());
  await expect(page.locator('#printPortfolio')).toContainText('QA-MANUAL-V81');
  await expect(page.locator('#printPortfolio')).toContainText('Combi Rifle');
  expect(errors).toEqual([]);
});

test('B manual focus allocation produces a visible, current summary',async({page})=>{
  await openSheet(page);
  await page.locator('select[data-focus="Observation"]').selectOption('+2');
  await page.locator('select[data-focus="Hacking"]').selectOption('+1');
  await expect(page.locator('#focusAllocationStatus')).toContainText('3 points');
  await expect(page.locator('#focusAllocationStatus')).toContainText('Observation +2');
});

test('C changing faction clears incompatible homeworld; saves require a valid pairing',async({page})=>{
  await openSheet(page);
  await page.locator('input[data-field="characterName"]').fill('QA-FACTION-CHANGE');
  await page.locator('select[data-field="faction"]').selectOption('PanOceania');
  await page.locator('select[data-field="homeworld"]').selectOption('Varuna');
  await page.locator('select[data-field="faction"]').selectOption('Nomads');
  await expect(page.locator('select[data-field="homeworld"]')).toHaveValue('');
  const worlds=await page.locator('select[data-field="homeworld"] option').allTextContents();
  expect(worlds).toContain('Tunguska');
  expect(worlds).not.toContain('Varuna');
  const alerts=[];
  page.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
  await page.locator('#saveBtn').click();
  expect(alerts.some(msg=>msg.includes('Homeworld'))).toBe(true);
  await page.locator('select[data-field="homeworld"]').selectOption('Tunguska');
  await page.locator('#saveBtn').click();
  await expect(page.locator('#characterSlotSelect')).toHaveValue('qa-faction-change');
});

test('D New fully clears old-character personal notes, skills, traits, gear and garage',async({page})=>{
  autoDialogs(page);
  await openSheet(page);
  await populateManualPanO(page,'QA-NEW-RESET');
  await page.locator('#v80Catalog').selectOption('Car');
  await page.locator('#v80AddVehicle').click();
  await expect(page.locator('#v80Roster option')).toHaveCount(1);
  await page.locator('#saveBtn').click();
  await page.locator('#newSheetBtn').click();
  await expect(page.locator('input[data-field="characterName"]')).toHaveValue('');
  await expect(page.locator('select[data-weapon-select="0"]')).toHaveValue('');
  await expect(page.locator('select[data-equipment-select="0"]')).toHaveValue('');
  await expect(page.locator('select[data-trait-select="0"]')).toHaveValue('');
  await expect(page.locator('select[data-talent-select="0"]')).toHaveValue('');
  await expect(page.locator('select[data-focus="Observation"]')).toHaveValue('');
  await expect(page.locator('select[data-main-skill="Coordination"]')).toHaveValue('7');
  await expect(page.locator('input[data-weapon-note="0"]')).toHaveValue('');
  await expect(page.locator('input[data-equipment-note="0"]')).toHaveValue('');
  await expect(page.locator('textarea[data-field="scratchNotes"]')).toHaveValue('');
  await expect(page.locator('#v80Roster option')).toHaveCount(0);
  await page.locator('#characterSlotSelect').selectOption('qa-new-reset');
  await expect(page.locator('input[data-weapon-note="0"]')).toHaveValue('Calibrated sight');
  await expect(page.locator('input[data-equipment-note="0"]')).toHaveValue('Armor serial 149');
  await expect(page.locator('#v80Roster option')).toHaveCount(1);
});

test('E repeat generated standard characters; all starting loadouts, focus and locations valid',async({page})=>{
  autoDialogs(page);
  await openSheet(page);
  for(let k=0;k<12;k++) {
    await page.locator('#randomCharacterBtn').click();
    const result=await page.evaluate(()=>{
      const state=collectState();
      const focusValues=Object.values(state.focus).map(x=>Number(String(x||'').replace('+',''))||0);
      const valid=homeworldsForFaction(state.faction).includes(state.homeworld);
      const allOptions=new Set(DATA.equipment.map(e=>e.name));
      return {
        name:state.characterName, faction:state.faction,homeworld:state.homeworld,valid,
        weapons:state.weapons.filter(Boolean),equipment:state.equipment.filter(Boolean),
        focus:focusValues.reduce((x,y)=>x+y,0),mainFocus:mainSkills.some(x=>Object.hasOwn(state.focus,x)),
        tracks:[state.hp,state.mentalStress,state.firewall,state.armour],
        gearKnown:[...state.weapons,...state.equipment].filter(Boolean).every(x=>allOptions.has(x))
      };
    });
    expect(result.valid,'Invalid homeworld for '+JSON.stringify(result)).toBe(true);
    expect(result.weapons,'Two weapons expected').toHaveLength(2);
    expect(result.equipment,'Five equipment expected').toHaveLength(5);
    expect(result.gearKnown).toBe(true);
    expect(result.focus).toBe(10);
    expect(result.mainFocus).toBe(false);
    expect(result.tracks.slice(0,3)).toEqual(['20','20','20']);
    expect(['5','10','15'].includes(result.tracks[3])).toBe(true);
  }
});

test('F repeat beginner builds; starter choices all exist, no stale fields, valid homeworlds',async({page})=>{
  autoDialogs(page);
  await openSheet(page);
  for(let k=0;k<12;k++) {
    await page.locator('#randomBeginnerCharacterBtn').click();
    const result=await page.evaluate(()=>{
      const s=collectState();
      return {
        name:s.characterName,
        valid:homeworldsForFaction(s.faction).includes(s.homeworld),
        weapons:s.weapons.filter(Boolean).length,
        equipment:s.equipment.filter(Boolean).length,
        traits:s.traits.filter(Boolean).length,
        talents:s.talents.filter(Boolean).length,
        focus:Object.values(s.focus).reduce((t,v)=>t+(Number(String(v||'').replace('+',''))||0),0),
        gearKnown:[...s.weapons,...s.equipment].filter(Boolean).every(x=>DATA.equipment.some(e=>e.name===x))
      };
    });
    expect(result.valid,'Bad beginner origin '+JSON.stringify(result)).toBe(true);
    expect(result.weapons).toBe(2);
    expect(result.equipment).toBe(5);
    expect(result.traits).toBe(1);
    expect(result.talents).toBe(1);
    expect(result.focus).toBe(5);
    expect(result.gearKnown).toBe(true);
  }
});

test('G XML roundtrip restores a fully populated non-vehicle manual character',async({page})=>{
  autoDialogs(page);
  await openSheet(page);
  await populateManualPanO(page,'QA-MANUAL-XML');
  const download=page.waitForEvent('download');
  await page.locator('#exportXmlBtn').click();
  const file=await download;
  const xml=fs.readFileSync(await file.path(),'utf8');
  expect(xml).toContain('QA-MANUAL-XML');
  expect(xml).toContain('Calibrated sight');
  await page.locator('#newSheetBtn').click();
  await expect(page.locator('select[data-weapon-select="0"]')).toHaveValue('');
  await page.locator('#importXmlFile').setInputFiles({name:'qa-manual.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
  await expect(page.locator('input[data-field="characterName"]')).toHaveValue('QA-MANUAL-XML');
  await expect(page.locator('select[data-field="homeworld"]')).toHaveValue('Varuna');
  await expect(page.locator('select[data-trait-select="0"]')).not.toHaveValue('');
  await expect(page.locator('select[data-talent-select="0"]')).not.toHaveValue('');
  await expect(page.locator('select[data-field="armour"]')).toHaveValue('10');
  await expect(page.locator('input[data-weapon-note="0"]')).toHaveValue('Calibrated sight');
});

test('H all listed faction choices have a usable homeworld origin',async({page})=>{
  await openSheet(page);
  const result=await page.evaluate(()=>{
    return DATA.lists.factions.map(faction=>{
      const sel=document.querySelector('select[data-field="faction"]');
      sel.value=faction;sel.dispatchEvent(new Event('change',{bubbles:true}));
      const home=document.querySelector('select[data-field="homeworld"]');
      const options=[...home.options].map(x=>x.value).filter(Boolean);
      return {faction,count:options.length,disabled:home.disabled};
    });
  });
  const invalid=result.filter(x=>x.count===0 || x.disabled);
  expect(invalid,JSON.stringify(invalid)).toEqual([]);
});
