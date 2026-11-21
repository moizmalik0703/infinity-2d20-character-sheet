const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
// Load the exact checked-out build instead of racing Pages publication.
const url='https://moizmalik0703.github.io/infinity-2d20-character-sheet/';
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
test.setTimeout(120000);
test.use({viewport:{width:393,height:852},screenshot:'only-on-failure',trace:'retain-on-failure'});

async function openLocalBuild(page){
  await page.route(url,route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await expect(page.locator('input[data-field="characterName"]')).toBeVisible();
}

test('iPhone 15 and nearby sizes: single-column identity, compact two-column controls',async({page})=>{
  await openLocalBuild(page);
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
  await openLocalBuild(page);
  await page.setViewportSize({width:320,height:700});
  const cols=await page.evaluate(()=>{
    const count=q=>getComputedStyle(document.querySelector(q)).gridTemplateColumns.trim().split(/\s+/).length;
    return [count('.identity-grid'),count('.actions'),count('.main-skills'),count('.track-grid')];
  });
  expect(cols).toEqual([1,1,1,1]);
});
