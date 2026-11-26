const { test, expect } = require('@playwright/test');
// Use the full local checkout for PR testing or the full public deployment for live testing.
const url=process.env.PORTFOLIO_URL || 'https://moizmalik0703.github.io/infinity-2d20-character-sheet/';
test.setTimeout(120000);
test.use({viewport:{width:393,height:852},screenshot:'only-on-failure',trace:'retain-on-failure'});

async function openSheet(page){
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await expect(page.locator('input[data-field="characterName"]')).toBeVisible();
}

test('iPhone 15 and nearby sizes: single-column identity, compact two-column controls',async({page})=>{
  await openSheet(page);
  for (const width of [375,390,393,430]) {
    await page.setViewportSize({width,height:852});
    const result=await page.evaluate(()=>{
      const columns=selector=>getComputedStyle(document.querySelector(selector)).gridTemplateColumns.trim().split(/\s+/).length;
      const id=document.querySelector('.identity-grid').getBoundingClientRect();
      const labels=[...document.querySelectorAll('.identity-grid > label')].filter(e=>e.getClientRects().length);
      const fits=labels.every(e=>{const r=e.getBoundingClientRect();return r.left>=id.left-2&&r.right<=id.right+2});
      const slot=document.querySelector('#characterSlotSelect').getBoundingClientRect();
      const bar=document.querySelector('.actions').getBoundingClientRect();
      return {identity:columns('.identity-grid'),actions:columns('.actions'),
        main:columns('.main-skills'),tracks:columns('.track-grid'),fits,
        fullWidthSave:slot.width>=bar.width-3,
        headerHeight:document.querySelector('.app-header').getBoundingClientRect().height};
    });
    expect(result.identity).toBe(1);
    expect(result.actions).toBe(2);
    expect(result.main).toBe(2);
    expect(result.tracks).toBe(2);
    expect(result.fits).toBe(true);
    expect(result.fullWidthSave).toBe(true);
    expect(result.headerHeight).toBeLessThan(500);
  }
});

test('320px narrow phones use one-column toolbar and tracks',async({page})=>{
  await openSheet(page);
  await page.setViewportSize({width:320,height:700});
  const cols=await page.evaluate(()=>{
    const count=q=>getComputedStyle(document.querySelector(q)).gridTemplateColumns.trim().split(/\s+/).length;
    return [count('.identity-grid'),count('.actions'),count('.main-skills'),count('.track-grid')];
  });
  expect(cols).toEqual([1,1,1,1]);
});
