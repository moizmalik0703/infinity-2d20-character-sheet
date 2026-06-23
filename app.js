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

const subSkills = skillOrder.filter(skill => !mainSkills.includes(skill));
let startingSkillBonuses = {};


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
  const startBonus = mainSkills.includes(skill) ? 0 : Number(startingSkillBonuses[skill] || 0);
  const traitTalentBonus = mainSkills.includes(skill) ? 0 : (bonuses.direct[skill] || 0);
  const bonus = startBonus + traitTalentBonus;
  const sources = [];
  if (startBonus > 0) sources.push(`Starting allocation +${startBonus}`);
  sources.push(...(mainSkills.includes(skill) ? [] : (bonuses.details[skill] || [])));
  return {
    base,
    startBonus,
    traitTalentBonus,
    bonus,
    total: base + bonus,
    sources
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
    cell.title = parts.sources.length ? `Rating modifiers: ${parts.sources.join("; ")}` : "";
    cell.classList.toggle("auto-bonus", parts.bonus > 0);

    const ruleCell = document.querySelector(`[data-skill-rule="${skill}"]`);
    if (ruleCell) {
      const baseRule = mainSkills.includes(skill) ? "Main skill - no automatic Rating bonus" : "Sub-skill";
      const modifiers = [];
      if (parts.startBonus > 0) modifiers.push(`Start +${parts.startBonus}`);
      if (parts.traitTalentBonus > 0) modifiers.push(`Trait/Talent +${parts.traitTalentBonus}`);
      ruleCell.textContent = modifiers.length ? `${baseRule}; ${modifiers.join("; ")}` : baseRule;
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
      if (type === "equipment") applyArmourFromEquipment();
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
  state.startBonuses = { ...startingSkillBonuses };
  return state;
}
function applyState(state) {
  if (!state) return;
  startingSkillBonuses = { ...(state.startBonuses || {}) };

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
  applyArmourFromEquipment();
  updateSkillRatings();
}

const RANDOM_GIVEN_NAMES = ["Aster", "Badr", "Celia", "Dara", "Elias", "Farah", "Galen", "Hana", "Iris", "Juno", "Kade", "Lina"];
const RANDOM_CALLSIGNS = ["Aegis", "Comet", "Dagger", "Ember", "Falcon", "Ghost", "Harrier", "Ibis", "Javelin", "Kestrel", "Lynx", "Nova"];

// Portfolio-inspired starter builds drawn from the generated 2-page starting character sheets.
const STARTER_PORTFOLIOS = [
  {
    name: "Nika 'Needle' Proxy-17", faction: "ALEPH", talentFaction: "ALEPH",
    doctrine: "Posthuman Proxy Program", career: "ALEPH Prestige",
    homeworld: "Maya / ALEPH facilities", concept: "ALEPH Prestige from Posthuman Proxy Program",
    restriction: "ALEPH access or Posthuman background",
    trait: "Sensor Evader", talent: "Enhanced Reflexes",
    weapons: ["Assault Rifle - EMT (BS)", "Assault Rifle - Viral (BS)"],
    equipment: ["Abseil Rope (100ft)", "Flares", "Cooking Equipment", "Ball Bearings", "Crowbar"]
  },
  {
    name: "Pavel 'Rook' Mirov", faction: "Nomads", talentFaction: "Nomads",
    doctrine: "Tunguska Interventor Program", career: "Hacker",
    homeworld: "Nomad motherships", concept: "Nomad Hacker from Tunguska Interventor Program",
    restriction: "Nomad or advanced Hacking background",
    trait: "Empathic", talent: "System Cracker",
    weapons: ["Assault Rifle - Viral (BS)", "Boarding Shotgun (BS)"],
    equipment: ["Grappling Hook", "Health Kit", "Flares", "Parachute", "Mechanic Tools"]
  },
  {
    name: "Nadia 'Needle' Al-Farouk", faction: "Haqqislam", talentFaction: "Haqqislam",
    doctrine: "Akbar Doctor Program", career: "Doctor",
    homeworld: "Bourak", concept: "Haqqislam Doctor from Akbar Doctor Program",
    restriction: "Haqqislam or advanced Medicine background",
    trait: "Undercover Agent", talent: "Steady Scalpel",
    weapons: ["Pump Action Shotgun (CC / BS)", "Assault Rifle - Normal (BS)"],
    equipment: ["Caltrops", "Parachute", "Climbing gear", "Military rations", "Binoculars"]
  },
  {
    name: "Isabella 'Kite' Vega", faction: "PanOceania", talentFaction: "PanOceania",
    doctrine: "Fusilier Fireteam Doctrine", career: "Line Infantry",
    homeworld: "Neoterra or Varuna", concept: "PanOceania Line Infantry from Fusilier Fireteam Doctrine",
    restriction: "Military or security background",
    trait: "Duelist", talent: "Fireteam: Duo",
    weapons: ["rifles - Sniper (BS)", "Assault Rifle - Shock (BS)"],
    equipment: ["Armour - Ballistic Vest", "Torch Light", "Shovel", "Medikit", "Climbing gear"]
  },
  {
    name: "Reina 'Sable' Sato", faction: "Japanese Secessionist Army", talentFaction: "Japanese Secessionist Army",
    doctrine: "Japanese Secessionist Tech Cell", career: "Engineer",
    homeworld: "Japanese territories", concept: "Japanese Secessionist Army Engineer from Japanese Secessionist Tech Cell",
    restriction: "JSA, engineer, or battlefield support background",
    trait: "Escape Artist", talent: "Field Technician",
    weapons: ["Pump Action Shotgun (CC / BS)", "Boarding Shotgun (BS)"],
    equipment: ["Net", "Soldering Kit", "Shovel", "Military rations", "Foldable bicycle"]
  },
  {
    name: "Sasha 'Signal' Wire", faction: "O-12 / Nomads", talentFaction: "O-12 / Nomads",
    doctrine: "Circular Crew Operations", career: "Voidfarer",
    homeworld: "Circulars and classified stations", concept: "O-12 / Nomads Voidfarer from Circular Crew Operations",
    restriction: "Extraplanetary or shipboard operations background",
    trait: "Speed Typing", talent: "Spacecraft Pilot - Level 1",
    weapons: ["Assault Rifle - Viral (BS)", "rifles - Sniper (BS)"],
    equipment: ["Ball Bearings", "Suture Kit", "smoke bomb (BS)", "Torch Light", "Climbing gear"]
  },
  {
    name: "Theo 'Ghost' Ramos", faction: "O-12", talentFaction: "O-12",
    doctrine: "O-12 Liaison Corps", career: "Diplomat",
    homeworld: "Concilium Prima", concept: "O-12 Diplomat from O-12 Liaison Corps",
    restriction: "Diplomatic, legal, or political background",
    trait: "Disguise Expert", talent: "Attache",
    weapons: ["Boarding Shotgun (BS)", "Pistol (Normal)"],
    equipment: ["Mechanic Tools", "Foldable bicycle", "Medikit", "smoke bomb (BS)", "Caltrops"]
  },
  {
    name: "Brigid 'Needle' Wallace", faction: "Ariadna", talentFaction: "Ariadna",
    doctrine: "Ariadna Ranger Doctrine", career: "Recon",
    homeworld: "Dawn frontier", concept: "Ariadna Recon from Ariadna Ranger Doctrine",
    restriction: "Ariadna or frontier survival background",
    trait: "Imposing Figure", talent: "Wilderness Training",
    weapons: ["Dagger (CC)", "Pistol (Normal)"],
    equipment: ["Cooking Equipment", "Health Kit", "Foldable bicycle", "Grappling Hook", "Soldering Kit"]
  },
  {
    name: "Tala 'Lockstep' Rafiq", faction: "NA2 / Mercenaries", talentFaction: "NA2",
    doctrine: "Druze Bayram Security Contractor", career: "Smuggler",
    homeworld: "Mercenary caravanserai", concept: "NA2 Smuggler from Druze Bayram Security Contractor",
    restriction: "Mercenary, criminal, or trade-route background",
    trait: "Silver Tongue", talent: "Thief - Pickpocket",
    weapons: ["Boarding Shotgun (BS)", "Pump Action Shotgun (CC / BS)"],
    equipment: ["Torch Light", "Parachute", "smoke bomb (BS)", "Caltrops", "Backpack"]
  },
  {
    name: "Tao 'Needle' Fernandes", faction: "PanOceania / Yu Jing", talentFaction: "PanOceania / Yu Jing",
    doctrine: "Svalarheima Mountain Recon", career: "Recon",
    homeworld: "Svalarheima border theatres", concept: "PanOceania / Yu Jing Recon from Svalarheima Mountain Recon",
    restriction: "Cold-weather or mountain operations background",
    trait: "Bureaucrat", talent: "Rock Climber",
    weapons: ["Pump Action Shotgun (CC / BS)", "Pistol (Normal)"],
    equipment: ["Suture Kit", "Health Kit", "Parachute", "Medikit", "Shovel"]
  }
];

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDistinct(items, count) {
  const pool = [...items];
  const chosen = [];
  while (pool.length && chosen.length < count) {
    chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return chosen;
}

function ensureSelectValue(select, value) {
  if (!select) return;
  if (value && ![...select.options].some(option => option.value === value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  select.value = value || "";
}

function setFieldValue(field, value) {
  const element = inputField(field);
  if (!element) return;
  if (element.tagName === "SELECT") ensureSelectValue(element, value);
  else element.value = value || "";
  element.dispatchEvent(new Event("change"));
}

function setSelectValue(selector, value) {
  const element = document.querySelector(selector);
  if (!element) return;
  ensureSelectValue(element, value);
  element.dispatchEvent(new Event("change"));
}

function resetStartingBonuses() {
  startingSkillBonuses = {};
  subSkills.forEach(skill => startingSkillBonuses[skill] = 0);
}

function assignTenRandomSkillPoints(preferredSkills = []) {
  resetStartingBonuses();
  const preferred = preferredSkills.filter(skill => subSkills.includes(skill));
  let allocated = 0;
  let attempts = 0;

  while (allocated < 10 && attempts < 500) {
    attempts += 1;
    const weightedPool = [
      ...subSkills,
      ...preferred, ...preferred, ...preferred, ...preferred
    ];
    const skill = randomChoice(weightedPool);
    if ((startingSkillBonuses[skill] || 0) >= 2) continue;
    startingSkillBonuses[skill] += 1;
    allocated += 1;
  }
}

function assignRandomFocusPoints(totalPoints, preferredSkills = [], maxPerSkill = 2) {
  resetStartingBonuses();

  // Generated starting points live in Focus, not Rating.
  document.querySelectorAll("select[data-focus]").forEach(element => {
    element.value = "";
  });
  document.querySelectorAll("input[data-skill-note]").forEach(element => {
    element.value = "";
  });

  const allocation = {};
  subSkills.forEach(skill => allocation[skill] = 0);
  const preferred = preferredSkills.filter(skill => subSkills.includes(skill));
  let allocated = 0;
  let attempts = 0;

  while (allocated < totalPoints && attempts < 800) {
    attempts += 1;
    const weightedPool = [...subSkills, ...preferred, ...preferred, ...preferred, ...preferred];
    const skill = randomChoice(weightedPool);
    if (allocation[skill] >= maxPerSkill) continue;
    allocation[skill] += 1;
    allocated += 1;
  }

  Object.entries(allocation).forEach(([skill, points]) => {
    const focus = document.querySelector(`select[data-focus="${skill}"]`);
    const note = document.querySelector(`input[data-skill-note="${skill}"]`);
    if (focus) ensureSelectValue(focus, points > 0 ? `+${points}` : "");
    if (note) note.value = points > 0 ? `Start Focus +${points}` : "";
  });
  updateSkillRatings();
}

function assignTenRandomFocusPoints(preferredSkills = []) {
  assignRandomFocusPoints(10, preferredSkills, 2);
}

function assignFiveBeginnerFocusPoints(preferredSkills = []) {
  // Five distinct +1 Focus allocations for starter portfolios.
  assignRandomFocusPoints(5, preferredSkills, 1);
}

function preferredSkillsFor(traits, talents) {
  const linked = [];
  [...traits, ...talents].filter(Boolean).forEach(item => {
    [item.primary, item.secondary].forEach(skill => {
      if (subSkills.includes(skill)) linked.push(skill);
    });
  });
  return linked;
}

function setDefaultTracks() {
  setFieldValue("hp", "20");
  setFieldValue("mentalStress", "20");
  setFieldValue("firewall", "20");
  setFieldValue("armour", "0");
}

function clearEditableNotes() {
  document.querySelectorAll("select[data-focus], select[data-condition-select]").forEach(element => element.value = "");
  document.querySelectorAll("input[data-skill-note], input[data-weapon-note], input[data-equipment-note], input[data-condition-note]").forEach(element => element.value = "");
  ["scratchNotes", "contactFaction", "contactPersonal", "lifepathSecret", "campaignLongNotes"].forEach(field => {
    const element = inputField(field);
    if (element) element.value = "";
  });
}

function armourValueForItem(item) {
  if (!item || !/armor|armour/i.test(`${item.type || ""} ${item.name || ""}`)) return 0;
  const weight = String(item.weight || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();
  if (weight.includes("heavy") || name.includes("heavy") || name.includes("powered") || name.includes("exo")) return 15;
  if (weight.includes("medium") || name.includes("medium")) return 10;
  return 5;
}

function applyArmourFromEquipment() {
  const selectedEquipment = [...document.querySelectorAll("select[data-equipment-select]")]
    .map(element => byName(DATA.equipment, element.value));
  const armour = selectedEquipment.reduce((highest, item) => Math.max(highest, armourValueForItem(item)), 0);
  setFieldValue("armour", String(armour));
}

function setWeaponsAndEquipment(weapons = [], equipment = []) {
  document.querySelectorAll("select[data-weapon-select]").forEach((element, index) => {
    setSelectValue(`select[data-weapon-select="${index}"]`, weapons[index] || "");
  });
  document.querySelectorAll("select[data-equipment-select]").forEach((element, index) => {
    setSelectValue(`select[data-equipment-select="${index}"]`, equipment[index] || "");
  });
  applyArmourFromEquipment();
}

function clearTraitAndTalentSlots() {
  document.querySelectorAll("select[data-trait-select]").forEach((element, index) => setSelectValue(`select[data-trait-select="${index}"]`, ""));
  document.querySelectorAll("select[data-talent-select]").forEach((element, index) => setSelectValue(`select[data-talent-select="${index}"]`, ""));
}

function setMainSkillsToStartingBaseline() {
  document.querySelectorAll("select[data-main-skill]").forEach(element => element.value = "7");
}

function randomGenericGear() {
  const armourChoices = DATA.equipment.filter(item => /armor|armour/i.test(`${item.type || ""} ${item.name || ""}`));
  const armour = randomChoice(armourChoices);
  const nonArmourNames = DATA.lists.equipment.filter(name => {
    const item = byName(DATA.equipment, name);
    return armourValueForItem(item) === 0;
  });
  return {
    weapons: randomDistinct(DATA.lists.weapons, 2),
    equipment: [armour.name, ...randomDistinct(nonArmourNames, 4)]
  };
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

function randomCharacter() {
  const levelOneTalents = DATA.talents.filter(talent => String(talent.level) === "1");
  const anchorTalent = randomChoice(levelOneTalents);
  const faction = factionForTalentFaction(anchorTalent.faction);
  const factionInfo = DATA.factions.find(entry => entry.faction === faction) ||
    DATA.factions.find(entry => entry.faction.startsWith((faction || "").split(" - ")[0]));
  const matchingTalents = levelOneTalents.filter(talent => talent.faction === anchorTalent.faction);
  const chosenTalents = randomDistinct(matchingTalents.length >= 3 ? matchingTalents : levelOneTalents, 3);

  setFieldValue("characterName", `${randomChoice(RANDOM_GIVEN_NAMES)} "${randomChoice(RANDOM_CALLSIGNS)}"`);
  setFieldValue("player", "");
  setFieldValue("faction", faction);
  setFieldValue("homeworld", factionInfo?.homeworld || randomChoice(DATA.lists.homeworlds));
  setFieldValue("concept", "Randomly generated operative");
  setFieldValue("xp", "0");
  setFieldValue("careerRole", anchorTalent.career || "");
  setFieldValue("doctrine", anchorTalent.doctrine || "");
  setFieldValue("restriction", "No Restrictions");
  setFieldValue("talentFaction", anchorTalent.faction || "");
  setFieldValue("campaignNotes", "Generated random character - review before play.");

  setDefaultTracks();
  clearEditableNotes();
  clearTraitAndTalentSlots();
  setMainSkillsToStartingBaseline();
  refreshRestrictionChoices();

  const generalTraits = DATA.traits.filter(trait => (trait.restriction || "No Restrictions") === "No Restrictions");
  const chosenTraits = randomDistinct(generalTraits, 3);
  chosenTraits.forEach((trait, index) => setSelectValue(`select[data-trait-select="${index}"]`, trait?.name || ""));
  chosenTalents.forEach((talent, index) => setSelectValue(`select[data-talent-select="${index}"]`, talent?.name || ""));

  const gear = randomGenericGear();
  setWeaponsAndEquipment(gear.weapons, gear.equipment);

  assignTenRandomFocusPoints(preferredSkillsFor(chosenTraits, chosenTalents));
  updateSkillRatings();
  alert("Random Character created with 10 starting Focus points. Vigor, Mental Stress, and Firewall are 20. Armour is set from the generated armour item.");
}

function randomBeginnerCharacter() {
  const template = randomChoice(STARTER_PORTFOLIOS);
  const trait = byName(DATA.traits, template.trait);
  const talent = byName(DATA.talents, template.talent);

  setFieldValue("characterName", template.name);
  setFieldValue("player", "Starting Character");
  setFieldValue("faction", template.faction);
  setFieldValue("homeworld", template.homeworld);
  setFieldValue("concept", template.concept);
  setFieldValue("xp", "Starting character");
  setFieldValue("careerRole", template.career);
  setFieldValue("doctrine", template.doctrine);
  setFieldValue("restriction", template.restriction);
  setFieldValue("talentFaction", template.talentFaction);
  setFieldValue("campaignNotes", "Portfolio-based beginner character - review and personalise before play.");

  setDefaultTracks();
  clearEditableNotes();
  clearTraitAndTalentSlots();
  setMainSkillsToStartingBaseline();
  refreshRestrictionChoices();

  setSelectValue('select[data-trait-select="0"]', template.trait);
  setSelectValue('select[data-talent-select="0"]', template.talent);
  setWeaponsAndEquipment(template.weapons, template.equipment);

  assignFiveBeginnerFocusPoints(preferredSkillsFor([trait], [talent]));
  updateSkillRatings();

  alert(`Random Beginner Character created from the ${template.name} starter portfolio pattern. It has 2 weapons, 5 non-weapon equipment items, 1 Trait, 1 Level 1 Talent, and 5 starting Focus points.`);
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

function newCharacterSheet() {
  if (!confirm("Start a new character sheet? Unsaved changes will be lost.")) return;

  document.querySelectorAll("input[data-field], textarea[data-field]").forEach(element => {
    element.value = "";
  });
  document.querySelectorAll("select[data-field]").forEach(element => {
    element.value = "";
  });

  setFieldValue("restriction", "No Restrictions");
  refreshRestrictionChoices();
  clearTraitAndTalentSlots();
  setWeaponsAndEquipment([], []);
  document.querySelectorAll("select[data-condition-select], select[data-focus]").forEach(element => {
    element.value = "";
  });
  document.querySelectorAll("input[data-skill-note], input[data-weapon-note], input[data-equipment-note], input[data-condition-note]").forEach(element => {
    element.value = "";
  });

  setMainSkillsToStartingBaseline();
  resetStartingBonuses();
  setDefaultTracks();
  applyArmourFromEquipment();
  updateSkillRatings();
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
  setDefaultTracks();
  resetStartingBonuses();
  refreshSaveSlots();

  document.getElementById("randomCharacterBtn").addEventListener("click", randomCharacter);
  document.getElementById("randomBeginnerCharacterBtn").addEventListener("click", randomBeginnerCharacter);
  document.getElementById("saveBtn").addEventListener("click", saveCharacterToBrowser);
  document.getElementById("loadBtn").addEventListener("click", loadCharacterFromBrowser);
  document.getElementById("deleteSaveBtn").addEventListener("click", deleteSelectedSave);
  document.getElementById("newSheetBtn").addEventListener("click", newCharacterSheet);
  document.getElementById("downloadBtn").addEventListener("click", downloadJSON);
  document.getElementById("exportAllBtn").addEventListener("click", exportAllSaves);
  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importJSONFile(file);
    e.target.value = "";
  });
});
