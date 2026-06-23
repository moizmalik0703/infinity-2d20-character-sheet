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

  const restriction = inputField("restriction");
  if (restriction) {
    restriction.value = "No Restrictions";
    restriction.addEventListener("change", refreshRestrictionChoices);
  }
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

function normalizeSkillName(skill) {
  const raw = (skill || "").trim();
  if (!raw) return "";
  const exact = skillOrder.find(s => s.toLowerCase() === raw.toLowerCase());
  return exact || raw;
}

function baseRating(skill) {
  if (mainSkills.includes(skill)) {
    return Number(document.querySelector(`[data-main-skill="${skill}"]`)?.value || "7");
  }
  const parent = parentOf[skill];
  return Number(document.querySelector(`[data-main-skill="${parent}"]`)?.value || "7");
}

function selectedTraitObjects() {
  return [...document.querySelectorAll("select[data-trait-select]")]
    .map(el => byName(DATA.traits, el.value))
    .filter(t => t && t.name);
}

function selectedTalentObjects() {
  return [...document.querySelectorAll("select[data-talent-select]")]
    .map(el => byName(DATA.talents, el.value))
    .filter(t => t && t.name);
}

function calculateSkillBonuses() {
  const direct = {};
  const details = {};
  skillOrder.forEach(skill => {
    direct[skill] = 0;
    details[skill] = [];
  });

  function addSubskillBonus(skillName, source) {
    const skill = normalizeSkillName(skillName);
    // Main skills are references only. They never gain or pass on automatic Rating bonuses.
    if (!skill || mainSkills.includes(skill) || !skillOrder.includes(skill)) return;
    direct[skill] = (direct[skill] || 0) + 1;
    details[skill].push(source);
  }

  selectedTraitObjects().forEach(t => {
    addSubskillBonus(t.primary, `Trait: ${t.name}`);
    addSubskillBonus(t.secondary, `Trait: ${t.name}`);
  });

  selectedTalentObjects().forEach(t => {
    addSubskillBonus(t.primary, `Talent: ${t.name}`);
    addSubskillBonus(t.secondary, `Talent: ${t.name}`);
  });

  return { direct, details };
}

function skillRatingParts(skill) {
  const bonuses = calculateSkillBonuses();
  const base = baseRating(skill);
  const bonus = mainSkills.includes(skill) ? 0 : (bonuses.direct[skill] || 0);
  return {
    base,
    bonus,
    total: base + bonus,
    sources: mainSkills.includes(skill) ? [] : (bonuses.details[skill] || [])
  };
}

