const { test, expect } = require('@playwright/test');

const site = process.env.PORTFOLIO_URL || 'https://moizmalik0703.github.io/infinity-2d20-character-sheet/';
test.setTimeout(120000);
test.use({ viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' });

async function openLive(page) {
  const scriptErrors = [];
  page.on('pageerror', err => scriptErrors.push(String(err)));
  await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(page.locator('select[data-trait-select="0"]')).toBeAttached({ timeout: 45000 });
  await expect(page.locator('select[data-talent-select="0"]')).toBeAttached();
  return scriptErrors;
}

test('live data.js includes all corrected Traits and Talents with no blank display fields', async ({ page }) => {
  const scriptErrors = await openLive(page);
  const audit = await page.evaluate(() => {
    const reqTrait = ['name','category','primary','secondary','brief','effect','rarity','cost','restriction','source'];
    const reqTalent = ['name','category','career','faction','restriction','level','primary','secondary','description','effect','prerequisite','rarity','cost','source'];
    const missing = (rows, keys) => rows.flatMap(row =>
      keys.filter(k => row[k] == null || String(row[k]).trim() === '').map(k => row.name + ':' + k));
    const wanted = ['Catfall','Pattern Recognition','Sturdy'];
    return {
      traits: DATA.traits.length,
      talents: DATA.talents.length,
      missingTraits: missing(DATA.traits, reqTrait),
      missingTalents: missing(DATA.talents, reqTalent),
      lifepath: DATA.traits.filter(t=>t.rarity==='Lifepath Event' && t.cost==='Granted by Lifepath').length,
      heritage: DATA.traits.filter(t=>t.rarity==='Heritage' && t.cost==='Granted by Lifepath').length,
      core: wanted.map(name=>{
        const t=DATA.talents.find(x=>x.name===name);
        return t && { name:t.name, career:t.career, faction:t.faction, rarity:t.rarity, cost:t.cost, pricingNote:t.pricingNote };
      })
    };
  });
  expect(audit.traits).toBe(306);
  expect(audit.talents).toBe(194);
  expect(audit.missingTraits).toEqual([]);
  expect(audit.missingTalents).toEqual([]);
  expect(audit.lifepath).toBe(51);
  expect(audit.heritage).toBe(3);
  expect(audit.core.map(t=>[t.name,t.career,t.faction,t.rarity,t.cost])).toEqual([
    ['Catfall','General / Unrestricted','All Factions','Common','5'],
    ['Pattern Recognition','General / Unrestricted','All Factions','Common','5'],
    ['Sturdy','General / Unrestricted','All Factions','Common','5'],
  ]);
  expect(audit.core.every(t=>t.pricingNote.includes('house-rule'))).toBe(true);
  expect(scriptErrors).toEqual([]);
});

test('live UI displays corrected rarity, cost and eligibility when records are selected', async ({ page }) => {
  const errors = await openLive(page);
  const trait = page.locator('select[data-trait-select="0"]');
  await trait.selectOption('Amateur Archaeologist');
  await expect(page.locator('[data-trait-rarity="0"]')).toHaveText('Lifepath Event');
  await expect(page.locator('[data-trait-cost="0"]')).toHaveText('Granted by Lifepath');
  await expect(page.locator('[data-trait-brief="0"]')).not.toBeEmpty();
  await expect(page.locator('[data-trait-effect="0"]')).not.toBeEmpty();

  const talent = page.locator('select[data-talent-select="0"]');
  for (const name of ['Catfall','Pattern Recognition','Sturdy']) {
    await talent.selectOption(name);
    await expect(page.locator('[data-talent-career="0"]')).toHaveText('General / Unrestricted');
    await expect(page.locator('[data-talent-rarity="0"]')).toHaveText('Common');
    await expect(page.locator('[data-talent-cost="0"]')).toHaveText('5');
    await expect(page.locator('[data-talent-description="0"]')).not.toBeEmpty();
    await expect(page.locator('[data-talent-effect="0"]')).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});
