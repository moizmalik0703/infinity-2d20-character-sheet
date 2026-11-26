const baseline = require('../fixtures/v81-baseline.json');
const { test, expect } = require('@playwright/test');

const site = process.env.PORTFOLIO_URL || 'https://moizmalik0703.github.io/infinity-2d20-character-sheet/';
test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(90000);
const rating = (page, skill) => page.locator('[data-rating="' + skill + '"]').innerText().then(Number);

test('Charismatic grants a situational reroll; never silently increases Ratings', async ({ page }) => {
  await page.goto(site, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('select[data-trait-select="0"]')).toBeVisible();
  const persuade = await rating(page, 'Persuade');
  const lifestyle = await rating(page, 'Lifestyle');
  await page.locator('select[data-trait-select="0"]').selectOption('Charismatic');
  expect(await rating(page, 'Persuade')).toBe(persuade);
  expect(await rating(page, 'Lifestyle')).toBe(lifestyle);
  await expect(page.locator('[data-trait-effect="0"]')).toContainText('reroll one d20');
  await expect(page.locator('[data-skill-rule="Persuade"]')).toContainText('situational effect');
  expect(await page.locator('[data-skill-rule="Persuade"]').getAttribute('title')).toContain('reroll one d20');
});

test('Talent situational effects stay separate from explicit permanent Rating grants', async ({ page }) => {
  await page.goto(site, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('select[data-talent-select="0"]')).toBeVisible();
  const athletics = await rating(page, 'Athletics');
  const analysis = await rating(page, 'Analysis');
  const resistance = await rating(page, 'Resistance');
  for (const name of ['Catfall', 'Pattern Recognition', 'Sturdy']) {
    await page.locator('select[data-talent-select="0"]').selectOption(name);
    expect(await rating(page, 'Athletics')).toBe(athletics);
    expect(await rating(page, 'Analysis')).toBe(analysis);
    expect(await rating(page, 'Resistance')).toBe(resistance);
  }
  const talentSlot = page.locator('select[data-talent-select="0"]');
  // Inject a catalogue item into a test-only choice to exercise its effect:
  // career restrictions affect eligibility, not the Rating algorithm.
  await page.evaluate(() => {
    const select = document.querySelector('select[data-talent-select="0"]');
    select.add(new Option('Animal Handler', 'Animal Handler'));
  });
  const animalBefore = await rating(page, 'Animal Handling');
  const commandBefore = await rating(page, 'Command');
  await talentSlot.selectOption('Animal Handler');
  const animal = await rating(page, 'Animal Handling');
  const command = await rating(page, 'Command');
  expect(animal).toBe(animalBefore + 1);
  expect(command).toBe(commandBefore);
  await expect(page.locator('[data-talent-effect="0"]')).toContainText('+1d20');
  expect(await page.locator('[data-skill-rule="Animal Handling"]').getAttribute('title')).toContain('+1d20');
  await talentSlot.selectOption('');
  expect(await rating(page, 'Animal Handling')).toBe(animalBefore);
});

test('Explicit grants persist, and XML reload does not convert situational effects into Rating', async ({ page }) => {
  await page.goto(site, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('select[data-trait-select="0"]')).toBeVisible();
  const survival = await rating(page, 'Survival');
  const persuade = await rating(page, 'Persuade');
  const athletics = await rating(page, 'Athletics');
  await page.locator('select[data-trait-select="0"]').selectOption('Grizzled');
  await page.locator('select[data-trait-select="1"]').selectOption('Charismatic');
  await page.locator('select[data-talent-select="0"]').selectOption('Catfall');
  expect(await rating(page, 'Survival')).toBe(survival + 1);
  expect(await rating(page, 'Persuade')).toBe(persuade);
  expect(await rating(page, 'Athletics')).toBe(athletics);
  const state = await page.evaluate(() => characterXmlToState(characterStateToXml(collectState())));
  await page.evaluate(state => applyState(state), state);
  expect(await rating(page, 'Survival')).toBe(survival + 1);
  expect(await rating(page, 'Persuade')).toBe(persuade);
  expect(await rating(page, 'Athletics')).toBe(athletics);
});

test('No ordinary Trait/Talent or inherited main skill label is a generic +1 Rating grant', async ({ page }) => {
  await page.goto(site, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('select[data-trait-select="0"]')).toBeVisible();
  const data = await page.evaluate(() => ({
    traits: DATA.traits.length,
    talents: DATA.talents.length,
    explicitSingle: DATA.traits.filter(t => t.skillBonusMode === 'source-single').length,
    explicitChoice: DATA.traits.filter(t => t.skillBonusMode === 'source-choice').length,
    mappedCore: DATA.talents.filter(t => t.skillBonusMode === 'source-single').map(t => t.name),
    resultKeys: Object.keys(calculateSkillBonuses()),
    mainSkillsHaveFocus: mainSkills.some(s => document.querySelector('[data-focus="' + s + '"]')),
    mainRating: skillRatingParts('Awareness').traitTalentBonus
  }));
  expect([data.traits, data.talents, data.explicitSingle, data.explicitChoice]).toEqual([baseline.counts.traits, baseline.counts.talents, baseline.counts.legacySingle, baseline.counts.legacyChoice]);
  expect(data.mappedCore.sort()).toEqual(['Catfall', 'Pattern Recognition', 'Sturdy']);
  expect(data.resultKeys.sort()).toEqual(['details', 'direct']);
  expect(data.mainSkillsHaveFocus).toBe(false);
  expect(data.mainRating).toBe(0);
});