function skillRating(skill) {
  const parts = skillRatingParts(skill);
  return parts.bonus > 0 ? `${parts.total} (+${parts.bonus})` : String(parts.total);
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
      <td data-skill-rule="${skill}">${mainSkills.includes(skill) ? "Main skill" : "Sub-skill"}</td>`;
    body.appendChild(tr);
  });
  table.appendChild(body);
  table.querySelectorAll("select[data-focus]").forEach(sel => makeOptions(sel, DATA.lists.focus, ""));
}

function updateSkillRatings() {
  document.querySelectorAll("[data-rating]").forEach(cell => {
    const skill = cell.dataset.rating;
    const parts = skillRatingParts(skill);
    cell.textContent = parts.bonus > 0 ? `${parts.total} (+${parts.bonus})` : String(parts.total);
    cell.title = parts.sources.length ? `Automatic Rating bonus: ${parts.sources.join("; ")}` : "";
    cell.classList.toggle("auto-bonus", parts.bonus > 0);

    const ruleCell = document.querySelector(`[data-skill-rule="${skill}"]`);
    if (ruleCell) {
      const baseRule = mainSkills.includes(skill) ? "Main skill — no automatic Rating bonus" : "Sub-skill";
      ruleCell.textContent = parts.bonus > 0 ? `${baseRule}; +${parts.bonus} Rating from Trait/Talent` : baseRule;
      ruleCell.title = parts.sources.length ? parts.sources.join("; ") : "";
      ruleCell.classList.toggle("auto-bonus", parts.bonus > 0);
    }
  });
}

function activeRestriction() {
  return inputField("restriction")?.value || "No Restrictions";
}

function isEligibleForRestriction(item) {
  const selected = activeRestriction();
  if (!selected || selected === "No Restrictions") return true;
  const itemRestriction = item.restriction || "No Restrictions";
  return itemRestriction === "No Restrictions" || itemRestriction === selected;
}

function eligibleTraits() {
  return DATA.traits.filter(isEligibleForRestriction);
}

function eligibleTalents() {
  return DATA.talents.filter(isEligibleForRestriction);
}

function setTraitCard(index, traitName) {
  const t = byName(DATA.traits, traitName);
  setText(document.querySelector(`[data-trait-primary="${index}"]`), t.primary);
  setText(document.querySelector(`[data-trait-secondary="${index}"]`), t.secondary);
  setText(document.querySelector(`[data-trait-restriction="${index}"]`), t.restriction || "No Restrictions");
  setText(document.querySelector(`[data-trait-rarity="${index}"]`), t.rarity);
  setText(document.querySelector(`[data-trait-cost="${index}"]`), t.cost);
  setText(document.querySelector(`[data-trait-brief="${index}"]`), t.brief);
  setText(document.querySelector(`[data-trait-effect="${index}"]`), t.effect);
  updateSkillRatings();
}

function setTalentCard(index, talentName) {
  const t = byName(DATA.talents, talentName);
  ["level","career","doctrine","faction","prereq","primary","secondary","restriction","rarity","cost","description","effect"].forEach(k => {
    const dataKey = k === "prereq" ? "prerequisite" : k;
    setText(document.querySelector(`[data-talent-${k}="${index}"]`), t[dataKey]);
  });
  updateSkillRatings();
}

function buildTraits() {
  const wrap = document.getElementById("traitSlots");
  wrap.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const card = document.createElement("div");
    card.className = "card card-trait";
    card.innerHTML = `
      <label>Trait<select data-trait-select="${i}"></select></label>
      <label>Primary<div class="output" data-trait-primary="${i}"></div></label>
      <label>Secondary<div class="output" data-trait-secondary="${i}"></div></label>
      <label>Eligibility<div class="output" data-trait-restriction="${i}"></div></label>
      <label>Rarity<div class="output" data-trait-rarity="${i}"></div></label>
      <label>Cost<div class="output" data-trait-cost="${i}"></div></label>
      <label>Brief Description<div class="output big-text" data-trait-brief="${i}"></div></label>
      <label>Effect<div class="output big-text" data-trait-effect="${i}"></div></label>`;
    wrap.appendChild(card);

    const sel = card.querySelector(`[data-trait-select="${i}"]`);
    sel.addEventListener("change", () => setTraitCard(i, sel.value));
  }
}

function buildTalents() {
  const wrap = document.getElementById("talentSlots");
  wrap.innerHTML = "";
  for (let i = 0; i < 3; i++) {
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
    sel.addEventListener("change", () => setTalentCard(i, sel.value));
  }
}

function refreshRestrictionChoices() {
  const selected = activeRestriction();
  const traits = eligibleTraits();
  const talents = eligibleTalents();

  document.querySelectorAll("select[data-trait-select]").forEach((sel, i) => {
    const current = sel.value;
    makeOptions(sel, traits.map(t => t.name), "Choose trait...");
    if (traits.some(t => t.name === current)) sel.value = current;
    else sel.value = "";
    setTraitCard(i, sel.value);
  });

  document.querySelectorAll("select[data-talent-select]").forEach((sel, i) => {
    const current = sel.value;
    makeOptions(sel, talents.map(t => t.name), "Choose talent...");
    if (talents.some(t => t.name === current)) sel.value = current;
    else sel.value = "";
    setTalentCard(i, sel.value);
  });

  const status = document.getElementById("restrictionStatus");
  if (status) {
    status.textContent = selected === "No Restrictions"
      ? `Restriction: No Restrictions — all ${DATA.traits.length} Traits and ${DATA.talents.length} Talents are available.`
      : `Restriction: ${selected} — ${traits.length} eligible Traits (including general options) and ${talents.length} eligible Talents are available.`;
  }
}

function buildItemTable(id, rows, type) {
  const table = document.getElementById(id);
  const isWeapon = type === "weapon";
  table.innerHTML = `<thead><tr><th>#</th><th>${isWeapon ? "Weapon" : "Item"}</th><th>${isWeapon ? "Skill" : "Type"}</th><th>Weight</th><th>Rules / Notes</th><th>Rarity</th><th>Notes</th></tr></thead>`;
  const body = document.createElement("tbody");
  for (let i = 0; i < rows; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="#">${i + 1}</td>
      <td data-label="${isWeapon ? "Weapon" : "Item"}"><select data-${type}-select="${i}"></select></td>
      <td data-label="${isWeapon ? "Skill" : "Type"}" data-${type}-type="${i}"></td>
      <td data-label="Weight" data-${type}-weight="${i}"></td>
      <td data-label="Rules / Notes" data-${type}-rules="${i}"></td>
      <td data-label="Rarity" data-${type}-rarity="${i}"></td>
      <td data-label="Player Notes"><input data-${type}-note="${i}"></td>`;
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
  for (let i = 0; i < 2; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="#">${i + 1}</td>
      <td data-label="Condition"><select data-condition-select="${i}"></select></td>
      <td data-label="Description" data-condition-desc="${i}"></td>
      <td data-label="Removal / Check" data-condition-removal="${i}"></td>
      <td data-label="Player Notes"><input data-condition-note="${i}"></td>`;
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

  document.querySelectorAll("input[data-field], textarea[data-field], select[data-field]").forEach(el => {
    if (state[el.dataset.field] !== undefined) el.value = state[el.dataset.field];
  });

  const restriction = inputField("restriction");
  if (restriction && !restriction.value) restriction.value = "No Restrictions";
  refreshRestrictionChoices();

  Object.entries(state.mainSkills || {}).forEach(([k, v]) => {
    const el = document.querySelector(`select[data-main-skill="${k}"]`);
    if (el) el.value = v;
  });
  Object.entries(state.focus || {}).forEach(([k, v]) => {
    const el = document.querySelector(`select[data-focus="${k}"]`);
    if (el) el.value = v;
  });
  Object.entries(state.skillNotes || {}).forEach(([k, v]) => {
    const el = document.querySelector(`input[data-skill-note="${k}"]`);
    if (el) el.value = v;
  });

  (state.traits || []).forEach((v, i) => {
    const el = document.querySelector(`select[data-trait-select="${i}"]`);
    if (el) { el.value = v; el.dispatchEvent(new Event("change")); }
  });
  (state.talents || []).forEach((v, i) => {
    const el = document.querySelector(`select[data-talent-select="${i}"]`);
    if (el) { el.value = v; el.dispatchEvent(new Event("change")); }
  });
  (state.weapons || []).forEach((v, i) => {
    const el = document.querySelector(`select[data-weapon-select="${i}"]`);
    if (el) { el.value = v; el.dispatchEvent(new Event("change")); }
  });
  (state.equipment || []).forEach((v, i) => {
    const el = document.querySelector(`select[data-equipment-select="${i}"]`);
    if (el) { el.value = v; el.dispatchEvent(new Event("change")); }
  });
  (state.conditions || []).forEach((v, i) => {
    const el = document.querySelector(`select[data-condition-select="${i}"]`);
    if (el) { el.value = v; el.dispatchEvent(new Event("change")); }
  });
  updateSkillRatings();
}

const RANDOM_GIVEN_NAMES = ["Aster", "Badr", "Celia", "Dara", "Elias", "Farah", "Galen", "Hana", "Iris", "Juno", "Kade", "Lina"];
const RANDOM_CALLSIGNS = ["Aegis", "Comet", "Dagger", "Ember", "Falcon", "Ghost", "Harrier", "Ibis", "Javelin", "Kestrel", "Lynx", "Nova"];

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDistinct(items, count) {
  const pool = [...items];
  const chosen = [];
  while (pool.length && chosen.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(index, 1)[0]);
  }
  return chosen;
}

