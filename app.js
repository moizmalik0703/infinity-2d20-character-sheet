const DATA = window.INFINITY_DATA;
const mainSkills = ["Agility","Awareness","Brawn","Coordination","Intelligence","Personality","Willpower"];
const skillGroups = {
  "Agility": ["Close Combat","Stealth"],
  "Awareness": ["Analysis","Extraplanetary","Observation","Survival","Thievery"],
  "Brawn": ["Athletics","Resistance"],
  "Coordination": ["Ballistics","Pilot","Spacecraft"],
  "Intelligence": ["Education","Hacking","Medicine","Psychology","Science","Tech"],
  "Personality": ["Animal Handling","Command","Lifestyle","Persuade"],
  "Willpower": ["Discipline"]
};
const skillOrder = [
  "Agility","Close Combat","Stealth","Awareness","Analysis","Extraplanetary","Observation","Survival","Thievery",
  "Brawn","Athletics","Resistance","Coordination","Ballistics","Pilot","Spacecraft",
  "Intelligence","Education","Hacking","Medicine","Psychology","Science","Tech",
  "Personality","Animal Handling","Command","Lifestyle","Persuade","Willpower","Discipline"
];
const parentOf = {};
Object.entries(skillGroups).forEach(([parent, children]) => children.forEach(child => parentOf[child] = parent));

function makeOptions(select, values, placeholder = "") {
  select.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = placeholder || "";
  select.appendChild(blank);
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}
function byName(list, name) {
  return list.find(x => x.name === name) || {};
}
function setText(el, value) {
  el.textContent = value || "";
}
function inputField(field) {
  return document.querySelector(`[data-field="${field}"]`);
}

function initLists() {
  document.querySelectorAll("select[data-list]").forEach(select => {
    const listName = select.dataset.list;
    makeOptions(select, DATA.lists[listName] || [], "Choose...");
  });
}

function buildMainSkills() {
  const wrap = document.getElementById("mainSkills");
  wrap.innerHTML = "";
  mainSkills.forEach(skill => {
    const label = document.createElement("label");
    label.textContent = skill;
    const sel = document.createElement("select");
    sel.dataset.mainSkill = skill;
    makeOptions(sel, DATA.lists.ratings, "");
    sel.value = "7";
    sel.addEventListener("change", updateSkillRatings);
    label.appendChild(sel);
    wrap.appendChild(label);
  });
}

function skillRating(skill) {
  if (mainSkills.includes(skill)) {
    return document.querySelector(`[data-main-skill="${skill}"]`)?.value || "7";
  }
  const parent = parentOf[skill];
  return document.querySelector(`[data-main-skill="${parent}"]`)?.value || "7";
}

function buildSkillTable(tableId, skills) {
  const table = document.getElementById(tableId);
  table.innerHTML = `<thead><tr><th>Skill</th><th>Rating</th><th>Focus</th><th>Notes</th><th>Rule</th></tr></thead>`;
  const body = document.createElement("tbody");
  skills.forEach(skill => {
    const tr = document.createElement("tr");
    if (mainSkills.includes(skill)) tr.classList.add("main-row");
    const focus = mainSkills.includes(skill)
      ? `<td>—</td>`
      : `<td><select data-focus="${skill}"></select></td>`;
    tr.innerHTML = `
      <td>${skill}</td>
      <td data-rating="${skill}">${skillRating(skill)}</td>
      ${focus}
      <td><input data-skill-note="${skill}"></td>
      <td>${mainSkills.includes(skill) ? "Main skill" : "Sub-skill"}</td>`;
    body.appendChild(tr);
  });
  table.appendChild(body);
  table.querySelectorAll("select[data-focus]").forEach(sel => makeOptions(sel, DATA.lists.focus, ""));
}
function updateSkillRatings() {
  document.querySelectorAll("[data-rating]").forEach(cell => {
    cell.textContent = skillRating(cell.dataset.rating);
  });
}

function buildTraits() {
  const wrap = document.getElementById("traitSlots");
  wrap.innerHTML = "";
  for (let i=0; i<3; i++) {
    const card = document.createElement("div");
    card.className = "card card-trait";
    card.innerHTML = `
      <label>Trait<select data-trait-select="${i}"></select></label>
      <label>Primary<div class="output" data-trait-primary="${i}"></div></label>
      <label>Secondary<div class="output" data-trait-secondary="${i}"></div></label>
      <label>Rarity<div class="output" data-trait-rarity="${i}"></div></label>
      <label>Cost<div class="output" data-trait-cost="${i}"></div></label>
      <label>Brief Description<div class="output big-text" data-trait-brief="${i}"></div></label>
      <label>Effect<div class="output big-text" data-trait-effect="${i}"></div></label>`;
    wrap.appendChild(card);
    const sel = card.querySelector(`[data-trait-select="${i}"]`);
    makeOptions(sel, DATA.lists.traitNames, "Choose trait...");
    sel.addEventListener("change", () => {
      const t = byName(DATA.traits, sel.value);
      setText(card.querySelector(`[data-trait-primary="${i}"]`), t.primary);
      setText(card.querySelector(`[data-trait-secondary="${i}"]`), t.secondary);
      setText(card.querySelector(`[data-trait-rarity="${i}"]`), t.rarity);
      setText(card.querySelector(`[data-trait-cost="${i}"]`), t.cost);
      setText(card.querySelector(`[data-trait-brief="${i}"]`), t.brief);
      setText(card.querySelector(`[data-trait-effect="${i}"]`), t.effect);
    });
  }
}

