const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const site = 'https://moizmalik0703.github.io/infinity-2d20-character-sheet/';
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
test.setTimeout(120000);
test.use({viewport:{width:1280,height:900},screenshot:'only-on-failure',trace:'retain-on-failure'});

async function openLocal(page) {
  await page.route(site,route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:60000});
  await expect(page.locator('select[data-trait-select="0"]')).toBeVisible();
}
const rating=(page,skill)=>page.locator('[data-rating="'+skill+'"]').innerText().then(Number);

test('Trait and Talent catalogue has no blank or invalid Primary/Secondary bonus labels',async({page})=>{
  await openLocal(page);
  const result=await page.evaluate(()=>{
    const valid=new Set([...subSkills,'Not applicable','Choose below']);
    const bad=[...DATA.traits,...DATA.talents].flatMap(item=>
      ['primary','secondary'].flatMap(field=>valid.has(item[field])?[]:[item.name+':'+field+':'+String(item[field])]));
    return {traits:DATA.traits.length,talents:DATA.talents.length,bad,
      single:DATA.traits.filter(t=>t.skillBonusMode==='source-single').length,
      choice:DATA.traits.filter(t=>t.skillBonusMode==='source-choice').length,
      special:DATA.traits.filter(t=>t.skillBonusMode==='special-effect').length,
      catfall:DATA.talents.find(t=>t.name==='Catfall')};
  });
  expect(result.traits).toBe(306);
  expect(result.talents).toBe(194);
  expect(result.bad).toEqual([]);
  expect([result.single,result.choice,result.special]).toEqual([12,3,40]);
  expect(result.catfall.primary).toBe('Athletics');
  expect(result.catfall.secondary).toBe('Not applicable');
  expect(result.catfall.skillMappingNote).toContain('Acrobatics');
});

test('Single-skill source Trait grants exactly one sub-skill Rating, not a main skill',async({page})=>{
  await openLocal(page);
  const oldSurvival=await rating(page,'Survival');
  const oldAwareness=await rating(page,'Awareness');
  await page.locator('select[data-trait-select="0"]').selectOption('Grizzled');
  await expect(page.locator('[data-trait-primary="0"]')).toHaveText('Survival');
  await expect(page.locator('[data-trait-secondary="0"]')).toHaveText('Not applicable');
  expect(await rating(page,'Survival')).toBe(oldSurvival+1);
  expect(await rating(page,'Awareness')).toBe(oldAwareness);
  await page.locator('select[data-trait-select="0"]').selectOption('Lucky');
  await expect(page.locator('[data-trait-primary="0"]')).toHaveText('Not applicable');
  expect(await rating(page,'Survival')).toBe(oldSurvival);
});

test('Two choice-based Traits work independently and persist in an XML roundtrip',async({page})=>{
  await openLocal(page);
  const oldAnimal=await rating(page,'Animal Handling');
  const oldSurvival=await rating(page,'Survival');
  const oldBallistics=await rating(page,'Ballistics');
  await page.locator('select[data-trait-select="0"]').selectOption('Raised in a Barn');
  await page.locator('select[data-trait-select="1"]').selectOption('Survivor');
  const first=page.locator('select[data-trait-bonus-choice="0"]');
  const second=page.locator('select[data-trait-bonus-choice="1"]');
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await first.selectOption('Animal Handling');
  await second.selectOption('Ballistics');
  expect(await rating(page,'Animal Handling')).toBe(oldAnimal+1);
  expect(await rating(page,'Ballistics')).toBe(oldBallistics+1);
  expect(await rating(page,'Survival')).toBe(oldSurvival);
  await first.selectOption('Survival');
  expect(await rating(page,'Animal Handling')).toBe(oldAnimal);
  expect(await rating(page,'Survival')).toBe(oldSurvival+1);
  const fromXml=await page.evaluate(()=>characterXmlToState(characterStateToXml(collectState())));
  expect(fromXml.traitBonusChoices.slice(0,2)).toEqual(['Survival','Ballistics']);
  await page.evaluate(state=>applyState(state),fromXml);
  await expect(first).toHaveValue('Survival');
  await expect(second).toHaveValue('Ballistics');
  expect(await rating(page,'Survival')).toBe(oldSurvival+1);
  expect(await rating(page,'Ballistics')).toBe(oldBallistics+1);
});

test('Conditional Thievery starts at zero; Catfall maps to Athletics only',async({page})=>{
  await openLocal(page);
  const oldThievery=await rating(page,'Thievery');
  const oldAthletics=await rating(page,'Athletics');
  const oldBrawn=await rating(page,'Brawn');
  await page.locator('select[data-trait-select="0"]').selectOption('It Takes One to Know One');
  expect(await rating(page,'Thievery')).toBe(oldThievery);
  await page.locator('select[data-trait-bonus-choice="0"]').selectOption('Thievery');
  expect(await rating(page,'Thievery')).toBe(oldThievery+1);
  await page.locator('select[data-talent-select="0"]').selectOption('Catfall');
  await expect(page.locator('[data-talent-primary="0"]')).toHaveText('Athletics');
  await expect(page.locator('[data-talent-secondary="0"]')).toHaveText('Not applicable');
  expect(await rating(page,'Athletics')).toBe(oldAthletics+1);
  expect(await rating(page,'Brawn')).toBe(oldBrawn);
});
