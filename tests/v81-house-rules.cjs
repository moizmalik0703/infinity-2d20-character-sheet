const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const dataCode = fs.readFileSync("data.js", "utf8");
const appCode = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
new vm.Script(appCode, {filename:"app.js"});
const context = {window:{}};
vm.runInNewContext(dataCode, context, {filename:"data.js"});
const DATA = context.window.INFINITY_DATA;
assert.equal(context.window.INFINITY_BUILD, "v81-approved-house-rules");
assert.equal(DATA.traits.length, 318);
assert.equal(DATA.talents.length, 203);
for(const [key, expected] of [["traits",83],["talents",69]]) {
  const list = DATA[key];
  assert.equal(list.filter(x=>x.rulesReview==="Approved workbook").length, expected);
  assert.equal(new Set(list.map(x=>x.name.toLowerCase())).size, list.length);
  assert.ok(list.every(x=>x.rulesClassification==="Custom House Rule" && x.effect));
  assert.equal(JSON.stringify(DATA.lists[key==="traits"?"traitNames":"talentNames"]),JSON.stringify(list.map(x=>x.name)));
}
assert.ok(html.includes('data.js?v=v81-approved-house-rules'));
assert.ok(html.includes('app.js?v=v81-approved-house-rules'));
assert.ok(html.includes('id="v81HouseRuleGuide"'));
const range = (start,end) => {
  const i=appCode.indexOf(start), j=appCode.indexOf(end,i);
  assert.ok(i>=0&&j>i, start);
  return appCode.slice(i,j);
};
const testContext = {DATA, window:context.window, console, Set};
const selection = {traits:[],talents:[]};
testContext.selectedTraitObjects = ()=>selection.traits;
testContext.selectedTalentObjects = ()=>selection.talents;
testContext.selectedAlephFoundation = ()=>null;
testContext.document = {querySelectorAll:()=>[],querySelector:()=>null};
vm.runInNewContext(
  range("const mainSkills =", "function makeOptions(") +
  range("const LEGACY_TRAIT_TALENT_ALIASES =", "function alphaCompare(") +
  range("function normalizeSkillName(", "function baseRating(") +
  range("function approvedAbilityChain(", "// Show situational bonuses"),
  testContext);
const find = (key,name)=>DATA[key].find(x=>x.name===name);
function run(expr){return vm.runInNewContext(expr,testContext);}
assert.equal(run('parentOf.Acrobatics'),"Agility");
assert.ok(run('!subSkills.includes("Agility")'));
assert.equal(run('byName(DATA.traits,"Tactical Perception").name'),"Tactical Awareness");
assert.equal(run('byName(DATA.traits,"Berserk").name'),"Dogged");
assert.equal(run('byName(DATA.talents,"Counter-Intel").name'),"Counter Intelligence");
assert.equal(run('byName(DATA.traits,"Counter Intelligence").name'),"Counter Intelligence");
selection.traits = [find("traits","Cammo - TO 2"),find("traits","Cammo - TO 1")];
selection.talents = [find("talents","Marksman Level 3"),find("talents","Marksman Level 1")];
let bonuses=run('calculateSkillBonuses().direct');
assert.equal(bonuses.Discipline,4); // Cammo +1, Marksman levels 1–3 +3
assert.equal(bonuses.Survival,2); // Cammo +1, Marksman L3 +1
assert.equal(bonuses.Stealth,1);
assert.equal(bonuses.Agility,0);
selection.traits = [];
selection.talents = [find("talents","Spy")];
run('talentGrantChoices = {"Counter Intelligence|Intelligence":"Hacking","Espionage|Intelligence":"Medicine","Espionage|Awareness":"Observation","Spy|Intelligence":"Tech","Spy|Awareness":"Survival"}');
bonuses=run('calculateSkillBonuses().direct');
for(const skill of ["Hacking","Medicine","Observation","Tech","Survival"]) assert.equal(bonuses[skill],1,skill);
assert.equal(bonuses.Intelligence,0);
assert.match(find("traits","Mimetism").effect,/1 Heat/);
assert.equal(find("talents","Medicine - Doctor+").level,"3");
assert.equal(find("talents","Fire Team Master").prerequisite,"Fire Team Leader");
assert.equal(find("traits","Cammo - TO 1").prerequisite,"Cammo - Normal");
assert.ok(DATA.vehicleWorkshop);
console.log("PASS: syntax, data integrity, build assets, approved counts, rank deduplication, skill choices, aliases and retained vehicle workshop.");