function buildTalents() {
  const wrap = document.getElementById("talentSlots");
  wrap.innerHTML = "";
  for (let i=0; i<3; i++) {
    const card = document.createElement("div");
    card.className = "card card-talent";
    card.innerHTML = `
      <label>Talent<select data-talent-select="${i}"></select></label>
      <label>Level<div class="output" data-talent-level="${i}"></div></label>
      <label>Career<div class="output" data-talent-career="${i}"></div></label>
      <label>Doctrine<div class="output" data-talent-doctrine="${i}"></div></label>
      <label>Faction<div class="output" data-talent-faction="${i}"></div></label>
      <label>Prereq<div class="output" data-talent-prereq="${i}"></div></label>
      <label>Primary<div class="output" data-talent-primary="${i}"></div></label>
      <label>Secondary<div class="output" data-talent-secondary="${i}"></div></label>
      <label>Restriction<div class="output" data-talent-restriction="${i}"></div></label>
      <label>Rarity<div class="output" data-talent-rarity="${i}"></div></label>
      <label>Cost<div class="output" data-talent-cost="${i}"></div></label>
      <label class="wide-text">Description<div class="output big-text" data-talent-description="${i}"></div></label>
      <label class="wide-text">Effect<div class="output big-text" data-talent-effect="${i}"></div></label>`;
    wrap.appendChild(card);
    const sel = card.querySelector(`[data-talent-select="${i}"]`);
    makeOptions(sel, DATA.lists.talentNames, "Choose talent...");
    sel.addEventListener("change", () => {
      const t = byName(DATA.talents, sel.value);
      ["level","career","doctrine","faction","prereq","primary","secondary","restriction","rarity","cost","description","effect"].forEach(k => {
        const dataKey = k === "prereq" ? "prerequisite" : k;
        setText(card.querySelector(`[data-talent-${k}="${i}"]`), t[dataKey]);
      });
    });
  }
}

