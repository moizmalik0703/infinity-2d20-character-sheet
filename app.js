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
const LEGACY_TRAIT_TALENT_ALIASES = {
  "Counter Intelligence": "Counter-Intel",
  "Tactical Awareness": "Tactical Perception",
  "Proxy Coordination": "Proxy Synchrony",
  "Human Intelligence": "Human Intel",
  "Swarm Coordination": "Swarm Synchrony",
  "Quick Reflexes": "Quick Reactions",
  "Enhanced Reflexes": "Enhanced Reactions",
  "Gladiator Reflexes": "Gladiator Reactions",
  "Superior Tactics": "Superior Doctrine",
  "Streetwise": "Street Operator"
};

function resolveLegacyTraitTalentName(value) {
  const raw = String(value || "");
  return LEGACY_TRAIT_TALENT_ALIASES[raw] || raw;
}

function byName(list, name) {
  const resolved = resolveLegacyTraitTalentName(name);
  return list.find(x => x.name === resolved) || {};
}
function setText(el, value) {
  const text = value || "";
  el.textContent = text;
  // Preserve the complete value on hover when a narrow browser layout wraps it.
  el.title = text;
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
    // Only explicit sub-skills may receive automatic Trait/Talent Rating bonuses.
    // Main skills and unknown labels are never valid bonus targets.
    if (!skill || !subSkills.includes(skill)) return;
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
      <div class="trait-meta">
        <label class="trait-name">Trait<select data-trait-select="${i}"></select></label>
        <label>Primary<div class="output" data-trait-primary="${i}"></div></label>
        <label>Secondary<div class="output" data-trait-secondary="${i}"></div></label>
        <label>Eligibility<div class="output" data-trait-restriction="${i}"></div></label>
        <label>Rarity<div class="output" data-trait-rarity="${i}"></div></label>
        <label class="trait-cost">Cost<div class="output" data-trait-cost="${i}"></div></label>
      </div>
      <div class="trait-full text-panel trait-brief">
        <div class="text-panel-heading">Brief Description</div>
        <div class="output big-text" data-trait-brief="${i}"></div>
      </div>
      <div class="trait-full text-panel trait-effect">
        <div class="text-panel-heading">Effect</div>
        <div class="output big-text" data-trait-effect="${i}"></div>
      </div>`;
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
      <div class="wide-text text-panel talent-description">
        <div class="text-panel-heading">Description</div>
        <div class="output big-text" data-talent-description="${i}"></div>
      </div>
      <div class="wide-text text-panel talent-effect">
        <div class="text-panel-heading">Effect</div>
        <div class="output big-text" data-talent-effect="${i}"></div>
      </div>`;
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
    if (el) {
      el.value = resolveLegacyTraitTalentName(v);
      el.dispatchEvent(new Event("change"));
    }
  });
  (state.talents || []).forEach((v, i) => {
    const el = document.querySelector(`select[data-talent-select="${i}"]`);
    if (el) {
      el.value = resolveLegacyTraitTalentName(v);
      el.dispatchEvent(new Event("change"));
    }
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
  const resolved = resolveLegacyTraitTalentName(value);
  ensureSelectValue(element, resolved);
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

function clearFocusAllocations() {
  document.querySelectorAll("select[data-focus]").forEach(element => {
    element.value = "";
  });
  document.querySelectorAll("input[data-skill-note]").forEach(element => {
    element.value = "";
  });
  updateFocusAllocationStatus();
}

function setFocusValue(skill, points, notePrefix = "Start Focus") {
  const focus = document.querySelector(`select[data-focus="${skill}"]`);
  const note = document.querySelector(`input[data-skill-note="${skill}"]`);
  const target = points > 0 ? `+${points}` : "";

  if (!focus) return false;
  let option = [...focus.options].find(item => item.value === target);
  if (!option && target) {
    option = document.createElement("option");
    option.value = target;
    option.textContent = target;
    focus.appendChild(option);
  }
  focus.value = target;

  // Defensive fallback: browsers should accept an existing option, but this
  // ensures the allocation is never silently lost.
  if (focus.value !== target && target) {
    focus.selectedIndex = [...focus.options].findIndex(item => item.value === target);
  }

  if (note) note.value = points > 0 ? `${notePrefix} +${points}` : "";
  return focus.value === target;
}

function updateFocusAllocationStatus() {
  const status = document.getElementById("focusAllocationStatus");
  if (!status) return;

  const allocations = [...document.querySelectorAll("select[data-focus]")]
    .map(element => ({ skill: element.dataset.focus, value: element.value }))
    .filter(entry => entry.value);

  if (!allocations.length) {
    status.textContent = "Generated Focus allocation: none.";
    return;
  }

  const total = allocations.reduce((sum, entry) => sum + Number(String(entry.value).replace("+", "")), 0);
  status.textContent = `Generated Focus allocation: ${total} point${total === 1 ? "" : "s"} — ${allocations.map(entry => `${entry.skill} ${entry.value}`).join(", ")}.`;
}

function assignRandomFocusPoints(totalPoints, preferredSkills = [], maxPerSkill = 2) {
  resetStartingBonuses();

  // Generated points always go directly into Focus, never into Rating.
  clearFocusAllocations();

  const allocation = {};
  subSkills.forEach(skill => allocation[skill] = 0);
  const preferred = preferredSkills.filter(skill => subSkills.includes(skill));
  let allocated = 0;
  let attempts = 0;

  while (allocated < totalPoints && attempts < 1000) {
    attempts += 1;
    const weightedPool = [...subSkills, ...preferred, ...preferred, ...preferred, ...preferred];
    const skill = randomChoice(weightedPool);
    if (allocation[skill] >= maxPerSkill) continue;
    allocation[skill] += 1;
    allocated += 1;
  }

  const failures = [];
  Object.entries(allocation).forEach(([skill, points]) => {
    if (points > 0 && !setFocusValue(skill, points)) failures.push(skill);
  });

  updateFocusAllocationStatus();
  updateSkillRatings();

  if (failures.length) {
    console.warn("Focus allocation could not be applied to:", failures.join(", "));
  }
}

function assignTenRandomFocusPoints(preferredSkills = []) {
  assignRandomFocusPoints(10, preferredSkills, 2);
}

function assignFiveBeginnerFocusPoints(preferredSkills = []) {
  // Five distinct +1 Focus allocations for portfolio-based starters.
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

function setArmourValue(value) {
  const armour = inputField("armour");
  if (!armour) return;

  const target = String(value);
  let option = [...armour.options].find(item => item.value === target);
  if (!option) {
    option = document.createElement("option");
    option.value = target;
    option.textContent = target;
    armour.appendChild(option);
  }
  armour.value = target;
  if (armour.value !== target) {
    armour.selectedIndex = [...armour.options].findIndex(item => item.value === target);
  }
}

function updateArmourStatus(value, itemName = "") {
  const status = document.getElementById("armourStatus");
  if (!status) return;
  status.textContent = value > 0
    ? `Armour: ${value} — auto-calculated from ${itemName || "equipped armour"}.`
    : "Armour: 0 — no armour equipment selected.";
}

function setDefaultTracks() {
  setFieldValue("hp", "20");
  setFieldValue("mentalStress", "20");
  setFieldValue("firewall", "20");
  setArmourValue(0);
  updateArmourStatus(0);
}

function clearEditableNotes() {
  document.querySelectorAll("select[data-condition-select]").forEach(element => element.value = "");
  document.querySelectorAll("input[data-weapon-note], input[data-equipment-note], input[data-condition-note]").forEach(element => element.value = "");
  ["scratchNotes", "contactFaction", "contactPersonal", "lifepathSecret", "campaignLongNotes"].forEach(field => {
    const element = inputField(field);
    if (element) element.value = "";
  });
  clearFocusAllocations();
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
    .map(element => byName(DATA.equipment, element.value))
    .filter(item => item && item.name);

  let armourItem = null;
  let armourValue = 0;
  selectedEquipment.forEach(item => {
    const value = armourValueForItem(item);
    if (value > armourValue) {
      armourValue = value;
      armourItem = item;
    }
  });

  setArmourValue(armourValue);
  updateArmourStatus(armourValue, armourItem?.name || "");
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

  // Clear all gear first, then deliberately set Armour to 0.
  document.querySelectorAll("select[data-weapon-select], select[data-equipment-select], select[data-condition-select]").forEach(element => {
    element.value = "";
    element.dispatchEvent(new Event("change"));
  });

  clearFocusAllocations();
  setMainSkillsToStartingBaseline();
  resetStartingBonuses();
  setDefaultTracks();
  applyArmourFromEquipment();
  updateSkillRatings();
}


/* -------------------------------------------------------------------------
   Print portfolio v5
   The editable browser sheet remains unchanged. Printing builds a compact,
   portfolio-style document that only includes populated cards and rows.
   ------------------------------------------------------------------------- */
function printEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printValue(field) {
  return inputField(field)?.value?.trim() || "";
}

function printText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text ? printEscape(text) : fallback;
}

function printShortText(value, limit = 420) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= limit) return printEscape(text);
  return `${printEscape(text.slice(0, Math.max(0, limit - 1)).trim())}... <span class="print-truncated">(continued in browser sheet)</span>`;
}