function setSelectValue(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.value = value || "";
  el.dispatchEvent(new Event("change"));
}

function factionForTalentFaction(talentFaction) {
  const map = {
    "ALEPH": "ALEPH",
    "Ariadna": "Ariadna",
    "Haqqislam": "Haqqislam",
    "Japanese Secessionist Army": "Japanese Secessionist Army",
    "NA2": "NA2 / Mercenaries",
    "Nomads": "Nomads",
    "O-12": "O-12",
    "O-12 / Nomads": "O-12 / Nomads - Circular Crew",
    "PanOceania": "PanOceania",
    "PanOceania / Yu Jing": "PanOceania",
    "Yu Jing": "Yu Jing"
  };
  return map[talentFaction] || randomChoice(DATA.lists.factions);
}

function randomBeginnerCharacter() {
  const beginnerTalents = DATA.talents.filter(t => String(t.level) === "1");
  const anchorTalent = randomChoice(beginnerTalents);
  const faction = factionForTalentFaction(anchorTalent.faction);
  const factionInfo = DATA.factions.find(f => f.faction === faction) ||
    DATA.factions.find(f => f.faction.startsWith((faction || "").split(" - ")[0]));

  inputField("characterName").value = `${randomChoice(RANDOM_GIVEN_NAMES)} "${randomChoice(RANDOM_CALLSIGNS)}"`;
  inputField("player").value = "";
  inputField("faction").value = faction;
  inputField("homeworld").value = factionInfo?.homeworld || randomChoice(DATA.lists.homeworlds);
  inputField("concept").value = "Random beginner operative";
  inputField("xp").value = "0";
  inputField("careerRole").value = anchorTalent.career || "";
  inputField("doctrine").value = anchorTalent.doctrine || "";
  inputField("restriction").value = "No Restrictions";
  inputField("talentFaction").value = anchorTalent.faction || "";
  inputField("campaignNotes").value = "Generated beginner character — review before play.";

  // Default resource values are deliberately conservative; review them for your campaign.
  ["hp", "firewall", "mentalStress", "armour"].forEach(field => {
    const el = inputField(field);
    if (el) el.value = "0";
  });
  ["infinityPoints", "credits", "momentum", "heat", "wounds"].forEach(field => {
    const el = inputField(field);
    if (el) el.value = "";
  });

  document.querySelectorAll("select[data-main-skill]").forEach(el => el.value = "7");
  const raised = randomDistinct(mainSkills, 3);
  if (raised[0]) document.querySelector(`[data-main-skill="${raised[0]}"]`).value = "9";
  if (raised[1]) document.querySelector(`[data-main-skill="${raised[1]}"]`).value = "8";
  if (raised[2]) document.querySelector(`[data-main-skill="${raised[2]}"]`).value = "8";

  refreshRestrictionChoices();

  const starterTalentPool = DATA.talents.filter(t => String(t.level) === "1" && t.faction === anchorTalent.faction);
  const chosenTalents = randomDistinct(
    starterTalentPool.length >= 3 ? starterTalentPool : beginnerTalents,
    3
  );
  chosenTalents.forEach((t, i) => setSelectValue(`select[data-talent-select="${i}"]`, t?.name || ""));

  const traitPool = DATA.traits.filter(t => t.restriction === "No Restrictions");
  randomDistinct(traitPool, 3).forEach((t, i) => setSelectValue(`select[data-trait-select="${i}"]`, t?.name || ""));

  randomDistinct(DATA.lists.weapons, 2).forEach((name, i) => setSelectValue(`select[data-weapon-select="${i}"]`, name));
  randomDistinct(DATA.lists.equipment, 5).forEach((name, i) => setSelectValue(`select[data-equipment-select="${i}"]`, name));

  document.querySelectorAll("select[data-condition-select], select[data-focus]").forEach(el => el.value = "");
  document.querySelectorAll("input[data-skill-note], input[data-weapon-note], input[data-equipment-note], input[data-condition-note], textarea").forEach(el => {
    if (!el.dataset.field || !["campaignNotes"].includes(el.dataset.field)) el.value = "";
  });

  updateSkillRatings();
  alert("Random beginner created. Review Vigor, Mental Stress, Firewall, Armour, gear, and restrictions before play. You can now save, download, or print the sheet.");
}