function buildItemTable(id, rows, type) {
  const table = document.getElementById(id);
  const isWeapon = type === "weapon";
  table.innerHTML = `<thead><tr><th>#</th><th>${isWeapon ? "Weapon" : "Item"}</th><th>${isWeapon ? "Skill" : "Type"}</th><th>Weight</th><th>Rules / Notes</th><th>Rarity</th><th>Notes</th></tr></thead>`;
  const body = document.createElement("tbody");
  for (let i=0; i<rows; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td><select data-${type}-select="${i}"></select></td><td data-${type}-type="${i}"></td><td data-${type}-weight="${i}"></td><td data-${type}-rules="${i}"></td><td data-${type}-rarity="${i}"></td><td><input data-${type}-note="${i}"></td>`;
    body.appendChild(tr);
  }
  table.appendChild(body);
  table.querySelectorAll(`select[data-${type}-select]`).forEach(sel => {
    makeOptions(sel, isWeapon ? DATA.lists.weapons : DATA.lists.equipment, "Choose...");
    sel.addEventListener("change", () => {
      const i = sel.dataset[`${type}Select`];
      const e = byName(DATA.equipment, sel.value);
      document.querySelector(`[data-${type}-type="${i}"]`).textContent = isWeapon ? inferWeaponSkill(e.name || "") : e.type || "";
      document.querySelector(`[data-${type}-weight="${i}"]`).textContent = e.weight || "";
      document.querySelector(`[data-${type}-rules="${i}"]`).textContent = e.mechanic || e.brief || "";
      document.querySelector(`[data-${type}-rarity="${i}"]`).textContent = e.rarity || "";
    });
  });
}
function inferWeaponSkill(name) {
  if (name.includes("CC / BS")) return "CC/BS";
  if (name.includes("(CC)")) return "CC";
  if (!name) return "";
  return "BS";
}

function buildConditions() {
  const table = document.getElementById("conditionTable");
  table.innerHTML = `<thead><tr><th>#</th><th>Condition</th><th>Description</th><th>Removal / Check</th><th>Notes</th></tr></thead>`;
  const body = document.createElement("tbody");
  for (let i=0; i<2; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td><select data-condition-select="${i}"></select></td><td data-condition-desc="${i}"></td><td data-condition-removal="${i}"></td><td><input data-condition-note="${i}"></td>`;
    body.appendChild(tr);
  }
  table.appendChild(body);
  table.querySelectorAll("select[data-condition-select]").forEach(sel => {
    makeOptions(sel, DATA.lists.conditions, "Choose...");
    sel.addEventListener("change", () => {
      const i = sel.dataset.conditionSelect;
      const c = byName(DATA.conditions, sel.value);
      document.querySelector(`[data-condition-desc="${i}"]`).textContent = c.description || "";
      document.querySelector(`[data-condition-removal="${i}"]`).textContent = c.removal || "";
    });
  });
}

function collectState() {
  const state = {};
  document.querySelectorAll("input[data-field], textarea[data-field], select[data-field]").forEach(el => state[el.dataset.field] = el.value);
  state.mainSkills = {};
  document.querySelectorAll("select[data-main-skill]").forEach(el => state.mainSkills[el.dataset.mainSkill] = el.value);
  state.focus = {};
  document.querySelectorAll("select[data-focus]").forEach(el => state.focus[el.dataset.focus] = el.value);
  state.skillNotes = {};
  document.querySelectorAll("input[data-skill-note]").forEach(el => state.skillNotes[el.dataset.skillNote] = el.value);
  state.traits = [...document.querySelectorAll("select[data-trait-select]")].map(el => el.value);
  state.talents = [...document.querySelectorAll("select[data-talent-select]")].map(el => el.value);
  state.weapons = [...document.querySelectorAll("select[data-weapon-select]")].map(el => el.value);
  state.equipment = [...document.querySelectorAll("select[data-equipment-select]")].map(el => el.value);
  state.conditions = [...document.querySelectorAll("select[data-condition-select]")].map(el => el.value);
  return state;
}
function applyState(state) {
  if (!state) return;
  document.querySelectorAll("input[data-field], textarea[data-field], select[data-field]").forEach(el => { if (state[el.dataset.field] !== undefined) el.value = state[el.dataset.field]; });
  Object.entries(state.mainSkills || {}).forEach(([k,v]) => { const el = document.querySelector(`select[data-main-skill="${k}"]`); if (el) el.value = v; });
  updateSkillRatings();
  Object.entries(state.focus || {}).forEach(([k,v]) => { const el = document.querySelector(`select[data-focus="${k}"]`); if (el) el.value = v; });
  Object.entries(state.skillNotes || {}).forEach(([k,v]) => { const el = document.querySelector(`input[data-skill-note="${k}"]`); if (el) el.value = v; });
  (state.traits || []).forEach((v,i) => { const el = document.querySelector(`select[data-trait-select="${i}"]`); if (el) { el.value = v; el.dispatchEvent(new Event("change")); } });
  (state.talents || []).forEach((v,i) => { const el = document.querySelector(`select[data-talent-select="${i}"]`); if (el) { el.value = v; el.dispatchEvent(new Event("change")); } });
  (state.weapons || []).forEach((v,i) => { const el = document.querySelector(`select[data-weapon-select="${i}"]`); if (el) { el.value = v; el.dispatchEvent(new Event("change")); } });
  (state.equipment || []).forEach((v,i) => { const el = document.querySelector(`select[data-equipment-select="${i}"]`); if (el) { el.value = v; el.dispatchEvent(new Event("change")); } });
  (state.conditions || []).forEach((v,i) => { const el = document.querySelector(`select[data-condition-select="${i}"]`); if (el) { el.value = v; el.dispatchEvent(new Event("change")); } });
}

function downloadJSON() {
  const state = collectState();
  const name = (state.characterName || "infinity-character").replace(/[^\w\-]+/g, "_");
  const blob = new Blob([JSON.stringify(state, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  initLists();
  buildMainSkills();
  buildSkillTable("skillsLeft", skillOrder.slice(0,16));
  buildSkillTable("skillsRight", skillOrder.slice(16));
  buildTraits();
  buildTalents();
  buildItemTable("weaponTable", 5, "weapon");
  buildItemTable("equipmentTable", 10, "equipment");
  buildConditions();

  document.getElementById("saveBtn").addEventListener("click", () => {
    localStorage.setItem("infinity2d20-character", JSON.stringify(collectState()));
    alert("Saved to this browser.");
  });
  document.getElementById("loadBtn").addEventListener("click", () => {
    applyState(JSON.parse(localStorage.getItem("infinity2d20-character") || "null"));
  });
  document.getElementById("newSheetBtn").addEventListener("click", () => {
    if (confirm("Clear this character sheet?")) location.reload();
  });
  document.getElementById("downloadBtn").addEventListener("click", downloadJSON);
  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyState(JSON.parse(reader.result));
    reader.readAsText(file);
  });
});
