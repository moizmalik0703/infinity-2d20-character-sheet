const DATA = window.INFINITY_DATA || window.DATA;

// v11 boot guard: accept either historical data-global name and fail visibly instead of
// leaving a partially rendered sheet with inactive controls.
if (!DATA || !DATA.lists || !Array.isArray(DATA.traits) || !Array.isArray(DATA.talents)) {
  window.addEventListener("DOMContentLoaded", () => {
    const warning = document.createElement("div");
    warning.setAttribute("role", "alert");
    warning.style.cssText = "margin:1rem auto;padding:1rem;max-width:900px;border:2px solid #8b1e1e;background:#fff4f4;color:#5c1010;font:700 16px/1.4 Arial,sans-serif;";
    warning.textContent = "Character data failed to load. Refresh the page once; if it persists, re-upload both data.js and app.js from the same release package.";
    document.body.prepend(warning);
  });
  throw new Error("Infinity 2D20 data payload is missing or invalid.");
}
window.INFINITY_DATA = DATA;
window.DATA = DATA;
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

// Career and Faction/Homeworld relationship rules.
// `careerRole` and `restriction` only appear below for one-time migration of older saved characters.
const GENERAL_CAREER = "General / Unrestricted";
const legacyCareerEligibility = new Map();

function uniqueText(values) {
  return [...new Set((values || []).map(value => String(value || "").trim()).filter(Boolean))];
}

function normalizeEligibilityValues(value) {
  return uniqueText(Array.isArray(value) ? value : [value]);
}

function careerOptions() {
  const listed = DATA.lists.careers || DATA.lists.careerRoles || [];
  const fromTalents = (DATA.talents || []).map(talent => talent.career);
  return uniqueText([GENERAL_CAREER, ...listed, ...fromTalents]);
}

function selectedCareer() {
  return inputField("career")?.value || GENERAL_CAREER;
}

function careerRestrictionsFor(career) {
  if (!career || career === GENERAL_CAREER) return ["No Restrictions"];
  const fromTalents = (DATA.talents || [])
    .filter(talent => talent.career === career)
    .map(talent => talent.restriction || "No Restrictions");
  const migrated = legacyCareerEligibility.get(career) || [];
  const restrictions = uniqueText([...fromTalents, ...migrated]);
  return restrictions.length ? restrictions : ["No Restrictions"];
}


function setCareerChoice(career, savedEligibility = []) {
  const select = inputField("career");
  if (!select) return;
  const value = String(career || GENERAL_CAREER).trim() || GENERAL_CAREER;
  const eligibility = normalizeEligibilityValues(savedEligibility).filter(value => value !== "No Restrictions");
  if (eligibility.length) legacyCareerEligibility.set(value, eligibility);
  else legacyCareerEligibility.delete(value);
  ensureSelectValue(select, value);
  if (!select.value) select.value = GENERAL_CAREER;
}

function migrateCharacterState(rawState) {
  const state = { ...(rawState || {}) };
  if (!state.career && state.careerRole) state.career = state.careerRole;

  const legacyEligibility = normalizeEligibilityValues(
    state.careerEligibility ||
    state.careerRestrictions ||
    state.careerRestriction ||
    state.restriction ||
    []
  );
  if (legacyEligibility.length) state.careerEligibility = legacyEligibility;

  delete state.careerRole;
  delete state.careerRestrictions;
  delete state.careerRestriction;
  delete state.restriction;
  return state;
}

function factionRecord(faction) {
  const selected = String(faction || "");
  return (DATA.factions || []).find(entry => entry.faction === selected) ||
    (DATA.factions || []).find(entry => selected && entry.faction.startsWith(selected + " -")) ||
    (DATA.factions || []).find(entry => selected && selected.startsWith(entry.faction + " -")) ||
    null;
}

function homeworldsForFaction(faction) {
  const selected = String(faction || "");
  const explicit = DATA.homeworldsByFaction?.[selected];
  if (Array.isArray(explicit) && explicit.length) return uniqueText(explicit);

  const record = factionRecord(selected);
  if (!record?.homeworld) return [];
  return uniqueText(String(record.homeworld).split(/[,;]/));
}

function isValidFactionHomeworld(faction, homeworld) {
  return Boolean(faction && homeworld && homeworldsForFaction(faction).includes(homeworld));
}

function closestFactionHomeworld(faction, preferred = "") {
  const choices = homeworldsForFaction(faction);
  const requested = String(preferred || "").trim();
  if (!requested) return choices[0] || "";
  if (choices.includes(requested)) return requested;

  const normalized = requested.toLowerCase();
  const partial = choices.find(choice => {
    const candidate = choice.toLowerCase();
    return candidate.includes(normalized) || normalized.includes(candidate);
  });
  if (partial) return partial;

  const tokenMatch = choices.find(choice => choice.toLowerCase().split(/\s+/)
    .some(token => token.length > 3 && normalized.includes(token)));
  return tokenMatch || "";
}

function refreshHomeworldChoices({ value, allowClosestMatch = false } = {}) {
  const faction = inputField("faction")?.value || "";
  const select = inputField("homeworld");
  if (!select) return;

  const requested = value !== undefined ? String(value || "").trim() : select.value;
  const choices = homeworldsForFaction(faction);
  makeOptions(select, choices, faction ? "Choose..." : "Choose Faction first...");
  select.disabled = !faction;
  select.title = faction
    ? `Homeworld / Habitat choices linked to ${faction}.`
    : "Choose a Faction first to filter Homeworld / Habitat choices.";

  const hint = document.getElementById("homeworldRelationshipHint");
  if (hint) {
    hint.textContent = faction
      ? `Homeworld / Habitat choices are linked to ${faction}.`
      : "Choose a Faction to see its related homeworlds and habitats.";
  }

  if (!faction) {
    select.value = "";
    return;
  }
  if (choices.includes(requested)) select.value = requested;
  else if (allowClosestMatch) select.value = closestFactionHomeworld(faction, requested);
  else select.value = "";
}

function setHomeworldValue(value, { allowClosestMatch = false } = {}) {
  refreshHomeworldChoices({ value, allowClosestMatch });
  inputField("homeworld")?.dispatchEvent(new Event("change"));
}