const SAVE_INDEX_KEY = "infinity2d20-character-index";
const SAVE_PREFIX = "infinity2d20-character-save:";

function safeFileName(name) {
  return (name || "infinity-character").replace(/[^\w\-]+/g, "_");
}

function currentCharacterName() {
  return (inputField("characterName")?.value || "").trim() || "Unnamed Character";
}

function saveIdFromName(name) {
  return name.trim().toLowerCase().replace(/[^\w\-]+/g, "_") || "unnamed_character";
}

function getSaveIndex() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function setSaveIndex(index) {
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
}

function saveCharacterToBrowser() {
  const state = collectState();
  state.characterName = state.characterName || currentCharacterName();
  state.savedAt = new Date().toISOString();

  const name = state.characterName || "Unnamed Character";
  const id = saveIdFromName(name);
  localStorage.setItem(SAVE_PREFIX + id, JSON.stringify(state));

  let index = getSaveIndex().filter(item => item.id !== id);
  index.push({ id, name, updatedAt: state.savedAt });
  index.sort((a, b) => a.name.localeCompare(b.name));
  setSaveIndex(index);
  refreshSaveSlots(id);
  alert(`Saved "${name}" to this browser.`);
}

function loadCharacterFromBrowser() {
  const select = document.getElementById("characterSlotSelect");
  const id = select?.value;
  if (!id) {
    alert("Choose a saved character first.");
    return;
  }
  const raw = localStorage.getItem(SAVE_PREFIX + id);
  if (!raw) {
    alert("Saved character not found in this browser.");
    refreshSaveSlots();
    return;
  }
  applyState(JSON.parse(raw));
  alert("Loaded selected character.");
}