function printSigned(value) {
  const number = Number(value || 0);
  return number ? `${number > 0 ? "+" : ""}${number}` : "-";
}

function printField(label, value, wide = false) {
  return `<div class="print-field${wide ? " wide" : ""}">
    <span class="print-field-label">${printEscape(label)}</span>
    <span class="print-field-value">${printText(value)}</span>
  </div>`;
}

function printSection(title, body, extraClass = "") {
  return `<section class="print-section ${extraClass}">
    <h2 class="print-section-title">${printEscape(title)}</h2>
    <div class="print-section-body">${body}</div>
  </section>`;
}

function printHeader(page, total, subtitle = "") {
  return `<header class="print-header">
    <div>
      <h1>INFINITY 2D20 CHARACTER PORTFOLIO</h1>
      ${subtitle ? `<p class="print-subtitle">${printEscape(subtitle)}</p>` : ""}
    </div>
    <div class="print-page-number">Page ${page} of ${total}</div>
  </header>`;
}

function selectedPrintTraits() {
  return [...document.querySelectorAll("select[data-trait-select]")]
    .map(select => byName(DATA.traits, select.value))
    .filter(entry => entry && entry.name);
}

function selectedPrintTalents() {
  return [...document.querySelectorAll("select[data-talent-select]")]
    .map(select => byName(DATA.talents, select.value))
    .filter(entry => entry && entry.name);
}

