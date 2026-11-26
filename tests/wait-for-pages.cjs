// A Pages deployment is asynchronous. Refuse to run live tests against stale or mixed assets.
const fs = require('node:fs');
const crypto = require('node:crypto');
const baseline = require('./fixtures/v81-baseline.json');
const site = process.env.PORTFOLIO_URL || 'https://moizmalik0703.github.io/infinity-2d20-character-sheet/';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const expected = Object.fromEntries(['data.js','app.js'].map(name=>[name,hash(fs.readFileSync(name))]));
async function fetchAsset(name, attempt) {
  const url = new URL(name,site);
  url.searchParams.set('qa', (process.env.GITHUB_SHA || baseline.qaVersion) + '-' + attempt);
  const response = await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error(url.pathname+' returned HTTP '+response.status);
  return Buffer.from(await response.arrayBuffer());
}
(async()=>{
  for(let attempt=1;attempt<=30;attempt++){
    try {
      const [html, data, app] = await Promise.all(['index.html','data.js','app.js'].map(name=>fetchAsset(name,attempt)));
      const page = html.toString('utf8');
      if(!page.includes('content="'+baseline.build+'"') ||
         !page.includes('data.js?v='+baseline.build) ||
         !page.includes('app.js?v='+baseline.build)) throw new Error('HTML build marker or script versions differ');
      if(hash(data)!==expected['data.js'] || hash(app)!==expected['app.js']) throw new Error('Published JS does not match checked-out JS');
      console.log('PASS: public Pages HTML build '+baseline.build+' and both JS SHA-256 hashes match checkout.');
      console.log('data.js SHA-256 '+expected['data.js']);
      console.log('app.js SHA-256 '+expected['app.js']);
      return;
    } catch(err) {
      console.log('Pages verification attempt '+attempt+': '+err.message);
      if(attempt===30) throw err;
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