function deleteSelectedSave() {
  const select = document.getElementById("characterSlotSelect");
  const id = select?.value;
  if (!id) {
    alert("Choose a saved character first.");
    return;
  }
  const index = getSaveIndex();
  const item = index.find(x => x.id === id);
  if (!confirm(`Delete saved character "${item?.name || id}" from this browser?`)) return;
  localStorage.removeItem(SAVE_PREFIX + id);
  setSaveIndex(index.filter(x => x.id !== id));
  refreshSaveSlots();
}

function refreshSaveSlots(selectedId = "") {
  const select = document.getElementById("characterSlotSelect");
  if (!select) return;
  const index = getSaveIndex();
  select.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = index.length ? "Saved characters..." : "No saved characters";
  select.appendChild(blank);
  index.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "";
    opt.textContent = date ? `${item.name} (${date})` : item.name;
    select.appendChild(opt);
  });
  if (selectedId) select.value = selectedId;
}

function downloadJSON() {
  const state = collectState();
  const name = safeFileName(state.characterName || "infinity-character");
  const blob = new Blob([JSON.stringify(state, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAllSaves() {
  const index = getSaveIndex();
  const saves = {};
  index.forEach(item => {
    const raw = localStorage.getItem(SAVE_PREFIX + item.id);
    if (raw) saves[item.id] = JSON.parse(raw);
  });
  const backup = {
    app: "Infinity 2D20 Web Character Sheet",
    exportedAt: new Date().toISOString(),
    index,
    saves
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `infinity_2d20_all_character_saves_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = JSON.parse(reader.result);

    // Backup file containing many characters.
    if (parsed && parsed.saves && parsed.index) {
      const existing = getSaveIndex();
      const byId = {};
      existing.forEach(item => byId[item.id] = item);
      parsed.index.forEach(item => {
        if (parsed.saves[item.id]) {
          localStorage.setItem(SAVE_PREFIX + item.id, JSON.stringify(parsed.saves[item.id]));
          byId[item.id] = item;
        }
      });
      setSaveIndex(Object.values(byId).sort((a, b) => a.name.localeCompare(b.name)));
      refreshSaveSlots();
      alert("Imported all saved characters into this browser.");
      return;
    }

    // Single character file.
    applyState(parsed);
    if (confirm("Import loaded. Save this character into browser slots now?")) {
      saveCharacterToBrowser();
    }
  };
  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
  initLists();
  buildMainSkills();
  buildSkillTable("skillsLeft", skillOrder.slice(0,16));
  buildSkillTable("skillsRight", skillOrder.slice(16));
  buildTraits();
  buildTalents();
  refreshRestrictionChoices();
  buildItemTable("weaponTable", 5, "weapon");
  buildItemTable("equipmentTable", 10, "equipment");
  buildConditions();
  refreshSaveSlots();

  document.getElementById("randomCharacterBtn").addEventListener("click", randomBeginnerCharacter);
  document.getElementById("saveBtn").addEventListener("click", saveCharacterToBrowser);
  document.getElementById("loadBtn").addEventListener("click", loadCharacterFromBrowser);
  document.getElementById("deleteSaveBtn").addEventListener("click", deleteSelectedSave);
  document.getElementById("newSheetBtn").addEventListener("click", () => {
    if (confirm("Clear this character sheet? Unsaved changes will be lost.")) location.reload();
  });
  document.getElementById("downloadBtn").addEventListener("click", downloadJSON);
  document.getElementById("exportAllBtn").addEventListener("click", exportAllSaves);
  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importJSONFile(file);
    e.target.value = "";
  });
});