function selectedPrintGear(type) {
  return [...document.querySelectorAll(`select[data-${type}-select]`)]
    .map((select, index) => {
      const entry = byName(DATA.equipment, select.value);
      const note = document.querySelector(`input[data-${type}-note="${index}"]`)?.value?.trim() || "";
      return { index: index + 1, entry, note };
    })
    .filter(item => item.entry && item.entry.name);
}

function selectedPrintConditions() {
  return [...document.querySelectorAll("select[data-condition-select]")]
    .map((select, index) => {
      const entry = byName(DATA.conditions, select.value);
      const note = document.querySelector(`input[data-condition-note="${index}"]`)?.value?.trim() || "";
      return { index: index + 1, entry, note };
    })
    .filter(item => item.entry && item.entry.name);
}

function printMainSkillCard(skill) {
  const parts = skillRatingParts(skill);
  return `<div class="print-skill-chip">
    <div class="print-skill-chip-name">${printEscape(skill)}</div>
    <div class="print-skill-chip-stats">
      <div><span>Base</span><b>${printEscape(parts.base)}</b></div>
      <div><span>Bonus</span><b>${printEscape(printSigned(parts.bonus))}</b></div>
      <div class="print-skill-chip-total"><span>Total</span><strong>${printEscape(parts.total)}</strong></div>
    </div>
  </div>`;
}