function validateFactionHomeworld({ showMessage = false } = {}) {
  const faction = inputField("faction")?.value || "";
  const homeworld = inputField("homeworld")?.value || "";
  if (!faction && !homeworld) return true;

  const valid = isValidFactionHomeworld(faction, homeworld);
  if (!valid && showMessage) {
    alert("Choose a Homeworld / Habitat from the options linked to the selected Faction before saving.");
  }
  return valid;
}

function pruneLegacyProfileFields() {
  const retired = ["doctrine", "talentFaction", "concept", "careerRole", "restriction"];
  retired.forEach(field => {
    document.querySelectorAll(`[data-field="${field}"]`).forEach(control => {
      const label = control.closest("label");
      if (label) label.remove(); else control.remove();
    });
  });

  document.querySelectorAll("[data-identity-grid] label").forEach(label => {
    const field = label.querySelector("[data-field]")?.dataset.field || "";
    const text = (label.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (retired.includes(field) ||
        /^(doctrine|unit tree|talent faction|concept|campaign notes|career\s*\/\s*role|restriction)\b/.test(text)) {
      label.remove();
    }
  });

  const campaign = inputField("campaignNotes");
  const page3 = document.querySelector(".page-3");
  const bottomAnchor = page3?.querySelector(".two-column.lower");
  const campaignLabel = campaign?.closest("label");
  if (campaignLabel && page3 && !campaignLabel.closest(".page-3")) {
    if (bottomAnchor) bottomAnchor.insertAdjacentElement("afterend", campaignLabel);
    else page3.appendChild(campaignLabel);
  }
}

function initLists() {
  document.querySelectorAll("select[data-list]").forEach(select => {
    const listName = select.dataset.list;
    makeOptions(select, DATA.lists[listName] || [], "Choose...");
  });

  const career = inputField("career");
  if (career) {
    makeOptions(career, careerOptions(), "Choose...");
    career.value = GENERAL_CAREER;
    career.addEventListener("change", refreshRestrictionChoices);
  }

  const faction = inputField("faction");
  if (faction) {
    faction.addEventListener("change", () => {
      // Changing Faction clears a Homeworld / Habitat that does not belong to it.
      refreshHomeworldChoices({ allowClosestMatch: false });
    });
  }

  refreshHomeworldChoices({ allowClosestMatch: false });
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

function activeRestrictions() {
  return careerRestrictionsFor(selectedCareer());
}

function activeRestriction() {
  return activeRestrictions().join(" | ") || "No Restrictions";
}

function isEligibleForRestriction(item) {
  const career = selectedCareer();
  const restrictions = activeRestrictions();
  const itemRestriction = item.restriction || "No Restrictions";

  // Talents with a defined Career only appear under that Career.
  if (item.career && career !== GENERAL_CAREER && item.career !== career) return false;
  if (item.career && career === GENERAL_CAREER) return false;

  // General entries remain available to every Career.
  if (itemRestriction === "No Restrictions") return true;
  return restrictions.includes(itemRestriction);
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
  ["level","career","prereq","primary","secondary","restriction","rarity","cost","description","effect"].forEach(k => {
    const dataKey = k === "prereq" ? "prerequisite" : k;
    const output = document.querySelector(`[data-talent-${k}="${index}"]`);
    if (output) setText(output, t[dataKey]);
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
      <label>Prereq<div class="output" data-talent-prereq="${i}"></div></label>
      <label>Primary<div class="output" data-talent-primary="${i}"></div></label>
      <label>Secondary<div class="output" data-talent-secondary="${i}"></div></label>
      <label>Eligibility<div class="output" data-talent-restriction="${i}"></div></label>
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
    const career = selectedCareer();
    const selectedFilters = activeRestrictions();
    const eligibility = selectedFilters.filter(value => value !== "No Restrictions");
    status.textContent = !eligibility.length
      ? `Career: ${career} — all ${DATA.traits.length} Traits and ${DATA.talents.length} Talents are available.`
      : `Career: ${career} — eligibility: ${eligibility.join("; ")}. ${traits.length} Traits (including general options) and ${talents.length} Talents are available.`;
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

  // Career is the sole user-facing eligibility control.
  state.careerEligibility = activeRestrictions().filter(value => value !== "No Restrictions");
  state.startBonuses = { ...startingSkillBonuses };
  return state;
}
function applyState(rawState) {
  const state = migrateCharacterState(rawState);
  if (!state) return;
  startingSkillBonuses = { ...(state.startBonuses || {}) };

  document.querySelectorAll("input[data-field], textarea[data-field], select[data-field]").forEach(el => {
    if (state[el.dataset.field] !== undefined) el.value = state[el.dataset.field];
  });

  setCareerChoice(state.career || GENERAL_CAREER, state.careerEligibility || []);
  refreshHomeworldChoices({ value: state.homeworld || "", allowClosestMatch: true });
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
  if (field === "homeworld") {
    setHomeworldValue(value, { allowClosestMatch: false });
    return;
  }

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

  setFieldValue("characterName", `${randomChoice(RANDOM_GIVEN_NAMES)} "${randomChoice(RANDOM_CALLSIGNS)}"`);
  setFieldValue("player", "");
  setFieldValue("faction", faction);
  refreshHomeworldChoices({ preserve: false });
  setHomeworldValue(randomChoice(homeworldsForFaction(faction)) || "");
  setFieldValue("xp", "0");
  setFieldValue("campaignNotes", "Generated random character - review before play.");
  setCareerChoice(anchorTalent.career || GENERAL_CAREER, anchorTalent.restriction || "No Restrictions");
  refreshRestrictionChoices();

  setDefaultTracks();
  clearEditableNotes();
  clearTraitAndTalentSlots();
  setMainSkillsToStartingBaseline();

  const careerTalents = eligibleTalents().filter(talent => String(talent.level) === "1");
  const chosenTalents = randomDistinct(careerTalents.length >= 3 ? careerTalents : levelOneTalents, 3);
  const careerTraits = eligibleTraits();
  const chosenTraits = randomDistinct(careerTraits.length >= 3 ? careerTraits : DATA.traits, 3);
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

  const starterFaction = factionForTalentFaction(template.talentFaction || template.faction);
  setFieldValue("characterName", template.name);
  setFieldValue("player", "Starting Character");
  setFieldValue("faction", starterFaction);
  setHomeworldValue(closestFactionHomeworld(starterFaction, template.homeworld), { allowClosestMatch: true });
  setFieldValue("xp", "Starting character");
  setCareerChoice(template.career || GENERAL_CAREER, template.restriction || "No Restrictions");
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
  if (!validateFactionHomeworld({ showMessage: true })) return;
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
          localStorage.setItem(SAVE_PREFIX + item.id, JSON.stringify(migrateCharacterState(parsed.saves[item.id])));
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

  setCareerChoice(GENERAL_CAREER, "No Restrictions");
  refreshHomeworldChoices({ preserve: false });
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

  /* Inline geometry is intentional: every print path receives the exact same six columns. */
  return `<div class="print-skills-panel" data-equal-skills-panel style="flex:0 0 calc((100% - 1.7mm) / 2);width:calc((100% - 1.7mm) / 2);min-width:0;box-sizing:border-box;">
    <table class="print-table print-skills-table" style="width:100%;min-width:0;max-width:100%;table-layout:fixed;">
      <colgroup>
        <col class="print-skill-col-name" style="width:20%">
        <col class="print-skill-col-base" style="width:9%">
        <col class="print-skill-col-rating" style="width:9%">
        <col class="print-skill-col-total" style="width:9%">
        <col class="print-skill-col-focus" style="width:9%">
        <col class="print-skill-col-source" style="width:44%">
      </colgroup>
      <thead><tr><th>Skill</th><th>Base</th><th>Rating +</th><th>Total</th><th>Focus</th><th>Source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
function buildPrintCorePage(page, total) {
  const fields = [
    ["Character Name", printValue("characterName") || "Unnamed Character", true],
    ["Player", printValue("player")],
    ["Faction", printValue("faction")],
    ["Homeworld / Habitat", printValue("homeworld")],
    ["XP / Advancement", printValue("xp")],
    ["Career", printValue("career")]
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

  const skillBody = `<div class="print-skills-grid" data-equal-skills-grid style="display:flex;width:100%;gap:1.7mm;align-items:flex-start;box-sizing:border-box;">
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
    : [["Level", item.level], ["Career", item.career], ["Skill Links", [item.primary, item.secondary].filter(Boolean).join(" / ")]];
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
  const compactFull = Boolean(options.compactFull);
  // Full-character gear is constrained to two equal-height print rows. Compact rules text
  // preserves the four-page cap; extended rules remain available in the browser sheet.
  const rulesLimit = compactBeginner ? (isWeapon ? 96 : 88) : (compactFull ? (isWeapon ? 108 : 92) : (items.length >= 8 ? 96 : 210));
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
  const widths = compactBeginner
    ? (hasPlayerNotes
      ? (isWeapon ? [3, 15, 8, 7, 49, 18] : [3, 15, 8, 7, 49, 18])
      : (isWeapon ? [3, 17, 9, 7, 64] : [3, 16, 9, 7, 65]))
    : (compactFull
      ? (hasPlayerNotes
        ? (isWeapon ? [3, 14, 8, 7, 48, 20] : [3, 14, 8, 7, 48, 20])
        : (isWeapon ? [3, 16, 9, 7, 65] : [3, 16, 9, 7, 65]))
      : (hasPlayerNotes ? [5, 24, 13, 11, 36, 11] : [5, 26, 13, 11, 45]));
  const cols = widths.map((width, index) => `<col class="print-gear-col-${index + 1}" style="width:${width}%">`).join("");
  return `<table class="print-table print-gear-table print-${isWeapon ? "weapon" : "equipment"}-table ${hasPlayerNotes ? "with-player-notes" : "no-player-notes"}" style="width:100%;table-layout:fixed;">
    <colgroup>${cols}</colgroup>
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

function printLockedFullGearBlock(kind, items) {
  const isWeapon = kind === "weapon";
  const singular = isWeapon ? "Weapon" : "Item";
  const auxiliary = isWeapon ? "Skill" : "Type";
  const rows = items.map(item => {
    const entry = item.entry || {};
    const type = isWeapon ? inferWeaponSkill(entry.name || "") : entry.type || "";
    const rawRules = [entry.mechanic || entry.brief || "", item.note ? `Player: ${item.note}` : ""].filter(Boolean).join(" ");
    const compactRules = printShortText(rawRules, isWeapon ? 78 : 72);
    return `<div class="print-locked-gear-row" role="row">
      <div class="print-locked-gear-cell print-locked-gear-index" role="cell">${item.index}</div>
      <div class="print-locked-gear-cell" role="cell">${printEscape(entry.name || "-")}</div>
      <div class="print-locked-gear-cell" role="cell">${printText(type, "-")}</div>
      <div class="print-locked-gear-cell" role="cell">${printText(entry.weight, "-")}</div>
      <div class="print-locked-gear-cell print-locked-gear-rules" role="cell">${compactRules || "-"}</div>
    </div>`;
  }).join("");

  return `<section class="print-locked-full-gear-block print-locked-full-${isWeapon ? "weapons" : "equipment"}" data-locked-full-gear-block>
    <div class="print-locked-full-gear-title">${isWeapon ? "Weapons" : "Equipment"} - ${items.length} Selected</div>
    <div class="print-locked-gear-table" role="table" aria-label="${isWeapon ? "Weapons" : "Equipment"}">
      <div class="print-locked-gear-row print-locked-gear-header" role="row">
        <div role="columnheader">#</div><div role="columnheader">${singular}</div><div role="columnheader">${auxiliary}</div><div role="columnheader">Weight</div><div role="columnheader">Rules / Notes</div>
      </div>
      ${rows}
    </div>
  </section>`;
}

function buildPrintFullGearRows(content) {
  const sections = [
    content.weapons.length ? printLockedFullGearBlock("weapon", content.weapons) : "",
    content.equipment.length ? printLockedFullGearBlock("equipment", content.equipment) : ""
  ].filter(Boolean);
  if (!sections.length) return "";
  return `<div class="print-locked-full-gear-stack" data-locked-full-gear-stack>${sections.join("")}</div>`;
}

function buildPrintGearPage(page, total, content) {
  return `<section class="print-page print-full-gear-page">${printHeader(page, total, "Weapons and equipment")}
    ${buildPrintFullGearRows(content)}
    <div class="print-rule-reminder">Gear is split into Weapons and Equipment. Empty Weapon and Equipment rows are omitted. Longer rules are abbreviated here and remain available in the browser sheet.</div>
  </section>`;
}

function buildPrintBeginnerGearRows(content) {
  const sections = [
    content.weapons.length
      ? `<div class="print-beginner-gear-row print-beginner-weapons-row" data-equal-gear-row style="min-height:34mm;min-width:0;box-sizing:border-box;">${printSection(`Weapons - ${content.weapons.length} Selected`, printGearTable("weapon", content.weapons, { compactBeginner: true }))}</div>`
      : "",
    content.equipment.length
      ? `<div class="print-beginner-gear-row print-beginner-equipment-row" data-equal-gear-row style="min-height:34mm;min-width:0;box-sizing:border-box;">${printSection(`Equipment - ${content.equipment.length} Selected`, printGearTable("equipment", content.equipment, { compactBeginner: true }))}</div>`
      : ""
  ].filter(Boolean);
  if (!sections.length) return "";
  return `<div class="print-beginner-gear-stack" data-equal-gear-stack style="display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto;gap:2.2mm;width:100%;min-width:0;box-sizing:border-box;">${sections.join("")}</div>`;
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
    ["Faction / Doctrine Contact", printValue("contactFaction")],
    ["Personal Contact / Rival", printValue("contactPersonal")],
    ["Lifepath Event / Secret", printValue("lifepathSecret")],
    ["Session Notes", printValue("scratchNotes")],
    ["Campaign Notes", printValue("campaignNotes")]
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

const PRINT_WINDOW_MARKER = "Infinity 2D20 Compact Portfolio v21 - direct mobile landscape PDF";

function printStylesheetUrl() {
  const link = document.querySelector('link[data-portfolio-style]');
  return link?.href || new URL("styles-v14.css", window.location.href).href;
}

function embeddedPortfolioStyles() {
  return document.querySelector('style[data-portfolio-style]')?.textContent || "";
}

function compactPrintFrameHtml(markup, title, token) {
  const safeTitle = printEscape(title || PRINT_WINDOW_MARKER);
  const safeToken = JSON.stringify(String(token || ""));
  const styleText = embeddedPortfolioStyles().replace(/<\/style/gi, "<\\/style");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1123, height=794, initial-scale=1, maximum-scale=1, viewport-fit=cover">
  <title>${safeTitle}</title>
  <style>${styleText}
    /* v18: fixed A4 landscape geometry inside the export document. */
    @page{size:297mm 210mm!important;margin:7mm!important;}
    html{width:297mm!important;min-width:297mm!important;height:210mm!important;min-height:210mm!important;margin:0!important;padding:0!important;background:#fff!important;}
    body{width:297mm!important;min-width:297mm!important;height:210mm!important;min-height:210mm!important;margin:0!important;padding:0!important;background:#fff!important;}
    @media print{html,body{width:297mm!important;min-width:297mm!important;height:210mm!important;min-height:210mm!important;}}
    /* v15 hard geometry: critical rules live inside the print document. */
    body.print-window{background:#fff;}
    body.print-window #printPortfolio{display:block!important;width:283mm!important;min-width:283mm!important;margin:0 auto!important;}
    .print-skills-grid[data-equal-skills-grid]{display:flex!important;width:100%!important;gap:1.7mm!important;align-items:flex-start!important;box-sizing:border-box!important;}
    .print-skills-panel[data-equal-skills-panel]{flex:0 0 calc((100% - 1.7mm)/2)!important;width:calc((100% - 1.7mm)/2)!important;min-width:0!important;box-sizing:border-box!important;}
    .print-skills-table{width:100%!important;min-width:0!important;max-width:100%!important;table-layout:fixed!important;}
    .print-skills-table col.print-skill-col-name{width:20%!important;}
    .print-skills-table col.print-skill-col-base,.print-skills-table col.print-skill-col-rating,.print-skills-table col.print-skill-col-total,.print-skills-table col.print-skill-col-focus{width:9%!important;}
    .print-skills-table col.print-skill-col-source{width:44%!important;}
    .print-skills-table td:nth-child(6),.print-skills-table th:nth-child(6){white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;}
    .print-beginner-gear-stack[data-equal-gear-stack]{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto auto!important;gap:2.2mm!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;}
    .print-beginner-gear-row[data-equal-gear-row]{min-width:0!important;box-sizing:border-box!important;}
    .print-beginner-gear-row[data-equal-gear-row] .print-section{height:100%!important;margin-bottom:0!important;}
    .print-beginner-gear-row[data-equal-gear-row] .print-gear-table{width:100%!important;table-layout:fixed!important;}
    .print-beginner-equipment-row .print-equipment-table col.print-gear-col-5{width:65%!important;}
    .print-full-gear-stack[data-equal-full-gear-stack]{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(70mm,auto) minmax(70mm,auto)!important;gap:2.2mm!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;}
    .print-full-gear-row[data-equal-full-gear-row]{min-width:0!important;min-height:70mm!important;box-sizing:border-box!important;}
    .print-full-gear-row[data-equal-full-gear-row] .print-section{height:100%!important;margin-bottom:0!important;}
    .print-full-gear-row[data-equal-full-gear-row] .print-gear-table{width:100%!important;table-layout:fixed!important;}
    .print-full-equipment-row .print-equipment-table col.print-gear-col-5,.print-full-weapons-row .print-weapon-table col.print-gear-col-5{width:65%!important;}
    .print-full-gear-row[data-equal-full-gear-row] .print-gear-table td:nth-child(5){white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;}
    /* v17: random/manual gear uses standalone CSS-grid blocks; table auto-layout cannot alter these columns. */
    .print-locked-full-gear-stack[data-locked-full-gear-stack]{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:68mm 68mm!important;gap:2.2mm!important;width:100%!important;height:138.2mm!important;box-sizing:border-box!important;}
    .print-locked-full-gear-block[data-locked-full-gear-block]{height:68mm!important;min-height:68mm!important;max-height:68mm!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;border:.3mm solid #9aa7b1!important;border-radius:1.1mm!important;background:#fff!important;box-sizing:border-box!important;}
    .print-locked-full-gear-title{flex:0 0 auto!important;margin:0!important;padding:1.45mm 2.2mm 1.35mm!important;background:#1f4e79!important;color:#fff!important;font-size:8.2pt!important;line-height:1.1!important;font-weight:700!important;letter-spacing:.02em!important;text-transform:uppercase!important;}
    .print-locked-gear-table{flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;padding:1.25mm 1.55mm 1.35mm!important;box-sizing:border-box!important;}
    .print-locked-gear-row{display:grid!important;grid-template-columns:3% 16% 9% 7% 65%!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;}
    .print-locked-gear-row>div{min-width:0!important;padding:.30mm .46mm!important;border:.2mm solid #9aa7b1!important;border-right:0!important;border-bottom:0!important;font-size:5.1pt!important;line-height:1.13!important;overflow-wrap:anywhere!important;word-break:break-word!important;}
    .print-locked-gear-row>div:last-child{border-right:.2mm solid #9aa7b1!important;}
    .print-locked-gear-row:last-child>div{border-bottom:.2mm solid #9aa7b1!important;}
    .print-locked-gear-header>div{background:#1f4e79!important;color:#fff!important;font-size:5.1pt!important;line-height:1.04!important;font-weight:700!important;text-transform:uppercase!important;}
    .print-locked-gear-index{text-align:center!important;}
    .print-locked-gear-rules{display:block!important;max-height:2.65em!important;overflow:hidden!important;}
    @media print{html,body{margin:0!important;padding:0!important;}body.print-window #printPortfolio{display:block!important;}.print-page{margin:0 auto!important;}.print-locked-full-gear-stack[data-locked-full-gear-stack]{grid-template-rows:68mm 68mm!important;height:138.2mm!important;}.print-locked-full-gear-block[data-locked-full-gear-block]{height:68mm!important;min-height:68mm!important;max-height:68mm!important;}}
  
/* v24: legacy profile controls are removed; the unified Career field drives eligibility. */
.identity-grid label:has([data-field="doctrine"]),
.identity-grid label:has([data-field="talentFaction"]),
.identity-grid label:has([data-field="concept"]),
.identity-grid label:has([data-field="campaignNotes"]) { display:none !important; }
.card-talent [data-talent-doctrine],
.card-talent [data-talent-faction] { display:none !important; }
</style>
</head>
<body class="print-window print-portfolio-mode" data-print-orientation="landscape">
  <section id="printPortfolio" aria-label="Current character portfolio">${markup}</section>
  <script>
    function lockPortfolioGeometry(){
      document.querySelectorAll('[data-equal-skills-grid]').forEach(function(grid){
        var panels=[].slice.call(grid.querySelectorAll('[data-equal-skills-panel]'));
        if(panels.length!==2)return;
        var gridWidth=grid.getBoundingClientRect().width;
        var gap=parseFloat(getComputedStyle(grid).columnGap)||0;
        var panelWidth=Math.floor((gridWidth-gap)/2);
        panels.forEach(function(panel){
          panel.style.setProperty('flex','0 0 '+panelWidth+'px','important');
          panel.style.setProperty('width',panelWidth+'px','important');
          var table=panel.querySelector('.print-skills-table');
          if(table){
            table.style.setProperty('width',panelWidth+'px','important');
            table.style.setProperty('table-layout','fixed','important');
            var cols=table.querySelectorAll('col');
            [20,9,9,9,9,44].forEach(function(width,index){if(cols[index])cols[index].style.setProperty('width',width+'%','important');});
          }
        });
      });
      function lockEqualGearRows(stackSelector,rowSelector){
        document.querySelectorAll(stackSelector).forEach(function(stack){
          var rows=[].slice.call(stack.querySelectorAll(':scope > '+rowSelector));
          if(rows.length!==2)return;
          rows.forEach(function(row){row.style.removeProperty('height');});
          var tallest=Math.ceil(Math.max.apply(null,rows.map(function(row){return row.getBoundingClientRect().height;})));
          rows.forEach(function(row){
            row.style.setProperty('height',tallest+'px','important');
            var section=row.querySelector('.print-section');
            if(section)section.style.setProperty('height','100%','important');
          });
        });
      }
      lockEqualGearRows('[data-equal-gear-stack]','[data-equal-gear-row]');
      lockEqualGearRows('[data-equal-full-gear-stack]','[data-equal-full-gear-row]');
    }
    window.addEventListener('load',function(){
      requestAnimationFrame(function(){requestAnimationFrame(function(){
        lockPortfolioGeometry();
        window.setTimeout(function(){lockPortfolioGeometry(); parent.postMessage({type:'infinity-compact-print-ready',token:${safeToken}},'*');},40);
      });});
    });
  <\/script>
</body>
</html>`;
}
let activeCompactPrintFrame = null;

function isMobilePortfolioExport() {
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(ua);
  const touchDevice = (navigator.maxTouchPoints || 0) > 0;
  const shortEdge = Math.min(window.screen?.width || window.innerWidth || 0, window.screen?.height || window.innerHeight || 0);
  const coarse = window.matchMedia?.('(any-pointer: coarse)').matches || window.matchMedia?.('(pointer: coarse)').matches;
  // Covers Android phones/tablets, iPhones/iPads (including iPad desktop UA),
  // and small touch-first browsers. Mobile never calls window.print().
  return mobileUa || (touchDevice && shortEdge <= 1180) || (Boolean(coarse) && shortEdge <= 1024);
}

function setExportStatus(message, actionLabel = '', actionUrl = '') {
  const status = document.getElementById('exportStatus');
  const text = document.getElementById('exportStatusText');
  const action = document.getElementById('mobilePdfAction');
  if (!status || !text || !action) return;
  status.hidden = !message;
  text.textContent = message || '';
  if (actionLabel && actionUrl) {
    action.href = actionUrl;
    action.textContent = actionLabel;
    action.hidden = false;
  } else {
    action.removeAttribute('href');
    action.textContent = '';
    action.hidden = true;
  }
}

function mobilePdfFilename(name) {
  const cleaned = String(name || 'Infinity_2D20_Character').replace(/[\/:*?"<>|]+/g, '-').trim().replace(/\s+/g, '_');
  return `${cleaned || 'Infinity_2D20_Character'}_Portfolio_Landscape.pdf`;
}

function pdfAscii(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function pdfBytes(value) { return new TextEncoder().encode(String(value)); }
function pdfJoin(parts) { const length = parts.reduce((sum, part) => sum + part.length, 0); const out = new Uint8Array(length); let at = 0; parts.forEach(part => { out.set(part, at); at += part.length; }); return out; }

function makeTextPdf(pageStreams) {
  const encoder = new TextEncoder();
  const objects = [null];
  const add = body => { objects.push(body); return objects.length - 1; };
  const pagesId = add('');
  const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds = [];
  const W = 841.89, H = 595.28;
  pageStreams.forEach(stream => {
    const contentId = add(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /CropBox [0 0 ${W} ${H}] /BleedBox [0 0 ${W} ${H}] /TrimBox [0 0 ${W} ${H}] /Rotate 0 /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R /PageLayout /SinglePage /ViewerPreferences << /DisplayDocTitle true >> >>`);
  const chunks = [encoder.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets = [0]; let size = chunks[0].length;
  for (let id=1; id<objects.length; id+=1) {
    offsets[id]=size;
    const pre=encoder.encode(`${id} 0 obj\n`);
    const body=typeof objects[id] === 'string' ? encoder.encode(objects[id]) : objects[id];
    const post=encoder.encode('\nendobj\n');
    chunks.push(pre,body,post); size += pre.length+body.length+post.length;
  }
  const xrefAt=size;
  let xref=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let id=1; id<objects.length; id+=1) xref += `${String(offsets[id]).padStart(10,'0')} 00000 n \n`;
  chunks.push(encoder.encode(`${xref}trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`));
  return new Blob([pdfJoin(chunks)], {type:'application/pdf'});
}

function pdfPage() {
  const H=595.28; const commands=[];
  const color = (r,g,b,stroke=false) => commands.push(`${r} ${g} ${b} ${stroke?'RG':'rg'}`);
  const rect = (x,top,w,h,fill=null,stroke='#9aa7b1',line=0.6) => {
    const y=H-top-h;
    if(fill){ const [r,g,b]=fill; color(r,g,b,false); commands.push(`${x} ${y} ${w} ${h} re f`); }
    if(stroke){ const [r,g,b]=hexToRgb(stroke); color(r,g,b,true); commands.push(`${line} w ${x} ${y} ${w} ${h} re S`); }
  };
  const text = (x,top,value,size=9,bold=false,colour='#172033') => {
    const [r,g,b]=hexToRgb(colour); color(r,g,b,false); const y=H-top-size;
    commands.push(`BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfAscii(value)}) Tj ET`);
  };
  const line = (x1,top1,x2,top2,colour='#9aa7b1',width=.5) => { const [r,g,b]=hexToRgb(colour); color(r,g,b,true); commands.push(`${width} w ${x1} ${H-top1} m ${x2} ${H-top2} l S`); };
  return {commands,rect,text,line,H};
}

function hexToRgb(value) {
  const hex=String(value || '#000000').replace('#','');
  const n=parseInt(hex.length===3?hex.split('').map(x=>x+x).join(''):hex,16) || 0;
  return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}

function pdfWords(value, maxChars, maxLines=99) {
  const raw=String(value || '').replace(/\s+/g,' ').trim();
  if(!raw) return ['-'];
  const words=raw.split(' '); const lines=[]; let line='';
  words.forEach(word=>{
    const next=line?`${line} ${word}`:word;
    if(next.length<=maxChars || !line) line=next;
    else { lines.push(line); line=word; }
  });
  if(line)lines.push(line);
  if(lines.length>maxLines){ const kept=lines.slice(0,maxLines); kept[maxLines-1]=`${kept[maxLines-1].slice(0,Math.max(0,maxChars-4))}...`; return kept; }
  return lines;
}

function pdfHeader(page, total, subtitle='') {
  const p=pdfPage();
  p.rect(18,16,805,46,[0.09,0.21,0.37],null);
  p.text(32,29,'INFINITY 2D20 CHARACTER PORTFOLIO',15,true,'#ffffff');
  if(subtitle) p.text(32,47,subtitle,7,false,'#eaf3f8');
  p.text(748,34,`PAGE ${page} OF ${total}`,8,true,'#ffffff');
  return p;
}

function pdfSection(p,title,x,top,w,h) {
  p.rect(x,top,w,h,[1,1,1],'#9aa7b1');
  p.rect(x,top,w,18,[0.12,0.31,0.48],null);
  p.text(x+8,top+5,title.toUpperCase(),8,true,'#ffffff');
  return {x,top:top+18,w,h:h-18};
}

function pdfBox(p,label,value,x,top,w,h) {
  p.rect(x,top,w,h,[1,1,1],'#c8d0d8');
  p.text(x+5,top+4,label.toUpperCase(),5,true,'#536173');
  const lines=pdfWords(value || '-', Math.max(8,Math.floor((w-10)/3.6)), Math.max(1,Math.floor((h-16)/8)));
  lines.forEach((line,index)=>p.text(x+5,top+14+index*8,line,7,false,'#172033'));
}

function pdfSkillPanel(p,skills,x,top,w,h) {
  const cols=[.20,.09,.09,.09,.09,.44];
  const xs=[x]; for(let i=0;i<cols.length;i++)xs.push(xs[i]+w*cols[i]);
  const headerH=16; const rowH=(h-headerH)/skills.length;
  p.rect(x,top,w,h,[1,1,1],'#9aa7b1');
  p.rect(x,top,w,headerH,[0.12,0.31,0.48],null);
  ['Skill','Base','Rating +','Total','Focus','Source'].forEach((label,i)=>p.text(xs[i]+3,top+4,label,4.7,true,'#ffffff'));
  skills.forEach((skill,row)=>{
    const parts=skillRatingParts(skill);
    const focus=document.querySelector(`select[data-focus="${CSS.escape(skill)}"]`)?.value || '';
    const note=document.querySelector(`input[data-skill-note="${CSS.escape(skill)}"]`)?.value?.trim() || '';
    const source=[...parts.sources,note].filter(Boolean).join('; ') || '';
    const y=top+headerH+row*rowH;
    p.line(x,y+rowH,x+w,y+rowH,'#c8d0d8',.25);
    [skill,parts.base,printSigned(parts.bonus),parts.total,focus,source].forEach((value,i)=>{
      const char=Math.max(4,Math.floor((xs[i+1]-xs[i]-6)/2.6));
      const lines=pdfWords(value, char, i===5?2:1);
      lines.forEach((line,n)=>p.text(xs[i]+3,y+3+n*5.1,line,i===5?4.5:5.2,i===3,'#172033'));
    });
  });
}

function pdfCorePage(page,total) {
  const p=pdfHeader(page,total,'Identity, main skills, resources and complete skill list');
  const identity=pdfSection(p,'Character Identity',18,70,805,72);
  const fields=[['Character Name',printValue('characterName')||'Unnamed Character'],['Faction',printValue('faction')],['Homeworld / Habitat',printValue('homeworld')],['XP / Advancement',printValue('xp')],['Career',printValue('career')]];
  const boxW=(identity.w-18)/4; fields.forEach((field,i)=>pdfBox(p,field[0],field[1],identity.x+5+(i%4)*(boxW+4.5),identity.top+5+Math.floor(i/4)*24,boxW,20));
  const main=pdfSection(p,'Main Skills and Resources',18,150,805,70);
  const chipW=(main.w-16)/7;
  mainSkills.forEach((skill,i)=>{ const parts=skillRatingParts(skill); const x=main.x+5+i*(chipW+1.6); pdfBox(p,skill,`B ${parts.base}  +${parts.bonus||0}  = ${parts.total}`,x,main.top+5,chipW,26); });
  const tracks=[['HP / Vigor',printValue('hp')],['Firewall',printValue('firewall')],['Armour',printValue('armour')],['Mental Stress',printValue('mentalStress')],['Momentum',printValue('momentum')],['Heat',printValue('heat')]];
  const trackW=(main.w-16)/6; tracks.forEach((track,i)=>pdfBox(p,track[0],track[1],main.x+5+i*(trackW+1.6),main.top+36,trackW,22));
  const skillSec=pdfSection(p,'Skills',18,228,805,346);
  const gap=10; const panelW=(skillSec.w-10-gap)/2; const panelH=skillSec.h-10;
  pdfSkillPanel(p,skillOrder.slice(0,16),skillSec.x+5,skillSec.top+5,panelW,panelH);
  pdfSkillPanel(p,skillOrder.slice(16),skillSec.x+5+panelW+gap,skillSec.top+5,panelW,panelH);
  return p.commands.join('\n');
}

function pdfOptionCard(p,title,item,x,top,w,h,kind) {
  p.rect(x,top,w,h,[0.97,0.985,0.995],'#9aa7b1');
  p.rect(x,top,w,20,kind==='trait'?[0.14,0.35,0.52]:[0.12,0.31,0.48],null);
  p.text(x+8,top+5,item?.name||title,8,true,'#ffffff');
  const primary=item?.primary||'-', secondary=item?.secondary||'-';
  p.text(x+8,top+28,`Primary: ${primary}     Secondary: ${secondary}`,6.3,true,'#172033');
  const body=item?.description||item?.brief||''; const effect=item?.effect||'';
  const bodyLines=pdfWords(body,Math.max(25,Math.floor((w-16)/3.3)),3); bodyLines.forEach((line,i)=>p.text(x+8,top+40+i*7,line,5.6,false,'#172033'));
  const effectLines=pdfWords(effect,Math.max(25,Math.floor((w-16)/3.3)),3); effectLines.forEach((line,i)=>p.text(x+8,top+64+i*7,line,5.6,false,'#172033'));
}

function pdfGearBlock(p,title,items,x,top,w,h,kind) {
  p.rect(x,top,w,h,[1,1,1],'#9aa7b1');
  p.rect(x,top,w,20,[0.12,0.31,0.48],null);
  p.text(x+8,top+5,title.toUpperCase(),8,true,'#ffffff');
  const cols=[.03,.16,.09,.07,.65]; const xs=[x+5]; const innerW=w-10; for(let i=0;i<cols.length;i++)xs.push(xs[i]+innerW*cols[i]);
  const tableTop=top+26; const headerH=14; const rows=Math.max(items.length, kind==='weapon'?2:5); const rowH=(h-32-headerH)/rows;
  p.rect(x+5,tableTop,innerW,headerH,[0.12,0.31,0.48],null);
  ['#','Item',kind==='weapon'?'Skill':'Type','Wt','Rules / Notes'].forEach((label,i)=>p.text(xs[i]+2,tableTop+4,label,4.7,true,'#ffffff'));
  for(let row=0;row<rows;row++){
    const item=items[row]; const y=tableTop+headerH+row*rowH; p.line(x+5,y+rowH,x+5+innerW,y+rowH,'#c8d0d8',.25);
    if(!item)continue;
    const entry=item.entry||{}; const type=kind==='weapon'?inferWeaponSkill(entry.name||''):entry.type||''; const rules=entry.mechanic||entry.brief||'';
    const vals=[String(item.index||row+1),entry.name||'',type,entry.weight||'',rules];
    vals.forEach((value,i)=>{const max=i===4?Math.max(18,Math.floor((xs[i+1]-xs[i]-4)/2.6)):Math.max(4,Math.floor((xs[i+1]-xs[i]-4)/3)); const lines=pdfWords(value,max,i===4?2:1); lines.forEach((line,n)=>p.text(xs[i]+2,y+3+n*5.1,line,i===4?4.5:5.1,false,'#172033'));});
  }
}

function pdfGearPage(page,total,content,beginner=false) {
  const p=pdfHeader(page,total,'Weapons and equipment');
  const top=76; const h=beginner?190:226; const gap=16;
  pdfGearBlock(p,`Weapons - ${content.weapons.length} Selected`,content.weapons,18,top,805,h,'weapon');
  pdfGearBlock(p,`Equipment - ${content.equipment.length} Selected`,content.equipment,18,top+h+gap,805,h,'equipment');
  return p.commands.join('\n');
}

function pdfOptionsPage(page,total,title,items,kind) {
  const p=pdfHeader(page,total,title);
  const cardH=Math.floor((500-((Math.max(1,items.length)-1)*12))/Math.max(1,items.length));
  (items.length?items:[{name:`No ${kind==='trait'?'Traits':'Talents'} selected`}]).slice(0,3).forEach((item,index)=>pdfOptionCard(p,kind==='trait'?'Trait':'Talent',item,18,76+index*(cardH+12),805,cardH,kind));
  return p.commands.join('\n');
}

function buildMobilePortfolioPdfPages() {
  const beginner=isBeginnerPrintCharacter(); const traits=selectedPrintTraits(); const talents=selectedPrintTalents(); const content=printSupplementContent();
  const pages=[];
  if(beginner){ pages.push(pdfCorePage(1,2)); const p=pdfHeader(2,2,'Starter trait, talent, weapons and equipment'); if(traits[0])pdfOptionCard(p,'Trait',traits[0],18,76,390,105,'trait'); if(talents[0])pdfOptionCard(p,'Talent',talents[0],433,76,390,105,'talent'); const gearTop=194, gearH=176, gap=14; pdfGearBlock(p,`Weapons - ${content.weapons.length} Selected`,content.weapons,18,gearTop,805,gearH,'weapon'); pdfGearBlock(p,`Equipment - ${content.equipment.length} Selected`,content.equipment,18,gearTop+gearH+gap,805,gearH,'equipment'); pages.push(p.commands.join('\n')); return pages; }
  pages.push(pdfCorePage(1,4)); pages.push(pdfOptionsPage(2,4,'Selected Traits',traits,'trait')); pages.push(pdfOptionsPage(3,4,'Selected Talents',talents,'talent')); pages.push(pdfGearPage(4,4,content,false)); return pages;
}

function openOrDownloadLandscapePdf(pdf, filename) {
  const url = URL.createObjectURL(pdf);
  const action = document.getElementById('mobilePdfAction');
  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const actionLabel = isAppleMobile ? 'Open Landscape PDF' : 'Download Landscape PDF';

  if (action) {
    action.href = url;
    action.textContent = actionLabel;
    action.setAttribute('aria-label', actionLabel);
    action.hidden = false;
    action.target = '_self';
    action.rel = 'noopener';
    if (isAppleMobile) action.removeAttribute('download');
    else action.download = filename;
  }

  // Do not use the device share API or the mobile browser print service: both can rebuild
  // the job in portrait. This opens/downloads the actual A4 landscape PDF instead.
  if (isAppleMobile) {
    setExportStatus('Landscape PDF is ready. Tap Open Landscape PDF, then print from the PDF viewer.', actionLabel, url);
  } else {
    setExportStatus('Landscape PDF is ready. Tap Download Landscape PDF, then print from your PDF viewer.', actionLabel, url);
    window.setTimeout(() => action?.click(), 0);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
}

function exportMobileLandscapePdf() {
  setExportStatus('Creating true A4 landscape PDF...');
  const pdf = makeTextPdf(buildMobilePortfolioPdfPages());
  const name = printValue('characterName') || 'Infinity 2D20 Character';
  openOrDownloadLandscapePdf(pdf, mobilePdfFilename(name));
}

function printCharacterSheet() {
  buildPrintPortfolio();
  if (isMobilePortfolioExport()) { try { exportMobileLandscapePdf(); } catch(error) { console.error(error); setExportStatus('Landscape PDF export failed. Please refresh and try again.'); } return; }
  const source = document.getElementById("printPortfolio"); const markup = source?.innerHTML?.trim() || "";
  if (!markup) { alert("The current character portfolio could not be built. Please refresh the page and try again."); return; }
  if (activeCompactPrintFrame?.isConnected) activeCompactPrintFrame.remove();
  const frame = document.createElement("iframe"); const token = `infinity-print-${Date.now()}-${Math.random().toString(16).slice(2)}`; let printed = false; let cleanupTimer = null;
  frame.className = "compact-print-frame"; frame.setAttribute("aria-hidden", "true"); frame.setAttribute("tabindex", "-1"); frame.title = ""; activeCompactPrintFrame = frame;
  const cleanup = () => { window.removeEventListener("message", onReady); if (cleanupTimer) window.clearTimeout(cleanupTimer); if (frame.isConnected) frame.remove(); if (activeCompactPrintFrame === frame) activeCompactPrintFrame = null; };
  const printFromFrame = () => { if (printed || !frame.isConnected) return; printed = true; const frameWindow = frame.contentWindow; if (!frameWindow) { cleanup(); alert("The print preview could not be opened. Please refresh the page and try again."); return; } frameWindow.addEventListener("afterprint", cleanup, { once: true }); window.setTimeout(() => { frameWindow.focus(); frameWindow.print(); }, 80); cleanupTimer = window.setTimeout(cleanup, 60000); };
  const onReady = event => { if (event.source !== frame.contentWindow) return; if (event.data?.type !== "infinity-compact-print-ready" || event.data?.token !== token) return; printFromFrame(); };
  window.addEventListener("message", onReady); document.body.appendChild(frame); const characterName = printValue("characterName") || "Infinity 2D20 Character"; const frameDocument = frame.contentDocument || frame.contentWindow?.document; frameDocument.open(); frameDocument.write(compactPrintFrameHtml(markup, `${characterName} - ${PRINT_WINDOW_MARKER}`, token)); frameDocument.close(); window.setTimeout(printFromFrame, 1200);
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
  document.documentElement.dataset.infinityBuild = "v25-career-homeworld-relationships";
  pruneLegacyProfileFields();
  initLists();
  buildMainSkills();
  buildSkillTable("skillsLeft", skillOrder.slice(0,16));
  buildSkillTable("skillsRight", skillOrder.slice(16));
  buildTraits();
  buildTalents();
  pruneLegacyProfileFields();
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
});