function printSkillTable(skills) {
  const rows = skills.map(skill => {
    const parts = skillRatingParts(skill);
    const focus = mainSkills.includes(skill) ? "" : (document.querySelector(`select[data-focus="${skill}"]`)?.value || "");
    const note = mainSkills.includes(skill) ? "" : (document.querySelector(`input[data-skill-note="${skill}"]`)?.value || "");
    const source = [...parts.sources, note].filter(Boolean).join("; ") || (mainSkills.includes(skill) ? "Main skill" : "");
    return `<tr class="${mainSkills.includes(skill) ? "print-main-row" : ""}">
      <td class="print-skill-name">${printEscape(skill)}</td>
      <td class="number">${printEscape(parts.base)}</td>
      <td class="number">${printEscape(printSigned(parts.bonus))}</td>
      <td class="number print-skill-total">${printEscape(parts.total)}</td>
      <td class="number">${printText(focus, "")}</td>
      <td class="print-skill-source">${printText(source, "")}</td>
    </tr>`;
  }).join("");

  return `<table class="print-table print-skills-table">
    <thead><tr><th>Skill</th><th>Base</th><th>Rating +</th><th>Total</th><th>Focus</th><th>Source</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildPrintCorePage(page, total) {
  const fields = [
    ["Character Name", printValue("characterName") || "Unnamed Character", true],
    ["Player", printValue("player")],
    ["Faction", printValue("faction")],
    ["Homeworld / Habitat", printValue("homeworld")],
    ["Concept", printValue("concept"), true],
    ["XP / Advancement", printValue("xp")],
    ["Career / Role", printValue("careerRole")],
    ["Doctrine / Unit", printValue("doctrine")],
    ["Restriction", printValue("restriction")],
    ["Talent Faction", printValue("talentFaction")]
  ].filter(([, value]) => value);

  const identity = printSection("Character Identity", `<div class="print-fields">${fields.map(field => printField(...field)).join("")}</div>`);

  const mainSkillChips = mainSkills.map(printMainSkillCard).join("");
  const tracks = [
    ["HP / Vigor", printValue("hp")], ["Firewall", printValue("firewall")], ["Armour", printValue("armour")],
    ["Mental Stress", printValue("mentalStress")], ["Infinity Points", printValue("infinityPoints")], ["Credits", printValue("credits")],
    ["Momentum", printValue("momentum")], ["Heat", printValue("heat")], ["Wounds", printValue("wounds")]
  ].map(([label, value]) => `<div class="print-track"><span>${printEscape(label)}</span><strong>${printText(value, "-")}</strong></div>`).join("");

  const core = printSection("Main Skills & Resources", `<div class="print-core-grid">
    <div class="print-main-skills">${mainSkillChips}</div>
    <div class="print-tracks">${tracks}</div>
  </div>`);

  const skillBody = `<div class="print-skills-grid">
    ${printSkillTable(skillOrder.slice(0, 16))}
    ${printSkillTable(skillOrder.slice(16))}
  </div>
  <p class="print-skill-reminder">Main skills never use Focus. Each sub-skill inherits its Base value from its parent main skill; Rating bonuses and Focus are printed separately.</p>`;
  const skills = printSection("Skills", skillBody);

  return `<section class="print-page">${printHeader(page, total, "Identity, main skills, resources and skill calculations")}${identity}${core}${skills}</section>`;
}

function printMetaGrid(entries) {
  const cells = entries.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([label, value]) => `<div class="print-option-meta-cell"><span>${printEscape(label)}</span><b>${printText(value, "-")}</b></div>`)
    .join("");
  return cells ? `<div class="print-option-meta-grid">${cells}</div>` : "";
}

function printCopyBox(label, value, limit, extraClass = "") {
  const text = printShortText(value, limit);
  if (!text) return "";
  return `<div class="print-copy-box ${extraClass}">
    <span class="print-copy-label">${printEscape(label)}</span>
    <div class="print-copy-text">${text}</div>
  </div>`;
}

function printOptionCard(kind, item, descriptionLimit = 280, effectLimit = 560) {
  const isTrait = kind === "trait";
  const meta = isTrait
    ? [["Primary", item.primary], ["Secondary", item.secondary], ["Rarity", item.rarity], ["Cost", item.cost]]
    : [["Level", item.level], ["Career", item.career], ["Doctrine", item.doctrine], ["Skill Links", [item.primary, item.secondary].filter(Boolean).join(" / ")]];
  const descriptionLabel = isTrait ? "Brief Description" : "Description";
  const descriptionValue = isTrait ? item.brief : item.description;
  return `<article class="print-option-card ${isTrait ? "trait" : "talent"}">
    <div class="print-option-head"><span class="print-option-name">${printEscape(item.name)}</span><span class="print-option-tag">${isTrait ? "Trait" : "Talent"}</span></div>
    <div class="print-option-body">
      ${printMetaGrid(meta)}
      ${printCopyBox(descriptionLabel, descriptionValue, descriptionLimit, "print-copy-short")}
      ${printCopyBox("Effect", item.effect, effectLimit, "print-copy-effect")}
    </div>
  </article>`;
}

function buildPrintSupplementMarkup(content) {
  const blocks = [
    content.conditions.length ? `<div>${printSection("Conditions / Status", printConditionsTable(content.conditions))}</div>` : "",
    content.notes.length ? `<div>${printSection("Contacts, Lifepath & Notes", printNoteSection(content.notes))}</div>` : ""
  ].filter(Boolean);
  if (!blocks.length) return "";
  return `<div class="print-supplement-grid${blocks.length === 1 ? " one-column" : ""}">${blocks.join("")}</div>`;
}

function buildPrintOptionsPage(page, total, traits, talents, beginner = false, supplementMarkup = "") {
  const traitCards = traits.length ? traits.map(item => printOptionCard("trait", item)).join("") : "";
  const talentCards = talents.length ? talents.map(item => printOptionCard("talent", item)).join("") : "";
  const columns = [
    traitCards ? `<div>${printSection(beginner ? "Starting Trait" : "Traits", `<div class="print-option-list">${traitCards}</div>`)}</div>` : "",
    talentCards ? `<div>${printSection(beginner ? "Starting Talent" : "Talents", `<div class="print-option-list">${talentCards}</div>`)}</div>` : ""
  ].filter(Boolean);
  const gridClass = columns.length === 1 ? "print-options-grid one-column" : "print-options-grid";
  return `<section class="print-page">${printHeader(page, total, beginner ? "Starter trait and talent" : "Selected traits and talents")}
    <div class="${gridClass}">${columns.join("")}</div>
    ${supplementMarkup}
  </section>`;
}

function buildPrintSingleOptionsPage(page, total, kind, items, supplementMarkup = "") {
  const title = kind === "trait" ? "Traits" : "Talents";
  const cards = items.map(item => printOptionCard(kind, item)).join("");
  return `<section class="print-page">${printHeader(page, total, `Selected ${title.toLowerCase()}`)}
    ${printSection(title, `<div class="print-option-list">${cards}</div>`)}
    ${supplementMarkup}
  </section>`;
}

function printGearTable(kind, items, options = {}) {
  const isWeapon = kind === "weapon";
  const hasPlayerNotes = items.some(item => item.note);
  const compactBeginner = Boolean(options.compactBeginner);
  // Beginner gear rows are intentionally concise so that both sections can share
  // the dossier page without clipping descriptions in the PDF.
  const rulesLimit = compactBeginner ? (isWeapon ? 120 : 118) : (items.length >= 8 ? 96 : 210);
  const rows = items.map(item => {
    const entry = item.entry;
    const type = isWeapon ? inferWeaponSkill(entry.name || "") : entry.type || "";
    const rules = entry.mechanic || entry.brief || "";
    return `<tr>
      <td>${item.index}</td>
      <td>${printEscape(entry.name)}</td>
      <td>${printText(type, "")}</td>
      <td>${printText(entry.weight, "")}</td>
      <td>${printShortText(rules, rulesLimit)}</td>
      ${hasPlayerNotes ? `<td>${printShortText(item.note, 70)}</td>` : ""}
    </tr>`;
  }).join("");

  const name = isWeapon ? "Weapon" : "Item";
  const aux = isWeapon ? "Skill" : "Type";
  return `<table class="print-table print-gear-table print-${isWeapon ? "weapon" : "equipment"}-table ${hasPlayerNotes ? "with-player-notes" : "no-player-notes"}">
    <thead><tr><th>#</th><th>${name}</th><th>${aux}</th><th>Weight</th><th>Rules / Notes</th>${hasPlayerNotes ? "<th>Player Notes</th>" : ""}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function printConditionsTable(items) {
  if (!items.length) return "";
  const rows = items.map(item => `<tr>
    <td>${item.index}</td>
    <td>${printEscape(item.entry.name)}</td>
    <td>${printShortText(item.entry.description, 170)}</td>
    <td>${printShortText(item.entry.removal, 130)}</td>
    <td>${printShortText(item.note, 110)}</td>
  </tr>`).join("");
  return `<table class="print-table print-condition-table">
    <thead><tr><th>#</th><th>Condition</th><th>Description</th><th>Removal / Check</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function printNoteSection(notes) {
  if (!notes.length) return "";
  return `<div class="print-note-list">${notes.map(([label, value]) => `<div class="print-note"><b>${printEscape(label)}</b><span>${printShortText(value, 190)}</span></div>`).join("")}</div>`;
}

function buildPrintGearMarkup(content, extraClass = "") {
  const { weapons, equipment } = content;
  const gearSections = [
    weapons.length ? `<div>${printSection(`Weapons - ${weapons.length} Selected`, printGearTable("weapon", weapons))}</div>` : "",
    equipment.length ? `<div>${printSection(`Equipment - ${equipment.length} Selected`, printGearTable("equipment", equipment))}</div>` : ""
  ].filter(Boolean);
  if (!gearSections.length) return "";
  return `<div class="print-gear-grid${gearSections.length === 1 ? " one-column" : ""} ${extraClass}">${gearSections.join("")}</div>`;
}

function buildPrintGearPage(page, total, content) {
  return `<section class="print-page">${printHeader(page, total, "Weapons and equipment")}
    ${buildPrintGearMarkup(content)}
    <div class="print-rule-reminder">Gear is split into Weapons and Equipment. Empty Weapon and Equipment rows are omitted from this compact print portfolio.</div>
  </section>`;
}

function buildPrintBeginnerGearRows(content) {
  const sections = [
    content.weapons.length
      ? `<div class="print-beginner-gear-row print-beginner-weapons-row">${printSection(`Weapons - ${content.weapons.length} Selected`, printGearTable("weapon", content.weapons, { compactBeginner: true }))}</div>`
      : "",
    content.equipment.length
      ? `<div class="print-beginner-gear-row print-beginner-equipment-row">${printSection(`Equipment - ${content.equipment.length} Selected`, printGearTable("equipment", content.equipment, { compactBeginner: true }))}</div>`
      : ""
  ].filter(Boolean);
  if (!sections.length) return "";
  return `<div class="print-beginner-gear-stack">${sections.join("")}</div>`;
}

function buildPrintBeginnerDossierPage(page, total, traits, talents, content) {
  const traitCards = traits.length ? traits.map(item => printOptionCard("trait", item, 440, 760)).join("") : "";
  const talentCards = talents.length ? talents.map(item => printOptionCard("talent", item, 440, 760)).join("") : "";
  const optionColumns = [
    traitCards ? `<div>${printSection("Starting Trait", `<div class="print-option-list">${traitCards}</div>`)}</div>` : "",
    talentCards ? `<div>${printSection("Starting Talent", `<div class="print-option-list">${talentCards}</div>`)}</div>` : ""
  ].filter(Boolean);
  const optionGridClass = optionColumns.length === 1 ? "print-options-grid one-column" : "print-options-grid";
  const gearMarkup = buildPrintBeginnerGearRows(content);
  // The generated beginner's default campaign reminder is boilerplate, not a player note.
  // Omitting it in print protects equal space for the Weapons and Equipment rows.
  const beginnerNotes = content.notes.filter(([, value]) => value !== "Portfolio-based beginner character - review and personalise before play.");
  const supplementMarkup = buildPrintSupplementMarkup({ ...content, notes: beginnerNotes });

  return `<section class="print-page print-beginner-dossier-page">${printHeader(page, total, "Starter trait, talent, selected gear and notes")}
    ${optionColumns.length ? `<div class="${optionGridClass} print-beginner-options-grid">${optionColumns.join("")}</div>` : ""}
    ${gearMarkup}
    ${supplementMarkup ? `<div class="print-beginner-supplement">${supplementMarkup}</div>` : ""}
    <div class="print-rule-reminder">Empty Trait, Talent, Weapon, Equipment, Condition and note fields are omitted. Main skills never use Focus; Focus and Rating bonuses remain separately recorded.</div>
  </section>`;
}

function buildPrintSupplementPage(page, total, content) {
  return `<section class="print-page">${printHeader(page, total, "Conditions, contacts, lifepath and notes")}${buildPrintSupplementMarkup(content)}</section>`;
}

function isBeginnerPrintCharacter() {
  const xp = printValue("xp").toLowerCase();
  const player = printValue("player").toLowerCase();
  const notes = printValue("campaignNotes").toLowerCase();
  return xp.includes("starting character") || player.includes("starting character") || notes.includes("portfolio-based beginner");
}

function printSupplementContent() {
  const weapons = selectedPrintGear("weapon");
  const equipment = selectedPrintGear("equipment");
  const conditions = selectedPrintConditions();
  const notes = [
    ["Campaign Notes", printValue("campaignNotes")],
    ["Faction / Doctrine Contact", printValue("contactFaction")],
    ["Personal Contact / Rival", printValue("contactPersonal")],
    ["Lifepath Event / Secret", printValue("lifepathSecret")],
    ["Session Notes", printValue("scratchNotes")],
    ["Campaign Log", printValue("campaignLongNotes")]
  ].filter(([, value]) => value);
  return { weapons, equipment, conditions, notes };
}

function buildPrintPortfolio() {
  const container = document.getElementById("printPortfolio");
  if (!container) return;

  const beginner = isBeginnerPrintCharacter();
  const traits = selectedPrintTraits();
  const talents = selectedPrintTalents();
  const supplement = printSupplementContent();
  const hasGear = supplement.weapons.length || supplement.equipment.length;
  const hasSupplement = supplement.conditions.length || supplement.notes.length;
  const builders = [
    (page, total) => buildPrintCorePage(page, total)
  ];

  if (beginner) {
    // A generated beginner has one Trait, one Talent, two weapons and five items.
    // Keep its selected content together on a single compact dossier page.
    if (traits.length || talents.length || hasGear || hasSupplement) {
      builders.push((page, total) => buildPrintBeginnerDossierPage(page, total, traits, talents, supplement));
    }
  } else if (traits.length && talents.length) {
    const conditionsOnly = { ...supplement, notes: [] };
    const notesOnly = { ...supplement, conditions: [] };
    builders.push((page, total) => buildPrintSingleOptionsPage(page, total, "trait", traits, buildPrintSupplementMarkup(conditionsOnly)));
    builders.push((page, total) => buildPrintSingleOptionsPage(page, total, "talent", talents, buildPrintSupplementMarkup(notesOnly)));
    if (hasGear) builders.push((page, total) => buildPrintGearPage(page, total, supplement));
  } else {
    if (traits.length) builders.push((page, total) => buildPrintSingleOptionsPage(page, total, "trait", traits));
    if (talents.length) builders.push((page, total) => buildPrintSingleOptionsPage(page, total, "talent", talents));
    if (hasSupplement) builders.push((page, total) => buildPrintSupplementPage(page, total, supplement));
    if (hasGear) builders.push((page, total) => buildPrintGearPage(page, total, supplement));
  }

  // A full manual sheet is capped at four pages by distributing Conditions and
  // Notes across the Trait and Talent pages whenever both are present.
  const total = builders.length;
  container.innerHTML = builders.map((build, index) => build(index + 1, total)).join("");
}

const PRINT_WINDOW_MARKER = "Infinity 2D20 Compact Portfolio v10 - balanced beginner gear rows";

function printStylesheetUrl() {
  return new URL("styles.css", window.location.href).href;
}

function compactPrintWindowHtml(markup, title) {
  const stylesheet = printEscape(printStylesheetUrl());
  const safeTitle = printEscape(title || PRINT_WINDOW_MARKER);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="${stylesheet}">
  <style>
    /* This document contains only the generated print portfolio. */
    html, body { margin: 0; padding: 0; background: #fff; }
    body.print-window { background: #fff; }
    body.print-window #printPortfolio { display: block !important; }
    body.print-window .print-page { margin: 0 auto; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; }
      body.print-window #printPortfolio { display: block !important; }
    }
  </style>
</head>
<body class="print-window print-portfolio-mode">
  <section id="printPortfolio" aria-label="Compact print portfolio">${markup}</section>
  <script>
    window.addEventListener('load', function () {
      // CSS must finish loading before the native print preview takes its snapshot.
      window.setTimeout(function () {
        window.focus();
        window.print();
      }, 500);
    });
  <\/script>
</body>
</html>`;
}

function printCharacterSheet() {
  buildPrintPortfolio();
  const source = document.getElementById("printPortfolio");
  const markup = source?.innerHTML?.trim() || "";
  if (!markup) {
    alert("The compact portfolio could not be built. Please refresh the page and try again.");
    return;
  }

  // Open synchronously from the user action so browsers do not block the print window.
  const printWindow = window.open("", "_blank", "popup=yes,width=1200,height=900");
  if (!printWindow) {
    alert("Your browser blocked the compact print window. Allow pop-ups for this site, then select Open Compact Print Portfolio again.");
    return;
  }

  const characterName = printValue("characterName") || "Infinity 2D20 Character";
  printWindow.document.open();
  printWindow.document.write(compactPrintWindowHtml(markup, `${characterName} - ${PRINT_WINDOW_MARKER}`));
  printWindow.document.close();
}

// Ctrl/Cmd+P is redirected before the browser begins its normal editable-sheet preview.
document.addEventListener("keydown", event => {
  const key = String(event.key || "").toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "p") {
    event.preventDefault();
    event.stopPropagation();
    printCharacterSheet();
  }
}, true);

// Fallback for the browser menu's native Print command. The dedicated button and
// Ctrl/Cmd+P route above are the reliable path because they open a clean document.
function activateCompactPrintMode() {
  buildPrintPortfolio();
  document.body.classList.add("print-portfolio-mode");
}

function restoreCompactPrintMode() {
  window.setTimeout(() => document.body.classList.remove("print-portfolio-mode"), 180);
}

window.addEventListener("beforeprint", activateCompactPrintMode);
window.addEventListener("afterprint", restoreCompactPrintMode);

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
  clearFocusAllocations();
  applyArmourFromEquipment();
  refreshSaveSlots();

  document.getElementById("randomCharacterBtn").addEventListener("click", randomCharacter);
  document.getElementById("randomBeginnerCharacterBtn").addEventListener("click", randomBeginnerCharacter);
  document.getElementById("saveBtn").addEventListener("click", saveCharacterToBrowser);
  document.getElementById("loadBtn").addEventListener("click", loadCharacterFromBrowser);
  document.getElementById("deleteSaveBtn").addEventListener("click", deleteSelectedSave);
  document.getElementById("newSheetBtn").addEventListener("click", newCharacterSheet);
  document.getElementById("printBtn").addEventListener("click", printCharacterSheet);
  document.getElementById("downloadBtn").addEventListener("click", downloadJSON);
  document.getElementById("exportAllBtn").addEventListener("click", exportAllSaves);
  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importJSONFile(file);
    e.target.value = "";
  });
});
