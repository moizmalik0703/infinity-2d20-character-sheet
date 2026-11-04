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

function alphaCompare(a, b) {
  return String(a || "").trim().localeCompare(String(b || "").trim(), undefined, { numeric: true, sensitivity: "base" });
}

function sortByName(list) {
  return [...list].sort((a, b) => alphaCompare(a?.name || "", b?.name || ""));
}

function sortNames(values) {
  return [...new Set((values || []).filter(Boolean))].sort(alphaCompare);
}

// Keep the source lists alphabetised too, so any future dropdown that reads DATA.lists
// directly will inherit the same order. The random-character logic still chooses from
// the object data, not this display order.
if (DATA?.lists) {
  if (Array.isArray(DATA.lists.traits)) DATA.lists.traits = sortNames(DATA.lists.traits);
  if (Array.isArray(DATA.lists.talents)) DATA.lists.talents = sortNames(DATA.lists.talents);
}
function setText(el, value) {
  if (!el) return;
  const text = value || "";
  if (el.textContent !== text) el.textContent = text;
  // Preserve the complete value on hover when a narrow browser layout wraps it.
  if (el.title !== text) el.title = text;
}
function inputField(field) {
  return document.querySelector(`[data-field="${field}"]`);
}

function normalizeWounds(value) {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 3 ? String(parsed) : "0";
}

// v24 career and faction/homeworld refinement. Older saves may retain the former
// careerRole and restriction values. They are migrated into the single visible Career
// control without discarding the old eligibility information.
const GENERAL_CAREER = "General / Unrestricted";
const DEFAULT_HOST_HERITAGE = DATA.hostHeritage?.default || "Standard / Human";
const HOST_HERITAGE_TRAITS = new Set(DATA.hostHeritage?.hostTraits || ["Dogface", "Wulver", "Antipode"]);

function isAriadnaFaction(faction) {
  const value = String(faction || "").trim();
  return value === "Ariadna" || value.startsWith("Ariadna -");
}

function isPanOceaniaFaction(faction) {
  const value = String(faction || "").trim();
  return value === "PanOceania" || value.startsWith("PanOceania -");
}

function isAlephFaction(faction) {
  const value = String(faction || "").trim();
  return value === "ALEPH" || value.startsWith("ALEPH -");
}

function isAlephAIHost() {
  return isAlephFaction(inputField("faction")?.value || "") &&
    ["Aspect","Recreation","True AI"].includes(selectedHostHeritage());
}

function selectedAlephFoundation() {
  if (!isAlephAIHost()) return null;
  const choice = inputField("homeworld")?.value || "";
  return DATA.alephReference?.psychogeneticFoundations?.find(row => row.name === choice) || null;
}

function isO12Faction(faction) {
  const selected = String(faction || "").trim();
  return selected === "O-12" || selected.startsWith("O-12 -");
}

function o12AssignmentRows() {
  if (!isO12Faction(inputField("faction")?.value || "")) return [];
  const career = inputField("career")?.value || "";
  const source = DATA.o12Reference || {};
  if (career === "Bureau Analyst") return (source.bureauAnalystTable || []).filter(row => row.name !== "Choose Your Bureau");
  if (career === "Bureau Aegis Specialist") return (source.aegisUnitTable || []).filter(row => row.name !== "Choose Your Unit");
  return [];
}

function refreshO12Assignment({ value, preserve = true } = {}) {
  const field = inputField("o12Assignment");
  if (!field) return;
  const label = document.getElementById("o12AssignmentLabel");
  const status = document.getElementById("o12AssignmentStatus");
  const rows = o12AssignmentRows();
  const career = inputField("career")?.value || "";
  const requested = value !== undefined ? String(value || "") : String(field.value || "");
  makeOptions(field, rows.map(row => row.name), "Choose...");
  field.value = preserve && rows.some(row => row.name === requested) ? requested : "";
  field.disabled = rows.length === 0;
  if (label) {
    label.hidden = !rows.length;
    const node = Array.from(label.childNodes || []).find(node => node.nodeType === 3);
    if (node) node.nodeValue = career === "Bureau Analyst" ? "O-12 Analyst Bureau" : "O-12 Aegis Unit";
  }
  if (status) {
    const row = rows.find(row => row.name === field.value);
    status.hidden = !rows.length;
    const extra = row?.name === "Beta" ? " Criminal Record requires Beta Unit until the career phase ends." : "";
    status.textContent = !rows.length ? "" : row
      ? `O-12 ${career} (${row.name}): electives ${row.electiveSkills.join(", ")}.${row.gear?.length ? " Gear: " + row.gear.join(", ") + "." : ""}${extra}`
      : "Select an O-12 Bureau / Unit to show source electives and gear. These are not automatically granted as extra skill ranks.";
  }
}

function refreshO12Pillar({ value, preserve = true } = {}) {
  const field = inputField("o12Pillar");
  if (!field) return;
  const label = document.getElementById("o12PillarLabel");
  const status = document.getElementById("o12PillarStatus");
  const active = isO12Faction(inputField("faction")?.value || "");
  const records = DATA.o12Reference?.pillars || [];
  const requested = value !== undefined ? String(value || "") : String(field.value || "");
  makeOptions(field, active ? records.map(row => row.name) : [], "Choose...");
  field.value = active && preserve && records.some(row => row.name === requested) ? requested : "";
  field.disabled = !active;
  if (label) label.hidden = !active;
  if (status) {
    const chosen = records.find(row => row.name === field.value);
    status.hidden = !active || !chosen;
    status.textContent = chosen ? `O-12 Pillar ${chosen.name} (d20 ${chosen.roll}): ${chosen.effect} Record contacts and Social Status manually.` : "";
  }
}

function refreshO12HistoricalTiesVisibility() {
  const label = document.getElementById("o12HistoricalTiesLabel");
  if (label) label.hidden = !isO12Faction(inputField("faction")?.value || "");
}

function isNomadsFaction(faction) {
  const value = String(faction || "").trim();
  return value === "Nomads" || value.startsWith("Nomads -");
}

function usesSourceHostHeritage(faction) {
  return isAriadnaFaction(faction) || isPanOceaniaFaction(faction) || isNomadsFaction(faction) || isAlephFaction(faction);
}

function isUpliftHost() {
  return isNomadsFaction(inputField("faction")?.value || "") && selectedHostHeritage() === "Uplift";
}

function selectedUpliftSpecies() {
  return isUpliftHost() ? (inputField("upliftSpecies")?.value || "") : "";
}

function selectedUpliftBody() {
  return isUpliftHost() ? (inputField("upliftBody")?.value || "") : "";
}

function upliftCareerNames() {
  return DATA.nomadsReference?.uplift?.careerLists?.[selectedUpliftSpecies()] || [];
}

function selectedHostHeritage() {
  return inputField("hostHeritage")?.value || DEFAULT_HOST_HERITAGE;
}

function selectedHostState() {
  const config = hostHeritageConfig();
  return inputField("hostState")?.value || config.defaultForm || config.forms?.[0] || "";
}

function hostHeritageConfig(host = selectedHostHeritage()) {
  return DATA.hostHeritage?.options?.[host] || DATA.hostHeritage?.options?.[DEFAULT_HOST_HERITAGE] || {
    label: DEFAULT_HOST_HERITAGE,
    forms: ["Standard Form"],
    defaultForm: "Standard Form",
    mainSkillModifiers: {},
    vigorBonus: 0,
    vigorSoakBonus: 0,
    rules: ""
  };
}

function hostOptionsForFaction(faction) {
  const configured = DATA.lists?.hostHeritage || [DEFAULT_HOST_HERITAGE];
  const selected = String(faction || "").trim();

  if (isAlephFaction(selected)) {
    return configured.filter(value => value === DEFAULT_HOST_HERITAGE || ["Aspect","Recreation","True AI"].includes(value));
  }
  if (isPanOceaniaFaction(selected)) {
    return configured.filter(value => value === DEFAULT_HOST_HERITAGE || value === "Helot");
  }
  if (isNomadsFaction(selected)) {
    return configured.filter(value => value === DEFAULT_HOST_HERITAGE || value === "Uplift");
  }
  if (!isAriadnaFaction(selected)) return [DEFAULT_HOST_HERITAGE];

  // Antipodes use the broad Ariadna faction rather than a human national/service
  // subfaction. Dogface and Wulver can retain their Ariadnan national identity.
  if (selected === "Ariadna") return configured.filter(value => value !== "Helot" && value !== "Uplift");
  return configured.filter(value => value !== "Antipode" && value !== "Helot" && value !== "Uplift");
}

function hostHomeworldsForFaction(faction, host = selectedHostHeritage()) {
  const base = homeworldsForFaction(faction);
  if (isAlephFaction(faction)) {
    const foundations = (DATA.alephReference?.psychogeneticFoundations || []).map(row => row.name);
    return ["Aspect","Recreation","True AI"].includes(host) ? foundations : base.filter(world => !foundations.includes(world));
  }

  if (isPanOceaniaFaction(faction) && host === "Helot") {
    return [...(DATA.homeworldsByFaction?.["PanOceania - Helot"] || ["Varuna"])];
  }
  if (isNomadsFaction(faction) && host === "Uplift") {
    return [...(DATA.homeworldsByFaction?.["Nomads - Uplift"] || ["Praxis Black Labs"])];
  }
  if (!isAriadnaFaction(faction)) return base;

  if (host === "Antipode") {
    return [...(DATA.homeworldsByFaction?.["Ariadna - Antipode"] || base)];
  }

  if (host === "Dogface" || host === "Wulver") {
    const dogBlooded = DATA.homeworldsByFaction?.["Ariadna - Dog-Blooded"] || [];
    if (String(faction || "") === "Ariadna") return [...dogBlooded];
    const intersected = base.filter(world => dogBlooded.includes(world));
    return intersected.length ? intersected : base;
  }
  return base;
}

function sourceCareerOptionsForFaction(faction, allCareers) {
  const selected = String(faction || "").trim();
  const sourceKey = selected.startsWith("Haqqislam") ? "Haqqislam"
    : selected.startsWith("Yu Jing") ? "Yu Jing"
    : selected.startsWith("PanOceania") ? "PanOceania"
    : selected.startsWith("Nomads") ? "Nomads"
    : selected.startsWith("ALEPH") ? "ALEPH"
    : isO12Faction(selected) ? "O-12"
    : "";
  const configured = sourceKey ? DATA.careerOptionsByFaction?.[sourceKey] : null;
  if (!Array.isArray(configured) || !configured.length) return null;
  return sortNames(configured.filter(career => allCareers.includes(career)));
}

function hostCareerOptions() {
  const all = sortNames(DATA.lists.careerRoles || []).filter(value => value !== GENERAL_CAREER);
  const faction = inputField("faction")?.value || "";
  const host = selectedHostHeritage();
  const config = hostHeritageConfig(host);

  if (isNomadsFaction(faction) && host === "Uplift") {
    return sortNames(upliftCareerNames().filter(career => all.includes(career)));
  }
  if (isAlephFaction(faction) && ["Aspect","Recreation","True AI"].includes(host)) {
    return sortNames((DATA.alephReference?.aiCareers || []).filter(career => all.includes(career)));
  }

  // A non-standard Birth Host can impose a source-specific career set.
  if (host !== DEFAULT_HOST_HERITAGE && Array.isArray(config.allowedCareers)) {
    return sortNames(config.allowedCareers.filter(career => all.includes(career)));
  }

  // Haqqislam, Yu Jing, PanOceania, Nomads and ALEPH use their faction-book career tables as
  // the visible Career selector. General / Unrestricted remains available for
  // standard human house-rule characters and legacy imports.
  const sourceCareers = sourceCareerOptionsForFaction(faction, all);
  if (sourceCareers) return [GENERAL_CAREER, ...sourceCareers];

  if (!isAriadnaFaction(faction)) return [GENERAL_CAREER, ...all];

  const excluded = new Set(config.excludedCareers || []);
  return [GENERAL_CAREER, ...all.filter(career => !excluded.has(career))];
}

function isCareerCompatibleWithHost(career, host = selectedHostHeritage()) {
  const value = String(career || "").trim();
  if (!value || value === GENERAL_CAREER) return host === DEFAULT_HOST_HERITAGE;
  const faction = inputField("faction")?.value || "";
  if (isNomadsFaction(faction) && host === "Uplift") {
    return upliftCareerNames().includes(value);
  }
  if (isAlephFaction(faction) && ["Aspect","Recreation","True AI"].includes(host)) {
    return (DATA.alephReference?.aiCareers || []).includes(value);
  }
  const config = hostHeritageConfig(host);
  if (host !== DEFAULT_HOST_HERITAGE && Array.isArray(config.allowedCareers)) {
    return config.allowedCareers.includes(value);
  }
  if (!isAriadnaFaction(faction)) return true;
  return !(config.excludedCareers || []).includes(value);
}

function refreshCareerChoices({ value, preserve = true, allowLegacy = false } = {}) {
  const select = inputField("career");
  if (!select) return;
  const requested = value !== undefined ? String(value || "").trim() : String(select.value || "").trim();
  const choices = hostCareerOptions();
  makeOptions(select, choices, "Choose...");
  if (requested && choices.includes(requested)) {
    select.value = requested;
  } else if (requested && allowLegacy) {
    ensureSelectValue(select, requested);
    select.value = requested;
  } else {
    select.value = choices.includes(GENERAL_CAREER) ? GENERAL_CAREER : "";
  }
  refreshO12Assignment({ preserve: false });
}

function refreshHostStateChoices({ value, preserve = true } = {}) {
  const select = inputField("hostState");
  if (!select) return;
  const config = hostHeritageConfig();
  const forms = Array.isArray(config.forms) && config.forms.length ? config.forms : [config.defaultForm || "Standard Form"];
  const requested = value !== undefined ? String(value || "").trim() : String(select.value || "").trim();
  makeOptions(select, forms, "");
  const fallback = config.defaultForm || forms[0] || "";
  select.value = preserve && forms.includes(requested) ? requested : fallback;
  select.disabled = forms.length <= 1;
  const label = document.getElementById("hostStateLabel");
  if (label) label.hidden = forms.length <= 1;
  select.dataset.lastValue = select.value;
}

function refreshHostHeritageChoices({ value, preserve = true } = {}) {
  const faction = inputField("faction")?.value || "";
  const select = inputField("hostHeritage");
  if (!select) return;
  const choices = hostOptionsForFaction(faction);
  const requested = value !== undefined ? String(value || "").trim() : String(select.value || "").trim();
  makeOptions(select, choices, "");
  const fallback = choices.includes(DEFAULT_HOST_HERITAGE) ? DEFAULT_HOST_HERITAGE : (choices[0] || DEFAULT_HOST_HERITAGE);
  select.value = preserve && choices.includes(requested) ? requested : fallback;
  select.disabled = !usesSourceHostHeritage(faction);
  refreshHostStateChoices({ preserve: false });
  refreshUpliftChoices({ preserve: true });
  refreshNomadHeritageChoices({ preserve: true });
}


function nomadHeritageForHomeworld(homeworld) {
  const world = String(homeworld || "").trim();
  if (world === "Bakunin" || world.startsWith("Praxis ") || world === "Undocumented Orbital") return "Bakunian";
  if (world === "Corregidor") return "Corregidoran";
  if (world === "Tunguska") return "Tunguskan";
  if (world === "Planet, Other Faction") return "Lub’";
  if (world === "Commercial Mission") return "Missionary";
  if (world === "Orbitals, Human Edge") return "Vagrant";
  return "";
}

function refreshNomadHeritageChoices({ value, preserve = true, forceFromHomeworld = false } = {}) {
  const select = inputField("nomadHeritage");
  const label = document.getElementById("nomadHeritageLabel");
  if (!select) return;
  const nomad = isNomadsFaction(inputField("faction")?.value || "");
  if (label) label.hidden = !nomad;
  const choices = DATA.lists?.nomadHeritage || [];
  const requested = value !== undefined ? String(value || "") : String(select.value || "");
  const sourceDefault = isUpliftHost() ? "Bakunian" : nomadHeritageForHomeworld(inputField("homeworld")?.value || "");
  makeOptions(select, choices, "Choose...");
  select.value = isUpliftHost() ? "Bakunian" : forceFromHomeworld ? sourceDefault : preserve && choices.includes(requested) ? requested : sourceDefault;
  select.disabled = !nomad || isUpliftHost();
}

function refreshUpliftChoices({ species, body, preserve = true } = {}) {
  const enabled = isUpliftHost();
  const config = [
    [inputField("upliftSpecies"), document.getElementById("upliftSpeciesLabel"), DATA.lists?.upliftSpecies || [], species],
    [inputField("upliftBody"), document.getElementById("upliftBodyLabel"), DATA.lists?.upliftBody || [], body]
  ];
  for (const [select, label, choices, specified] of config) {
    if (label) label.hidden = !enabled;
    if (!select) continue;
    const requested = specified !== undefined ? String(specified || "") : String(select.value || "");
    makeOptions(select, choices, "Choose...");
    select.value = enabled && preserve && choices.includes(requested) ? requested : "";
    select.disabled = !enabled;
  }
}

function upliftSourceStatus() {
  if (!isUpliftHost()) return "";
  const source = DATA.nomadsReference?.uplift || {};
  const species = selectedUpliftSpecies();
  const body = selectedUpliftBody();
  if (!species || !body) return "Choose both an Uplift Species and a Body / Platform; these are separate source decisions.";
  const speciesInfo = source.species?.[species];
  const bodyInfo = source.bodies?.[body];
  const speciesCost = speciesInfo?.lifePoints ?? "?";
  const bodyCost = bodyInfo?.alternateCosts?.[species] ?? bodyInfo?.lifePoints ?? "?";
  return `Uplift ${species}, ${body}: Species ${speciesCost} LP, Body ${bodyCost} LP. Species Trait: ${speciesInfo?.trait || "—"}. ${(speciesInfo?.abilities || []).join("; ")}. Body: ${bodyInfo?.rules || ""}`;
}

function hostMainSkillModifier(mainSkill) {
  const config = hostHeritageConfig();
  const state = selectedHostState();
  const base = Number(config.mainSkillModifiers?.[mainSkill] || 0);
  const form = Number(config.formMainSkillModifiers?.[state]?.[mainSkill] || 0);
  if (isUpliftHost()) {
    const uplift = DATA.nomadsReference?.uplift;
    const species = Number(uplift?.species?.[selectedUpliftSpecies()]?.mainSkillModifiers?.[mainSkill] || 0);
    const body = Number(uplift?.bodies?.[selectedUpliftBody()]?.mainSkillModifiers?.[mainSkill] || 0);
    return base + form + species + body;
  }
  const foundation = selectedAlephFoundation();
  const foundationBonus = foundation?.attributes?.includes(mainSkill) ? 1 : 0;
  return base + form + foundationBonus;
}

function hostVigorSoakBonus() {
  const config = hostHeritageConfig();
  const state = selectedHostState();
  return Number(config.vigorSoakBonus || 0) + Number(config.formVigorSoakBonus?.[state] || 0);
}

function hostVigorBonus() {
  return Number(hostHeritageConfig().vigorBonus || 0);
}

function maximumVigorTrackValue() {
  const values = (DATA.lists?.track20 || []).map(Number).filter(Number.isFinite);
  return values.length ? Math.max(...values) : 20;
}

function updateHostHeritageStatus() {
  const status = document.getElementById("hostHeritageStatus");
  if (!status) return;
  const faction = inputField("faction")?.value || "";
  if (!usesSourceHostHeritage(faction)) {
    status.textContent = "Host / Heritage: standard human unless a source-backed Ariadna, PanOceania, Nomad or ALEPH host is selected.";
    return;
  }
  const host = selectedHostHeritage();
  const config = hostHeritageConfig(host);
  const state = selectedHostState();
  const mods = mainSkills
    .map(skill => [skill, hostMainSkillModifier(skill)])
    .filter(([, value]) => value !== 0)
    .map(([skill, value]) => `${skill} ${value > 0 ? "+" : ""}${value}`);
  const extras = [];
  if (hostVigorBonus()) extras.push(`Vigour ${hostVigorBonus() > 0 ? "+" : ""}${hostVigorBonus()}`);
  if (hostVigorSoakBonus()) extras.push(`Vigour soak +${hostVigorSoakBonus()}`);
  if (config.firewallDisabled) extras.push("Firewall unavailable");
  const foundation = selectedAlephFoundation();
  if (foundation?.skill) extras.push(`Psychogenetic Foundation ${foundation.name}: +1 ${foundation.skill}`);
  if (foundation?.name === "Eclectic") extras.push("Eclectic: choose two attributes and one skill manually");
  const summary = [...mods, ...extras].join("; ");
  status.textContent = isUpliftHost()
    ? `Host / Heritage: Uplift. ${upliftSourceStatus()}${summary ? ` Effective modifiers: ${summary}.` : ""}`
    : `Host / Heritage: ${host}${state ? ` — ${state}` : ""}.${summary ? ` Effective modifiers: ${summary}.` : ""} ${config.rules || ""}`;
}

function applyHostHeritageEffects({ recoverVigor = false } = {}) {
  const host = selectedHostHeritage();
  const config = hostHeritageConfig(host);
  const state = selectedHostState();
  const firewall = inputField("firewall");

  if (firewall) {
    if (config.firewallDisabled) {
      if (!firewall.dataset.hostLocked) firewall.dataset.preHostValue = firewall.value || "20";
      firewall.value = "0";
      firewall.disabled = true;
      firewall.dataset.hostLocked = "1";
    } else if (firewall.dataset.hostLocked) {
      firewall.disabled = false;
      firewall.value = firewall.dataset.preHostValue || "20";
      delete firewall.dataset.preHostValue;
      delete firewall.dataset.hostLocked;
    } else {
      firewall.disabled = false;
    }
  }

  if (recoverVigor && config.recoverVigorOnEnter && state === config.recoverVigorOnEnter) {
    const hp = inputField("hp");
    if (hp) hp.value = String(maximumVigorTrackValue());
  }

  updateHostHeritageStatus();
  updateSkillRatings();
  updateDogfaceAutomationPanel();
}

const DOGFACE_HOST = "Dogface";
const DOGFACE_HUMAN_FORM = "Human Form";
const DOGFACE_WARRIOR_FORM = "Dog-Warrior Form";
const DOGFACE_ARMOUR_AUTO = "Auto";
const DOGFACE_ARMOUR_HUMAN = "Human-sized";
const DOGFACE_ARMOUR_COMPATIBLE = "Dogface-compatible";

function isDogfaceHost() {
  return selectedHostHeritage() === DOGFACE_HOST;
}

function isDogWarriorForm() {
  return isDogfaceHost() && selectedHostState() === DOGFACE_WARRIOR_FORM;
}

function dogfaceConfig() {
  return DATA.hostHeritage?.options?.[DOGFACE_HOST] || {};
}

function dogfaceInnateWeaponName() {
  return dogfaceConfig().innateWeapon || "Dogface Claws (CC)";
}

function dogfaceFatigueConditionName() {
  return dogfaceConfig().fatigueCondition || "Fatigued";
}

function dogfaceSelectedArmourItems() {
  return [...document.querySelectorAll("select[data-equipment-select]")]
    .map(element => byName(DATA.equipment, element.value))
    .filter(item => item && item.name && armourValueForItem(item) > 0);
}

function resolvedDogfaceArmourFit() {
  const control = inputField("dogfaceArmourFit");
  const selected = control?.value || DOGFACE_ARMOUR_AUTO;
  if (selected === DOGFACE_ARMOUR_COMPATIBLE) return DOGFACE_ARMOUR_COMPATIBLE;
  if (selected === DOGFACE_ARMOUR_HUMAN) return DOGFACE_ARMOUR_HUMAN;
  const armourItems = dogfaceSelectedArmourItems();
  return armourItems.length > 0 && armourItems.every(item => item.dogfaceCompatible === true)
    ? DOGFACE_ARMOUR_COMPATIBLE
    : DOGFACE_ARMOUR_HUMAN;
}

function ensureDogfaceClaws() {
  if (!isDogfaceHost()) return true;
  const weaponName = dogfaceInnateWeaponName();
  const slots = [...document.querySelectorAll("select[data-weapon-select]")];
  if (slots.some(slot => slot.value === weaponName)) return true;
  const empty = slots.find(slot => !slot.value);
  if (!empty) return false;
  ensureSelectValue(empty, weaponName);
  empty.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function removeDogfaceClaws() {
  const weaponName = dogfaceInnateWeaponName();
  document.querySelectorAll("select[data-weapon-select]").forEach(slot => {
    if (slot.value !== weaponName) return;
    slot.value = "";
    slot.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function addDogfaceFatiguedCondition() {
  const conditionName = dogfaceFatigueConditionName();
  const slots = [...document.querySelectorAll("select[data-condition-select]")];
  const empty = slots.find(slot => !slot.value);
  if (!empty) return false;
  ensureSelectValue(empty, conditionName);
  empty.dispatchEvent(new Event("change", { bubbles: true }));
  const note = document.querySelector(`input[data-condition-note="${empty.dataset.conditionSelect}"]`);
  if (note && !note.value) note.value = "Dogface reversion";
  return true;
}

function dogfaceArmourWarningText() {
  if (!isDogWarriorForm()) return "";
  const armourItems = dogfaceSelectedArmourItems();
  if (!armourItems.length) return "Armour: none selected.";
  if (resolvedDogfaceArmourFit() === DOGFACE_ARMOUR_COMPATIBLE) {
    return "Armour fit: Dogface-compatible; transformation damage does not apply.";
  }
  const damage = dogfaceConfig().armourDamageOnTransform || "2+3§";
  return `ARMOUR WARNING: ${armourItems.map(item => item.name).join(", ")} is treated as human-sized. On transformation apply ${damage} damage to the Dogface and mark the armour as needing repair.`;
}

function updateDogfaceAutomationPanel(message = "") {
  const panel = document.getElementById("dogfaceAutomationPanel");
  if (!panel) return;
  const active = isDogfaceHost();
  panel.hidden = !active;
  if (!active) return;

  const fit = inputField("dogfaceArmourFit");
  if (fit && !fit.value) fit.value = DOGFACE_ARMOUR_AUTO;

  const button = document.getElementById("dogfaceTransformBtn");
  const warrior = isDogWarriorForm();
  if (button) {
    button.textContent = warrior ? "Revert to Human Form" : "Transform to Dog-Warrior";
    button.dataset.state = warrior ? "warrior" : "human";
  }

  const summary = document.getElementById("dogfaceAutomationSummary");
  if (!summary) return;
  const clawPresent = [...document.querySelectorAll("select[data-weapon-select]")]
    .some(slot => slot.value === dogfaceInnateWeaponName());
  const base = warrior
    ? "ACTIVE — +2 Agility, +2 Brawn, +1 Vigour soak; Vigour restored on entry; Scent +2d20; Monstrous; Snarling Beast (+2 Difficulty to non-intimidation Personality tests); Super-Jump. Reverting applies Fatigued."
    : "HUMAN FORM — Scent +2d20. When a Wound is suffered, resolve Discipline D1; failure or voluntary failure transforms the Dogface.";
  const clawText = clawPresent
    ? " Innate Claws are present in the Weapons box."
    : " No free Weapon slot is available for innate Claws; free a slot to let automation add them.";
  const armourText = dogfaceArmourWarningText();
  summary.textContent = [base + clawText, armourText, message].filter(Boolean).join(" ");
}

function syncDogfaceAutomation(options = {}) {
  if (isDogfaceHost()) {
    const clawsPlaced = ensureDogfaceClaws();
    const message = options.message || (clawsPlaced ? "" : "Innate Claws could not be added because all five Weapon slots are occupied.");
    updateDogfaceAutomationPanel(message);
  } else {
    removeDogfaceClaws();
    updateDogfaceAutomationPanel("");
  }
}

function setDogfaceForm(form) {
  if (!isDogfaceHost()) return;
  const select = inputField("hostState");
  if (!select || select.value === form) return;
  ensureSelectValue(select, form);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function handleDogfaceWoundChange() {
  const wounds = inputField("wounds");
  if (!wounds) return;
  const current = Number.parseInt(wounds.value || "0", 10) || 0;
  const previous = Number.parseInt(wounds.dataset.lastDogfaceWounds || String(current), 10) || 0;
  wounds.dataset.lastDogfaceWounds = String(current);
  if (!isDogfaceHost() || selectedHostState() !== DOGFACE_HUMAN_FORM || current <= previous) return;

  for (let wound = previous + 1; wound <= current; wound += 1) {
    if (selectedHostState() !== DOGFACE_HUMAN_FORM) break;
    const succeeded = window.confirm(
      `Dogface Wound trigger (${wound}/${current}): resolve ${dogfaceConfig().woundTransformTest || "Discipline D1"}.\n\nOK = test succeeds; remain in Human Form.\nCancel = failed test or voluntary failure; transform to Dog-Warrior.`
    );
    if (!succeeded) {
      setDogfaceForm(DOGFACE_WARRIOR_FORM);
      break;
    }
    updateDogfaceAutomationPanel("Wound trigger resolved: Discipline test succeeded; Human Form retained.");
  }
}

function initDogfaceAutomation() {
  const hostState = inputField("hostState");
  if (!hostState || document.getElementById("dogfaceAutomationPanel")) return;

  if (!document.getElementById("dogfaceAutomationStyles")) {
    const style = document.createElement("style");
    style.id = "dogfaceAutomationStyles";
    style.textContent = `
      #dogfaceAutomationPanel{grid-column:1/-1;border:1px solid #86a8bd;background:#eef7fb;padding:.7rem;border-radius:8px;margin-top:.35rem}
      #dogfaceAutomationPanel[hidden]{display:none!important}
      .dogface-automation-actions{display:flex;gap:.7rem;align-items:end;flex-wrap:wrap}
      #dogfaceTransformBtn{font-weight:700;min-height:40px;padding:.55rem .8rem}
      #dogfaceTransformBtn[data-state="warrior"]{outline:2px solid #8b1e1e}
      .dogface-armour-fit{display:flex;flex-direction:column;gap:.25rem;min-width:210px}
      #dogfaceAutomationSummary{margin-top:.55rem;font-size:.92rem;line-height:1.4}
      @media (max-width:760px){.dogface-automation-actions{align-items:stretch}.dogface-armour-fit{min-width:100%}#dogfaceTransformBtn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  const panel = document.createElement("div");
  panel.id = "dogfaceAutomationPanel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="dogface-automation-actions">
      <button type="button" id="dogfaceTransformBtn">Transform to Dog-Warrior</button>
      <label class="dogface-armour-fit"><span>Dogface Armour Fit</span>
        <select data-field="dogfaceArmourFit">
          <option value="Auto">Auto (from gear)</option>
          <option value="Human-sized">Human-sized</option>
          <option value="Dogface-compatible">Dogface-compatible</option>
        </select>
      </label>
    </div>
    <div id="dogfaceAutomationSummary" role="status" aria-live="polite"></div>
  `;

  const anchor = document.getElementById("hostStateLabel") || hostState.closest("label") || hostState.parentElement;
  anchor.insertAdjacentElement("afterend", panel);

  document.getElementById("dogfaceTransformBtn")?.addEventListener("click", () => {
    setDogfaceForm(isDogWarriorForm() ? DOGFACE_HUMAN_FORM : DOGFACE_WARRIOR_FORM);
  });
  inputField("dogfaceArmourFit")?.addEventListener("change", () => updateDogfaceAutomationPanel());

  const wounds = inputField("wounds");
  if (wounds) {
    wounds.dataset.lastDogfaceWounds = wounds.value || "0";
    wounds.addEventListener("change", handleDogfaceWoundChange);
  }

  syncDogfaceAutomation();
}

function handleHostStateChange() {
  const select = inputField("hostState");
  const previous = select?.dataset.lastValue || "";
  const current = select?.value || "";
  const wasDogWarrior = isDogfaceHost() && previous === DOGFACE_WARRIOR_FORM;
  const isHumanNow = isDogfaceHost() && current === DOGFACE_HUMAN_FORM;
  const enteringDogWarrior = isDogfaceHost() && current === DOGFACE_WARRIOR_FORM && previous !== DOGFACE_WARRIOR_FORM;

  applyHostHeritageEffects({ recoverVigor: Boolean(current && current !== previous) });

  let message = "";
  if (wasDogWarrior && isHumanNow) {
    message = addDogfaceFatiguedCondition()
      ? "Reversion complete: Fatigued was added to Conditions."
      : "Reversion complete, but both Condition slots are full. Add Fatigued manually; multiple Fatigued conditions can stack.";
  }
  if (enteringDogWarrior) {
    const warning = dogfaceArmourWarningText();
    message = [message, warning].filter(Boolean).join(" ");
  }

  if (select) select.dataset.lastValue = current;
  syncDogfaceAutomation({ message });
}

function migrateLegacyHostState(state) {
  const copy = { ...(state || {}) };
  const legacyHaqqFactionMap = {
    "Haqqislam - Akbar Doctors": "Haqqislam - Sword of Allah",
    "Haqqislam - Ghulam Doctors": "Haqqislam - Sword of Allah",
    "Haqqislam - Janissaries": "Haqqislam - Sword of Allah",
    "Haqqislam - Khawarij": "Haqqislam - Sword of Allah",
    "Haqqislam - Fiday Impersonators": "Haqqislam - Hassassin Bahram",
    "Haqqislam - Scholar-Physicians": "Haqqislam"
  };
  if (legacyHaqqFactionMap[copy.faction]) copy.faction = legacyHaqqFactionMap[copy.faction];
  const legacyHelotFaction = copy.faction === "Helots";
  if (legacyHelotFaction) copy.faction = "PanOceania";
  const legacyHaqqHomeworldMap = {
    "Haqqislamite hospitals":"Bourak","Sword of Allah warfronts":"Bourak","Sword of Allah deployments":"Bourak",
    "Sword of Allah heavy infantry formations":"Bourak","Sword of Allah academies":"Bourak","caravanserai garrisons":"Caravanserai",
    "Hassassin safehouses":"Alamut","Human Sphere covert networks":"Alamut","enemy command zones":"Alamut",
    "covert mission sites":"Alamut","Bourak universities":"Bourak","bimaristans":"Bourak","research centres":"Bourak"
  };
  if (legacyHaqqHomeworldMap[copy.homeworld]) copy.homeworld = legacyHaqqHomeworldMap[copy.homeworld];
  const legacyTraits = Array.isArray(copy.traits) ? copy.traits.map(resolveLegacyTraitTalentName) : [];
  if (!copy.hostHeritage) {
    if (legacyTraits.includes("Wulver")) copy.hostHeritage = "Wulver";
    else if (legacyTraits.includes("Dogface")) copy.hostHeritage = "Dogface";
    else if (legacyTraits.includes("Antipode")) copy.hostHeritage = "Antipode";
    else if (copy.faction === "Ariadna - Antipode") copy.hostHeritage = "Antipode";
    else if (copy.faction === "Ariadna - Dog-Blooded") copy.hostHeritage = "Dogface";
    else if (legacyHelotFaction || legacyTraits.includes("Helot")) copy.hostHeritage = "Helot";
    else copy.hostHeritage = DEFAULT_HOST_HERITAGE;
  }
  if (copy.faction === "Ariadna - Antipode" || copy.faction === "Ariadna - Dog-Blooded") copy.faction = "Ariadna";
  if (copy.hostHeritage === "Helot" && (!copy.homeworld || copy.homeworld === "Various worlds")) copy.homeworld = "Varuna — Atlantea Waters";
  const hostConfig = DATA.hostHeritage?.options?.[copy.hostHeritage] || {};
  if (!copy.hostState) copy.hostState = hostConfig.defaultForm || hostConfig.forms?.[0] || "";
  copy.traits = legacyTraits.filter(name => !HOST_HERITAGE_TRAITS.has(name));
  return copy;
}
const CAREER_FILTERS = {
  "ALEPH Prestige": "ALEPH access or Posthuman background",
  "Airborne": "Yu Jing or airborne operations background",
  "Assassin": "Close combat or Hassassin background",
  "Beastmaster": "Ariadna or frontier survival background",
  "Diplomat": "Diplomatic, legal, or political background",
  "Doctor": ["Medicine background", "Medicine or Haqqislamite military background", "Haqqislam or advanced Medicine background"],
  "Engineer": ["Engineer or military support background", "Nomad, engineer, or remote-support background", "JSA, engineer, or battlefield support background"],
  "Explorer": "O-12, scientific, or exploration background",
  "Faction Prestige": "No Restrictions",
  "Frontier Scout": "Ariadna or frontier survival background",
  "Hacker": ["Nomad or advanced Hacking background", "O-12, Bureau Noir, or advanced Hacking background"],
  "Haqqislam Scholar": "Haqqislam or academic background",
  "Hassassin Bahram": "Haqqislam, Hassassin Bahram, or covert-ops background",
  "Heavy Infantry": "Heavy infantry or military background",
  "Imperial Service": "Yu Jing or state-security background",
  "Infiltrator": "PanOceania or stealth recon background",
  "Infowar Specialist": "O-12, Bureau Noir, or advanced Hacking background",
  "Line Infantry": "Military or security background",
  "O-12 Bureaucrat": "O-12, legal, diplomatic, or command background",
  "Officer": "Military command or Yu Jing background",
  "Recon": "Recon or sniper background",
  "Remote Controller": "Nomad, engineer, or remote-support background",
  "Skirmisher": "PanOceania or stealth recon background",
  "Smuggler": "Mercenary, criminal, or trade-route background",
  "TAG Pilot": "TAG, heavy infantry, or advanced Tech background",
  "Voidfarer": "Extraplanetary or shipboard operations background",

  "AI Aspect": "ALEPH access or Posthuman background",
  "Advanced Infowar Analyst": "ALEPH, O-12, Nomad, or advanced Hacking background",
  "Arachne Broker": "Nomad or advanced Hacking background",
  "Bakunin Social Operator": "Nomad, Bakunin, or Submondo background",
  "Combined Army Operative": "Combined Army or alien technology background",
  "Corregidor Crew": "Nomad or shipboard operations background",
  "EI Handler": "Combined Army or alien technology background",
  "Fleet Officer": "Extraplanetary or shipboard operations background",
  "Geist Handler": "ALEPH, Geist, or Hacking background",
  "Lhost Specialist": "ALEPH, Lhost, or medical-technical background",
  "Morat Warrior": "Combined Army or Morat background",
  "Mothership Crew": "Nomad or shipboard operations background",
  "Praxis Bodymodder": "Nomad, Praxis, or body-modification background",
  "Shasvastii Infiltrator": "Combined Army or Shasvastii background",
  "Ship Crew": "Extraplanetary or shipboard operations background",
  "Steel Phalanx Operative": "ALEPH or military elite background",
  "Sygmaa Diplomat": "Tohaa, Sygmaa, or alien diplomacy background",
  "Tunguska Data Broker": "Nomad or advanced Hacking background",
  "Voidship Engineer": "Extraplanetary or shipboard operations background"
};

function careerOptions() {
  return hostCareerOptions();
}

function selectedCareer() {
  return inputField("career")?.value || GENERAL_CAREER;
}

function careerFiltersFor(career) {
  const selected = String(career || GENERAL_CAREER).trim();
  if (!selected || selected === GENERAL_CAREER) return ["No Restrictions"];

  const mapped = DATA.careerFilters?.[selected] || CAREER_FILTERS[selected] || [];
  const fromTalentData = (DATA.talents || [])
    .filter(talent => talent.career === selected)
    .map(talent => talent.restriction || "No Restrictions");

  const filters = [...new Set([...(Array.isArray(mapped) ? mapped : [mapped]), ...fromTalentData]
    .map(value => String(value || "").trim())
    .filter(value => value && value !== "No Restrictions"))];
  return filters.length ? filters : ["No Restrictions"];
}

function careerFilterFor(career) {
  return careerFiltersFor(career).join(" | ") || "No Restrictions";
}

function setCareerChoice(career, legacyRestriction = "") {
  const select = inputField("career");
  if (!select) return;
  const value = career || GENERAL_CAREER;
  const carried = (Array.isArray(legacyRestriction) ? legacyRestriction : [legacyRestriction])
    .filter(entry => entry && entry !== "No Restrictions");
  const existing = careerFiltersFor(value).filter(entry => entry !== "No Restrictions");
  const combined = [...new Set([...existing, ...carried])];
  // Saved/custom careers may not be in the current profile list. Preserve all
  // matching legacy eligibility values so their Trait and Talent filtering works.
  if (combined.length) CAREER_FILTERS[value] = combined;
  else if (!Object.prototype.hasOwnProperty.call(CAREER_FILTERS, value)) CAREER_FILTERS[value] = "No Restrictions";
  ensureSelectValue(select, value);
  if (!select.value) select.value = GENERAL_CAREER;
}

function factionRecord(faction) {
  const selected = String(faction || "");
  return DATA.factions.find(entry => entry.faction === selected) ||
    DATA.factions.find(entry => selected && entry.faction.startsWith(selected + " -")) ||
    DATA.factions.find(entry => selected && selected.startsWith(entry.faction + " -")) || null;
}

function homeworldsForFaction(faction) {
  const selected = String(faction || "").trim();
  const configured = DATA.homeworldsByFaction?.[selected];
  if (Array.isArray(configured) && configured.length) {
    return [...new Set(configured.map(value => String(value || "").trim()).filter(Boolean))];
  }

  const record = factionRecord(selected);
  if (!record?.homeworld) return [];
  return [...new Set(String(record.homeworld)
    .split(/[,;]/)
    .map(value => value.trim())
    .filter(Boolean))];
}

function isValidFactionHomeworld(faction, homeworld) {
  const selectedFaction = String(faction || "").trim();
  const selectedHomeworld = String(homeworld || "").trim();
  if (!selectedFaction && !selectedHomeworld) return true;
  return Boolean(selectedFaction && selectedHomeworld && homeworldsForFaction(selectedFaction).includes(selectedHomeworld));
}

function closestFactionHomeworld(faction, preferred = "") {
  const options = homeworldsForFaction(faction);
  const requested = String(preferred || "").trim();
  if (!requested) return "";
  if (options.includes(requested)) return requested;
  const normalized = requested.toLowerCase();
  const exactish = options.find(option => {
    const candidate = option.toLowerCase();
    return normalized.includes(candidate) || candidate.includes(normalized);
  });
  if (exactish) return exactish;
  const tokenMatch = options.find(option => {
    const candidate = option.toLowerCase();
    return candidate.split(/\s+/).some(token => token.length > 3 && normalized.includes(token));
  });
  return tokenMatch || "";
}

function refreshHomeworldChoices({ value, preserve = true, allowLegacy = false } = {}) {
  const faction = inputField("faction")?.value || "";
  const select = inputField("homeworld");
  if (!select) return;

  const requested = value !== undefined ? String(value || "").trim() : String(select.value || "").trim();
  const worlds = hostHomeworldsForFaction(faction);
  makeOptions(select, worlds, faction ? "Choose..." : "Choose Faction first...");
  select.disabled = !faction;
  select.title = faction
    ? `Homeworld / Habitat choices linked to ${faction}.`
    : "Choose a Faction first to filter Homeworld / Habitat choices.";

  const hint = document.getElementById("homeworldRelationshipHint");
  if (hint) hint.textContent = faction
    ? `Choose a Homeworld / Habitat linked to ${faction}.`
    : "Choose a Faction to see its related homeworlds and habitats.";

  // A Faction change never carries an invalid world across. The player must select
  // one of the new faction's listed worlds before the character can be saved.
  if (!faction) {
    select.value = "";
    return;
  }

  // Older Nomad sheets used organisational habitats (shipyards, secure markets,
  // etc.) as homes. Preserve such saved values during import until the player
  // deliberately chooses a sourcebook origin; never invent a birthplace.
  if (allowLegacy && isNomadsFaction(faction) && requested && !worlds.includes(requested)) {
    ensureSelectValue(select, requested);
    select.value = requested;
    if (hint) hint.textContent = "Legacy Nomad homeworld preserved from saved character. You can select a sourcebook origin when ready.";
    return;
  }
  const selected = preserve ? closestFactionHomeworld(faction, requested) : "";
  if (hint && isAlephAIHost()) hint.textContent = "ALEPH AI: this Homeworld / Habitat field selects your Psychogenetic Foundation (Chapter 4, p. 55).";
  select.value = worlds.includes(selected) ? selected : "";
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

  const faction = inputField("faction");
  const host = inputField("hostHeritage");
  const hostState = inputField("hostState");
  const career = inputField("career");
  const homeworld = inputField("homeworld");
  const upliftSpecies = inputField("upliftSpecies");
  const upliftBody = inputField("upliftBody");
  const o12Assignment = inputField("o12Assignment");
  const o12Pillar = inputField("o12Pillar");

  refreshHostHeritageChoices({ value: DEFAULT_HOST_HERITAGE, preserve: false });
  refreshCareerChoices({ value: GENERAL_CAREER, preserve: false });
  refreshHomeworldChoices({ preserve: false });
  refreshNomadHeritageChoices({ preserve: false });
  refreshO12Assignment({ preserve: false });
  refreshO12Pillar({ preserve: false });
  refreshO12HistoricalTiesVisibility();

  if (career) career.addEventListener("change", () => { refreshRestrictionChoices(); refreshO12Assignment({ preserve: false }); });
  if (o12Assignment) o12Assignment.addEventListener("change", () => refreshO12Assignment({ value: o12Assignment.value, preserve: true }));
  if (o12Pillar) o12Pillar.addEventListener("change", () => refreshO12Pillar({ value: o12Pillar.value, preserve: true }));

  if (faction) {
    faction.addEventListener("change", () => {
      refreshHostHeritageChoices({ value: DEFAULT_HOST_HERITAGE, preserve: false });
      refreshCareerChoices({ preserve: false });
      refreshHomeworldChoices({ preserve: false });
      refreshNomadHeritageChoices({ preserve: false });
      refreshO12Assignment({ preserve: false });
      refreshO12Pillar({ preserve: false });
      refreshO12HistoricalTiesVisibility();
      refreshRestrictionChoices();
      applyHostHeritageEffects({ recoverVigor: false });
      syncDogfaceAutomation();
    });
  }

  if (host) {
    host.addEventListener("change", () => {
      refreshHostStateChoices({ preserve: false });
      refreshCareerChoices({ preserve: false });
      refreshHomeworldChoices({ preserve: true });
      refreshNomadHeritageChoices({ preserve: false });
      refreshRestrictionChoices();
      applyHostHeritageEffects({ recoverVigor: false });
      syncDogfaceAutomation();
    });
  }

  if (hostState) hostState.addEventListener("change", handleHostStateChange);
  if (homeworld) homeworld.addEventListener("change", () => {
    refreshNomadHeritageChoices({ forceFromHomeworld: true });
    if (isAlephAIHost()) applyHostHeritageEffects({ recoverVigor: false });
  });
  if (upliftSpecies) upliftSpecies.addEventListener("change", () => {
    refreshCareerChoices({ preserve: false });
    refreshRestrictionChoices();
    applyHostHeritageEffects({ recoverVigor: false });
  });
  if (upliftBody) upliftBody.addEventListener("change", () => applyHostHeritageEffects({ recoverVigor: false }));
  applyHostHeritageEffects({ recoverVigor: false });
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
  const main = mainSkills.includes(skill) ? skill : parentOf[skill];
  const raw = Number(document.querySelector(`[data-main-skill="${main}"]`)?.value || "7");
  return raw + hostMainSkillModifier(main);
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

  // Chapter 4 ALEPH Psychogenetic Foundation gives a skill increase separate from main attributes.
  const aiFoundation = selectedAlephFoundation();
  if (aiFoundation?.skill) addSubskillBonus(aiFoundation.skill, `Psychogenetic Foundation: ${aiFoundation.name}`);
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
  const main = mainSkills.includes(skill) ? skill : parentOf[skill];
  const hostModifier = hostMainSkillModifier(main);
  const base = baseRating(skill);
  const startBonus = mainSkills.includes(skill) ? 0 : Number(startingSkillBonuses[skill] || 0);
  const traitTalentBonus = mainSkills.includes(skill) ? 0 : (bonuses.direct[skill] || 0);
  const bonus = startBonus + traitTalentBonus;
  const sources = [];
  if (hostModifier !== 0) sources.push(`Host: ${selectedHostHeritage()} ${main} ${hostModifier > 0 ? "+" : ""}${hostModifier}`);
  if (startBonus > 0) sources.push(`Starting allocation +${startBonus}`);
  sources.push(...(mainSkills.includes(skill) ? [] : (bonuses.details[skill] || [])));
  return {
    base,
    hostModifier,
    startBonus,
    traitTalentBonus,
    bonus,
    total: base + bonus,
    sources
  };
}

function skillRating(skill) {
  const parts = skillRatingParts(skill);
  return String(parts.total);
}

function stripSkillBonusSuffix(value) {
  return String(value || "").replace(/\s*\(\+\d+\)\s*$/g, "").trim();
}

function sanitizeSkillRatingDisplays() {
  document.querySelectorAll("[data-rating]").forEach(cell => {
    const skill = cell.dataset.rating;
    const cleanText = skill ? String(skillRatingParts(skill).total) : stripSkillBonusSuffix(cell.textContent);
    if (cell.textContent !== cleanText) cell.textContent = cleanText;
  });
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
      <td data-rating="${skill}">${stripSkillBonusSuffix(skillRating(skill))}</td>
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
    cell.textContent = String(parts.total);
    cell.title = parts.sources.length ? `Rating modifiers: ${parts.sources.join("; ")}` : "";
    cell.classList.toggle("auto-bonus", parts.bonus > 0);

    const ruleCell = document.querySelector(`[data-skill-rule="${skill}"]`);
    if (ruleCell) {
      const baseRule = mainSkills.includes(skill) ? "Main skill - no automatic Rating bonus" : "Sub-skill";
      const modifiers = [];
      if (parts.hostModifier !== 0) modifiers.push(`Host ${parts.hostModifier > 0 ? "+" : ""}${parts.hostModifier}`);
      if (parts.startBonus > 0) modifiers.push(`Start +${parts.startBonus}`);
      if (parts.traitTalentBonus > 0) modifiers.push(`Trait/Talent +${parts.traitTalentBonus}`);
      ruleCell.textContent = modifiers.length ? `${baseRule}; ${modifiers.join("; ")}` : baseRule;
      ruleCell.title = parts.sources.length ? parts.sources.join("; ") : "";
      ruleCell.classList.toggle("auto-bonus", parts.bonus > 0);
    }
  });
  sanitizeSkillRatingDisplays();
}

function activeRestrictions() {
  return careerFiltersFor(selectedCareer());
}

function activeRestriction() {
  return activeRestrictions().join(" | ") || "No Restrictions";
}

function restrictionMatchesSelectedFaction(itemRestriction) {
  const restriction = String(itemRestriction || "").trim().toLowerCase();
  const faction = String(inputField("faction")?.value || "").trim();
  if (!restriction || !faction) return false;
  const baseFaction = faction.split(" - ")[0].trim();
  return [faction, baseFaction]
    .filter(Boolean)
    .some(value => restriction.includes(value.toLowerCase()));
}

function isEligibleForRestriction(item) {
  const selected = activeRestrictions();
  const itemRestriction = item.restriction || "No Restrictions";
  if (itemRestriction === "No Restrictions") return true;
  if (!selected.length || selected.includes("No Restrictions")) return true;
  return selected.includes(itemRestriction) || restrictionMatchesSelectedFaction(itemRestriction);
}

function eligibleTraits() {
  return sortByName(DATA.traits.filter(isEligibleForRestriction).filter(trait => !trait.hostHeritageOnly && !HOST_HERITAGE_TRAITS.has(trait.name)));
}

function eligibleTalents() {
  return sortByName(DATA.talents.filter(isEligibleForRestriction));
}

let suppressSkillRatingUpdates = false;
let restrictionRefreshInProgress = false;

function setTraitCard(index, traitName) {
  const t = byName(DATA.traits, traitName);
  setText(document.querySelector(`[data-trait-primary="${index}"]`), t.primary);
  setText(document.querySelector(`[data-trait-secondary="${index}"]`), t.secondary);
  setText(document.querySelector(`[data-trait-restriction="${index}"]`), t.restriction || "No Restrictions");
  setText(document.querySelector(`[data-trait-rarity="${index}"]`), t.rarity);
  setText(document.querySelector(`[data-trait-cost="${index}"]`), t.cost);
  setText(document.querySelector(`[data-trait-brief="${index}"]`), t.brief);
  setText(document.querySelector(`[data-trait-effect="${index}"]`), t.effect);
  if (!suppressSkillRatingUpdates) updateSkillRatings();
}

function setTalentCard(index, talentName) {
  const t = byName(DATA.talents, talentName);
  ["level","career","prereq","primary","secondary","restriction","rarity","cost","description","effect"].forEach(k => {
    const dataKey = k === "prereq" ? "prerequisite" : k;
    const output = document.querySelector(`[data-talent-${k}="${index}"]`);
    if (output) setText(output, t[dataKey]);
  });
  if (!suppressSkillRatingUpdates) updateSkillRatings();
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
  if (restrictionRefreshInProgress) return;
  restrictionRefreshInProgress = true;
  suppressSkillRatingUpdates = true;

  try {
    const careerSelect = inputField("career");
    const selectedCareerValue = careerSelect?.value || GENERAL_CAREER;
    const traits = eligibleTraits();
    const talents = eligibleTalents();
    const traitNames = sortNames(traits.map(t => t.name));
    const talentNames = sortNames(talents.map(t => t.name));
    const traitNameSet = new Set(traitNames);
    const talentNameSet = new Set(talentNames);

    document.querySelectorAll("select[data-trait-select]").forEach((sel, i) => {
      const current = sel.value;
      makeOptions(sel, traitNames, "Choose trait...");
      sel.value = traitNameSet.has(current) ? current : "";
      setTraitCard(i, sel.value);
    });

    document.querySelectorAll("select[data-talent-select]").forEach((sel, i) => {
      const current = sel.value;
      makeOptions(sel, talentNames, "Choose talent...");
      sel.value = talentNameSet.has(current) ? current : "";
      setTalentCard(i, sel.value);
    });

    // Keep the Career dropdown stable. Trait/Talent filtering must never rewrite
    // the selected Career back to General / Unrestricted.
    if (careerSelect && careerSelect.value !== selectedCareerValue) {
      ensureSelectValue(careerSelect, selectedCareerValue);
    }

    const status = document.getElementById("restrictionStatus");
    if (status) {
      const career = selectedCareer();
      const selectedFilters = activeRestrictions();
      const eligibility = selectedFilters.filter(value => value !== "No Restrictions");
      const host = selectedHostHeritage();
      const compatible = isCareerCompatibleWithHost(career, host);
      if (!compatible) {
        status.textContent = `Career: ${career} — not valid for Host / Heritage: ${host}. Choose a compatible Career.`;
      } else {
        status.textContent = !eligibility.length
          ? `Career: ${career} — ${traits.length} selectable Traits and ${talents.length} Talents are available. Host / Heritage is handled separately.`
          : `Career: ${career} — eligibility: ${eligibility.join("; ")}. ${traits.length} selectable Traits and ${talents.length} Talents are available. Host / Heritage is handled separately.`;
      }
    }
  } finally {
    suppressSkillRatingUpdates = false;
    restrictionRefreshInProgress = false;
    updateSkillRatings();
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
    const slotNames = isWeapon
      ? DATA.lists.weapons
      : DATA.lists.equipment.filter(name => {
          const item = byName(DATA.equipment, name);
          return item && item.loadoutEligible !== false;
        });
    makeOptions(sel, slotNames, "Choose...");
    sel.addEventListener("change", () => {
      const i = sel.dataset[`${type}Select`];
      const e = byName(DATA.equipment, sel.value);
      document.querySelector(`[data-${type}-type="${i}"]`).textContent = isWeapon ? inferWeaponSkill(e.name || "") : e.type || "";
      document.querySelector(`[data-${type}-weight="${i}"]`).textContent = e.weight || "";
      document.querySelector(`[data-${type}-rules="${i}"]`).textContent = e.mechanic || e.brief || "";
      document.querySelector(`[data-${type}-rarity="${i}"]`).textContent = e.rarity || "";
      if (type === "equipment") {
        applyArmourFromEquipment();
        updateDogfaceAutomationPanel();
      }
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
  state.weaponNotes = [...document.querySelectorAll("input[data-weapon-note]")].map(el => el.value);
  state.equipmentNotes = [...document.querySelectorAll("input[data-equipment-note]")].map(el => el.value);
  state.conditionNotes = [...document.querySelectorAll("input[data-condition-note]")].map(el => el.value);
  // Career is the sole persisted field. Older saved records are migrated in applyState().
  state.careerEligibility = activeRestrictions().filter(value => value !== "No Restrictions");
  state.startBonuses = { ...startingSkillBonuses };
  return state;
}
function applyState(rawState) {
  if (!rawState) return;
  const state = migrateLegacyHostState(rawState);
  if (!state.career && state.careerRole) state.career = state.careerRole;
  const legacyRestriction = state.careerEligibility || state.careerRestrictions || state.careerRestriction || state.restriction || "";
  delete state.careerRole;
  delete state.careerRestrictions;
  delete state.careerRestriction;
  delete state.restriction;

  startingSkillBonuses = { ...(state.startBonuses || {}) };

  // Identity dependencies are restored in order so Faction -> Host -> Homeworld /
  // Career filtering is valid before the rest of the saved sheet is applied.
  const specialFields = new Set(["faction", "hostHeritage", "hostState", "homeworld", "career", "nomadHeritage", "upliftSpecies", "upliftBody", "o12Assignment", "o12Pillar", "o12HistoricalTies"]);
  document.querySelectorAll("input[data-field], textarea[data-field], select[data-field]").forEach(el => {
    if (!specialFields.has(el.dataset.field) && state[el.dataset.field] !== undefined) el.value = state[el.dataset.field];
  });

  const factionField = inputField("faction");
  if (factionField) factionField.value = state.faction || "";
  refreshHostHeritageChoices({ value: state.hostHeritage || DEFAULT_HOST_HERITAGE, preserve: true });
  refreshHostStateChoices({ value: state.hostState || "", preserve: true });
  refreshUpliftChoices({ species: state.upliftSpecies || "", body: state.upliftBody || "", preserve: true });
  refreshHomeworldChoices({ value: state.homeworld || "", preserve: true, allowLegacy: true });
  refreshNomadHeritageChoices({ value: state.nomadHeritage || "", preserve: true });
  refreshCareerChoices({ value: state.career || GENERAL_CAREER, preserve: true, allowLegacy: true });
  setCareerChoice(state.career || GENERAL_CAREER, legacyRestriction);
  refreshO12Assignment({ value: state.o12Assignment || "", preserve: true });
  refreshO12Pillar({ value: state.o12Pillar || "", preserve: true });
  refreshO12HistoricalTiesVisibility();
  if (inputField("o12HistoricalTies")) inputField("o12HistoricalTies").value = state.o12HistoricalTies || "";
  refreshRestrictionChoices();

  const woundsField = inputField("wounds");
  if (woundsField) {
    woundsField.value = normalizeWounds(state.wounds);
    woundsField.dataset.lastDogfaceWounds = woundsField.value;
  }

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
  const migratedWeaponEquipment = [];
  const legacyWeaponToEquipment = {
    "Fireflies Grenade (BS)": "Fireflies Grenade",
    "Palad Khik (BS)": "Palad Khik Ammo",
    "CrazyKoala Mine (BS)": "CrazyKoala Mine"
  };
  (state.weapons || []).forEach((v, i) => {
    const el = document.querySelector(`select[data-weapon-select="${i}"]`);
    const equipmentAlias = legacyWeaponToEquipment[v];
    if (equipmentAlias) {
      migratedWeaponEquipment.push({ value: equipmentAlias, oldValue: v, weaponIndex: i });
      if (el) { el.value = ""; el.dispatchEvent(new Event("change")); }
      return;
    }
    if (el) { el.value = v; el.dispatchEvent(new Event("change")); }
  });

  const legacyEquipmentAliases = {
    "360* Visor": "360° Visor",
    "X Visor": "X-Visor"
  };
  const equipmentValues = (state.equipment || []).map(v => legacyEquipmentAliases[v] || v);
  migratedWeaponEquipment.forEach(migration => {
    if (equipmentValues.includes(migration.value)) return;
    let emptyIndex = equipmentValues.findIndex(value => !value);
    if (emptyIndex < 0 && equipmentValues.length < 10) emptyIndex = equipmentValues.length;
    if (emptyIndex >= 0) {
      equipmentValues[emptyIndex] = migration.value;
      return;
    }
    // Preserve a full-loadout legacy save rather than silently losing the item.
    const weaponEl = document.querySelector(`select[data-weapon-select="${migration.weaponIndex}"]`);
    if (weaponEl) {
      ensureSelectValue(weaponEl, migration.oldValue);
      weaponEl.value = migration.oldValue;
      weaponEl.dispatchEvent(new Event("change"));
    }
  });
  equipmentValues.forEach((v, i) => {
    const el = document.querySelector(`select[data-equipment-select="${i}"]`);
    if (el) { el.value = v; el.dispatchEvent(new Event("change")); }
  });
  (state.conditions || []).forEach((v, i) => {
    const el = document.querySelector(`select[data-condition-select="${i}"]`);
    if (el) { el.value = v; el.dispatchEvent(new Event("change")); }
  });
  (state.weaponNotes || []).forEach((v, i) => {
    const el = document.querySelector(`input[data-weapon-note="${i}"]`);
    if (el) el.value = v;
  });
  (state.equipmentNotes || []).forEach((v, i) => {
    const el = document.querySelector(`input[data-equipment-note="${i}"]`);
    if (el) el.value = v;
  });
  (state.conditionNotes || []).forEach((v, i) => {
    const el = document.querySelector(`input[data-condition-note="${i}"]`);
    if (el) el.value = v;
  });

  const hostState = inputField("hostState");
  if (hostState) hostState.dataset.lastValue = hostState.value || "";
  applyHostHeritageEffects({ recoverVigor: false });
  applyArmourFromEquipment();
  updateSkillRatings();
  syncDogfaceAutomation();
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

function updateArmourStatus(value, itemName = "", manualSourceArmour = false) {
  const status = document.getElementById("armourStatus");
  if (!status) return;
  if (manualSourceArmour) {
    status.textContent = `Armour: manual source profile — ${itemName}. This armour uses location-based source soak and is not converted automatically to the custom 5/10/15 Armour track.`;
    return;
  }
  status.textContent = value > 0
    ? `Armour: ${value} — auto-calculated from ${itemName || "equipped armour"}.`
    : "Armour: 0 — no armour equipment selected.";
}

function setDefaultTracks() {
  setFieldValue("hp", "20");
  setFieldValue("mentalStress", "20");
  setFieldValue("firewall", "20");
  setFieldValue("wounds", "0");
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
  if (item.armourAutomation === false) return 0;
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
  const manualSourceArmour = selectedEquipment.find(item => item.armourAutomation === false && /armor|armour/i.test(`${item.type || ""} ${item.name || ""}`)) || null;
  selectedEquipment.forEach(item => {
    const value = armourValueForItem(item);
    if (value > armourValue) {
      armourValue = value;
      armourItem = item;
    }
  });

  setArmourValue(armourValue);
  updateArmourStatus(armourValue, armourItem?.name || manualSourceArmour?.name || "", Boolean(manualSourceArmour && armourValue === 0));
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
  const armourChoices = DATA.equipment.filter(item => item.loadoutEligible !== false && /armor|armour/i.test(`${item.type || ""} ${item.name || ""}`));
  const armour = randomChoice(armourChoices);
  const nonArmourNames = DATA.lists.equipment.filter(name => {
    const item = byName(DATA.equipment, name);
    return item && item.loadoutEligible !== false && armourValueForItem(item) === 0;
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
    "Yu Jing": "Yu Jing",

    "Combined Army": "Combined Army",
    "Tohaa": "Tohaa",
    "Ships": "Ships - Circular Crew"
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
  setFieldValue("homeworld", randomChoice(homeworldsForFaction(faction)) || "");
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
  activeSaveId = "";
  autosaveCurrentCharacterNow();
  alert("Random Character created with 10 starting Focus points. Vigor, Mental Stress, and Firewall are 20. Armour is set from the generated armour item. It has been autosaved in this browser.");
}

function randomBeginnerCharacter() {
  const template = randomChoice(STARTER_PORTFOLIOS);
  const trait = byName(DATA.traits, template.trait);
  const talent = byName(DATA.talents, template.talent);

  setFieldValue("characterName", template.name);
  setFieldValue("player", "Starting Character");
  setFieldValue("faction", template.faction);
  refreshHomeworldChoices({ preserve: false });
  setFieldValue("homeworld", closestFactionHomeworld(template.faction, template.homeworld));
  setFieldValue("concept", template.concept);
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
  activeSaveId = "";
  autosaveCurrentCharacterNow();

  alert(`Random Beginner Character created from the ${template.name} starter portfolio pattern. It has 2 weapons, 5 non-weapon equipment items, 1 Trait, 1 Level 1 Talent, and 5 starting Focus points. It has been autosaved in this browser.`);
}

const SAVE_INDEX_KEY = "infinity2d20-character-index";
const SAVE_PREFIX = "infinity2d20-character-save:";
const LAST_ACTIVE_SAVE_KEY = "infinity2d20-character-last-active";
const CURRENT_SNAPSHOT_KEY = "infinity2d20-character-current-snapshot";
const IDB_DB_NAME = "infinity2d20-character-vault";
const IDB_STORE_NAME = "keyValue";
const AUTOSAVE_DELAY_MS = 500;
let activeSaveId = "";
let autosaveTimer = null;
let autosaveDirty = false;
let autosaveSuppressed = false;
let indexedDbAutoLoadAttempted = false;

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openCharacterVaultDb() {
  return new Promise(resolve => {
    if (!hasIndexedDb()) {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(IDB_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) db.createObjectStore(IDB_STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function vaultSet(key, value) {
  const db = await openCharacterVaultDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      tx.objectStore(IDB_STORE_NAME).put(value, key);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
      tx.onabort = () => { db.close(); resolve(false); };
    } catch {
      try { db.close(); } catch {}
      resolve(false);
    }
  });
}

async function vaultGet(key) {
  const db = await openCharacterVaultDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const request = tx.objectStore(IDB_STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
      tx.oncomplete = () => { try { db.close(); } catch {} };
      tx.onerror = () => { try { db.close(); } catch {} };
    } catch {
      try { db.close(); } catch {}
      resolve(null);
    }
  });
}

function buildCharacterSnapshot(id, state) {
  return {
    build: "v75-technology-workshop-foundation",
    id: id || saveIdFromName(state?.characterName || currentCharacterName()),
    name: state?.characterName || currentCharacterName(),
    savedAt: state?.savedAt || new Date().toISOString(),
    state
  };
}

function writeSnapshotMirrors(id, state) {
  if (!state) return;
  const snapshot = buildCharacterSnapshot(id, state);
  try {
    localStorage.setItem(CURRENT_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {}
  // IndexedDB is more durable on many mobile browsers than a single localStorage
  // index entry. It is asynchronous, so it mirrors autosaves without blocking play.
  vaultSet(CURRENT_SNAPSHOT_KEY, snapshot).catch(() => {});
}

function readLocalSnapshot() {
  try {
    const raw = localStorage.getItem(CURRENT_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function recoverSnapshotToLocalSave(snapshot) {
  if (!snapshot || !snapshot.state) return "";
  const state = snapshot.state;
  const id = snapshot.id || saveIdFromName(state.characterName || currentCharacterName());
  const name = state.characterName || snapshot.name || "Recovered Character";
  const savedAt = state.savedAt || snapshot.savedAt || new Date().toISOString();
  try {
    localStorage.setItem(SAVE_PREFIX + id, JSON.stringify(state));
    localStorage.setItem(LAST_ACTIVE_SAVE_KEY, id);
    upsertSaveIndexItem(id, name, savedAt, Boolean(state.autoSaved));
    return id;
  } catch {
    return "";
  }
}

function requestIndexedDbAutoLoadFallback() {
  if (indexedDbAutoLoadAttempted) return;
  indexedDbAutoLoadAttempted = true;
  vaultGet(CURRENT_SNAPSHOT_KEY).then(snapshot => {
    if (!snapshot || !snapshot.state) return;
    // Do not overwrite a character the player has already started editing while
    // the asynchronous mobile-storage fallback was opening.
    if (activeSaveId || autosaveDirty) return;
    const recoveredId = recoverSnapshotToLocalSave(snapshot);
    if (recoveredId) loadCharacterById(recoveredId, { auto: true, initial: true });
  }).catch(() => {});
}

function setAutosaveStatus(message, state = "ready") {
  const status = document.getElementById("autosaveStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function formatAutosaveTime(date = new Date()) {
  try {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "now";
  }
}

function upsertSaveIndexItem(id, name, updatedAt, autoSaved = false) {
  const cleanName = name || "Unnamed Character";
  let index = getSaveIndex().filter(item => item.id !== id);
  index.push({ id, name: cleanName, updatedAt, autoSaved });
  index.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  setSaveIndex(index);
}

function stateHasAutosaveContent(state) {
  if (!state) return false;
  const textFields = ["characterName", "player", "faction", "homeworld", "career", "concept", "campaignNotes"];
  if (textFields.some(field => String(state[field] || "").trim())) return true;
  if ((state.traits || []).some(Boolean) || (state.talents || []).some(Boolean)) return true;
  if ((state.weapons || []).some(Boolean) || (state.equipment || []).some(Boolean) || (state.conditions || []).some(Boolean)) return true;
  if ((state.weaponNotes || []).some(Boolean) || (state.equipmentNotes || []).some(Boolean) || (state.conditionNotes || []).some(Boolean)) return true;
  if (Object.values(state.skillNotes || {}).some(Boolean)) return true;
  if (Object.values(state.focus || {}).some(Boolean)) return true;
  if (Object.values(state.mainSkills || {}).some(value => String(value) && String(value) !== "7")) return true;
  return false;
}

function autosaveCurrentCharacterNow() {
  if (autosaveSuppressed) return;
  autosaveDirty = false;
  let state = null;
  try {
    state = collectState();
    if (!activeSaveId && !stateHasAutosaveContent(state)) {
      setAutosaveStatus("Autosave ready", "ready");
      return;
    }
    state.characterName = state.characterName || currentCharacterName();
    state.savedAt = new Date().toISOString();
    state.autoSaved = true;
    const name = state.characterName || "Unnamed Character";
    if (!activeSaveId) activeSaveId = saveIdFromName(name);
    localStorage.setItem(SAVE_PREFIX + activeSaveId, JSON.stringify(state));
    localStorage.setItem(LAST_ACTIVE_SAVE_KEY, activeSaveId);
    upsertSaveIndexItem(activeSaveId, name, state.savedAt, true);
    writeSnapshotMirrors(activeSaveId, state);
    const slotSelect = document.getElementById("characterSlotSelect");
    const selectedBeforeRefresh = slotSelect?.value || "";
    const selectedAfterRefresh = selectedBeforeRefresh && selectedBeforeRefresh !== activeSaveId ? selectedBeforeRefresh : activeSaveId;
    refreshSaveSlots(selectedAfterRefresh);
    setAutosaveStatus(`Autosaved ${formatAutosaveTime()}`, "saved");
  } catch (error) {
    console.error("Autosave failed", error);
    if (state) writeSnapshotMirrors(activeSaveId || saveIdFromName(state.characterName || currentCharacterName()), state);
    setAutosaveStatus("Autosave paused - storage unavailable", "error");
  }
}

function flushPendingAutosave() {
  if (autosaveSuppressed) return;
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  if (autosaveDirty) autosaveCurrentCharacterNow();
}

function scheduleAutosave() {
  if (autosaveSuppressed) return;
  autosaveDirty = true;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  setAutosaveStatus("Autosaving...", "saving");
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    autosaveCurrentCharacterNow();
  }, AUTOSAVE_DELAY_MS);
}

function installAutosave() {
  const sheet = document.getElementById("sheet");
  if (!sheet) return;
  const shouldAutosave = target => !!(target && target.matches && target.matches("input, textarea, select"));
  ["input", "change"].forEach(eventName => {
    sheet.addEventListener(eventName, event => {
      if (shouldAutosave(event.target)) scheduleAutosave();
    });
  });
  const flushForCloseOrBackground = () => {
    // Mobile browsers may suspend a tab without firing beforeunload. Save now
    // when the page is hidden, frozen, or about to be unloaded.
    flushPendingAutosave();
    autosaveCurrentCharacterNow();
  };
  window.addEventListener("beforeunload", flushForCloseOrBackground);
  window.addEventListener("pagehide", flushForCloseOrBackground);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushForCloseOrBackground();
  });
  setAutosaveStatus("Autosave ready", "ready");
}

function safeFileName(name) {
  return (name || "infinity-character").replace(/[^\w\-]+/g, "_");
}

function currentCharacterName() {
  return (inputField("characterName")?.value || "").trim() || "Unnamed Character";
}

function saveIdFromName(name) {
  return name.trim().toLowerCase().replace(/[^\w\-]+/g, "_") || "unnamed_character";
}

function normalizeSaveIndexItem(item) {
  if (!item || !item.id) return null;
  return {
    id: String(item.id),
    name: item.name || "Unnamed Character",
    updatedAt: item.updatedAt || item.savedAt || "",
    autoSaved: Boolean(item.autoSaved)
  };
}

function readSavedCharacterState(id) {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSaveIndex() {
  const byId = {};

  try {
    const stored = JSON.parse(localStorage.getItem(SAVE_INDEX_KEY) || "[]");
    if (Array.isArray(stored)) {
      stored.map(normalizeSaveIndexItem).filter(Boolean).forEach(item => {
        byId[item.id] = item;
      });
    }
  } catch {
    // Rebuild below from actual save records.
  }

  // v54: repair older or partially migrated browsers by scanning actual saved
  // character records. This makes auto-load work even if the visible index was
  // not refreshed by an earlier build, mobile browser, or XML import path.
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SAVE_PREFIX)) continue;
      const id = key.slice(SAVE_PREFIX.length);
      const state = readSavedCharacterState(id);
      if (!state) continue;
      byId[id] = {
        id,
        name: state.characterName || byId[id]?.name || id.replace(/_/g, " ") || "Unnamed Character",
        updatedAt: state.savedAt || byId[id]?.updatedAt || "",
        autoSaved: Boolean(state.autoSaved || byId[id]?.autoSaved)
      };
    }
  } catch {
    // If localStorage iteration is blocked, keep any index entries already read.
  }

  return Object.values(byId)
    .filter(item => !!localStorage.getItem(SAVE_PREFIX + item.id))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function setSaveIndex(index) {
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index.map(normalizeSaveIndexItem).filter(Boolean)));
}

function saveCharacterToBrowser() {
  const faction = inputField("faction")?.value || "";
  const homeworld = inputField("homeworld")?.value || "";
  if (!isValidFactionHomeworld(faction, homeworld)) {
    alert("Select a Homeworld / Habitat from the options linked to the chosen Faction before saving.");
    return;
  }

  const state = collectState();
  state.characterName = state.characterName || currentCharacterName();
  state.savedAt = new Date().toISOString();

  const name = state.characterName || "Unnamed Character";
  const id = saveIdFromName(name);
  localStorage.setItem(SAVE_PREFIX + id, JSON.stringify(state));
  localStorage.setItem(LAST_ACTIVE_SAVE_KEY, id);

  upsertSaveIndexItem(id, name, state.savedAt, false);
  writeSnapshotMirrors(id, state);
  activeSaveId = id;
  autosaveDirty = false;
  refreshSaveSlots(id);
  setAutosaveStatus(`Saved ${formatAutosaveTime()}`, "saved");
  alert(`Saved "${name}" to this browser.`);
}

let initialAutoLoadDone = false;

function loadCharacterById(id, options = {}) {
  const notify = !!options.notify;
  const auto = !!options.auto;
  const initial = !!options.initial;

  if (!id) {
    if (notify) alert("Choose a saved character first.");
    return false;
  }

  // Save pending edits to the current active portfolio before switching to
  // another saved portfolio. This keeps autosave safe while making the Load
  // button unnecessary.
  if (!initial && !autosaveSuppressed) flushPendingAutosave();

  let state = readSavedCharacterState(id);
  if (!state) {
    const snapshot = readLocalSnapshot();
    if (snapshot && snapshot.id === id && snapshot.state) {
      recoverSnapshotToLocalSave(snapshot);
      state = snapshot.state;
    }
  }
  if (!state) {
    if (notify || !auto) alert("Saved character not found in this browser.");
    refreshSaveSlots(id);
    requestIndexedDbAutoLoadFallback();
    return false;
  }

  autosaveSuppressed = true;
  try {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    hideGlossary({ silent: true, noScroll: true });
    applyState(state);
    activeSaveId = id;
    localStorage.setItem(LAST_ACTIVE_SAVE_KEY, id);
    writeSnapshotMirrors(id, state);
    autosaveDirty = false;
    refreshSaveSlots(id);
    const indexItem = getSaveIndex().find(item => item.id === id);
    setAutosaveStatus(`${initial ? "Auto-loaded" : "Loaded"}${indexItem?.name ? `: ${indexItem.name}` : ""} - autosave ready`, "ready");
  } catch (error) {
    console.error("Load failed", error);
    if (notify || !auto) alert("Saved character could not be loaded. The save data may be damaged.");
    return false;
  } finally {
    autosaveSuppressed = false;
  }

  if (notify) alert("Loaded selected character. Autosave is now active for this portfolio.");
  return true;
}

function autoLoadLastSavedCharacter() {
  const localSnapshot = readLocalSnapshot();
  let index = getSaveIndex();

  if (!index.length && localSnapshot?.state) {
    const recoveredId = recoverSnapshotToLocalSave(localSnapshot);
    if (recoveredId) index = getSaveIndex();
  }

  if (!index.length) {
    refreshSaveSlots();
    setAutosaveStatus("Autosave ready - no saved character found", "ready");
    requestIndexedDbAutoLoadFallback();
    return false;
  }

  const exists = id => !!id && index.some(item => item.id === id) && !!localStorage.getItem(SAVE_PREFIX + id);
  let id = localStorage.getItem(LAST_ACTIVE_SAVE_KEY) || "";

  if (!exists(id) && localSnapshot?.state) {
    const recoveredId = recoverSnapshotToLocalSave(localSnapshot);
    if (recoveredId) {
      index = getSaveIndex();
      id = recoveredId;
    }
  }

  if (!exists(id)) {
    const newest = [...index]
      .filter(item => exists(item.id))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
    id = newest?.id || "";
  }

  if (!exists(id)) {
    localStorage.removeItem(LAST_ACTIVE_SAVE_KEY);
    refreshSaveSlots();
    setAutosaveStatus("Autosave ready - no saved character found", "ready");
    requestIndexedDbAutoLoadFallback();
    return false;
  }

  const loaded = loadCharacterById(id, { auto: true, initial: true });
  if (!loaded) requestIndexedDbAutoLoadFallback();
  return loaded;
}

function runInitialAutoLoadSavedCharacter() {
  if (initialAutoLoadDone) return;
  initialAutoLoadDone = true;
  autoLoadLastSavedCharacter();
}

// Kept as a compatibility wrapper for older event hooks, but the visible Load
// button has been removed in v54. Selecting a saved character now loads it.
function loadCharacterFromBrowser() {
  const select = document.getElementById("characterSlotSelect");
  return loadCharacterById(select?.value || "", { notify: true });
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
  if (activeSaveId === id) activeSaveId = "";
  if (localStorage.getItem(LAST_ACTIVE_SAVE_KEY) === id) localStorage.removeItem(LAST_ACTIVE_SAVE_KEY);
  autosaveDirty = false;
  setAutosaveStatus("Save deleted - autosave ready", "ready");
  refreshSaveSlots();
}

function refreshSaveSlots(selectedId = undefined) {
  const select = document.getElementById("characterSlotSelect");
  if (!select) return;
  const previousSelection = select.value || "";
  const requestedSelection = selectedId === undefined ? previousSelection : selectedId;
  const index = getSaveIndex();
  select.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = index.length ? "Choose saved character to auto-load..." : "No saved characters";
  select.appendChild(blank);
  index.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "";
    opt.textContent = date ? `${item.name} (${date})` : item.name;
    select.appendChild(opt);
  });
  if (requestedSelection && [...select.options].some(option => option.value === requestedSelection)) {
    select.value = requestedSelection;
  }
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


/* -------------------------------------------------------------------------
   XML import/export for single character portfolios.
   The XML format mirrors collectState() and deliberately stores user-entered
   values only, not the full rules database. This keeps files small, readable,
   and safe to import on desktop or mobile browsers.
   ------------------------------------------------------------------------- */
function xmlSafeText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stateValueToXml(name, value, indent = "  ") {
  const safeName = xmlSafeText(name);
  if (Array.isArray(value)) {
    const items = value.map((item, index) => `${indent}  <item index="${index}">${xmlSafeText(item)}</item>`).join("\n");
    return `${indent}<array name="${safeName}">\n${items}\n${indent}</array>`;
  }
  if (value && typeof value === "object") {
    const fields = Object.entries(value)
      .map(([key, innerValue]) => stateValueToXml(key, innerValue, indent + "  "))
      .join("\n");
    return `${indent}<object name="${safeName}">\n${fields}\n${indent}</object>`;
  }
  return `${indent}<field name="${safeName}">${xmlSafeText(value)}</field>`;
}

function characterStateToXml(state) {
  const exportState = {
    ...state,
    xmlFormat: "Infinity2D20CharacterSheetXML-v1",
    exportedAt: new Date().toISOString(),
    exportedWithBuild: window.INFINITY_BUILD || document.documentElement.dataset.infinityBuild || "unknown"
  };
  const body = Object.entries(exportState)
    .map(([key, value]) => stateValueToXml(key, value, "    "))
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<infinity2d20CharacterSheet format="Infinity2D20CharacterSheetXML-v1" build="${xmlSafeText(window.INFINITY_BUILD || "v75-technology-workshop-foundation")}">\n  <state>\n${body}\n  </state>\n</infinity2d20CharacterSheet>\n`;
}

function exportCharacterXml() {
  flushPendingAutosave();
  const state = collectState();
  state.characterName = state.characterName || currentCharacterName();
  const name = safeFileName(state.characterName || "infinity-character");
  const xml = characterStateToXml(state);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setAutosaveStatus(`Exported XML ${formatAutosaveTime()}`, "saved");
}

function xmlChildToValue(node) {
  const tag = String(node.tagName || "").toLowerCase();
  if (tag === "array") {
    const result = [];
    [...node.children].forEach(child => {
      if (String(child.tagName || "").toLowerCase() !== "item") return;
      const index = Number(child.getAttribute("index"));
      if (Number.isInteger(index) && index >= 0) result[index] = child.textContent || "";
      else result.push(child.textContent || "");
    });
    return result.map(value => value ?? "");
  }
  if (tag === "object") {
    const result = {};
    [...node.children].forEach(child => {
      const key = child.getAttribute("name");
      if (key) result[key] = xmlChildToValue(child);
    });
    return result;
  }
  return node.textContent || "";
}

function characterXmlToState(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(xmlText || ""), "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("The selected XML file could not be read. It may be damaged or not valid XML.");
  const stateNode = doc.querySelector("infinity2d20CharacterSheet > state") || doc.querySelector("state");
  if (!stateNode) throw new Error("This XML file does not contain an Infinity 2D20 character state.");
  const state = {};
  [...stateNode.children].forEach(child => {
    const key = child.getAttribute("name");
    if (!key) return;
    state[key] = xmlChildToValue(child);
  });
  delete state.xmlFormat;
  delete state.exportedAt;
  delete state.exportedWithBuild;
  return state;
}

function importCharacterXmlFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => alert("The XML file could not be opened. Please try again.");
  reader.onload = () => {
    let parsed;
    try {
      parsed = characterXmlToState(reader.result);
    } catch (error) {
      alert(error.message || "The selected XML file is not a valid Infinity 2D20 character XML file.");
      return;
    }

    autosaveSuppressed = true;
    try {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      applyState(parsed);
      activeSaveId = "";
      autosaveDirty = false;
      hideGlossary({ silent: true });
      refreshSaveSlots("");
      setAutosaveStatus("Imported XML - save or edit to autosave", "ready");
    } finally {
      autosaveSuppressed = false;
    }

    if (confirm("XML import loaded. Save this character into browser slots now?")) {
      saveCharacterToBrowser();
    }
  };
  reader.readAsText(file);
}

function newCharacterSheet() {
  if (!confirm("Start a new character sheet? Your current character has been autosaved in this browser.")) return;

  autosaveSuppressed = true;
  try {
      document.querySelectorAll("input[data-field], textarea[data-field]").forEach(element => {
        element.value = "";
      });
      document.querySelectorAll("select[data-field]").forEach(element => {
        element.value = "";
      });

      refreshHostHeritageChoices({ value: DEFAULT_HOST_HERITAGE, preserve: false });
      refreshHostStateChoices({ preserve: false });
      refreshCareerChoices({ value: GENERAL_CAREER, preserve: false });
      setCareerChoice(GENERAL_CAREER, "No Restrictions");
      refreshHomeworldChoices({ preserve: false });
      refreshRestrictionChoices();
      applyHostHeritageEffects({ recoverVigor: false });
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
      updateSkillRatings();  } finally {
    autosaveSuppressed = false;
  }
  activeSaveId = "";
  autosaveDirty = false;
  setAutosaveStatus("New sheet - autosave ready", "ready");
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
  return `<div class="print-skill-chip print-skill-chip-simple">
    <div class="print-skill-chip-name">${printEscape(skill)}</div>
    <div class="print-skill-chip-total-only"><strong>${printEscape(parts.total)}</strong></div>
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
      <td class="number print-skill-total">${printEscape(parts.total)}</td>
      <td class="number">${printText(focus, "")}</td>
      <td class="print-skill-source">${printText(source, "")}</td>
    </tr>`;
  }).join("");

  /* Inline geometry is intentional: every print path receives the same simplified columns. */
  return `<div class="print-skills-panel" data-equal-skills-panel style="flex:0 0 calc((100% - 1.7mm) / 2);width:calc((100% - 1.7mm) / 2);min-width:0;box-sizing:border-box;">
    <table class="print-table print-skills-table" style="width:100%;min-width:0;max-width:100%;table-layout:fixed;">
      <colgroup>
        <col class="print-skill-col-name" style="width:27%">
        <col class="print-skill-col-total" style="width:13%">
        <col class="print-skill-col-focus" style="width:13%">
        <col class="print-skill-col-source" style="width:47%">
      </colgroup>
      <thead><tr><th>Skill</th><th>Total</th><th>Focus</th><th>Source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
function buildPrintCorePage(page, total) {
  const factionValue = printValue("faction");
  const showHost = usesSourceHostHeritage(factionValue);
  const fields = [
    ["Character Name", printValue("characterName") || "Unnamed Character", true],
    ["Player", printValue("player")],
    ["Faction", factionValue],
    ["Homeworld / Habitat", printValue("homeworld")],
    ...(isNomadsFaction(factionValue) ? [["Nomad Heritage", printValue("nomadHeritage")]] : []),
    ...(showHost ? [["Host / Heritage", printValue("hostHeritage") || DEFAULT_HOST_HERITAGE], ["Current Form", printValue("hostState")]] : []),
    ...(isNomadsFaction(factionValue) && selectedHostHeritage() === "Uplift" ? [["Uplift Species", printValue("upliftSpecies")], ["Body / Platform", printValue("upliftBody")]] : []),
    ["Career", printValue("career")],
    ...(isO12Faction(factionValue) ? [
      ["Historical Ties", printValue("o12HistoricalTies")],
      ["O-12 Bureau / Unit", printValue("o12Assignment")],
      ["O-12 Pillar", printValue("o12Pillar")]
    ] : [])
  ].filter(([, value]) => value);

  const hostConfig = hostHeritageConfig();
  const hostRuleText = isUpliftHost() ? upliftSourceStatus() : hostConfig.rules;
  const hostRules = showHost && selectedHostHeritage() !== DEFAULT_HOST_HERITAGE ? `<div class="print-rule-reminder"><b>Host / Heritage:</b> ${printText(hostRuleText, "")}</div>` : "";
  const identity = printSection("Character Identity", `<div class="print-fields">${fields.map(field => printField(...field)).join("")}</div>${hostRules}`);

  const mainSkillChips = mainSkills.map(printMainSkillCard).join("");
  const tracks = [
    ["HP / Vigor", printValue("hp")], ["Firewall", printValue("firewall")], ["Armour", printValue("armour")],
    ["Mental Stress", printValue("mentalStress")], ["Infinity Points", printValue("infinityPoints")], ["Credits", printValue("credits")],
    ["Momentum", printValue("momentum")], ["Wounds", printValue("wounds")]
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
  const player = printValue("player").toLowerCase();
  const notes = printValue("campaignNotes").toLowerCase();
  return player.includes("starting character") || notes.includes("portfolio-based beginner");
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
    .print-skills-table col.print-skill-col-name{width:27%!important;}
    .print-skills-table col.print-skill-col-total,.print-skills-table col.print-skill-col-focus{width:13%!important;}
    .print-skills-table col.print-skill-col-source{width:47%!important;}
    .print-skills-table td:nth-child(4),.print-skills-table th:nth-child(4){white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;}
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

/* v38 compact frame override: keep A4 landscape geometry while enforcing Arial 12pt minimum and flexible boxes. */
#_unused_v38_marker { display:none; }
body.print-window #printPortfolio,
body.print-window #printPortfolio *{font-family:Arial,Helvetica,sans-serif!important;font-size:12pt!important;line-height:1.18!important;}
body.print-window .print-page{height:auto!important;min-height:196mm!important;max-height:none!important;overflow:visible!important;}
body.print-window .print-header h1{font-size:16pt!important;}
body.print-window .print-section-title,body.print-window .print-locked-full-gear-title{font-size:12.5pt!important;line-height:1.1!important;}
body.print-window .print-skill-chip-total-only strong,body.print-window .print-skill-chip-total strong{font-size:18pt!important;line-height:.95!important;}
body.print-window .print-table th,body.print-window .print-table td,body.print-window .print-locked-gear-row>div,body.print-window .print-locked-gear-header>div{font-size:12pt!important;line-height:1.15!important;padding:.55mm .75mm!important;}

/* v39 frame print override: later than all old hard geometry, so it wins. */
body.print-window #printPortfolio,body.print-window #printPortfolio *{font-family:Arial,Helvetica,sans-serif!important;font-size:12pt!important;line-height:1.22!important;}
body.print-window #printPortfolio{width:285mm!important;min-width:0!important;max-width:285mm!important;}
body.print-window .print-page,body.print-window .print-section,body.print-window .print-field,body.print-window .print-track,body.print-window .print-option-meta-cell,body.print-window .print-copy-box,body.print-window .print-option-card,body.print-window .print-option-body,body.print-window .print-locked-full-gear-stack[data-locked-full-gear-stack],body.print-window .print-locked-full-gear-block[data-locked-full-gear-block],body.print-window .print-full-gear-stack[data-equal-full-gear-stack],body.print-window .print-full-gear-row[data-equal-full-gear-row],body.print-window .print-beginner-gear-stack[data-equal-gear-stack],body.print-window .print-beginner-gear-row[data-equal-gear-row]{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
body.print-window .print-locked-full-gear-stack[data-locked-full-gear-stack],body.print-window .print-full-gear-stack[data-equal-full-gear-stack],body.print-window .print-beginner-gear-stack[data-equal-gear-stack]{grid-template-rows:auto auto!important;gap:1.4mm!important;}
body.print-window .print-section-title,body.print-window .print-locked-full-gear-title{font-size:12.5pt!important;line-height:1.1!important;padding:1mm 1.35mm!important;}
body.print-window .print-header h1{font-size:18pt!important;}
body.print-window .print-header,body.print-window .print-section-body{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
body.print-window .print-table th,body.print-window .print-table td,body.print-window .print-locked-gear-row>div,body.print-window .print-locked-gear-header>div,body.print-window .print-skill-source{font-size:12pt!important;line-height:1.16!important;padding:.42mm .52mm!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
body.print-window .print-locked-gear-table{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
body.print-window .print-locked-gear-rules{max-height:none!important;overflow:visible!important;}
@media print{body.print-window .print-locked-full-gear-stack[data-locked-full-gear-stack],body.print-window .print-locked-full-gear-block[data-locked-full-gear-block]{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}}


/* v40 compact PDF/print override: remove remaining fixed-height/dead-space rules while keeping 12pt readable text. */
#_unused_v40_marker{display:none;}
@media print{
  #printPortfolio,#printPortfolio *{font-family:Arial,Helvetica,sans-serif!important;font-size:12pt!important;line-height:1.12!important;}
  #printPortfolio{width:283mm!important;max-width:283mm!important;}
  #printPortfolio .print-page{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;break-after:page!important;page-break-after:always!important;padding:0!important;}
  #printPortfolio .print-page:last-child{break-after:auto!important;page-break-after:auto!important;}
  #printPortfolio .print-header{min-height:0!important;margin:0 0 1.4mm!important;padding:1.8mm 2.4mm!important;}
  #printPortfolio .print-header h1{font-size:16pt!important;line-height:1.0!important;}
  #printPortfolio .print-subtitle,#printPortfolio .print-page-number{font-size:12pt!important;line-height:1.05!important;}
  #printPortfolio .print-section{margin:0 0 1.2mm!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;break-inside:auto!important;page-break-inside:auto!important;}
  #printPortfolio .print-section-title,#printPortfolio .print-locked-full-gear-title{font-size:12pt!important;line-height:1.05!important;padding:.75mm 1mm!important;}
  #printPortfolio .print-section-body{padding:.75mm 1mm!important;height:auto!important;min-height:0!important;}
  #printPortfolio .print-fields{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:.65mm!important;}
  #printPortfolio .print-field,#printPortfolio .print-track,#printPortfolio .print-option-meta-cell,#printPortfolio .print-copy-box,#printPortfolio .print-note{height:auto!important;min-height:0!important;max-height:none!important;padding:.45mm .6mm!important;}
  #printPortfolio .print-field-label,#printPortfolio .print-track span,#printPortfolio .print-note b{font-size:12pt!important;line-height:1.05!important;margin:0 0 .2mm!important;}
  #printPortfolio .print-field-value,#printPortfolio .print-track strong,#printPortfolio .print-note span{font-size:12pt!important;line-height:1.1!important;min-height:0!important;}
  #printPortfolio .print-core-grid{grid-template-columns:1fr!important;gap:.9mm!important;}
  #printPortfolio .print-main-skills{grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:.6mm!important;}
  #printPortfolio .print-skill-chip,#printPortfolio .print-skill-chip-total-only,#printPortfolio .print-skill-chip-total{height:auto!important;min-height:0!important;max-height:none!important;}
  #printPortfolio .print-skill-chip-name{font-size:11pt!important;line-height:1.0!important;padding:.45mm .25mm!important;}
  #printPortfolio .print-skill-chip-total-only strong,#printPortfolio .print-skill-chip-total strong{font-size:16pt!important;line-height:.9!important;margin:0!important;}
  #printPortfolio .print-tracks{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:.65mm!important;}
  #printPortfolio .print-table{font-size:12pt!important;line-height:1.08!important;width:100%!important;table-layout:fixed!important;}
  #printPortfolio .print-table th,#printPortfolio .print-table td,#printPortfolio .print-locked-gear-row>div,#printPortfolio .print-locked-gear-header>div{font-size:12pt!important;line-height:1.08!important;padding:.3mm .45mm!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
  #printPortfolio .print-skills-grid[data-equal-skills-grid]{gap:.9mm!important;align-items:flex-start!important;}
  #printPortfolio .print-skill-reminder{font-size:12pt!important;line-height:1.1!important;margin:.5mm 0 0!important;padding-top:.3mm!important;}
  #printPortfolio .print-options-grid,#printPortfolio .print-gear-grid,#printPortfolio .print-supplement-grid{gap:1mm!important;}
  #printPortfolio .print-option-card,#printPortfolio .print-option-body,#printPortfolio .print-copy-box{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
  #printPortfolio .print-copy-text{font-size:12pt!important;line-height:1.12!important;}
  #printPortfolio .print-locked-full-gear-stack[data-locked-full-gear-stack],#printPortfolio .print-full-gear-stack[data-equal-full-gear-stack],#printPortfolio .print-beginner-gear-stack[data-equal-gear-stack]{display:block!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
  #printPortfolio .print-locked-full-gear-block[data-locked-full-gear-block],#printPortfolio .print-full-gear-row[data-equal-full-gear-row],#printPortfolio .print-beginner-gear-row[data-equal-gear-row]{display:block!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;margin:0 0 1mm!important;}
  #printPortfolio .print-locked-gear-table{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;padding:.5mm .7mm!important;}
  #printPortfolio .print-locked-gear-rules{display:block!important;max-height:none!important;overflow:visible!important;}
  #printPortfolio .print-rule-reminder{font-size:12pt!important;line-height:1.1!important;margin-top:.7mm!important;padding:.6mm .8mm!important;}
}
body.print-window #printPortfolio,body.print-window #printPortfolio *{font-family:Arial,Helvetica,sans-serif!important;font-size:12pt!important;line-height:1.12!important;}
body.print-window .print-page,body.print-window .print-section,body.print-window .print-field,body.print-window .print-track,body.print-window .print-locked-full-gear-stack[data-locked-full-gear-stack],body.print-window .print-locked-full-gear-block[data-locked-full-gear-block]{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
body.print-window .print-section{margin-bottom:1.2mm!important;}
body.print-window .print-section-body{padding:.75mm 1mm!important;}
body.print-window .print-field,body.print-window .print-track{padding:.45mm .6mm!important;}
body.print-window .print-table th,body.print-window .print-table td,body.print-window .print-locked-gear-row>div,body.print-window .print-locked-gear-header>div{font-size:12pt!important;line-height:1.08!important;padding:.3mm .45mm!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
body.print-window .print-locked-full-gear-stack[data-locked-full-gear-stack]{display:block!important;}
body.print-window .print-locked-full-gear-block[data-locked-full-gear-block]{display:block!important;margin-bottom:1mm!important;}


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
            [27,13,13,47].forEach(function(width,index){if(cols[index])cols[index].style.setProperty('width',width+'%','important');});
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
      // v39: do not equalise gear row heights; boxes now grow only as needed.
      // lockEqualGearRows('[data-equal-gear-stack]','[data-equal-gear-row]');
      // lockEqualGearRows('[data-equal-full-gear-stack]','[data-equal-full-gear-row]');
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
  const text = (x,top,value,size=12,bold=false,colour='#172033') => {
    const safeSize = Math.max(12, Number(size) || 12);
    const [r,g,b]=hexToRgb(colour); color(r,g,b,false); const y=H-top-safeSize;
    commands.push(`BT /${bold?'F2':'F1'} ${safeSize} Tf 1 0 0 1 ${x} ${y} Tm (${pdfAscii(value)}) Tj ET`);
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
  p.text(32,25,'INFINITY 2D20 CHARACTER PORTFOLIO',18,true,'#ffffff');
  if(subtitle) p.text(32,47,subtitle,12,false,'#eaf3f8');
  p.text(722,33,`PAGE ${page} OF ${total}`,12,true,'#ffffff');
  return p;
}

function pdfSection(p,title,x,top,w,h) {
  p.rect(x,top,w,h,[1,1,1],'#9aa7b1');
  p.rect(x,top,w,20,[0.12,0.31,0.48],null);
  p.text(x+8,top+3,title.toUpperCase(),12,true,'#ffffff');
  return {x,top:top+20,w,h:h-20};
}

function pdfBox(p,label,value,x,top,w,h) {
  p.rect(x,top,w,h,[1,1,1],'#c8d0d8');
  p.text(x+5,top+3,label.toUpperCase(),12,true,'#536173');
  const lines=pdfWords(value || '-', Math.max(6,Math.floor((w-10)/6.6)), Math.max(1,Math.floor((h-22)/12)));
  lines.forEach((line,index)=>p.text(x+5,top+18+index*14,line,12,false,'#172033'));
}

function pdfSkillPanel(p,skills,x,top,w,h) {
  const cols=[.27,.13,.13,.47];
  const xs=[x]; for(let i=0;i<cols.length;i++)xs.push(xs[i]+w*cols[i]);
  const headerH=20; const rowH=(h-headerH)/skills.length;
  p.rect(x,top,w,h,[1,1,1],'#9aa7b1');
  p.rect(x,top,w,headerH,[0.12,0.31,0.48],null);
  ['Skill','Total','Focus','Source'].forEach((label,i)=>p.text(xs[i]+3,top+3,label,12,true,'#ffffff'));
  skills.forEach((skill,row)=>{
    const parts=skillRatingParts(skill);
    const focus=document.querySelector(`select[data-focus="${CSS.escape(skill)}"]`)?.value || '';
    const note=document.querySelector(`input[data-skill-note="${CSS.escape(skill)}"]`)?.value?.trim() || '';
    const source=[...parts.sources,note].filter(Boolean).join('; ') || '';
    const y=top+headerH+row*rowH;
    p.line(x,y+rowH,x+w,y+rowH,'#c8d0d8',.25);
    [skill,parts.total,focus,source].forEach((value,i)=>{
      const char=Math.max(4,Math.floor((xs[i+1]-xs[i]-6)/6.4));
      const lines=pdfWords(value, char, 1);
      lines.forEach((line,n)=>p.text(xs[i]+3,y+3+n*13,line,12,i===1,'#172033'));
    });
  });
}

function pdfCorePage(page,total) {
  const p=pdfHeader(page,total,'Identity, main skills, resources and complete skill list');
  const identity=pdfSection(p,'Character Identity',18,70,805,76);
  const fields=[['Character Name',printValue('characterName')||'Unnamed Character'],['Faction',printValue('faction')],['Homeworld / Habitat',printValue('homeworld')],['Career',printValue('career')]];
  const boxW=(identity.w-18)/4; fields.forEach((field,i)=>pdfBox(p,field[0],field[1],identity.x+5+(i%4)*(boxW+4.5),identity.top+6+Math.floor(i/4)*36,boxW,32));
  const main=pdfSection(p,'Main Skills and Resources',18,154,805,108);
  const chipW=(main.w-16)/7;
  mainSkills.forEach((skill,i)=>{ const parts=skillRatingParts(skill); const x=main.x+5+i*(chipW+1.6); pdfBox(p,skill,String(parts.total),x,main.top+6,chipW,38); });
  const tracks=[['HP / Vigor',printValue('hp')],['Firewall',printValue('firewall')],['Armour',printValue('armour')],['Mental Stress',printValue('mentalStress')],['Momentum',printValue('momentum')],['Wounds',printValue('wounds')]];
  const trackW=(main.w-16)/6; tracks.forEach((track,i)=>pdfBox(p,track[0],track[1],main.x+5+i*(trackW+1.6),main.top+52,trackW,36));
  const skillSec=pdfSection(p,'Skills',18,268,805,308);
  const gap=10; const panelW=(skillSec.w-10-gap)/2; const panelH=skillSec.h-10;
  pdfSkillPanel(p,skillOrder.slice(0,16),skillSec.x+5,skillSec.top+5,panelW,panelH);
  pdfSkillPanel(p,skillOrder.slice(16),skillSec.x+5+panelW+gap,skillSec.top+5,panelW,panelH);
  return p.commands.join('\n');
}

function pdfOptionCard(p,title,item,x,top,w,h,kind) {
  p.rect(x,top,w,h,[0.97,0.985,0.995],'#9aa7b1');
  p.rect(x,top,w,24,kind==='trait'?[0.14,0.35,0.52]:[0.12,0.31,0.48],null);
  p.text(x+8,top+5,item?.name||title,12,true,'#ffffff');
  const primary=item?.primary||'-', secondary=item?.secondary||'-';
  p.text(x+8,top+34,`Primary: ${primary}     Secondary: ${secondary}`,12,true,'#172033');
  const body=item?.description||item?.brief||''; const effect=item?.effect||'';
  const bodyLines=pdfWords(body,Math.max(18,Math.floor((w-16)/6.2)),3); bodyLines.forEach((line,i)=>p.text(x+8,top+52+i*14,line,12,false,'#172033'));
  const effectLines=pdfWords(effect,Math.max(18,Math.floor((w-16)/6.2)),3); effectLines.forEach((line,i)=>p.text(x+8,top+98+i*14,line,12,false,'#172033'));
}

function pdfGearBlock(p,title,items,x,top,w,h,kind) {
  p.rect(x,top,w,h,[1,1,1],'#9aa7b1');
  p.rect(x,top,w,24,[0.12,0.31,0.48],null);
  p.text(x+8,top+5,title.toUpperCase(),12,true,'#ffffff');
  const cols=[.03,.16,.09,.07,.65]; const xs=[x+5]; const innerW=w-10; for(let i=0;i<cols.length;i++)xs.push(xs[i]+innerW*cols[i]);
  const tableTop=top+30; const headerH=20; const rows=Math.max(items.length,1); const rowH=Math.max(22,(h-36-headerH)/rows);
  p.rect(x+5,tableTop,innerW,headerH,[0.12,0.31,0.48],null);
  ['#','Item',kind==='weapon'?'Skill':'Type','Wt','Rules / Notes'].forEach((label,i)=>p.text(xs[i]+2,tableTop+3,label,12,true,'#ffffff'));
  for(let row=0;row<rows;row++){
    const item=items[row]; const y=tableTop+headerH+row*rowH; p.line(x+5,y+rowH,x+5+innerW,y+rowH,'#c8d0d8',.25);
    if(!item)continue;
    const entry=item.entry||{}; const type=kind==='weapon'?inferWeaponSkill(entry.name||''):entry.type||''; const rules=entry.mechanic||entry.brief||'';
    const vals=[String(item.index||row+1),entry.name||'',type,entry.weight||'',rules];
    vals.forEach((value,i)=>{const max=i===4?Math.max(14,Math.floor((xs[i+1]-xs[i]-4)/6.2)):Math.max(3,Math.floor((xs[i+1]-xs[i]-4)/6.6)); const lines=pdfWords(value,max,i===4?2:1); lines.forEach((line,n)=>p.text(xs[i]+2,y+3+n*13,line,12,false,'#172033'));});
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



/* -------------------------------------------------------------------------
   v39 mobile direct-PDF flow layout
   The mobile export path does not use browser print CSS. These replacements
   draw larger 12pt text into more, less-cramped pages and let row/card height
   grow from content instead of fixed legacy boxes.
   ------------------------------------------------------------------------- */
const MOBILE_PDF_FONT = 12;
const MOBILE_PDF_LINE = 15;
const MOBILE_PDF_LEFT = 18;
const MOBILE_PDF_TOP = 70;
const MOBILE_PDF_WIDTH = 805;
const MOBILE_PDF_BOTTOM = 574;

function pdfLineCapacity(width, avg = 6.2) {
  return Math.max(8, Math.floor((Number(width) || 0) / avg));
}

function pdfDynamicBox(p, label, value, x, top, w, minH = 28, maxLines = 3) {
  const textWidth = Math.max(12, w - 10);
  const lines = pdfWords(value || '-', pdfLineCapacity(textWidth, 6.2), maxLines);
  const h = Math.max(minH, 20 + lines.length * 13);
  p.rect(x, top, w, h, [1,1,1], '#c8d0d8');
  p.text(x + 5, top + 3, String(label || '').toUpperCase(), MOBILE_PDF_FONT, true, '#536173');
  lines.forEach((line, index) => p.text(x + 5, top + 17 + index * 13, line, MOBILE_PDF_FONT, false, '#172033'));
  return h;
}

function pdfSectionFrame(p, title, x, top, w, h) {
  p.rect(x, top, w, h, [1,1,1], '#9aa7b1');
  p.rect(x, top, w, 23, [0.12,0.31,0.48], null);
  p.text(x + 8, top + 5, String(title || '').toUpperCase(), MOBILE_PDF_FONT, true, '#ffffff');
  return { x: x + 6, top: top + 29, w: w - 12, h: h - 35 };
}

function pdfHeaderLarge(page, total, subtitle = '') {
  const p = pdfPage();
  p.rect(18, 16, 805, 48, [0.09,0.21,0.37], null);
  p.text(32, 25, 'INFINITY 2D20 CHARACTER PORTFOLIO', 18, true, '#ffffff');
  if (subtitle) p.text(32, 48, subtitle, MOBILE_PDF_FONT, false, '#eaf3f8');
  p.text(710, 34, `PAGE ${page} OF ${total}`, MOBILE_PDF_FONT, true, '#ffffff');
  return p;
}


function pdfMeasureBoxValue(value, w, minH = 30, maxLines = 2) {
  const textWidth = Math.max(12, w - 10);
  const lines = pdfWords(value || '-', pdfLineCapacity(textWidth, 6.2), maxLines);
  return { lines, h: Math.max(minH, 20 + lines.length * 13) };
}

function pdfDrawMeasuredBox(p, label, measure, x, top, w) {
  const safe = measure || { lines: ['-'], h: 30 };
  p.rect(x, top, w, safe.h, [1,1,1], '#c8d0d8');
  p.text(x + 5, top + 3, String(label || '').toUpperCase(), MOBILE_PDF_FONT, true, '#536173');
  (safe.lines || ['-']).forEach((line, index) => p.text(x + 5, top + 17 + index * 13, line, MOBILE_PDF_FONT, false, '#172033'));
  return safe.h;
}

function pdfDrawSectionFrame(p, title, x, top, w, h) {
  p.rect(x, top, w, h, [1,1,1], '#9aa7b1');
  p.rect(x, top, w, 23, [0.12,0.31,0.48], null);
  p.text(x + 8, top + 5, String(title || '').toUpperCase(), MOBILE_PDF_FONT, true, '#ffffff');
  return { x: x + 6, top: top + 29, w: w - 12, h: h - 35 };
}

function pdfCorePage(page, total) {
  const p = pdfHeaderLarge(page, total, 'Identity, main skills and resources');
  const pageX = 18;
  const pageW = 805;
  const sectionGap = 8;
  const boxGap = 5;
  let sectionTop = 72;

  // Character Identity: calculate the required height first, then draw the frame.
  // This prevents the Main Skills header from overlapping Homeworld/Career on mobile PDFs.
  const identityFields = [
    ['Character Name', printValue('characterName') || 'Unnamed Character'],
    ['Player', printValue('player')],
    ['Faction', printValue('faction')],
    ['Homeworld / Habitat', printValue('homeworld')],
    ['Career', printValue('career')]
  ];
  const identityInnerW = pageW - 12;
  const identityColW = (identityInnerW - boxGap) / 2;
  const nameM = pdfMeasureBoxValue(identityFields[0][1], identityInnerW, 30, 2);
  const playerM = pdfMeasureBoxValue(identityFields[1][1], identityColW, 30, 2);
  const factionM = pdfMeasureBoxValue(identityFields[2][1], identityColW, 30, 2);
  const homeworldM = pdfMeasureBoxValue(identityFields[3][1], identityColW, 30, 2);
  const careerM = pdfMeasureBoxValue(identityFields[4][1], identityColW, 30, 2);
  const identityRow1H = Math.max(playerM.h, factionM.h);
  const identityRow2H = Math.max(homeworldM.h, careerM.h);
  const identityBodyH = nameM.h + boxGap + identityRow1H + boxGap + identityRow2H;
  const identitySectionH = 29 + identityBodyH + 6;
  const identity = pdfDrawSectionFrame(p, 'Character Identity', pageX, sectionTop, pageW, identitySectionH);
  let y = identity.top;
  pdfDrawMeasuredBox(p, identityFields[0][0], nameM, identity.x, y, identity.w);
  y += nameM.h + boxGap;
  pdfDrawMeasuredBox(p, identityFields[1][0], playerM, identity.x, y, identityColW);
  pdfDrawMeasuredBox(p, identityFields[2][0], factionM, identity.x + identityColW + boxGap, y, identityColW);
  y += identityRow1H + boxGap;
  pdfDrawMeasuredBox(p, identityFields[3][0], homeworldM, identity.x, y, identityColW);
  pdfDrawMeasuredBox(p, identityFields[4][0], careerM, identity.x + identityColW + boxGap, y, identityColW);
  sectionTop += identitySectionH + sectionGap;

  // Main skills and resources: dynamic frame based on box rows, not fixed top values.
  const mainInnerW = pageW - 12;
  const skillGap = 4;
  const skillBoxH = 34;
  const chipW = (mainInnerW - skillGap * 6) / 7;
  const tracks = [
    ['HP / Vigor', printValue('hp')],
    ['Firewall', printValue('firewall')],
    ['Armour', printValue('armour')],
    ['Mental Stress', printValue('mentalStress')],
    ['Infinity Points', printValue('infinityPoints')],
    ['Credits', printValue('credits')],
    ['Momentum', printValue('momentum')],
    ['Wounds', printValue('wounds')]
  ];
  const trackGap = 5;
  const trackW = (mainInnerW - trackGap * 3) / 4;
  const trackMeasures = tracks.map(track => pdfMeasureBoxValue(track[1] || '-', trackW, 30, 1));
  const trackRow1H = Math.max(...trackMeasures.slice(0, 4).map(m => m.h));
  const trackRow2H = Math.max(...trackMeasures.slice(4).map(m => m.h));
  const mainBodyH = skillBoxH + 8 + trackRow1H + boxGap + trackRow2H;
  const mainSectionH = 29 + mainBodyH + 6;
  const main = pdfDrawSectionFrame(p, 'Main Skills and Resources', pageX, sectionTop, pageW, mainSectionH);
  mainSkills.forEach((skill, index) => {
    const x = main.x + index * (chipW + skillGap);
    const measure = { lines: [String(skillRatingParts(skill).total)], h: skillBoxH };
    pdfDrawMeasuredBox(p, skill, measure, x, main.top, chipW);
  });
  const trackY1 = main.top + skillBoxH + 8;
  const trackY2 = trackY1 + trackRow1H + boxGap;
  tracks.forEach((track, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const top = row === 0 ? trackY1 : trackY2;
    const measure = trackMeasures[index];
    pdfDrawMeasuredBox(p, track[0], measure, main.x + col * (trackW + trackGap), top, trackW);
  });
  sectionTop += mainSectionH + sectionGap;

  // A small optional note replaces the older oversized Export Notes box.
  const noteText = 'Large-print PDF: Arial-equivalent 12pt text, clean skill totals, and non-overlapping adaptive boxes.';
  const noteM = pdfMeasureBoxValue(noteText, pageW - 12, 26, 2);
  const noteH = 29 + noteM.h + 6;
  const notes = pdfDrawSectionFrame(p, 'Export Notes', pageX, sectionTop, pageW, noteH);
  pdfDrawMeasuredBox(p, 'Notes', noteM, notes.x, notes.top, notes.w);

  return p.commands.join('\n');
}

function pdfSkillsLargePage(page, total, title, skills) {
  const p = pdfHeaderLarge(page, total, title);
  const x = 18, top = 76, w = 805;
  const headerH = 26;
  const rowH = 26;
  const h = headerH + skills.length * rowH + 10;
  const cols = [0.27, 0.12, 0.12, 0.49];
  const xs = [x + 6];
  const innerW = w - 12;
  cols.forEach(col => xs.push(xs[xs.length - 1] + innerW * col));

  p.rect(x, top, w, h, [1,1,1], '#9aa7b1');
  p.rect(x, top, w, headerH, [0.12,0.31,0.48], null);
  ['Skill', 'Total', 'Focus', 'Source'].forEach((label, index) => p.text(xs[index] + 3, top + 6, label, MOBILE_PDF_FONT, true, '#ffffff'));

  skills.forEach((skill, row) => {
    const y = top + headerH + row * rowH;
    const parts = skillRatingParts(skill);
    const focus = mainSkills.includes(skill) ? '' : (document.querySelector(`select[data-focus="${CSS.escape(skill)}"]`)?.value || '');
    const note = mainSkills.includes(skill) ? '' : (document.querySelector(`input[data-skill-note="${CSS.escape(skill)}"]`)?.value?.trim() || '');
    const source = [...parts.sources, note].filter(Boolean).join('; ') || (mainSkills.includes(skill) ? 'Main skill' : '');
    p.line(x, y + rowH, x + w, y + rowH, '#c8d0d8', .3);
    const values = [skill, String(parts.total), focus, source];
    values.forEach((value, index) => {
      const colWidth = xs[index + 1] - xs[index] - 6;
      const maxLines = index === 3 ? 2 : 1;
      const lines = pdfWords(value, pdfLineCapacity(colWidth, 6.2), maxLines);
      lines.forEach((line, n) => p.text(xs[index] + 3, y + 5 + n * 12, line, MOBILE_PDF_FONT, index === 1, '#172033'));
    });
  });
  return p.commands.join('\n');
}

function pdfOptionCard(p, title, item, x, top, w, h, kind) {
  const safeItem = item || {};
  p.rect(x, top, w, h, [0.97,0.985,0.995], '#9aa7b1');
  p.rect(x, top, w, 28, kind === 'trait' ? [0.14,0.35,0.52] : [0.12,0.31,0.48], null);
  p.text(x + 8, top + 7, safeItem.name || title, 13, true, '#ffffff');
  const meta = kind === 'trait'
    ? `Primary: ${safeItem.primary || '-'}   Secondary: ${safeItem.secondary || '-'}   Rarity: ${safeItem.rarity || '-'}`
    : `Level: ${safeItem.level || '-'}   Career: ${safeItem.career || '-'}   Skill Links: ${[safeItem.primary, safeItem.secondary].filter(Boolean).join(' / ') || '-'}`;
  p.text(x + 8, top + 38, meta, MOBILE_PDF_FONT, true, '#172033');
  const body = safeItem.description || safeItem.brief || '';
  const effect = safeItem.effect || '';
  const bodyLines = pdfWords(body, pdfLineCapacity(w - 18, 6.2), 5);
  bodyLines.forEach((line, index) => p.text(x + 8, top + 58 + index * MOBILE_PDF_LINE, line, MOBILE_PDF_FONT, false, '#172033'));
  const effectTop = top + 58 + Math.max(2, bodyLines.length) * MOBILE_PDF_LINE + 10;
  p.text(x + 8, effectTop, 'Effect', MOBILE_PDF_FONT, true, '#536173');
  const effectLines = pdfWords(effect, pdfLineCapacity(w - 18, 6.2), 7);
  effectLines.forEach((line, index) => p.text(x + 8, effectTop + 17 + index * MOBILE_PDF_LINE, line, MOBILE_PDF_FONT, false, '#172033'));
}

function pdfOptionsPage(page, total, title, items, kind) {
  const p = pdfHeaderLarge(page, total, title);
  const shown = (items && items.length) ? items.slice(0, 3) : [{ name: `No ${kind === 'trait' ? 'Traits' : 'Talents'} selected` }];
  const gap = 12;
  const cardH = Math.floor((MOBILE_PDF_BOTTOM - MOBILE_PDF_TOP - (shown.length - 1) * gap) / shown.length);
  shown.forEach((item, index) => pdfOptionCard(p, kind === 'trait' ? 'Trait' : 'Talent', item, 18, MOBILE_PDF_TOP + index * (cardH + gap), 805, cardH, kind));
  return p.commands.join('\n');
}

function pdfGearBlockLarge(p, title, items, x, top, w, kind) {
  const rowCount = Math.max(items.length, 1);
  const headerH = 24;
  const rowH = 28;
  const h = headerH + 22 + rowCount * rowH + 10;
  const cols = [0.05, 0.22, 0.13, 0.10, 0.50];
  const innerX = x + 6;
  const innerW = w - 12;
  const xs = [innerX];
  cols.forEach(col => xs.push(xs[xs.length - 1] + innerW * col));
  p.rect(x, top, w, h, [1,1,1], '#9aa7b1');
  p.rect(x, top, w, 24, [0.12,0.31,0.48], null);
  p.text(x + 8, top + 5, title.toUpperCase(), MOBILE_PDF_FONT, true, '#ffffff');
  const tableTop = top + 30;
  p.rect(innerX, tableTop, innerW, headerH, [0.12,0.31,0.48], null);
  ['#', 'Item', kind === 'weapon' ? 'Skill' : 'Type', 'Wt', 'Rules / Notes'].forEach((label, index) => p.text(xs[index] + 3, tableTop + 5, label, MOBILE_PDF_FONT, true, '#ffffff'));
  for (let row = 0; row < rowCount; row += 1) {
    const y = tableTop + headerH + row * rowH;
    p.line(innerX, y + rowH, innerX + innerW, y + rowH, '#c8d0d8', .3);
    const item = items[row];
    if (!item) continue;
    const entry = item.entry || {};
    const type = kind === 'weapon' ? inferWeaponSkill(entry.name || '') : (entry.type || '');
    const rules = entry.mechanic || entry.brief || '';
    const values = [String(item.index || row + 1), entry.name || '', type, entry.weight || '', rules];
    values.forEach((value, index) => {
      const colWidth = xs[index + 1] - xs[index] - 6;
      const maxLines = index === 4 ? 2 : 1;
      const lines = pdfWords(value, pdfLineCapacity(colWidth, 6.2), maxLines);
      lines.forEach((line, n) => p.text(xs[index] + 3, y + 5 + n * 12, line, MOBILE_PDF_FONT, false, '#172033'));
    });
  }
  return h;
}

function pdfGearPage(page, total, content, beginner = false) {
  const p = pdfHeaderLarge(page, total, 'Weapons and equipment');
  let y = MOBILE_PDF_TOP;
  if (content.weapons.length) y += pdfGearBlockLarge(p, `Weapons - ${content.weapons.length} Selected`, content.weapons, 18, y, 805, 'weapon') + 12;
  if (content.equipment.length) pdfGearBlockLarge(p, `Equipment - ${content.equipment.length} Selected`, content.equipment, 18, y, 805, 'equipment');
  if (!content.weapons.length && !content.equipment.length) {
    const area = pdfSectionFrame(p, 'Weapons and Equipment', 18, y, 805, 120);
    p.text(area.x, area.top, 'No weapons or equipment selected.', MOBILE_PDF_FONT, false, '#172033');
  }
  return p.commands.join('\n');
}

function buildMobilePortfolioPdfPages() {
  const traits = selectedPrintTraits();
  const talents = selectedPrintTalents();
  const content = printSupplementContent();
  const builders = [];
  builders.push((page, total) => pdfCorePage(page, total));
  builders.push((page, total) => pdfSkillsLargePage(page, total, 'Skills 1 of 2', skillOrder.slice(0, 15)));
  builders.push((page, total) => pdfSkillsLargePage(page, total, 'Skills 2 of 2', skillOrder.slice(15)));
  builders.push((page, total) => pdfOptionsPage(page, total, 'Selected Traits', traits, 'trait'));
  builders.push((page, total) => pdfOptionsPage(page, total, 'Selected Talents', talents, 'talent'));
  builders.push((page, total) => pdfGearPage(page, total, content, isBeginnerPrintCharacter()));
  const total = builders.length;
  return builders.map((build, index) => build(index + 1, total));
}


const GLOSSARY_CATEGORIES = [
  "All",
  "Rules Terms",
  "Source References",
  "Traits",
  "Talents",
  "Careers",
  "Factions",
  "Homeworlds / Habitats",
  "Weapons",
  "Equipment",
  "Conditions"
];
let glossaryEntriesCache = null;
let glossaryRenderPending = false;
let glossaryInitialized = false;

function glossaryEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function glossarySort(list) {
  return [...list].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
}

function glossaryMetaLine(parts) {
  return parts.filter(Boolean).map(v => String(v).trim()).filter(Boolean);
}

function compactList(values, limit = 10) {
  const cleaned = [...new Set((values || []).map(v => String(v || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (!cleaned.length) return "";
  return cleaned.length > limit
    ? `${cleaned.slice(0, limit).join(", ")}, and ${cleaned.length - limit} more`
    : cleaned.join(", ");
}

function splitTerms(value) {
  return String(value || "")
    .split(/[,;/]|\band\b/gi)
    .map(v => v.trim())
    .filter(Boolean);
}

function normalizeGlossaryKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findFactionRecord(name) {
  const key = normalizeGlossaryKey(name);
  if (!key) return null;
  return (DATA.factions || []).find(record => normalizeGlossaryKey(record.faction) === key)
    || (DATA.factions || []).find(record => normalizeGlossaryKey(record.faction).includes(key) || key.includes(normalizeGlossaryKey(record.faction)))
    || null;
}

function worldMatchesRecord(world, record) {
  const worldKey = normalizeGlossaryKey(world);
  const homeworldKey = normalizeGlossaryKey(record?.homeworld || "");
  if (!worldKey || !homeworldKey) return false;
  return homeworldKey.includes(worldKey) || worldKey.includes(homeworldKey);
}

function sourceGuidedFallback(kind, name, extra = "") {
  const label = String(name || kind || "entry").trim();
  const detail = String(extra || "").trim();
  if (kind === "Career") return `${label} is a life-path and social role in the Human Sphere. It says where a character learned their craft, who might recognise their methods, and which institutions, crews, armies, labs, clans, or street networks shaped them.${detail ? ` ${detail}` : ""}`;
  if (kind === "Faction") return `${label} is a political, military, cultural, or corporate allegiance that places a character inside the rival powers and frontier tensions of the Human Sphere.${detail ? ` ${detail}` : ""}`;
  if (kind === "Homeworld / Habitat") return `${label} is a place of origin, residence, or formative deployment. It can represent a birth world, shipboard childhood, orbital station, contested colony, Maya-connected enclave, frontier outpost, or alien-controlled theatre.${detail ? ` ${detail}` : ""}`;
  if (kind === "Weapon") return `${label} is part of the violent material culture of the Human Sphere, shaped by the needs of soldiers, security teams, mercenaries, rebels, explorers, and covert operatives.${detail ? ` ${detail}` : ""}`;
  if (kind === "Equipment") return `${label} is practical mission gear that hints at how characters survive the Human Sphere: expeditions, black operations, urban infiltration, void travel, battlefield triage, or specialist tradecraft.${detail ? ` ${detail}` : ""}`;
  if (kind === "Condition") return `${label} is a status effect used to describe the immediate fiction of a scene: shock, injury, fear, environmental pressure, hacking disruption, or battlefield loss of control.${detail ? ` ${detail}` : ""}`;
  return `${label} is a reference entry used by this character sheet.${detail ? ` ${detail}` : ""}`;
}

function humanJoin(values, fallback = "") {
  const cleaned = [...new Set((values || []).map(v => String(v || "").trim()).filter(Boolean))];
  if (!cleaned.length) return fallback;
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

function toneFromSkillName(skill) {
  const key = normalizeGlossaryKey(skill);
  if (!key) return "";
  if (/ballistics/.test(key)) return "marksmanship, armoury culture, range discipline, and the nerve to take a shot when everyone is moving";
  if (/close combat/.test(key)) return "duelling practice, breaching drills, body positioning, and the brutal intimacy of fights that happen too close";
  if (/stealth/.test(key)) return "quiet routes, patience, controlled breathing, and the habits of people who survive by not being noticed";
  if (/observation/.test(key)) return "watchfulness, battlefield reading, small details, and the habit of noticing what others dismiss";
  if (/analysis/.test(key)) return "pattern reading, evidence, tactical sense, and the ability to turn confusion into a usable answer";
  if (/extraplanetary|spacecraft|pilot/.test(key)) return "void routines, shipboard instinct, emergency checklists, and the strange confidence of people who treat vacuum as a workplace";
  if (/survival/.test(key)) return "frontier memory, weather sense, improvised shelter, ration discipline, and lessons learned far from reliable help";
  if (/thievery/.test(key)) return "locks, contraband routes, misdirection, urban back doors, and the moral flexibility of people who know where systems fail";
  if (/athletics/.test(key)) return "movement, climbs, hard landings, pursuit, endurance, and confidence in what the body can do under pressure";
  if (/resistance/.test(key)) return "pain tolerance, disease, fatigue, harsh climates, and the stubborn refusal to fold when the mission becomes ugly";
  if (/hacking/.test(key)) return "quantronic intrusion, hidden credentials, Geist support, countermeasures, and the silent wars inside every connected device";
  if (/education|science/.test(key)) return "formal learning, research habits, lab discipline, archives, and the authority that comes from knowing why something works";
  if (/medicine/.test(key)) return "triage, silk medicine, surgery, body politics, and the responsibility of keeping people alive after violence";
  if (/psychology/.test(key)) return "fear, trauma, motive, negotiation, interrogation, and the uncomfortable work of reading minds without opening skulls";
  if (/tech/.test(key)) return "field repairs, drones, tools, machines, jury-rigged systems, and the trust placed in people who keep gear alive";
  if (/animal handling/.test(key)) return "trained creatures, mutual trust, body language, patience, and instincts shared across species";
  if (/command/.test(key)) return "orders, morale, hierarchy, responsibility, and the burden of asking others to act under fire";
  if (/lifestyle/.test(key)) return "status, money, etiquette, favours, fashion, access, and the social codes that open doors without explosives";
  if (/persuade/.test(key)) return "promises, threats, rhetoric, charm, bargaining, and knowing what another person needs to hear";
  if (/discipline/.test(key)) return "fear control, oath, anger, focus, faith, drill, and the quiet moment before a character refuses to break";
  return "specialist experience shaped by practice, culture, and hard lessons";
}

function categoryLoreHook(category) {
  const key = normalizeGlossaryKey(category);
  if (/combat|weapon|attack|marksman|fireteam/.test(key)) return "It belongs to the culture of soldiers, duellists, security teams, rebels, and mercenary outfits who measure trust in seconds and survival in scars.";
  if (/infowar|hack|geist|maya|network/.test(key)) return "It comes from the invisible side of the Human Sphere, where a reputation can be rewritten, a door can be opened from orbit, and a silent breach can win a battle before anyone fires.";
  if (/medical|bio|science|cube|lhost/.test(key)) return "It is rooted in clinics, laboratories, resurrection economies, gene-tech, battlefield medicine, and the unease of treating bodies as both people and systems.";
  if (/social|command|diplomacy|criminal|submondo/.test(key)) return "It lives in the space between status and leverage: favours owed, names remembered, enemies humiliated, and rooms entered because someone knows who the character is.";
  if (/explor|survival|frontier|void|ship|pilot|terrain/.test(key)) return "It belongs to people shaped by frontier habitats, dangerous routes, stations, ship corridors, contested colonies, and places where help arrives late.";
  if (/engineering|tech|drone|tag|mechanic/.test(key)) return "It reflects the practical respect given to armourers, techs, drone handlers, and troubleshooters who can make complex tools work under bad conditions.";
  if (/aleph|posthuman|proxy|ai/.test(key)) return "It carries the flavour of ALEPH, posthuman identity, optimized responses, and the unsettling question of where instinct ends and prediction begins.";
  if (/combined|shasvastii|morat|tohaa|voodoo|alien/.test(key)) return "It points toward alien pressure, VoodooTech, infiltration, conquest, and ways of thinking that do not fit ordinary Human Sphere assumptions.";
  return "It can be grounded through faction culture, homeworld, mentors, academy training, street experience, religious duty, military service, or a formative mission.";
}

function nameLoreHook(name, category = "") {
  const key = normalizeGlossaryKey(`${name} ${category}`);
  if (/dumb luck|lucky|risk taker/.test(key)) return "This entry suits a character known for impossible timing: the right smile, the wrong turn that becomes a shortcut, or a mistake that somehow becomes an advantage.";
  if (/veteran|battle hardened|dogged|hard to kill|resilient|courageous/.test(key)) return "This entry fits someone whose calm was paid for: a siege, a botched evacuation, a failed command, or years of taking orders in places where hesitation killed people.";
  if (/ambusher|mimetism|stealth|infiltrat|night vision|scout|tracker/.test(key)) return "This entry feels at home in alleys, jungles, station maintenance decks, blackout corridors, and ambush sites where patience matters more than bravado.";
  if (/sniper|sharpshooter|marksman|eagle eye|quick draw|gunslinger|heavy gunner|suppressive/.test(key)) return "This entry is about weapon familiarity as identity: range habits, maintenance rituals, breath control, and the social distance created by carrying obvious lethality.";
  if (/hacker|counter intel|anti virus|quantronic|infowar/.test(key)) return "This entry belongs to the data war, where the character's real battlefield may be a repeater net, a compromised comlog, or a trail of false credentials.";
  if (/doctor|medic|paramedic|surgeon|biotech|regeneration|immunity/.test(key)) return "This entry is tied to flesh, recovery, Silk, battlefield care, genetic accident, or medical debt—the Human Sphere's promise that bodies can be repaired, altered, or exploited.";
  if (/religious|faith|martyr|oath|discipline/.test(key)) return "This entry can be framed through vows, doctrine, honour, spiritual certainty, or the pressure of being watched by an order, sect, unit, or family.";
  if (/command|strategist|tactical|leadership|superior doctrine/.test(key)) return "This entry marks a character who has learned to read groups, shape momentum, and carry the consequences when other people follow their judgement.";
  if (/criminal|smuggler|thief|street|submondo|black market|urban/.test(key)) return "This entry belongs to favours, debts, hidden doors, contraband routes, and the kind of reputation that travels faster than official records.";
  if (/pilot|spacecraft|void|starship|navigator|extraplanetary/.test(key)) return "This entry is coloured by shipboard routines, recycled air, docking clamps, vacuum drills, and the intimate trust formed between crews and machines.";
  if (/animal|beast|antipode|wild/.test(key)) return "This entry suggests a character who reads instinct and movement as naturally as speech, whether dealing with trained animals, frontier creatures, or half-understood alien behaviour.";
  if (/aleph|posthuman|proxy|lhost|mnemonica/.test(key)) return "This entry can feel uncanny: memory, body, identity, and decision-making are all touched by technologies or intelligences that blur ordinary human limits.";
  if (/morat|shasvastii|combined|ei|voodoo/.test(key)) return "This entry carries alien weight, whether as enemy doctrine, captured technique, infiltration trauma, or a sign that the Human Sphere is not the only measure of intelligence.";
  return "";
}

function skillLoreSentence(primary, secondary) {
  const skills = [primary, secondary].filter(Boolean);
  if (!skills.length) return "Its story expression should be tied to the character's background, faction, mentor, and the moment when this talent or trait first mattered.";
  const tones = compactList(skills.map(toneFromSkillName).filter(Boolean), 4);
  return `At the table, connect it to ${humanJoin(skills)} through ${tones}.`;
}

function restrictionLoreText(restriction) {
  const value = String(restriction || "No Restrictions").trim();
  if (!value || value === "No Restrictions") return "Availability: broadly available, but the GM should still colour it through the character's culture, faction, homeworld, mentor, or first serious mission.";
  return `Availability: tied to ${value}; treat that link as a social marker, training pipeline, oath, faction secret, or community expectation rather than just a checkbox.`;
}

function loreForFactionName(faction) {
  const record = findFactionRecord(faction);
  if (record?.subfaction && record?.theme) return `${record.subfaction} Its table theme is ${record.theme}.`;
  if (record?.subfaction) return record.subfaction;
  const key = normalizeGlossaryKey(faction);
  if (/aleph/.test(key)) return "ALEPH-linked characters often carry the aura of predictive support, posthuman possibility, Maya authority, and questions about how much of a choice was truly theirs.";
  if (/nomad/.test(key)) return "Nomad-linked characters usually come from mobile nations, shipboard cultures, hacker communities, radical autonomy, black-market expertise, and a distrust of centralised control.";
  if (/ariadna/.test(key)) return "Ariadnan characters are shaped by Dawn's frontier hardship, low-tech ingenuity, clan loyalties, antipode dangers, and hard-won independence.";
  if (/haqqislam/.test(key)) return "Haqqislamite characters often reflect Bourak's humanist scholarship, Silk medicine, trade routes, desert cultures, and the tension between learning and survival.";
  if (/panoc|panoceania/.test(key)) return "PanOceanian characters may carry the polish of hyperpower institutions, corporate patronage, high technology, religious orders, and professional military doctrine.";
  if (/yu jing|yujing/.test(key)) return "Yu Jing characters often move through imperial service, state security, disciplined social expectations, industrial power, and competing visions of loyalty.";
  if (/combined|shasvastii|morat|ei/.test(key)) return "Combined Army-linked entries carry the threat of alien empire, infiltration organisms, Morat militarism, EI strategy, and technology that feels wrong to human senses.";
  if (/o 12|o-12/.test(key)) return "O-12-linked characters stand near diplomacy, law, inter-faction pressure, emergency mandates, and the uneasy politics of being the official neutral party.";
  return "Its lore should be read through the faction, subfaction, homeworld, and career choices attached to the character.";
}

function loreForCareerName(career) {
  const key = normalizeGlossaryKey(career);
  if (/hacker|wardriver|interventor|infowar|cyber/.test(key)) return "This career lives in the invisible war: identity theft, intrusion duels, compromised comlogs, Maya reputations, and the constant risk that the network is watching back.";
  if (/doctor|medic|bio|surgeon|akbar/.test(key)) return "This career carries the Human Sphere's complicated mercy: saving lives, negotiating medical debt, handling Silk and Cube culture, and deciding what survival should cost.";
  if (/soldier|military|guard|trooper|security|veteran|mercenary|knight|order|marine|officer/.test(key)) return "This career is shaped by uniforms, contracts, command chains, unit legends, field trauma, and the knowledge that politics often arrives wearing armour.";
  if (/pilot|void|ship|space|navigator|crew/.test(key)) return "This career belongs to docking corridors, cramped berths, station bars, emergency burns, crew superstition, and the trust formed by people who survive hard vacuum together.";
  if (/detective|agent|intelligence|spy|investigator|bureau|operative/.test(key)) return "This career moves through secrets, surveillance, double meanings, informants, jurisdiction fights, and the suspicion that every clean answer is hiding a second one.";
  if (/criminal|smuggler|thief|corsair|submondo|gang/.test(key)) return "This career comes from the unofficial economy: favours, fences, fake IDs, protection, reputation, quiet exits, and people who know which laws are negotiable.";
  if (/diplomat|liaison|noble|social|media|celebrity|executive|merchant/.test(key)) return "This career treats conversation as terrain. Invitations, scandals, contracts, appearances, patronage, and public opinion can matter as much as weapons.";
  if (/engineer|technician|mechanic|drone|tag|armourer|researcher|scientist/.test(key)) return "This career is built from tools, prototypes, repairs, lab politics, maintenance rituals, and the confidence that almost any system can be understood or broken.";
  if (/explorer|scout|ranger|survival|frontier|colonist/.test(key)) return "This career is shaped by frontier maps, bad weather, missing supply lines, strange ruins, local guides, and the steady patience of people who travel beyond comfort.";
  if (/religious|priest|imam|monk|chaplain/.test(key)) return "This career carries obligation, doctrine, community trust, ritual authority, and the hard question of what faith demands when the mission becomes compromised.";
  return "This career is a social identity as much as employment: it points to mentors, rivals, credentials, habits, obligations, and the communities that taught the character how to survive.";
}

function traitGlossaryText(t) {
  const name = t.name || "This Trait";
  const hook = nameLoreHook(name, t.category);
  const category = categoryLoreHook(t.category);
  const skillLine = skillLoreSentence(t.primary, t.secondary);
  const brief = t.brief ? `Character-sheet meaning: ${t.brief}` : "Character-sheet meaning: This Trait marks a recurring strength, training history, reputation, or survival instinct connected to the listed skills.";
  const effect = t.effect ? `Rule effect: ${t.effect}` : "";
  const eligibility = restrictionLoreText(t.restriction);
  const source = t.source && t.sourcePage ? `Source: ${t.source}, p. ${t.sourcePage}.` : "";
  const opening = hook || `${name} reflects a recognisable habit, reputation, or way of surviving that other people in the setting can notice and remember.`;
  return [opening, category, skillLine, brief, effect, eligibility, source].filter(Boolean).join("\n\n");
}

function talentGlossaryText(t) {
  const name = t.name || "This Talent";
  const hook = nameLoreHook(name, [t.category, t.career, t.faction, t.doctrine].filter(Boolean).join(" ")) || `${name} is a learned edge: a practiced method, school tradition, faction habit, personal trick, or specialist procedure that makes the character stand out.`;
  const careerLore = t.career ? `Career colour: ${loreForCareerName(t.career)}` : "Career colour: tie this Talent to a mentor, crew, academy, unit, rival, or formative failure so it feels earned rather than purchased.";
  const factionLore = t.faction ? `Faction colour: ${loreForFactionName(t.faction)}` : "Faction colour: it can be expressed differently by each faction, from polished academies to street apprenticeship, military doctrine, shipboard necessity, or black-market practice.";
  const doctrine = t.doctrine ? `Doctrine / path: ${t.doctrine} suggests the school, unit culture, tactical habit, or specialist tradition behind the Talent.` : "";
  const skillLine = skillLoreSentence(t.primary, t.secondary);
  const original = t.description ? `Character-sheet meaning: ${t.description}` : "Character-sheet meaning: This Talent supports the listed concept, Career, Faction, doctrine, or skill link.";
  const effect = t.effect ? `Rule effect: ${t.effect}` : "";
  const limits = glossaryMetaLine([
    t.career ? `Career link: ${t.career}` : "",
    t.faction ? `Faction link: ${t.faction}` : "",
    t.prerequisite ? `Prerequisite: ${t.prerequisite}` : "",
    t.restriction && t.restriction !== "No Restrictions" ? `Restriction: ${t.restriction}` : ""
  ]);
  const rules = limits.length ? `Selection notes: ${limits.join(". ")}.` : "";
  return [hook, careerLore, factionLore, doctrine, skillLine, original, effect, rules].filter(Boolean).join("\n\n");
}

function careerGlossaryText(name, relatedTalents, relatedFactions) {
  const skillHints = [];
  relatedTalents.forEach(t => {
    if (t.primary) skillHints.push(t.primary);
    if (t.secondary) skillHints.push(t.secondary);
    if (t.category) skillHints.push(t.category);
  });
  const factionRecords = relatedFactions.map(findFactionRecord).filter(Boolean);
  const themes = factionRecords.flatMap(record => splitTerms(record.theme));
  const talentNames = compactList(relatedTalents.map(t => t.name), 18);
  const factionNames = compactList(relatedFactions, 10);
  const focus = compactList([...skillHints, ...themes], 12);
  const lines = [];
  // ARIADNA_SOURCE_CAREER_PROFILE_GLOSSARY
  const sourceProfile = DATA.careerProfiles?.[name] || null;
  if (sourceProfile?.brief) lines.push(`Source profile: ${sourceProfile.brief}`);
  if (sourceProfile?.attributeBonuses) {
    const labels = {Agility:"AGI",Awareness:"AWA",Brawn:"BRW",Coordination:"COO",Intelligence:"INT",Personality:"PER",Willpower:"WIL"};
    const mods = Object.entries(sourceProfile.attributeBonuses).map(([name,value]) => `${labels[name] || name} ${Number(value) > 0 ? "+" : ""}${value}`);
    lines.push(`Attribute modifiers: ${mods.join(", ")}.`);
  }
  if (sourceProfile?.mandatorySkills?.length) lines.push(`Mandatory skills: ${sourceProfile.mandatorySkills.join(", ")}.`);
  if (sourceProfile?.electiveSkills?.length) lines.push(`Elective skills: ${sourceProfile.electiveSkills.join(", ")}.`);
  if (sourceProfile?.earnings) lines.push(`Source Earnings: ${sourceProfile.earnings}.`);
  if (sourceProfile?.gear?.length) lines.push(`Source career gear: ${sourceProfile.gear.join(", ")}.`);
  if (sourceProfile?.special) lines.push(`Source restriction / special: ${sourceProfile.special}`);
  if (sourceProfile?.sourceNote) lines.push(`Source note: ${sourceProfile.sourceNote}`);
  if (sourceProfile?.sourcePage) lines.push(`Source: ${sourceProfile.source || "Infinity RPG sourcebook"}, p. ${sourceProfile.sourcePage}.`);
  (sourceProfile?.additionalSources || []).forEach(source => lines.push(`Additional source: ${source}.`));
  lines.push(`${name} is a Career identity, not only a job label. It tells players who trained the character, who might vouch for them, who might resent them, and what kind of trouble naturally follows them.`);
  lines.push(loreForCareerName(name));
  if (focus) lines.push(`Common tone and focus areas: ${focus}. Use these as prompts for roleplay, downtime contacts, mission complications, and how the character explains competence.`);
  if (factionNames) lines.push(`Linked factions or subfactions: ${factionNames}. These can make the Career political, cultural, or institutional rather than neutral.`);
  if (talentNames) lines.push(`Related Talents include: ${talentNames}. They suggest the techniques, social expectations, and specialist traditions that grow out of this Career.`);
  if (!talentNames && !factionNames) lines.push("This is a broad career option suitable for general concepts; root it in a homeworld, mentor, company, unit, tribe, crew, academy, faith, or faction obligation.");
  return lines.join("\n\n");
}

function factionGlossaryText(name, worlds, relatedTalents) {
  const record = findFactionRecord(name);
  const lines = [];
  // ARIADNA_SOURCE_FACTION_SKILLS_GLOSSARY
  if (record?.factionSkills?.length) lines.push(`Faction skills: ${record.factionSkills.join(", ")}.`);

  if (record?.subfaction) lines.push(record.subfaction);
  else lines.push(sourceGuidedFallback("Faction", name));
  if (record?.source) lines.push(`Source: ${record.source}${record.sourcePage ? `, p. ${record.sourcePage}` : ""}.`);
  if (record?.sourceNote) lines.push(`Source note: ${record.sourceNote}`);
  if (record?.theme) lines.push(`Theme: ${record.theme}.`);
  const homeworldText = record?.homeworld || compactList(worlds, 20);
  if (homeworldText) lines.push(`Homeworlds / Habitats: ${homeworldText}.`);
  if (record?.suggested_traits) lines.push(`Suggested Traits: ${record.suggested_traits}.`);
  if (record?.suggested_talents) lines.push(`Suggested Talents: ${record.suggested_talents}.`);
  const talentNames = compactList(relatedTalents.map(t => t.name), 16);
  if (talentNames) lines.push(`Character-sheet Talents linked to this Faction include: ${talentNames}.`);
  return lines.join("\n\n");
}

function homeworldGlossaryText(name, factions) {
  const factionRecords = (DATA.factions || []).filter(record => worldMatchesRecord(name, record) || factions.includes(record.faction));
  const themes = compactList(factionRecords.flatMap(record => splitTerms(record.theme)), 14);
  const descriptions = factionRecords.map(record => record.subfaction).filter(Boolean).slice(0, 3);
  const linkedFactions = compactList(factions.length ? factions : factionRecords.map(record => record.faction), 18);
  const lines = [];
  // Source-backed homeworld detail (Ariadna and Haqqislam).
  const sourceHomeworld = DATA.ariadnaReference?.homelands?.[name] || DATA.haqqislamReference?.homelands?.[name] || DATA.yuJingSource?.homelands?.[name] || DATA.panOceaniaReference?.homelands?.[name] || DATA.nomadsReference?.homelands?.[name] || null;
  if (sourceHomeworld) {
    const sourceLabel = sourceHomeworld.source || (DATA.ariadnaReference?.homelands?.[name] ? "Infinity RPG — Ariadna Supplement" : DATA.haqqislamReference?.source || "Infinity RPG sourcebook");
    const origin = sourceHomeworld.nation || sourceHomeworld.region || "";
    if (origin) lines.push(`Source region: ${origin}.`);
    if (sourceHomeworld.parentWorld && sourceHomeworld.parentWorld !== name) lines.push(`Lifepath parent world: ${sourceHomeworld.parentWorld}.`);
    if (sourceHomeworld.selectionRole) lines.push(`Sheet origin role: ${sourceHomeworld.selectionRole}.`);
    if ((sourceHomeworld.languages || []).length) lines.push(`Languages: ${sourceHomeworld.languages.join("; ")}.`);
    if (sourceHomeworld.page) lines.push(`Source: ${sourceLabel}, p. ${sourceHomeworld.page}.`);
  }
  lines.push(`${name} is a Homeworld / Habitat origin used to place a character within a faction, colony, ship, station, frontier, warfront, or specialist deployment.`);
  if (linkedFactions) lines.push(`Available through these Factions or subfactions: ${linkedFactions}.`);
  if (themes) lines.push(`Associated themes: ${themes}.`);
  if (descriptions.length) lines.push(`Source guidance: ${descriptions.join(" ")}`);
  if (!linkedFactions) lines.push("It is kept in the full glossary for player reference even if no strict Faction relationship is currently assigned.");
  return lines.join("\n\n");
}

function gearGlossaryText(item, kind) {
  const lines = [];
  if (item.brief) lines.push(item.brief);
  else lines.push(sourceGuidedFallback(kind, item.name));
  if (item.mechanic) lines.push(`Rules: ${item.mechanic}`);
  // ARIADNA_SOURCE_GEAR_GLOSSARY
  if (item.sourceProfile) lines.push(`Source profile: ${item.sourceProfile}`);
  if (item.source) lines.push(`Source: ${item.source}${item.sourcePage ? `, p. ${item.sourcePage}` : ""}.`);
  if (item.sourceRestriction) lines.push(`Source Restriction: ${item.sourceRestriction}.`);
  const traits = glossaryMetaLine([item.type, item.rarity, item.weight, item.cost ? `Cost ${item.cost}` : ""]);
  if (traits.length) lines.push(`Selection notes: ${traits.join("; ")}.`);
  return lines.join("\n\n");
}

function glossaryEntry(category, name, tag, meta, text, searchText = "") {
  const safeName = String(name || "").trim();
  const safeTag = tag || category;
  const safeMeta = Array.isArray(meta) ? meta : [];
  const fallbackKind = category === "Homeworlds / Habitats" ? "Homeworld / Habitat" : category.replace(/s$/, "");
  const safeText = String(text || "").trim() || sourceGuidedFallback(fallbackKind, safeName);
  return {
    category,
    name: safeName,
    tag: safeTag,
    meta: safeMeta,
    text: safeText,
    search: [category, safeName, safeTag, ...safeMeta, safeText, searchText].join(" ").toLowerCase()
  };
}

function glossaryPreviewText(text) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Description available in the expanded glossary entry.";
  if (cleaned.length <= 220) return cleaned;
  const sentenceEnd = cleaned.slice(0, 220).search(/[.!?](\s|$)(?!.*[.!?](\s|$))/);
  if (sentenceEnd > 80) return cleaned.slice(0, sentenceEnd + 1);
  return cleaned.slice(0, 217).replace(/\s+\S*$/, "") + "...";
}

function buildGlossaryEntries() {
  if (glossaryEntriesCache) return glossaryEntriesCache;

  const entries = [];
  const ruleTerms = [
    ["Main Skills", "Rule", ["Agility", "Awareness", "Brawn", "Coordination", "Intelligence", "Personality", "Willpower"], "Main skills set the base value for their linked sub-skills. In this custom sheet, main skills cannot use Focus. Increasing a main skill increases all sub-skills beneath it."],
    ["Sub-skills", "Rule", ["Skill tests", "Focus allowed"], "Sub-skills inherit the relevant main skill rating, then add starting allocation and applicable Trait/Talent modifiers. Focus may be assigned only to sub-skills."],
    ["Focus", "Rule", ["Sub-skills only"], "Focus represents specialist training. Main skills cannot use Focus; assign Focus to specific sub-skills such as Ballistics, Hacking, Medicine, Persuade, or Survival."],
    ["Career", "Character option", ["Eligibility", "Traits", "Talents"], "Career is the single field used for eligibility filtering. Choosing a Career filters Trait and Talent options while keeping general/unrestricted options available."],
    ["Host / Heritage", "Character option", ["Ariadna", "PanOceania", "Nomads", "ALEPH", "O-12", "Dogface", "Wulver", "Antipode", "Helot", "Uplift", "Aspect", "Recreation", "True AI"], "Host / Heritage is separate from Career. Ariadna supports Dogface, Wulver and Antipode; PanOceania supports Helot; Nomads supports Uplift; ALEPH supports Aspect, Recreation or True AI. AI psychogenesis is distinct from Lhost body choice. Host modifiers apply without occupying an ordinary Trait slot."],
    ["Faction / Homeworld relationship", "Character option", ["Validation"], "Homeworld / Habitat choices are filtered by the selected Faction. Changing Faction clears an invalid Homeworld / Habitat selection so saved characters keep a valid relationship."],
    ["Armour", "Resource", ["Light 5", "Medium 10", "Heavy 15"], "Armour replaces Temporary HP in this custom sheet. Armour can be selected directly or inferred from selected armour equipment."],
    ["HP / Vigor", "Resource", ["0–20"], "The character's physical endurance track. Damage and recovery should be handled according to the GM's current 2D20 scene rules."],
    ["Firewall", "Resource", ["0–20"], "The character's defensive quantronic or infowar resilience track, useful when facing hacking, intrusion, Geist, or network threats."],
    ["Mental Stress", "Resource", ["0–20"], "The character's psychological resilience track for fear, pressure, interrogation, trauma, and other mental strain."],
    ["Momentum", "Resource", ["Party resource"], "A shared or session-facing resource used to support player actions where the GM allows it."],
    ["Infinity Points", "Resource", ["Heroic resource"], "A player-facing resource used for important heroic or cinematic moments."],
    ["Wounds", "Resource", ["0–3"], "Wounds are tracked separately from HP / Vigor. This sheet restricts Wounds to values 0 through 3."],
    ["Rarity", "Gear / option", ["Common", "Uncommon", "Rare", "Very Rare"], "Rarity helps determine availability and cost. Beginner/random generation currently prefers Common gear unless otherwise specified."],
    ["Prerequisite", "Talent rule", ["Talent chains"], "A Talent prerequisite lists what a character should normally have before selecting that Talent."],
    ["Condition", "Status", ["Temporary effect"], "Conditions represent temporary battlefield, physical, mental, environmental, or equipment-related effects tracked during play."]
  ];
  ruleTerms.forEach(([name, tag, meta, text]) => entries.push(glossaryEntry("Rules Terms", name, tag, meta, text)));


  const aleph = DATA.alephReference;
  if (aleph) {
    const ref = (title,page,body) => entries.push(glossaryEntry("Source References",title,"ALEPH Reference",[`Source: ${aleph.source}, ${page}`],body,body));
    const table = (rows,fn) => (rows||[]).map(fn).join("; ");
    ref("ALEPH AI Host Table","p. 55",table(aleph.birthHostTable,r=>`${r.roll}: ${r.host}`) + ". " + aleph.aiRules.join(" "));
    ref("ALEPH True AI Origins","p. 55",table(aleph.trueAIOrigins,r=>`${r.roll}: ${r.heritage}`));
    ref("ALEPH Psychogenetic Foundation","pp. 55–56",table(aleph.psychogeneticFoundations,r=>`${r.roll}: ${r.name} (+1 ${r.attributes.join(", ") || "two chosen attributes"}; +1 ${r.skill||"chosen skill"})`));
    ref("ALEPH AI Social Status","p. 56",table(aleph.aiSocialStatus,r=>`${r.roll}: ${r.status}; +1 ${r.attribute}; Earnings ${r.earnings}`));
    ref("ALEPH Aspect Trait Table","p. 56",table(aleph.aspectTraits,r=>`${r.roll}: ${r.name}; +1 ${r.attribute}, +1 ${r.skill}`));
    ref("ALEPH Adolescent Events","p. 36",table(aleph.adolescentEvents,r=>`${r.roll}. ${r.trait}: ${r.effect}`));
    ref("ALEPH Faction Career Table","p. 38",table(aleph.factionCareerTable,r=>`${r.range}: ${r.career}${r.note?` [${r.note}]`:""}`));
    ref("ALEPH Faction Career Events","p. 39",table(aleph.factionCareerEvents,r=>`${r.roll}. ${r.result}: ${r.effect}`));
    ref("ALEPH AI Education Table","p. 58",table(aleph.aiEducation,r=>`${r.roll}: ${r.education} — ${r.recommendedCareers}`));
    ref("ALEPH AI Career Table","p. 59",table(aleph.aiCareerTable,r=>`${r.range}: ${r.career}`));
    ref("ALEPH AI Career Events","p. 61",table(aleph.aiCareerEvents,r=>`${r.roll}. ${r.result}: ${r.effect}`));
    ref("ALEPH Geas and Insurrection","pp. 59–60",aleph.aiRules.filter(x=>x.includes("Geas")||x.includes("Insurrection")).join(" ")+" Geas themes: "+aleph.geasThemes.join(", ")+". Insurrection themes: "+aleph.insurrectionThemes.join(", ")+".");
    ref("ALEPH AI Lhost Catalogue","pp. 72, 74–81",table(aleph.lhosts,r=>`${r.name}: ${r.lifePointCost} LP; ${r.restriction}; ${r.cost}; ${r.tariff}`));
    ref("ALEPH Source Gear","pp. 65–73",table(aleph.equipmentAudit,r=>`${r.name} [${r.classification}; p. ${r.sourcePage}]`));
    ref("ALEPH Geist Path","pp. 82–90",aleph.geists.note+" Decisions: "+aleph.geists.decisions.join(", ")+".");
    ref("ALEPH Advanced Infowar","pp. 19–34",aleph.advancedInfowar.note);
    ref("ALEPH Source Normalisation Notes","Chs. 3–6",aleph.sourceNormalisation.join(" "));
  }

  const o12 = DATA.o12Reference;
  if (o12) {
    const ref = (name, page, body) => entries.push(glossaryEntry("Source References", name, "O-12 Reference", [`Source: ${o12.source}, p. ${page}`], body, body));
    const rows = (arr, fn) => (arr || []).map(fn).join("; ");
    ref("O-12 Historical Ties and Double Agents", "84–86", o12.historicalTies.rule + " " + o12.historicalTies.doubleAgentRule);
    ref("O-12 Adolescent Routing", "84", rows(o12.adolescentRouting, x => `${x.roll}: ${x.table}`));
    ref("O-12 Adolescent Events", "85", rows(o12.adolescentEvents, x => `${x.roll}: ${x.trait}: ${x.effect}`));
    ref("O-12 Faction Career Table", "86", rows(o12.careerTable, x => `${x.roll}: ${x.name}`));
    ref("O-12 Career Event Routing", "86", rows(o12.careerEventRouting, x => `${x.roll}: ${x.table}`));
    ref("O-12 Career Events", "87", rows(o12.careerEvents, x => `${x.roll}: ${x.result}: ${x.effect}`));
    ref("O-12 Bureau Analyst Table", "88", rows(o12.bureauAnalystTable, x => `${x.roll}: ${x.name} (Electives: ${x.electiveSkills.join(", ")})`));
    ref("O-12 Aegis Unit Table", "91", rows(o12.aegisUnitTable, x => `${x.roll}: ${x.name} (Electives: ${x.electiveSkills.join(", ")}; Gear: ${x.gear.join(", ")})`));
    ref("O-12 Pillars Table", "92", rows(o12.pillars, x => `${x.roll}: ${x.name}: ${x.effect}`));
    ref("O-12 Equipment Catalogue", "94–102", rows(o12.gearAudit, x => `${x.sourceLabel} [${x.category}; p. ${x.sourcePage}]`));
    ref("O-12 Bureau Noir", "72–82", "The source details clandestine operational structures, assets, and inter-bureau relations. Career affiliation alone grants no automatic legal authority or extra resources.");
    ref("O-12 Ideals and Reputation", "64–71", "Campaign-level reputation, splashback, and Pillar ideals can be used with GM approval; they do not grant free bonuses in the simplified sheet.");
    ref("O-12 Source Exceptions", "83–102", o12.sourceNotes.concat(o12.sourceNormalisation).join(" "));
  }

  const panO = DATA.panOceaniaReference;
  if (panO) {
    const statusText = (panO.socialStatus || []).map(row => `${row.roll}: ${row.status} — ${row.attribute}, Earnings ${row.earnings}${row.special ? `; ${row.special}` : ""}`).join("; ");
    entries.push(glossaryEntry("Source References","PanOceania Faction Social Status Table","PanOceania Reference",[`Source: ${panO.source}, p. 82`],statusText,statusText));

    const homelandText = Object.entries(panO.homelandTables || {}).map(([world,rows]) =>
      `${world}: ${rows.map(row => `${row.roll} ${row.region} (${row.languages})`).join("; ")}`
    ).join(" ");
    entries.push(glossaryEntry("Source References","PanOceania Expanded Homelands","PanOceania Reference",[`Source: ${panO.source}, pp. 81–82`],homelandText,homelandText));

    const adolescentText = (panO.adolescentEvents || []).map(row => `${row.roll}. ${row.trait}: ${row.effect}`).join(" ");
    entries.push(glossaryEntry("Source References","PanOceanian Adolescent Event Table","PanOceania Reference",[`Source: ${panO.source}, p. 83`],adolescentText,adolescentText));

    const careerText = (panO.careerTable || []).map(row => `${row.range}: ${row.career}${row.flags?.length ? ` [${row.flags.join(", ")}]` : ""}`).join("; ");
    entries.push(glossaryEntry("Source References","Expanded PanOceanian Faction Career Table","PanOceania Reference",[`Source: ${panO.source}, p. 84`],careerText,careerText));

    const eventText = (panO.careerEvents || []).map(row => `${row.roll}. ${row.result} ${row.effect}`).join(" ");
    entries.push(glossaryEntry("Source References","PanOceanian Career Event Table","PanOceania Reference",[`Source: ${panO.source}, p. 85`],eventText,eventText));

    const orderText = (panO.militaryOrders || []).map(row => `${row.roll}: ${row.order} — Electives: ${row.electiveSkills.join(", ")}; Gear: ${row.gear.join(", ")}`).join(" ");
    entries.push(glossaryEntry("Source References","PanOceania Military Orders Table","PanOceania Reference",[`Source: ${panO.source}, p. 88`],orderText,orderText));

    const helot = panO.helot;
    if (helot) {
      const helotText = [`Host modifiers: Awareness +1, Personality +1, Willpower −1; Life Point Cost ${helot.lifePointCost}.`, helot.rules,
        `Sissolu Waters: ${(helot.sissoluWaters || []).map(row => `${row.roll} ${row.region}`).join("; ")}.`,
        `Helot careers: ${(helot.careers || []).join(", ")}.`].join(" ");
      entries.push(glossaryEntry("Source References","Helot Lifepath","PanOceania Reference",[`Source: ${panO.source}, pp. 98–106`],helotText,helotText));
    }

    const normalisation = (panO.normalizationNotes || []).join(" ");
    if (normalisation) entries.push(glossaryEntry("Source References","PanOceania Source Normalisation Notes","PanOceania Reference",[panO.source],normalisation,normalisation));
  }


  const nomads = DATA.nomadsReference;
  if (nomads) {
    const rows = (values, fn) => (values || []).map(fn).join("; ");
    const reference = (name, page, text) => entries.push(glossaryEntry("Source References", name, "Nomads Reference", [`Source: ${nomads.source}, ${page}`], text, text));

    reference("Nomad Heritage Traits", "p. 57", rows(nomads.heritages, row => `${row.region}: ${row.heritage}. ${row.note}`));
    reference("Nomad Social Status Table", "p. 58", rows(nomads.socialStatusTable, row =>
      `${row.roll}: ${(row.values || []).map((v,i) => `${nomads.socialStatusColumns?.[i] || i}: ${v}`).join(", ")}`));
    reference("Nomad Social Class Table", "p. 58", rows(nomads.socialClasses, row =>
      `${row.roll}: ${row.status} (+1 ${row.attribute}, Earnings ${row.earnings})`));
    reference("Nomad Home Environments", "p. 58", rows(nomads.homeEnvironments, row =>
      `${row.roll}: ${row.name} (+1 ${row.attribute}, ${row.skill})`));
    reference("Nomad Adolescent Event Table", "p. 59", rows(nomads.adolescentEvents, row =>
      `${row.roll}. ${row.trait}: ${row.effect}`));
    reference("Nomad Faction Career Table", "p. 60", rows(nomads.careerTable, row =>
      `${row.range}: ${row.career}${row.flags?.length ? ` [${row.flags.join(", ")}]` : ""}`));
    reference("Nomad Heritage Careers", "p. 60", Object.entries(nomads.heritageCareers || {}).map(([k,v])=>`${k}: ${v.join(", ")}`).join("; ") + ". " + (nomads.heritageCareerRule || ""));
    reference("Nomad Career Event Table", "p. 61", rows(nomads.careerEvents, row => `${row.roll}. ${row.result} ${row.effect}`));
    reference("Nomad ‘Cat Squads", "p. 62", rows(nomads.catSquads, row =>
      `${row.roll}: ${row.squad}; electives ${row.electiveSkills.join(", ")}; gear ${row.gear.join(", ")}; Earnings ${row.earnings}`));
    const uplift = nomads.uplift || {};
    reference("Uplift Species", "pp. 85–86", Object.entries(uplift.species || {}).map(([name, x]) =>
      `${name}: ${x.lifePoints} LP; trait ${x.trait}; ${x.abilities.join(", ")}`).join("; "));
    reference("Uplift Bodies / Platforms", "pp. 87–88", Object.entries(uplift.bodies || {}).map(([name,x]) =>
      `${name}: ${x.lifePoints} LP; ${x.rules}`).join("; "));
    reference("Uplift Lab Table", "p. 88", rows(uplift.labs, row =>
      `${row.roll}: ${row.region}, ${row.languages}; ${row.skill}`));
    reference("Uplift Social Class Table", "p. 89", rows(uplift.socialStatus, row =>
      `${row.roll}: ${row.status}, +1 ${row.attribute}, Earnings ${row.earnings}`));
    reference("Uplift Awakening Table", "p. 89", rows(uplift.awakening, row =>
      `${row.roll}: ${row.skill} [${row.talent}]`));
    reference("Uplift Species Career Tables", "p. 90", Object.entries(uplift.careerLists || {}).map(([k,v]) =>
      `${k}: ${v.join(", ")}`).join("; ") + ". " + (uplift.careerNotes || ""));

    if (uplift.careerRollTables) {
      reference("Uplift Species Career Rolls", "p. 90", Object.entries(uplift.careerRollTables).map(([species, table]) =>
        `${species}: ${table.map(row => `${row.range} ${row.career}`).join("; ")}`).join(" | "));
    }
    reference("Uplift Career Events", "p. 91", rows(uplift.careerEvents, row => `${row.roll}. ${row.result} ${row.effect}`));
    if (uplift.sourceDiscrepancies?.length) reference("Uplift Career Table Source Discrepancies", "p. 90", uplift.sourceDiscrepancies.join(" "));
    if (nomads.socialEnergy) {
      const ser = nomads.socialEnergy;
      reference("Bakunin Social Energy (Optional)", "pp. 45–56", [ser.explanation, ...ser.rules,
        ...Object.entries(ser.groups).map(([g, factions]) => `Group ${g}: ${factions.join(", ")}.`)].join(" "));
      reference("Starting Social Energy Rank and Inertia", "p. 55",
        `Rank: ${ser.rankRolls.map(row => `${row.rank} [A ${row.A}, B ${row.B}, C ${row.C}, D ${row.D}]`).join("; ")}.
        Inertia: ${ser.inertiaRolls.map(row => `${row.inertia} [A ${row.A}, B ${row.B}, C ${row.C}, D ${row.D}]`).join("; ")}`);
      reference("Social Energy Layers", "p. 54", ser.layers.map(x => `${x.name}: ${x.access}`).join("; "));
    }
    if (nomads.doubleAgentRule) reference("Nomad Double Agents", "p. 60", nomads.doubleAgentRule);
    if ((nomads.sourceNotes||[]).length) reference("Nomads Source Normalisation Notes", "sourcebook", nomads.sourceNotes.join(" "));
  }

  const haqq = DATA.haqqislamReference;
  if (haqq) {
    const statusText = (haqq.socialStatus || []).map(row => `${row.roll}: ${row.status} — ${row.attribute}, Earnings ${row.earnings}`).join("; ");
    entries.push(glossaryEntry("Source References","Haqqislam Faction Social Status Table","Haqqislam Reference",[`Source: ${haqq.source}, p. 76`],statusText,statusText));
    const mustaslahaText = [...(haqq.alMustaslaha || []).map(row => `${row.roll}: ${row.origin} — ${row.attribute}`),haqq.alMustaslahaRules].filter(Boolean).join("; ");
    entries.push(glossaryEntry("Source References","Al-Mustaslaha","Haqqislam Reference",[`Source: ${haqq.source}, p. 76`],mustaslahaText,mustaslahaText));
    const adolescentText = (haqq.adolescentEvents || []).map(row => `${row.roll}. ${row.trait}: ${row.effect}`).join(" ");
    entries.push(glossaryEntry("Source References","Haqqislam Adolescent Event Table","Haqqislam Reference",[`Source: ${haqq.source}, p. 78`],adolescentText,adolescentText));
    const careersText = (haqq.careerTable || []).map(row => `${row.range}: ${row.career}${row.flags?.length ? ` [${row.flags.join(", ")}]` : ""}`).join("; ");
    entries.push(glossaryEntry("Source References","Expanded Haqqislamite Faction Career Table","Haqqislam Reference",[`Source: ${haqq.source}, p. 79`],careersText,careersText));
    const ordersText = (haqq.hassassinOrders || []).map(row => `${row.roll}. ${row.order} — Electives: ${row.electiveSkills.join(", ")}; Gear: ${row.gear.join(", ")}`).join(" ");
    entries.push(glossaryEntry("Source References","Hassassin Orders Table","Haqqislam Reference",[`Source: ${haqq.source}, p. 83`],ordersText,ordersText));
    const haqqNotes = [...(haqq.normalizationNotes || []), ...(haqq.sourceNotes || [])];
    if (haqqNotes.length) {
      const noteText = haqqNotes.join(" ");
      entries.push(glossaryEntry("Source References","Haqqislam Source Normalisation Notes","Haqqislam Reference",[haqq.source],noteText,noteText));
    }
  }

  const yuJing = DATA.yuJingSource;
  if (yuJing) {
    const heritageColumns = yuJing.lifepath?.heritageHomeworlds || [];
    const heritageText = Object.entries(yuJing.lifepath?.heritageTable || {}).map(([roll,values]) =>
      `${roll}: ${values.map((value,index) => `${heritageColumns[index] || `Column ${index+1}`}: ${value}`).join("; ")}`
    ).join(" ");
    entries.push(glossaryEntry("Source References","Yu Jing Heritage Table","Yu Jing Reference",[`Source: ${yuJing.source}, p. 85`],heritageText,heritageText));

    const statusColumns = yuJing.lifepath?.socialStatusColumns || [];
    const statusText = Object.entries(yuJing.lifepath?.socialStatusTable || {}).map(([roll,values]) =>
      `${roll}: ${values.map((value,index) => `${statusColumns[index] || `Column ${index+1}`}: ${value}`).join("; ")}`
    ).join(" ");
    entries.push(glossaryEntry("Source References","Yu Jing Social Status Table","Yu Jing Reference",[`Source: ${yuJing.source}, pp. 85–86`],statusText,statusText));

    const classText = (yuJing.lifepath?.socialClasses || []).map(row => `${row.status}: +1 ${row.attribute}, Earnings ${row.earnings}`).join("; ");
    entries.push(glossaryEntry("Source References","Yu Jing Social Class Table","Yu Jing Reference",[`Source: ${yuJing.source}, p. 85`],classText,classText));

    const adolescentText = (yuJing.adolescentEvents || []).map(row => `${row.roll}. ${row.trait}: ${row.effect}`).join(" ");
    entries.push(glossaryEntry("Source References","Yu Jing Adolescent Event Table","Yu Jing Reference",[`Source: ${yuJing.source}, p. 89`],adolescentText,adolescentText));

    const careerText = (yuJing.careerTable || []).map(row => `${row.range}: ${row.career}${row.flags?.length ? ` [${row.flags.join(", ")}]` : ""}`).join("; ");
    entries.push(glossaryEntry("Source References","Yu Jing Career Table","Yu Jing Reference",[`Source: ${yuJing.source}, pp. 88–89`],careerText,careerText));

    const heritageCareerText = (yuJing.lifepath?.heritageCareers || []).map(row =>
      `${row.heritage} — Recommended: ${row.recommended.join(", ")}. Prohibited: ${row.prohibited.join(", ")}.`
    ).join(" ");
    entries.push(glossaryEntry("Source References","Yu Jing Heritage Careers Table","Yu Jing Reference",[`Source: ${yuJing.source}, p. 89`],heritageCareerText,heritageCareerText));

    const specialHeritageText = Object.entries(yuJing.lifepath?.specialHeritage || {}).map(([heritage,text]) => `${heritage}: ${text}`).join(" ");
    if (specialHeritageText) entries.push(glossaryEntry("Source References","Yu Jing Special Heritage Events","Yu Jing Reference",[`Source: ${yuJing.source}, p. 85`],specialHeritageText,specialHeritageText));

    const careerEventText = (yuJing.careerEventTable || []).map(row => `${row.roll}: ${row.result}`).join("; ");
    if (careerEventText) entries.push(glossaryEntry("Source References","Yu Jing Career Event Table","Yu Jing Reference",[`Source: ${yuJing.source}, p. 88`],careerEventText,careerEventText));

    const japaneseCareerText = (yuJing.japaneseCareerTable || []).map(row => `${row.range}: ${row.career}${row.flags?.length ? ` [${row.flags.join(", ")}]` : ""}`).join("; ");
    entries.push(glossaryEntry("Source References","Japanese Career Table","Yu Jing Reference",[`Source: ${yuJing.source}, p. 90`],japaneseCareerText,japaneseCareerText));

    const japaneseCareerEventText = (yuJing.japaneseCareerEventTable || []).map(row => `${row.roll}: ${row.result}`).join("; ");
    if (japaneseCareerEventText) entries.push(glossaryEntry("Source References","Japanese Career Event Table","Yu Jing Reference",[`Source: ${yuJing.source}, p. 90`],japaneseCareerEventText,japaneseCareerEventText));

    const rankText = (yuJing.imperialRanks || []).map(row =>
      `${row.range}: ${row.rank}; free entry ${row.freeEntryStatus.join("/")}; electives ${row.electiveSkills.join(", ")}; gear ${row.gear.join(", ")}; Earnings ${row.earnings}.`
    ).join(" ");
    entries.push(glossaryEntry("Source References","Imperial Ranks Table","Yu Jing Reference",[`Source: ${yuJing.source}, p. 93`],rankText,rankText));

    if (yuJing.japaneseUprisingRule) {
      entries.push(glossaryEntry("Source References","Japanese Uprising — Decision Nine","Yu Jing Reference",[`Source: ${yuJing.source}, p. 90`],yuJing.japaneseUprisingRule,yuJing.japaneseUprisingRule));
    }
    const normalisation = (yuJing.normalizationNotes || []).join(" ");
    if (normalisation) entries.push(glossaryEntry("Source References","Yu Jing Source Normalisation Notes","Yu Jing Reference",[yuJing.source],normalisation,normalisation));
  }

  glossarySort(DATA.traits || []).forEach(t => {
    entries.push(glossaryEntry(
      "Traits",
      t.name,
      t.category ? `Trait · ${t.category}` : "Trait",
      glossaryMetaLine([t.restriction || "No Restrictions", t.rarity, t.cost ? `Cost ${t.cost}` : "", t.primary && t.secondary ? `${t.primary} / ${t.secondary}` : ""]),
      traitGlossaryText(t),
      [t.primary, t.secondary, t.restriction, t.category, t.brief, t.effect].join(" ")
    ));
  });

  glossarySort(DATA.talents || []).forEach(t => {
    entries.push(glossaryEntry(
      "Talents",
      t.name,
      t.level ? `Talent · Level ${t.level}` : "Talent",
      glossaryMetaLine([t.category, t.career ? `Career: ${t.career}` : "", t.doctrine ? `Doctrine: ${t.doctrine}` : "", t.faction ? `Faction: ${t.faction}` : "", t.restriction, t.prerequisite ? `Prereq: ${t.prerequisite}` : "", t.rarity, t.cost ? `Cost ${t.cost}` : ""]),
      talentGlossaryText(t),
      [t.primary, t.secondary, t.career, t.doctrine, t.faction, t.restriction, t.category, t.description, t.effect].join(" ")
    ));
  });

  const careerSet = new Set(DATA.lists?.careerRoles || []);
  (DATA.talents || []).forEach(t => { if (t.career) careerSet.add(t.career); });
  glossarySort([...careerSet].map(name => ({ name }))).forEach(c => {
    const relatedTalents = (DATA.talents || []).filter(t => t.career === c.name).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const factions = [...new Set(relatedTalents.map(t => t.faction).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    entries.push(glossaryEntry(
      "Careers",
      c.name,
      "Career",
      glossaryMetaLine([factions.length ? `Linked factions: ${factions.join(", ")}` : "General / Unrestricted", relatedTalents.length ? `${relatedTalents.length} related talents` : "Broad career option"]),
      careerGlossaryText(c.name, relatedTalents, factions),
      [factions.join(" "), relatedTalents.map(t => t.name).join(" "), relatedTalents.map(t => t.description).join(" ")].join(" ")
    ));
  });

  glossarySort((DATA.lists?.factions || []).map(name => ({ name }))).forEach(f => {
    const worlds = DATA.homeworldsByFaction?.[f.name] || [];
    const relatedTalents = (DATA.talents || []).filter(t => t.faction === f.name).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const record = findFactionRecord(f.name);
    entries.push(glossaryEntry(
      "Factions",
      f.name,
      "Faction",
      glossaryMetaLine([worlds.length ? `${worlds.length} related homeworlds` : "No specific homeworld mapping", relatedTalents.length ? `${relatedTalents.length} related talents` : "", record?.theme ? `Theme: ${record.theme}` : ""]),
      factionGlossaryText(f.name, worlds, relatedTalents),
      [worlds.join(" "), relatedTalents.map(t => t.name).join(" "), record?.subfaction, record?.theme, record?.homeworld, record?.suggested_traits, record?.suggested_talents].join(" ")
    ));
  });

  const homeworldToFactions = new Map();
  Object.entries(DATA.homeworldsByFaction || {}).forEach(([faction, worlds]) => {
    (worlds || []).forEach(world => {
      if (!homeworldToFactions.has(world)) homeworldToFactions.set(world, []);
      homeworldToFactions.get(world).push(faction);
    });
  });
  const homeworldSet = new Set(DATA.lists?.homeworlds || []);
  homeworldToFactions.forEach((_, world) => homeworldSet.add(world));
  glossarySort([...homeworldSet].map(name => ({ name }))).forEach(w => {
    const factions = [...new Set(homeworldToFactions.get(w.name) || [])].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const records = (DATA.factions || []).filter(record => worldMatchesRecord(w.name, record) || factions.includes(record.faction));
    entries.push(glossaryEntry(
      "Homeworlds / Habitats",
      w.name,
      "Homeworld / Habitat",
      glossaryMetaLine([factions.length ? `Faction choices: ${factions.join(", ")}` : "General or unmapped option", records.length ? `${records.length} source links` : ""]),
      homeworldGlossaryText(w.name, factions),
      [factions.join(" "), records.map(record => [record.faction, record.subfaction, record.theme, record.homeworld].join(" ")).join(" ")].join(" ")
    ));
  });

  glossarySort((DATA.equipment || []).filter(item => !item.legacyAliasOnly && String(item.type || "").toLowerCase() === "weapon")).forEach(item => {
    entries.push(glossaryEntry(
      "Weapons",
      item.name,
      item.type || "Weapon",
      glossaryMetaLine([item.rarity, item.weight, item.cost ? `Cost ${item.cost}` : ""]),
      gearGlossaryText(item, "Weapon"),
      [item.type, item.rarity, item.weight, item.mechanic, item.brief].join(" ")
    ));
  });

  glossarySort((DATA.equipment || []).filter(item => !item.legacyAliasOnly && String(item.type || "").toLowerCase() !== "weapon")).forEach(item => {
    entries.push(glossaryEntry(
      "Equipment",
      item.name,
      item.type || "Equipment",
      glossaryMetaLine([item.rarity, item.weight, item.cost ? `Cost ${item.cost}` : ""]),
      gearGlossaryText(item, "Equipment"),
      [item.type, item.rarity, item.weight, item.mechanic, item.brief].join(" ")
    ));
  });

  glossarySort((DATA.conditions || []).map(item => ({ ...item, name: item.name }))).forEach(condition => {
    entries.push(glossaryEntry(
      "Conditions",
      condition.name,
      "Condition",
      glossaryMetaLine([condition.removal ? `Removal: ${condition.removal}` : "Status effect"]),
      [condition.description || sourceGuidedFallback("Condition", condition.name), condition.removal ? `Removal guidance: ${condition.removal}.` : ""].filter(Boolean).join("\n\n"),
      [condition.description, condition.removal].join(" ")
    ));
  });

  glossaryEntriesCache = entries
    .filter(e => e.name)
    .map(e => ({ ...e, text: e.text || sourceGuidedFallback(e.tag, e.name) }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return glossaryEntriesCache;
}

function buildGlossary() {
  const categorySelect = document.getElementById("glossaryCategory");
  if (!categorySelect) return;

  if (!glossaryInitialized) {
    makeOptions(categorySelect, GLOSSARY_CATEGORIES, "");
    categorySelect.value = "All";
    const search = document.getElementById("glossarySearch");
    const schedule = () => {
      if (glossaryRenderPending) return;
      glossaryRenderPending = true;
      window.requestAnimationFrame(() => {
        glossaryRenderPending = false;
        renderGlossary();
      });
    };
    categorySelect.addEventListener("change", schedule, { passive: true });
    if (search) search.addEventListener("input", schedule, { passive: true });
    glossaryInitialized = true;
  }

  // Mobile stability: initialise controls on page load, but do not build hundreds
  // of glossary cards until the player actually opens the glossary panel.
  const page = document.getElementById("glossaryPage");
  if (document.body.classList.contains("glossary-mode") || (page && !page.hidden)) {
    renderGlossary();
  }
}

function renderGlossary() {
  const list = document.getElementById("glossaryList");
  const summary = document.getElementById("glossarySummary");
  const category = document.getElementById("glossaryCategory")?.value || "All";
  const query = (document.getElementById("glossarySearch")?.value || "").trim().toLowerCase();
  if (!list) return;
  const allEntries = buildGlossaryEntries();
  const entries = allEntries.filter(entry => {
    const categoryMatch = category === "All" || entry.category === category;
    const queryMatch = !query || entry.search.includes(query);
    return categoryMatch && queryMatch;
  });
  if (summary) {
    const total = allEntries.length;
    summary.textContent = `Showing ${entries.length} of ${total} entries${category !== "All" ? ` in ${category}` : ""}${query ? ` matching “${query}”` : ""}. Every listed glossary entry now includes a visible lore-first description preview and an expanded full description.`;
  }
  if (!entries.length) {
    list.innerHTML = '<div class="glossary-empty">No glossary entries match the current search.</div>';
    return;
  }
  list.innerHTML = entries.map(entry => {
    const meta = entry.meta.length ? `<div class="glossary-meta">${entry.meta.map(v => `<span class="glossary-pill">${glossaryEscape(v)}</span>`).join("")}</div>` : "";
    const preview = glossaryPreviewText(entry.text);
    return `<details class="glossary-card">
      <summary><span class="glossary-title-wrap"><span class="glossary-title">${glossaryEscape(entry.name)}</span><span class="glossary-preview">${glossaryEscape(preview)}</span></span><span class="glossary-tag">${glossaryEscape(entry.tag)}</span></summary>
      <div class="glossary-body">${meta}<p class="glossary-text">${glossaryEscape(entry.text)}</p></div>
    </details>`;
  }).join("");
}

function showGlossary() {
  // Save any recent edits before leaving the visible sheet. This prevents a
  // pending autosave timer from later rebuilding the save selector and wiping
  // out the player's selected load slot while they are in the glossary.
  flushPendingAutosave();
  document.body.classList.add("glossary-mode");
  const page = document.getElementById("glossaryPage");
  if (page) page.hidden = false;
  buildGlossary();
  window.scrollTo({ top: 0, behavior: "smooth" });
  const search = document.getElementById("glossarySearch");
  if (search && window.matchMedia("(min-width: 761px)").matches) search.focus({ preventScroll: true });
}

function hideGlossary(options = {}) {
  document.body.classList.remove("glossary-mode");
  const page = document.getElementById("glossaryPage");
  if (page) page.hidden = true;
  if (!options.silent) flushPendingAutosave();
  if (!options.noScroll) window.scrollTo({ top: 0, behavior: "smooth" });
}


document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.infinityBuild = "v75-technology-workshop-foundation";
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
  initDogfaceAutomation();
  resetStartingBonuses();
  clearFocusAllocations();
  sanitizeSkillRatingDisplays();
  applyArmourFromEquipment();
  refreshSaveSlots();
  installAutosave();
  buildGlossary();
  // Do not attach a MutationObserver to the skill Rating cells. Earlier builds
  // rewrote those cells from inside the observer callback, which could retrigger
  // itself and freeze the page after Career changes. updateSkillRatings() and
  // sanitizeSkillRatingDisplays() now update the cells directly when needed.

  document.getElementById("randomCharacterBtn").addEventListener("click", randomCharacter);
  document.getElementById("randomBeginnerCharacterBtn").addEventListener("click", randomBeginnerCharacter);
  ["glossaryBtn", "glossaryShortcutBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", showGlossary);
  });
  const backToSheetBtn = document.getElementById("backToSheetBtn");
  if (backToSheetBtn) backToSheetBtn.addEventListener("click", hideGlossary);
  document.getElementById("saveBtn").addEventListener("click", saveCharacterToBrowser);
  const characterSlotSelect = document.getElementById("characterSlotSelect");
  if (characterSlotSelect) {
    characterSlotSelect.addEventListener("change", event => {
      const selectedId = event.target.value;
      if (selectedId) loadCharacterById(selectedId, { auto: true });
    });
  }
  document.getElementById("deleteSaveBtn").addEventListener("click", deleteSelectedSave);
  ["exportXmlBtn", "exportXmlShortcutBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", exportCharacterXml);
  });
  const importXmlFile = document.getElementById("importXmlFile");
  ["importXmlBtn", "importXmlShortcutBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn && importXmlFile) btn.addEventListener("click", () => importXmlFile.click());
  });
  if (importXmlFile) {
    importXmlFile.addEventListener("change", event => {
      const file = event.target.files && event.target.files[0];
      importCharacterXmlFile(file);
      event.target.value = "";
    });
  }
  document.getElementById("newSheetBtn").addEventListener("click", newCharacterSheet);
  document.getElementById("printBtn").addEventListener("click", printCharacterSheet);
  runInitialAutoLoadSavedCharacter();
});

window.addEventListener("load", () => {
  // Mobile Safari/Chrome can delay storage readiness in restored tabs; this is
  // harmless after the first successful run because initialAutoLoadDone guards it.
  window.setTimeout(runInitialAutoLoadSavedCharacter, 50);
});


/* V74 — opt-in O-12 Lifepath automation. The character sheet is not a replacement for the
   complete Corebook Lifepath: unsupported dice, contacts, talents and earned gear choices
   remain explicitly manual. All generated numeric bonuses are derived from a saved ledger. */
(function installO12LifepathV74() {
  const NEW_BUILD = "v75-technology-workshop-foundation";
  const careerSources = DATA.o12Reference?.careerProfiles || {};
  const o12Source = DATA.o12Reference || {};
  const defaultLedger = () => ({ version: 74, lifePoints: 5, otherSpent: 0, phases: [], adolescent: null, pillar: null, criminalRecord: false });
  let ledger = defaultLedger();
  let rolledBureau = "";
  let rolledCareer = "";
  let rolledAdolescent = null;
  let rolledEvent = null;
  let notice = "";

  const number = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const el = id => document.getElementById(id);
  const chosen = id => el(id)?.value || "";
  const integer = n => Math.max(0, Math.floor(number(n)));
  // Corebook pp.61–69: the six inherited O-12 careers have first-phase attributes.
  const coreAttributes = {
    "Special Forces": [2,2,2,1,1,0,2],
    "Intelligence Operative": [1,3,0,2,2,1,1],
    "Politician": [1,2,0,2,2,2,1],
    "Diplomat": [1,2,0,2,2,2,1],
    "Bureau Toth Agent": [1,2,0,1,2,2,2],
    "Field Scientist": [1,2,1,2,3,1,0]
  };
  const inheritedFieldScientist = {
    source:"Infinity RPG Corebook", sourcePage:63,
    mandatorySkills:["Science","Education","Survival"],
    electiveSkills:["Observation","Tech","Athletics"],
    earnings:"2+1§", gear:["Analytical Kit","Survival Kit","Sensor Suite ×3"]
  };
  const careerRecord = name => {
    const profile = careerSources[name] || DATA.careerProfiles?.[name] ||
      (name === "Field Scientist" ? inheritedFieldScientist : null);
    if (!profile) return null;
    if (!coreAttributes[name]) return profile;
    const keys = ["Agility","Awareness","Brawn","Coordination","Intelligence","Personality","Willpower"];
    return {...profile,attributeBonuses:Object.fromEntries(keys.map((key,i)=>[key,coreAttributes[name][i]]))};
  };
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const r20 = () => Math.floor(Math.random() * 20) + 1;
  const rollRange = value => {
    const [lo, hi] = String(value || "").replace(/[–—]/g, "-").split("-").map(Number);
    return [lo, Number.isFinite(hi) ? hi : lo];
  };
  const byRoll = (table, n) => (table || []).find(row => {
    const [low, high] = rollRange(row.roll);
    return n >= low && n <= high;
  }) || null;
  const isO12 = () => isO12Faction(inputField("faction")?.value || "");
  // The sheet does not have a selectable Criminal Record Trait: use explicit source status.
  const hasCriminalRecord = () => !!ledger.criminalRecord;
  const assignmentRows = career => career === "Bureau Analyst"
    ? (o12Source.bureauAnalystTable || []).filter(r => !/^Choose/.test(r.name))
    : career === "Bureau Aegis Specialist"
      ? (o12Source.aegisUnitTable || []).filter(r => !/^Choose/.test(r.name)) : [];

  const eventChoices = (type, n) => {
    const source = type === "adolescent" ? {
      4: [["defy","Defy family (+1 Resolve, manual)"],["accept","Accept family's wishes (+1 Discipline)"]],
      19: [["defect","Defect: GM resolves faction"],["double","Double agent: GM resolves"]]
    } : {
      1: [["assets","Keep quiet: 5 Assets (manual)"],["nemesis","Refuse: nemesis (manual)"]],
      4: [["intervene","Intervene: contact + rival (manual)"],["abstain","Do nothing: +1 Discipline"]],
      7: [["debt","Take on debt (manual)"],["stone","Refuse: +1 Discipline, Stone Cold"]],
      11: [["help","Help crew: contacts + 1 Asset"],["report","Report crew: O-12 contact"]],
      14: [["assets","Accept 5 Assets"],["rival","Gain rival"]],
      17: [["evidence","Report crime: nemesis + Momentum (manual)"],["blackmail","Blackmail: trait (manual)"],["abstain","Do nothing: +1 Discipline"]]
    };
    return source[n] || [];
  };
  function ledgerModifiers() {
    const main = {}, subs = {};
    let vigor = 0, social = 0;
    if (!isO12()) return { main, subs, vigor, social };
    const first = ledger.phases[0];
    // Corebook p. 53: attribute improvements apply to FIRST career only.
    if (first) Object.entries(careerRecord(first.career)?.attributeBonuses || {}).forEach(([k, v]) => main[k] = number(v));
    const addSkill = skill => { if (subSkills.includes(skill)) subs[skill] = (subs[skill] || 0) + 1; };
    (ledger.phases || []).forEach(phase => {
      const profile = careerRecord(phase.career) || {};
      (profile.mandatorySkills || []).forEach(addSkill);
      (phase.electives || []).forEach(addSkill);
      if (phase.signature) addSkill(phase.signature);
      const e = integer(phase.event);
      if ((e === 4 && phase.eventChoice === "abstain") ||
          (e === 7 && phase.eventChoice === "stone") ||
          (e === 17 && phase.eventChoice === "abstain")) addSkill("Discipline");
    });
    const a = integer(ledger.adolescent?.roll);
    if (a === 1) addSkill("Analysis");
    if (a === 2) { main.Personality = (main.Personality || 0) - 1; main.Brawn = (main.Brawn || 0) + 1; }
    if (a === 4 && ledger.adolescent?.choice === "accept") addSkill("Discipline");
    if (a === 5 || a === 15) addSkill("Observation");
    if (a === 7) vigor -= 1; // Ledger only: current HP track is not reset.
    if (a === 9) addSkill("Stealth");
    if (a === 14) addSkill("Animal Handling");
    if (a === 16) addSkill("Education");
    if (ledger.pillar === "Support") social += 1;
    if (ledger.pillar === "None") social -= 1;
    return { main, subs, vigor, social };
  }
  function lifePointsSpent() {
    const extended = (ledger.phases || []).filter((p, i) => i >= 2).length;
    const assignment = (ledger.phases || []).filter(p => p.assignmentMethod === "chosen").length;
    const careerTable = (ledger.phases || []).filter(p => p.careerMethod === "faction-roll").length;
    const events = (ledger.phases || []).filter(p => p.eventMethod === "selected").length;
    return integer(ledger.otherSpent) + extended + assignment + careerTable + events +
      (ledger.adolescent?.method === "selected" ? 1 : 0);
  }
  function remaining() { return integer(ledger.lifePoints) - lifePointsSpent(); }

  // Keep printed values and table ratings in sync while avoiding changes to base
  // attribute selects, manual starting allocation, Traits/Talents and host modifiers.
  const previousBaseRating = baseRating;
  baseRating = function(skill) {
    const parent = mainSkills.includes(skill) ? skill : parentOf[skill];
    return previousBaseRating(skill) + number(ledgerModifiers().main[parent]);
  };
  const previousSkillRatingParts = skillRatingParts;
  skillRatingParts = function(skill) {
    const result = previousSkillRatingParts(skill);
    const extra = mainSkills.includes(skill) ? 0 : number(ledgerModifiers().subs[skill]);
    const parent = mainSkills.includes(skill) ? skill : parentOf[skill];
    const attr = number(ledgerModifiers().main[parent]);
    result.lifepathBonus = extra;
    result.bonus += extra;
    result.total += extra;
    if (attr) result.sources.push("O-12 Lifepath attribute " + parent + " " + (attr > 0 ? "+" : "") + attr);
    if (extra) result.sources.push("O-12 career/event training +" + extra);
    return result;
  };
  const previousUpdateRatings = updateSkillRatings;
  updateSkillRatings = function() {
    previousUpdateRatings();
    document.querySelectorAll("[data-rating]").forEach(cell => {
      const skill = cell.dataset.rating;
      const bonus = skillRatingParts(skill).lifepathBonus;
      const rule = document.querySelector('[data-skill-rule="' + skill + '"]');
      if (rule && bonus) rule.textContent += "; O-12 Lifepath +" + bonus;
    });
    document.querySelectorAll("select[data-main-skill]").forEach(sel => {
      const delta = number(ledgerModifiers().main[sel.dataset.mainSkill]);
      sel.title = delta ? "O-12 Lifepath attribute " + (delta > 0 ? "+" : "") + delta + " applied to this skill and its sub-skills." : "";
    });
  };

  function normalizeLedger(value) {
    let obj = value;
    if (typeof value === "string") {
      try { obj = JSON.parse(value); } catch { obj = null; }
    }
    if (!obj || typeof obj !== "object") return defaultLedger();
    const out = defaultLedger();
    out.lifePoints = Math.min(20, integer(obj.lifePoints ?? 5));
    out.otherSpent = Math.min(20, integer(obj.otherSpent));
    out.criminalRecord = obj.criminalRecord === true || obj.criminalRecord === "true";
    out.phases = Array.isArray(obj.phases) ? obj.phases.slice(0, 4).filter(p => p && typeof p === "object").map(p => ({
      career: String(p.career || ""), assignment: String(p.assignment || ""),
      assignmentMethod: String(p.assignmentMethod || ""), careerMethod: String(p.careerMethod || ""),
      electives: Array.isArray(p.electives) ? p.electives.slice(0, 2).map(String) : [],
      signature: String(p.signature || ""), event: integer(p.event), eventChoice: String(p.eventChoice || ""),
      eventMethod: String(p.eventMethod || ""), ageYears: integer(p.ageYears),
      criminalRecordBefore: p.criminalRecordBefore === true || p.criminalRecordBefore === "true",
      granted: Array.isArray(p.granted) ? p.granted : [],
      unresolvedGear: Array.isArray(p.unresolvedGear) ? p.unresolvedGear : []
    })) : [];
    out.adolescent = obj.adolescent && typeof obj.adolescent === "object"
      ? {roll: integer(obj.adolescent.roll), choice: String(obj.adolescent.choice || ""),
         method: String(obj.adolescent.method || ""), ageYears:integer(obj.adolescent.ageYears),
         hpBefore: String(obj.adolescent.hpBefore || ""), hpAfter:String(obj.adolescent.hpAfter || "")} : null;
    out.pillar = (o12Source.pillars || []).some(p => p.name === obj.pillar) ? obj.pillar : null;
    return out;
  }
  const previousCollectState = collectState;
  collectState = function() {
    const state = previousCollectState();
    // Scalar JSON is deliberate: the existing XML converter only supports primitive array items.
    state.o12LifepathJson = JSON.stringify(ledger);
    return state;
  };
  const previousApplyState = applyState;
  applyState = function(raw) {
    ledger = normalizeLedger(raw?.o12LifepathJson);
    rolledBureau = ""; rolledCareer = ""; rolledAdolescent = null; rolledEvent = null;
    previousApplyState(raw);
    updateSkillRatings();
    renderV74();
  };
  const oldRandomCharacter = randomCharacter, oldRandomBeginner = randomBeginnerCharacter;
  randomCharacter = function() {
    ledger = defaultLedger();
    oldRandomCharacter();
    updateSkillRatings();
    renderV74();
  };
  randomBeginnerCharacter = function() {
    ledger = defaultLedger();
    oldRandomBeginner();
    updateSkillRatings();
    renderV74();
  };

  function fillSelect(select, options, initial) {
    if (!select) return;
    const previous = initial === undefined ? select.value : initial;
    select.innerHTML = "";
    options.forEach(item => {
      const option = document.createElement("option");
      option.value = String(item.value); option.textContent = String(item.label);
      select.appendChild(option);
    });
    select.value = options.some(o => String(o.value) === String(previous)) ? String(previous) : String(options[0]?.value || "");
  }
  function eventTitle(type, row) {
    if (!row) return "";
    return type === "adolescent" ? row.trait : row.result;
  }
  function refreshEventChoice(type) {
    const n = integer(chosen(type === "adolescent" ? "v74Adolescent" : "v74CareerEvent"));
    const id = type === "adolescent" ? "v74AdolescentChoice" : "v74CareerEventChoice";
    const opts = eventChoices(type, n);
    fillSelect(el(id), [{value:"",label:opts.length ? "Choose outcome..." : "No choice required"}, ...opts.map(x => ({value:x[0],label:x[1]}))]);
    el(id).disabled = !opts.length;
  }
  function refreshCareerEditor() {
    if (!el("v74Elective1")) return;
    const name = inputField("career")?.value || "";
    const profile = careerRecord(name);
    const assigned = assignmentRows(name);
    const chosenAssignment = assigned.find(row => row.name === inputField("o12Assignment")?.value);
    const electives = assigned.length ? chosenAssignment?.electiveSkills || [] : profile?.electiveSkills || [];
    const previousFirst = chosen("v74Elective1"), previousSecond = chosen("v74Elective2"), previousSignature = chosen("v74Signature");
    const items = [{value:"",label:electives.length ? "Choose elective..." : "Select Bureau / Unit first"}, ...electives.map(s => ({value:s,label:s}))];
    fillSelect(el("v74Elective1"), items, previousFirst);
    fillSelect(el("v74Elective2"), items, previousSecond);
    const gained = [...new Set([...(profile?.mandatorySkills || []), ...electives])].filter(s => subSkills.includes(s));
    fillSelect(el("v74Signature"), [{value:"",label:"No signature skill"}, ...gained.map(s => ({value:s,label:s}))], previousSignature);
    const priorAssignment = (ledger.phases || []).find(p => p.career === name)?.assignment || "";
    el("v74RollAssignment").disabled = !assigned.length || Boolean(priorAssignment);
    const repeatMode = el("v74RepeatAssignmentMode")?.closest("label");
    if (repeatMode) repeatMode.hidden = !priorAssignment;
    const info = [];
    if (profile) {
      info.push("Mandatory skills: " + (profile.mandatorySkills || []).join(", ") + ".");
      if (!profile.attributeBonuses && !(ledger.phases || []).length) info.push("Source attribute profile unavailable: first-career attributes require manual Corebook check.");
      info.push("Career Earnings " + (profile.earnings || "see Corebook") + "; signature skill and talent choice follow Corebook p.53.");
    } else info.push("This career has no verified rules profile in V73. Apply phase is blocked rather than inventing bonuses.");
    el("v74CareerReference").textContent = info.join(" ");
  }
  function v74SummaryLine() {
    const mods = ledgerModifiers(), keys = Object.entries(mods.main).filter(([,v]) => v).map(([k,v])=>k+" "+(v>0?"+":"")+v);
    return (ledger.phases || []).length + " career phases · " + remaining() + "/" + ledger.lifePoints + " Life Points left" +
      (keys.length ? " · first career: " + keys.join(", ") : "") +
      (ledger.pillar ? " · Pillar: " + ledger.pillar : "");
  }
  function renderV74() {
    const panel = el("v74O12Lifepath");
    if (!panel) return;
    panel.hidden = !isO12();
    if (!isO12()) return;
    if (el("v74LifePoints") && document.activeElement !== el("v74LifePoints")) el("v74LifePoints").value = ledger.lifePoints;
    if (el("v74OtherSpent") && document.activeElement !== el("v74OtherSpent")) el("v74OtherSpent").value = ledger.otherSpent;
    refreshCareerEditor();
    if(el("v74CriminalRecord") && document.activeElement!==el("v74CriminalRecord"))el("v74CriminalRecord").checked=!!ledger.criminalRecord;
    el("v74Status").textContent = v74SummaryLine() + (ledger.criminalRecord ? " · Criminal Record: ACTIVE" : "");
    el("v74Ledger").textContent = (ledger.phases || []).map((p,i)=>"Phase "+(i+1)+": "+p.career+
      (p.assignment ? " / "+p.assignment : "")+"; electives "+p.electives.join(" + ")+
      (p.signature ? "; signature "+p.signature : "")+(p.event ? "; event "+p.event : "")+
      (p.unresolvedGear?.length ? "; manual gear "+p.unresolvedGear.join(", ") : "")).join("\n") || "No O-12 career phases applied.";
    const event = (o12Source.adolescentEvents || []).find(e => e.roll === ledger.adolescent?.roll);
    el("v74EventLedger").textContent = (event ? "Adolescent event "+event.roll+" "+event.trait+" — "+event.effect+". " : "")+
      (ledger.adolescent?.ageYears ? "Adolescent age increase "+ledger.adolescent.ageYears+" years. " : "")+
      (ledger.pillar ? "Pillar "+ledger.pillar+" — "+(o12Source.pillars || []).find(p=>p.name===ledger.pillar)?.effect+". " : "")+
      "Social Status modifier "+(ledgerModifiers().social > 0 ? "+" : "")+ledgerModifiers().social+
      "; Vigor modifier "+ledgerModifiers().vigor+".";
    el("v74Notice").textContent = notice;
    el("v74ApplyPhase").disabled = ledger.phases.length >= 4;
    el("v74UndoPhase").disabled = !ledger.phases.length;
    el("v74ApplyAdolescent").disabled = !!ledger.adolescent;
    el("v74UndoAdolescent").disabled = !ledger.adolescent;
    el("v74ApplyPillar").disabled = !!ledger.pillar;
    el("v74UndoPillar").disabled = !ledger.pillar;
  }
  function eventDescription(type, roll) {
    const pool = type === "adolescent" ? o12Source.adolescentEvents : o12Source.careerEvents;
    return (pool || []).find(r => r.roll === roll)?.effect || "";
  }
  function enoughLP(extra) {
    if (remaining() < extra) {
      notice = "Insufficient Life Points for this choice (" + extra + " needed; " + remaining() + " available). Increase the starting budget only if the GM has granted additional Life Points.";
      renderV74(); return false;
    }
    return true;
  }
  function availableGear(profile, assignment) {
    const rows = assignmentRows(profile?.name || "");
    return [...(profile?.gear || []), ...(rows.find(r=>r.name===assignment)?.gear || [])];
  }
  function grantGear(names) {
    const granted = [], manual = [];
    names.forEach(raw => {
      // Never guess between "or" alternatives, unspecified ammunition, a loan or different armour variants.
      if (/\bor\b|\/|rental|credit|^choose/i.test(raw)) { manual.push(raw); return; }
      const trim = x=>String(x).toLowerCase().replace(/\s*\((bs|cc)\)$/i,"").replace(/[’']/g,"").trim();
      const match = (DATA.equipment || []).filter(item=>trim(item.name)===trim(raw) && item.loadoutEligible!==false);
      if (match.length!==1) { manual.push(raw); return; }
      const item=match[0];
      const weapon = (DATA.lists.weapons || []).includes(item.name);
      const category = weapon ? "weapon" : "equipment";
      const rows = [...document.querySelectorAll(weapon ? "select[data-weapon-select]" : "select[data-equipment-select]")];
      if (rows.some(r=>r.value===item.name)) return;
      const slot=rows.findIndex(r=>!r.value);
      if (slot<0) { manual.push(raw + " (no free slot)"); return; }
      const field=rows[slot];
      if (![...field.options].some(o=>o.value===item.name)) { manual.push(raw); return; }
      field.value=item.name; field.dispatchEvent(new Event("change"));
      granted.push({kind:category, index:slot, name:item.name});
    });
    applyArmourFromEquipment();
    return {granted, manual};
  }
  function undoGear(granted) {
    (granted || []).forEach(g => {
      const field=document.querySelector('select[data-'+(g.kind==="weapon"?"weapon":"equipment")+'-select="'+g.index+'"]');
      if(field?.value===g.name){field.value="";field.dispatchEvent(new Event("change"));}
    });
    applyArmourFromEquipment();
  }
  function applyPhase() {
    if (!isO12()) return;
    const career = inputField("career")?.value || "";
    const profile = careerRecord(career);
    if (!profile || !(profile.mandatorySkills || []).length) { notice="No source-verified Career profile for "+career+"; no grants made.";renderV74();return; }
    const assignmentTable = assignmentRows(career);
    const assignment = assignmentTable.length ? (inputField("o12Assignment")?.value || "") : "";
    if (assignmentTable.length && !assignment) { notice="Choose or roll your Bureau / Unit before applying this career.";renderV74();return; }
    if (career==="Bureau Aegis Specialist" && hasCriminalRecord() && assignment!=="Beta") {
      notice="Criminal Record requires Beta Unit. Select Beta first.";renderV74();return;
    }
    const priorAssignment = (ledger.phases || []).find(p => p.career === career)?.assignment || "";
    const assignMethod = assignmentTable.length
      ? (career==="Bureau Aegis Specialist" && hasCriminalRecord() ? "forced" :
        priorAssignment && priorAssignment === assignment ? "retained" :
        priorAssignment && chosen("v74RepeatAssignmentMode") === "hazard" ? "hazard" :
        !priorAssignment && assignment && assignment === rolledBureau ? "rolled" : "chosen") : "none";
    const elective1=chosen("v74Elective1"), elective2=chosen("v74Elective2");
    const assignedRow=assignmentTable.find(r=>r.name===assignment);
    const allowed=(assignmentTable.length ? assignedRow?.electiveSkills : profile.electiveSkills) || [];
    if (!elective1 || !elective2 || elective1===elective2 || !allowed.includes(elective1) || !allowed.includes(elective2)) {
      notice="Choose two DIFFERENT electives from the selected career/Bureau list.";renderV74();return;
    }
    const signature=chosen("v74Signature");
    const prior=(ledger.phases || []).map(p=>p.signature).filter(Boolean);
    const validSignature=[...(profile.mandatorySkills||[]),elective1,elective2];
    if ((!signature && prior.length < 3) || (signature && (!validSignature.includes(signature) || prior.includes(signature) || prior.length>=3))) {
      notice="Signature skill must be a new mandatory/chosen elective; a character may have no more than three.";renderV74();return;
    }
    const ev=integer(chosen("v74CareerEvent"));
    const evMethod=ev ? chosen("v74CareerEventMethod") : "";
    const evChoice=chosen("v74CareerEventChoice");
    if (ev===20) {notice="Music of the Spheres requires three additional Career Event rolls (and recursion); resolve with the GM before applying.";renderV74();return;}
    if(ev && eventChoices("career",ev).length && !evChoice){notice="Select the Career Event outcome before applying.";renderV74();return;}
    if(evMethod==="selected" && ev===20){notice="Corebook prohibits choosing event 20 by spending a Life Point.";renderV74();return;}
    const careerMethod=career===rolledCareer ? "faction-roll" : "resolved";
    const nextCost=(ledger.phases.length>=2?1:0)+(assignMethod==="chosen"?1:0)+(careerMethod==="faction-roll"?1:0)+(ev && evMethod==="selected"?1:0);
    if(!enoughLP(nextCost))return;
    const gearList=[...(profile.gear||[]),...(assignedRow?.gear||[])];
    const gear=grantGear(gearList);
    const criminalRecordBefore=career==="Bureau Aegis Specialist" && hasCriminalRecord() && assignment==="Beta";
    ledger.phases.push({career,assignment,assignmentMethod:assignMethod,careerMethod,criminalRecordBefore,electives:[elective1,elective2],
      signature,event:ev,eventChoice:evChoice,eventMethod:evMethod,ageYears:Math.floor(Math.random()*6)+2,
      granted:gear.granted,unresolvedGear:gear.manual});
    if (criminalRecordBefore) {ledger.criminalRecord=false;if(el("v74CriminalRecord"))el("v74CriminalRecord").checked=false;}
    rolledCareer="";rolledBureau="";rolledEvent=null;
    notice=(criminalRecordBefore ? "Criminal Record cleared after completing Beta Unit career phase. " : "")+
      "Applied "+career+". Source gear loaded when unambiguous; "+gear.manual.length+
      " gear choices remain manual. Add a permitted Talent, roll Earnings "+(profile.earnings || "per Corebook")+
      " and account for Social Status/contacts with the GM. Career age increased by "+ledger.phases.at(-1).ageYears+" years.";
    updateSkillRatings();renderV74();scheduleAutosave();
  }
  function undoPhase() {
    const last=ledger.phases.pop(); if(!last)return;
    undoGear(last.granted);
    if(last.criminalRecordBefore) {ledger.criminalRecord=true;if(el("v74CriminalRecord"))el("v74CriminalRecord").checked=true;}
    notice="Removed last career phase and its derived bonuses; granted gear was cleared only when the original slot/item still matched.";
    updateSkillRatings();renderV74();scheduleAutosave();
  }
  function applyAdolescent() {
    const n=integer(chosen("v74Adolescent")),choice=chosen("v74AdolescentChoice");
    if(!n){notice="Select or roll an O-12 adolescent event.";renderV74();return;}
    if(eventChoices("adolescent",n).length && !choice){notice="Choose the adolescent outcome first.";renderV74();return;}
    const method=chosen("v74AdolescentMethod");
    const cost=method==="selected" ? 1 : 0;
    if(!enoughLP(cost))return;
    const previousHp = n === 7 && inputField("hp")?.value === "20" ? "20" : "";
    const adjustedHp = previousHp ? "19" : "";
    if (adjustedHp) setFieldValue("hp", adjustedHp);
    ledger.adolescent={roll:n,choice,method,ageYears:n===16 ? Math.floor(Math.random()*6)+1 : 0,
      hpBefore:previousHp,hpAfter:adjustedHp};
    rolledAdolescent=null;
    notice="Recorded event "+n+": "+eventDescription("adolescent",n)+". "+
      (adjustedHp ? "Full HP/Vigor automatically reduced from 20 to 19. " : n===7 ? "HP/Vigor was not at 20; apply permanent Vigor change manually. " : "")+
      (ledger.adolescent.ageYears ? "Age increased by "+ledger.adolescent.ageYears+" years. " : "")+
      "Contacts, traits and unresolved effects require GM adjudication.";
    updateSkillRatings();renderV74();scheduleAutosave();
  }
  function applyPillar() {
    if(!chosen("v74PillarConfirm")){notice="Roll a Pillar or explicitly choose a GM-approved result.";renderV74();return;}
    const name=chosen("v74PillarConfirm");
    if(!(o12Source.pillars||[]).some(r=>r.name===name))return;
    ledger.pillar=name;
    notice="Applied Pillar: "+name+". Social Status +/- is tracked in the O-12 ledger; contacts are narrative and entered manually.";
    renderV74();scheduleAutosave();
  }

  function initPanelV74() {
    if(el("v74O12Lifepath"))return;
    const anchor=document.querySelector(".page-1 [data-identity-grid]");
    if(!anchor)return;
    const section=document.createElement("section");section.id="v74O12Lifepath";section.className="panel no-print";section.hidden=true;
    section.innerHTML = '<details><summary><strong>O-12 Lifepath Automation (V74)</strong> — opt-in career phases, events and Life Points</summary>'+
      '<p class="v74-note">Corebook p.53: first-career attributes apply once; mandatory skills and two electives each career phase. Existing sheet/gear choices are never overwritten. GM decisions and non-numeric results remain manual.</p>'+
      '<p id="v74Status"></p>'+
      '<div class="v74-grid"><label>Starting Life Points<input id="v74LifePoints" type="number" min="0" max="20" value="5"></label>'+
      '<label>Spent in earlier Lifepath decisions<input id="v74OtherSpent" type="number" min="0" max="20" value="0"></label></div>'+
      '<h4>O-12 Adolescent Event</h4><div class="v74-grid"><label>Result<select id="v74Adolescent"></select></label>'+
      '<label>Outcome<select id="v74AdolescentChoice"></select></label>'+
      '<label>Resolution<select id="v74AdolescentMethod"><option value="rolled">Rolled (0 LP)</option><option value="selected">Chosen with GM approval (1 LP)</option></select></label></div>'+
      '<div class="v74-actions"><button type="button" id="v74RollAdolescent">Roll d6 / d20</button><button type="button" id="v74ApplyAdolescent">Apply event</button><button type="button" id="v74UndoAdolescent">Undo event</button></div>'+
      '<h4>Career Phase — uses the main Career field above</h4><p id="v74CareerReference"></p>'+
      '<label class="v74-checkbox"><input id="v74CriminalRecord" type="checkbox"> Criminal Record at start of career (forces Beta Unit; clears after phase)</label>'+
      '<div class="v74-grid"><label>Elective 1<select id="v74Elective1"></select></label>'+
      '<label>Elective 2<select id="v74Elective2"></select></label>'+
      '<label>New signature skill (optional)<select id="v74Signature"></select></label></div>'+
      '<div class="v74-grid"><label hidden>Repeat Bureau / Unit change<select id="v74RepeatAssignmentMode"><option value="life">Choose new assignment (1 LP)</option><option value="hazard">GM confirmed successful D1 career hazard (0 LP)</option></select></label></div>'+
      '<div class="v74-actions"><button type="button" id="v74RollCareer">Roll O-12 career table (costs 1 LP)</button>'+
      '<button type="button" id="v74RollAssignment">Roll Bureau / Unit (free)</button></div>'+
      '<div class="v74-grid"><label>Career Event<select id="v74CareerEvent"></select></label>'+
      '<label>Event outcome<select id="v74CareerEventChoice"></select></label>'+
      '<label>Resolution<select id="v74CareerEventMethod"><option value="rolled">Already rolled / resolved (0 LP)</option><option value="selected">Chosen with GM approval (1 LP)</option></select></label></div>'+
      '<div class="v74-actions"><button type="button" id="v74RollEvent">Roll d6 / d20 Career Event</button><button type="button" id="v74ApplyPhase">Apply career phase</button>'+
      '<button type="button" id="v74UndoPhase">Undo last phase</button></div>'+
      '<h4>Final Customisation — Pillars</h4><div class="v74-grid"><label>Pillar<select id="v74PillarConfirm"></select></label></div>'+
      '<div class="v74-actions"><button type="button" id="v74RollPillar">Roll d20 Pillar</button><button type="button" id="v74ApplyPillar">Apply Pillar</button>'+
      '<button type="button" id="v74UndoPillar">Undo Pillar</button></div>'+
      '<h4>Applied career ledger</h4><pre id="v74Ledger"></pre><p id="v74EventLedger"></p><p id="v74Notice" role="status"></p>'+
      '<p class="v74-note">V74 does not automatically grant talents, Earnings rolls, contacts, uncertain age/event dice, source-location armour conversions or Core A/B/C events. Save and XML preserve every recorded phase.</p></details>';
    anchor.insertAdjacentElement("afterend",section);
    const css=document.createElement("style");
    css.textContent='#v74O12Lifepath{margin:10px 0;padding:10px 14px}#v74O12Lifepath[hidden]{display:none!important}'+
      '#v74O12Lifepath summary{cursor:pointer;font-size:14px}#v74O12Lifepath .v74-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:6px 0}'+
      '#v74O12Lifepath label{display:flex;flex-direction:column;gap:3px;font-size:12px}#v74O12Lifepath select,#v74O12Lifepath input{width:100%;min-height:32px}'+
      '#v74O12Lifepath .v74-actions{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0}#v74O12Lifepath .v74-actions button{padding:7px 10px;cursor:pointer}'+
      '#v74O12Lifepath .v74-checkbox{display:flex;align-items:center;flex-direction:row;gap:7px}#v74O12Lifepath .v74-checkbox input{width:auto;min-height:auto}'+
      '#v74O12Lifepath .v74-note{font-size:12px}#v74Ledger{white-space:pre-wrap;font-size:12px}#v74Notice{font-weight:600}';
    document.head.appendChild(css);
    fillSelect(el("v74Adolescent"),[{value:"",label:"No O-12 event"},...(o12Source.adolescentEvents||[]).map(r=>({value:r.roll,label:r.roll+" — "+r.trait}))]);
    fillSelect(el("v74CareerEvent"),[{value:"",label:"Resolved outside wizard"},...(o12Source.careerEvents||[]).map(r=>({value:r.roll,label:r.roll+" — "+r.result}))]);
    fillSelect(el("v74PillarConfirm"),[{value:"",label:"Choose or roll..."},...(o12Source.pillars||[]).map(r=>({value:r.name,label:r.name+" ("+r.roll+")"}))]);
    el("v74Adolescent").addEventListener("change",()=>refreshEventChoice("adolescent"));
    el("v74CareerEvent").addEventListener("change",()=>refreshEventChoice("career"));
    refreshEventChoice("adolescent");refreshEventChoice("career");
    el("v74LifePoints").addEventListener("change",()=>{ledger.lifePoints=Math.min(20,integer(chosen("v74LifePoints")));renderV74();scheduleAutosave();});
    el("v74OtherSpent").addEventListener("change",()=>{ledger.otherSpent=Math.min(20,integer(chosen("v74OtherSpent")));renderV74();scheduleAutosave();});
    el("v74CriminalRecord").addEventListener("change",()=>{
      ledger.criminalRecord=!!el("v74CriminalRecord").checked;
      if (ledger.criminalRecord && inputField("career")?.value==="Bureau Aegis Specialist" && inputField("o12Assignment")) {
        inputField("o12Assignment").value="Beta";inputField("o12Assignment").dispatchEvent(new Event("change"));
      }
      renderV74();scheduleAutosave();
    });
    el("v74RollCareer").addEventListener("click",()=>{
      const row=byRoll(o12Source.careerTable,r20());
      if (!row || !careerRecord(row.name)) {notice="Career result requires another faction/Corebook profile; resolve manually.";renderV74();return;}
      inputField("career").value=row.name; inputField("career").dispatchEvent(new Event("change"));
      rolledCareer=row.name;notice="Rolled "+row.name+" on the O-12 Faction Career Table. Charges 1 LP on application (Corebook faction-table choice).";
      refreshCareerEditor();renderV74();
    });
    el("v74RollAssignment").addEventListener("click",()=>{
      const rows=assignmentRows(inputField("career")?.value);
      if(!rows.length)return;
      const name=inputField("career").value;
      const forced=name==="Bureau Aegis Specialist" && hasCriminalRecord();
      const row=forced ? rows.find(r=>r.name==="Beta") : byRoll(rows,r20());
      if(!row){notice="Assignment roll needs a GM-selected Bureau/Unit (printed result 20).";renderV74();return;}
      inputField("o12Assignment").value=row.name;inputField("o12Assignment").dispatchEvent(new Event("change"));
      rolledBureau=forced ? "" : row.name;
      notice=forced?"Criminal Record forces Beta Unit; see the source rule for clearing that record after this career.":"Rolled "+row.name+" (free Bureau/Unit assignment).";
      refreshCareerEditor();renderV74();
    });
    inputField("o12Assignment")?.addEventListener("change",()=>{if(rolledBureau!==inputField("o12Assignment").value)rolledBureau="";refreshCareerEditor();});
    inputField("career")?.addEventListener("change",()=>{rolledCareer="";rolledBureau="";refreshCareerEditor();renderV74();});
    inputField("faction")?.addEventListener("change",renderV74);
    el("v74RollAdolescent").addEventListener("click",()=>{
      const die=Math.floor(Math.random()*6)+1;
      if(die>3){
        el("v74Adolescent").value="";refreshEventChoice("adolescent");rolledAdolescent=null;
        notice="Adolescent d6="+die+": use Corebook Table "+(["","A","B","C"][die-3])+" instead. No O-12 event was applied.";renderV74();return;
      }
      const value=r20();
      el("v74Adolescent").value=String(value);el("v74Adolescent").dispatchEvent(new Event("change"));
      el("v74AdolescentMethod").value="rolled";rolledAdolescent=value;
      notice="O-12 Adolescent Event rolled d6="+die+", d20="+value+".";renderV74();
    });
    el("v74RollEvent").addEventListener("click",()=>{
      const die=Math.floor(Math.random()*6)+1;
      if(die>3){
        el("v74CareerEvent").value="";refreshEventChoice("career");rolledEvent=null;
        notice="Career d6="+die+": resolve Corebook Career Event Table "+(["","A","B","C"][die-3])+" manually. No O-12 event selected.";renderV74();return;
      }
      const value=r20();
      el("v74CareerEvent").value=String(value);el("v74CareerEvent").dispatchEvent(new Event("change"));
      el("v74CareerEventMethod").value="rolled";rolledEvent=value;
      notice="O-12 Career Event rolled d6="+die+", d20="+value+".";renderV74();
    });
    el("v74RollPillar").addEventListener("click",()=>{
      const n=r20(), row=byRoll(o12Source.pillars,n);
      if(row){el("v74PillarConfirm").value=row.name;notice="Rolled d20="+n+" → "+row.name+".";renderV74();}
    });
    el("v74ApplyPhase").addEventListener("click",applyPhase);
    el("v74UndoPhase").addEventListener("click",undoPhase);
    el("v74ApplyAdolescent").addEventListener("click",applyAdolescent);
    el("v74UndoAdolescent").addEventListener("click",()=>{
      const prior=ledger.adolescent;
      if (prior?.hpAfter && inputField("hp")?.value===prior.hpAfter) setFieldValue("hp",prior.hpBefore);
      ledger.adolescent=null;
      notice="Adolescent event removed. HP restored only if the automatically modified value was still unchanged.";
      updateSkillRatings();renderV74();scheduleAutosave();
    });
    el("v74ApplyPillar").addEventListener("click",applyPillar);
    el("v74UndoPillar").addEventListener("click",()=>{ledger.pillar=null;notice="Pillar removed.";renderV74();scheduleAutosave();});
    renderV74();
  }
  // Do not replace the original print layout: derived main/sub-skill values already
  // appear in the existing PDF. Record phase/LP summary in its existing print header.
  const previousPrintCore = buildPrintCorePage;
  buildPrintCorePage = function(page,total) {
    const markup=previousPrintCore(page,total);
    if(!isO12() || !(ledger.phases || []).length)return markup;
    return markup.replace("Identity, main skills, resources and skill calculations",
      printEscape("O-12 Lifepath · "+ledger.phases.length+" career phases · "+remaining()+" Life Points left"));
  };
  window.INFINITY_BUILD=NEW_BUILD;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initPanelV74);
  else initPanelV74();
})();


/* V75 Technology Workshop — source-preserving foundation.
   This version DOES NOT claim the standalone Technology of the Human Sphere sourcebook
   was reconciled: that source is absent from the supplied/connected source collection.
   All catalogue entries retain their existing source data; Quality and Modification
   notes are player/GM records and never invent bonuses, costs or rules. */
(function installTechnologyWorkshopV75() {
  const BUILD = "v75-technology-workshop-foundation";
  const MAX_TEXT = { quality: 120, modifications: 800, notes: 500 };
  const MAX_RECORDS = 15;
  const selected = id => document.getElementById(id);
  const allEquipment = DATA.equipment || [];
  const slotKey = (kind, index) => kind + ":" + index;
  const itemSelect = (kind, index) => document.querySelector(
    'select[data-' + kind + '-select="' + index + '"]');
  const normalString = (value, length) => String(value == null ? "" : value).slice(0, length);
  const techCategories = [
    ["technology", "Technology-related items"],
    ["infogear", "Infogear / Quantronics"],
    ["medical", "Medical equipment"],
    ["augmentation", "Augmentations"],
    ["modification", "Modifications / Upgrades"],
    ["all", "Complete existing catalogue"]
  ];

  function technologyFamily(item) {
    const t = String(item?.type || "").toLowerCase();
    const subtype = String(item?.subtype || "").toLowerCase();
    const name = String(item?.name || "").toLowerCase();
    const category = String(item?.category || "").toLowerCase();
    if (/^modification$|upgrade$/.test(t) || /\bmodification\b|\bupgrade\b/.test(name) ||
        /program upgrade|vehicle upgrade|hacking upgrade/.test(t)) return "modification";
    if (t === "augmentation" || category === "augmentation" ||
        /neural implant|cybernetic implant|biograft implant/.test(subtype)) return "augmentation";
    if (/medical|automedikit|medical facility/.test(t) || /medical|surgical|medical nanites/.test(subtype) ||
        /^(medikit|health kit|automedikit|nannies|nannie-pump|akbar kit)$/i.test(item?.name || "")) return "medical";
    if (/program|hacking|comlog|geist|data storage|holographic|credential|repeater|recorder|scanner|sensor|visor|signal gear|quantronic/.test(t + " " + subtype) ||
        /infowar|data storage|network|quantronic/.test(subtype) || /^comm(s|log)\b/.test(name)) return "infogear";
    return "other";
  }
  const entries = allEquipment.map(item => ({item, family:technologyFamily(item)}));
  const counts = Object.fromEntries(["infogear","medical","augmentation","modification","other"]
    .map(key => [key, entries.filter(entry => entry.family === key).length]));

  let records = {};
  let activeSlot = "";
  let browserEntry = "";
  let workshopActive = false;
  let lastStatus = "";
  function entryOf(name) { return allEquipment.find(item => item.name === name) || null; }
  function currentItem(key) {
    const match = /^((?:weapon|equipment)):(\d+)$/.exec(key || "");
    if (!match) return "";
    return itemSelect(match[1], Number(match[2]))?.value || "";
  }
  function validSlot(key) {
    const m = /^(weapon|equipment):(\d+)$/.exec(String(key));
    return !!m && Number(m[2]) < (m[1] === "weapon" ? 5 : 10);
  }
  function normalizeRecord(raw) {
    if (!raw || typeof raw !== "object") return null;
    const item = normalString(raw.item, 160);
    if (!item || !entryOf(item)) return null;
    const quality = normalString(raw.quality, MAX_TEXT.quality);
    const modifications = normalString(raw.modifications, MAX_TEXT.modifications);
    const notes = normalString(raw.notes, MAX_TEXT.notes);
    const approved = raw.approved === true || raw.approved === "true";
    if (!quality && !modifications && !notes && !approved) return null;
    return {item, quality, modifications, notes, approved};
  }
  function restoreRecords(raw) {
    let input = raw;
    if (typeof raw === "string") {
      try { input = JSON.parse(raw); } catch { input = {}; }
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const result = {};
    Object.entries(input).slice(0, MAX_RECORDS).forEach(([key, value]) => {
      if (!validSlot(key)) return;
      const rec = normalizeRecord(value);
      if (rec && rec.item === currentItem(key)) result[key] = rec;
    });
    return result;
  }
  function cleanStaleRecords() {
    for (const key of Object.keys(records)) {
      if (!validSlot(key) || records[key].item !== currentItem(key)) delete records[key];
    }
  }
  function metaFor(kind, zeroBasedIndex, name) {
    const key = slotKey(kind, zeroBasedIndex);
    const record = records[key];
    return record && record.item === name ? record : null;
  }
  function updateStatus(text) {
    lastStatus = text;
    const target = selected("v75TechStatus");
    if (target) target.textContent = text;
  }
  function filterCatalogue() {
    const filter = selected("v75FamilyFilter")?.value || "technology";
    const query = String(selected("v75TechSearch")?.value || "").toLowerCase().trim();
    const list = entries.filter(({item, family}) => {
      if (filter !== "all" && (filter === "technology" ? family === "other" : family !== filter)) return false;
      if (!query) return true;
      return [item.name,item.type,item.subtype,item.category,item.brief,item.mechanic,item.source]
        .some(value => String(value || "").toLowerCase().includes(query));
    });
    const box = selected("v75TechResults");
    if (!box) return;
    const previous = browserEntry || box.value;
    box.textContent = "";
    list.slice(0, 150).forEach(({item}) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = item.name + " — " + (item.type || "Other");
      box.appendChild(option);
    });
    if (list.some(x=>x.item.name===previous) && [...box.options].some(x=>x.value===previous)) box.value=previous;
    browserEntry = box.value || "";
    const info = selected("v75CatalogueCount");
    if (info) info.textContent = list.length + " records match; showing first " + Math.min(list.length,150) +
      (list.length>150 ? ". Narrow the search to see the rest." : ".");
    showCatalogueEntry();
  }
  function showCatalogueEntry() {
    const item = entryOf(selected("v75TechResults")?.value);
    browserEntry = item?.name || "";
    const out = selected("v75TechDetail");
    if (!out) return;
    if (!item) { out.textContent = "Choose an item to view its existing source information."; return; }
    const source = item.source ? item.source + (item.sourcePage ? ", p. " + item.sourcePage : "") :
      "Existing sheet record — no verified source citation in this entry";
    out.textContent = [
      item.name,
      "Class: " + (item.category || "Other") + " / " + (item.subtype || item.type || "Unknown"),
      "Type: " + (item.type || "-") + " | Weight: " + (item.weight || "-") +
        " | Rarity: " + (item.rarity || "-") + " | Cost: " + (item.cost || "-"),
      "Source: " + source,
      "Rule / description: " + (item.mechanic || item.brief || "No mechanical rule recorded"),
      item.loadoutEligible === false ? "Reference only — not eligible for personal loadout." :
        "Select 'Add to first free slot' to place this existing catalogue item if a compatible slot is open."
    ].join("\n");
  }
  function renderSlots() {
    cleanStaleRecords();
    const selector = selected("v75SlotChoice");
    if (!selector) return;
    const current = activeSlot || selector.value;
    const items = [];
    for (const kind of ["weapon","equipment"]) {
      const size = kind === "weapon" ? 5 : 10;
      for (let n=0;n<size;n++) {
        const item = currentItem(slotKey(kind,n));
        if (item) items.push({key:slotKey(kind,n),title:(kind === "weapon" ? "Weapon " : "Equipment ")+(n+1)+": "+item});
      }
    }
    selector.textContent = "";
    const blank = document.createElement("option");
    blank.value="";blank.textContent=items.length?"Choose equipped item...":"No gear currently equipped";
    selector.appendChild(blank);
    items.forEach(({key,title})=>{
      const option=document.createElement("option");option.value=key;option.textContent=title;selector.appendChild(option);
    });
    activeSlot=items.some(row=>row.key===current) ? current : "";
    selector.value=activeSlot;
    renderSlotEditor();
  }
  function renderSlotEditor() {
    const key = selected("v75SlotChoice")?.value || "";
    activeSlot=key;
    const item = currentItem(key);
    const r = records[key];
    const live = r && r.item === item ? r : null;
    for(const [id,val] of [["v75Quality",live?.quality || ""],["v75Modification",live?.modifications || ""],["v75TechNotes",live?.notes || ""]]) {
      const node = selected(id); if(node && document.activeElement!==node) node.value=val;
    }
    const check = selected("v75Approved");
    if (check) check.checked=!!live?.approved;
    for(const id of ["v75Quality","v75Modification","v75TechNotes","v75Approved"]) {
      const node=selected(id);if(node)node.disabled=!item;
    }
    const desc = selected("v75EquippedDetail");
    if(desc) desc.textContent=item ? "Editing "+item+". Notes are bound to this exact slot AND item name; changing the gear entry clears its annotations." :
      "Select an equipped weapon or item above. Quality/modification text is GM-entered and does not change calculated bonuses.";
  }
  function storeCurrent() {
    const key = selected("v75SlotChoice")?.value || "";
    if (!validSlot(key)) return;
    const item = currentItem(key);
    if (!item) return;
    const r=normalizeRecord({
      item,
      quality:selected("v75Quality")?.value || "",
      modifications:selected("v75Modification")?.value || "",
      notes:selected("v75TechNotes")?.value || "",
      approved:!!selected("v75Approved")?.checked
    });
    if (r) records[key]=r; else delete records[key];
    updateStatus(r ? "Technology annotation saved in the current character. No mechanical modifiers applied." :
      "Technology annotation cleared.");
  }
  function addCatalogueEntry() {
    const item=entryOf(browserEntry);
    if(!item) return updateStatus("Choose a catalogue entry first.");
    if(item.loadoutEligible===false) return updateStatus("This entry is reference-only; it cannot be added as personal gear.");
    const weapon=(DATA.lists?.weapons || []).includes(item.name);
    const type=weapon ? "weapon" : "equipment";
    if(!weapon && !(DATA.lists?.equipment || []).includes(item.name))
      return updateStatus("This entry is not selectable in Equipment slots. No changes made.");
    const size=weapon ? 5:10;
    const available=Array.from({length:size},(_,i)=>({i,el:itemSelect(type,i)}))
      .find(row=>row.el && !row.el.value && [...row.el.options].some(o=>o.value===item.name));
    if(!available)return updateStatus("No compatible free "+(weapon?"Weapon":"Equipment")+" slot; nothing was overwritten.");
    available.el.value=item.name;
    available.el.dispatchEvent(new Event("change",{bubbles:true}));
    activeSlot=slotKey(type,available.i);
    renderSlots();
    updateStatus("Added "+item.name+" to "+type+" slot "+(available.i+1)+".");
  }
  function onGearChanged(event, kind) {
    const index = Number(event?.target?.dataset?.[kind+"Select"]);
    if(!Number.isInteger(index))return;
    const key=slotKey(kind,index);
    const record=records[key];
    if(record && record.item!==currentItem(key)){
      delete records[key];
      updateStatus("Cleared quality/modification notes for replaced "+kind+" slot "+(index+1)+".");
    }
    renderSlots();
  }
  const originalCollect = collectState;
  collectState = function() {
    cleanStaleRecords();
    const state=originalCollect();
    // Scalar JSON: existing XML serializer does not support nested array item objects.
    state.technologyGearJson=JSON.stringify(records);
    return state;
  };
  const originalApply = applyState;
  applyState = function(raw) {
    records={};
    activeSlot="";
    originalApply(raw);
    records=restoreRecords(raw?.technologyGearJson);
    renderSlots();
  };
  const priorRandom = randomCharacter;
  randomCharacter = function() {
    records={};activeSlot="";
    priorRandom();
    renderSlots();
    autosaveCurrentCharacterNow();
  };
  const priorBeginner = randomBeginnerCharacter;
  randomBeginnerCharacter = function() {
    records={};activeSlot="";
    priorBeginner();
    renderSlots();
    autosaveCurrentCharacterNow();
  };
  // Print existing gear as before, but keep a short human-readable Quality/
  // Modification note in the same row. Original source mechanics remain in DATA.
  const originalSelectedPrintGear = selectedPrintGear;
  selectedPrintGear = function(kind) {
    return originalSelectedPrintGear(kind).map(row => {
      const r=metaFor(kind,row.index-1,row.entry?.name);
      if(!r)return row;
      const prefix=[
        r.quality ? "Quality: "+r.quality : "",
        r.modifications ? "Mods: "+r.modifications : "",
        r.notes ? "Tech: "+r.notes : "",
        r.approved ? "GM checked" : ""
      ].filter(Boolean).join("; ");
      return {...row, entry:{...row.entry,mechanic:prefix+"; "+(row.entry.mechanic || row.entry.brief || "")}};
    });
  };
  function makeField(tag, labelText, id, extra={}) {
    const label=document.createElement("label");
    label.textContent=labelText;
    const input=document.createElement(tag);
    input.id=id;
    for(const [key,value] of Object.entries(extra))input.setAttribute(key,value);
    label.appendChild(input);
    return {label,input};
  }
  function initTechnologyWorkshop() {
    if(workshopActive || selected("v75TechnologyWorkshop"))return;
    const table=document.getElementById("equipmentTable");
    if(!table)return;
    workshopActive=true;
    const section=document.createElement("section");
    section.id="v75TechnologyWorkshop";section.className="panel no-print";
    const details=document.createElement("details");
    const heading=document.createElement("summary");
    heading.textContent="Technology Workshop (V75) — infogear, medical, augmentations, equipment quality & modifications";
    details.appendChild(heading);
    const disclaimer=document.createElement("p");
    disclaimer.className="tech-v75-small";
    disclaimer.textContent="Existing, previously sourced gear only. The standalone Technology of the Human Sphere sourcebook is not available in the supplied collection. Quality and modification fields are GM notes, not verified new bonuses, prices or slots.";
    details.appendChild(disclaimer);
    const countsP=document.createElement("p");
    countsP.className="tech-v75-small";
    countsP.textContent="Indexed existing records: "+entries.length+" total; "+counts.infogear+" infogear/quantronic, "+
      counts.medical+" medical, "+counts.augmentation+" augmentation, "+counts.modification+" upgrade/modification entries.";
    details.appendChild(countsP);
    const headingBrowser=document.createElement("h4");headingBrowser.textContent="Explore existing technology";details.appendChild(headingBrowser);
    const filters=document.createElement("div");filters.className="tech-v75-grid";
    const filter=makeField("select","Catalogue category","v75FamilyFilter");
    techCategories.forEach(([value,label])=>{
      const option=document.createElement("option");option.value=value;option.textContent=label;filter.input.appendChild(option);
    });
    filters.appendChild(filter.label);
    filters.appendChild(makeField("input","Search item, rule or source","v75TechSearch",{type:"search",placeholder:"e.g. Nannies, Hacking Device, surgical"}).label);
    details.appendChild(filters);
    const browser=document.createElement("div");browser.className="tech-v75-browser";
    const results=document.createElement("select");results.id="v75TechResults";results.size=9;
    results.setAttribute("aria-label","Technology catalogue results");
    browser.appendChild(results);
    const preview=document.createElement("pre");preview.id="v75TechDetail";browser.appendChild(preview);
    details.appendChild(browser);
    const countText=document.createElement("p");countText.id="v75CatalogueCount";details.appendChild(countText);
    const add=document.createElement("button");add.type="button";add.id="v75AddItem";add.textContent="Add selected item to first free compatible slot";
    details.appendChild(add);
    const slotTitle=document.createElement("h4");slotTitle.textContent="Quality & modifications for equipped gear";details.appendChild(slotTitle);
    const slot=makeField("select","Choose equipped weapon or equipment","v75SlotChoice");
    details.appendChild(slot.label);
    const slotDesc=document.createElement("p");slotDesc.id="v75EquippedDetail";slotDesc.className="tech-v75-small";details.appendChild(slotDesc);
    const quality=makeField("input","Item quality / condition (source or GM wording)","v75Quality",{maxlength:String(MAX_TEXT.quality),placeholder:"Enter verified or GM-approved wording"});
    details.appendChild(quality.label);
    const modification=makeField("textarea","Modifications / fitted upgrades (include rule reference)","v75Modification",{maxlength:String(MAX_TEXT.modifications),rows:"2",placeholder:"Modification name, source page, effect and acquisition cost"});
    details.appendChild(modification.label);
    const notes=makeField("textarea","Technology notes / constraints","v75TechNotes",{maxlength:String(MAX_TEXT.notes),rows:"2",placeholder:"e.g. surgery, maintenance, permissions, location, legality"});
    details.appendChild(notes.label);
    const approved=makeField("input","GM has checked the recorded customisation","v75Approved",{type:"checkbox"});
    approved.label.className="tech-v75-check";details.appendChild(approved.label);
    const status=document.createElement("p");status.id="v75TechStatus";status.setAttribute("role","status");status.className="tech-v75-small";
    details.appendChild(status);
    const note=document.createElement("p");note.className="tech-v75-small";
    note.textContent="Gear quality and modifications do not automatically change skill ratings, damage, Soak, Armour, rarity, availability, loadout eligibility or credits. Existing source mechanics are unchanged; data is saved in browser/JSON/XML and summarised in gear print rows.";
    details.appendChild(note);
    section.appendChild(details);
    const anchor=table.closest(".table-wrap") || table;
    anchor.insertAdjacentElement("afterend",section);
    const style=document.createElement("style");style.id="v75TechStyles";
    style.textContent=
      '#v75TechnologyWorkshop{margin:.6rem 0;padding:.8rem;border:1px solid #8fa9b6;border-radius:8px}'+
      '#v75TechnologyWorkshop summary{cursor:pointer;font-weight:700;font-size:14px}'+
      '#v75TechnologyWorkshop .tech-v75-small{font-size:12px;line-height:1.45}'+
      '#v75TechnologyWorkshop .tech-v75-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}'+
      '#v75TechnologyWorkshop label{display:flex;flex-direction:column;gap:4px;margin:7px 0;font-size:12px}'+
      '#v75TechnologyWorkshop select,#v75TechnologyWorkshop input:not([type=checkbox]),#v75TechnologyWorkshop textarea{width:100%;box-sizing:border-box;min-height:34px}'+
      '#v75TechnologyWorkshop .tech-v75-browser{display:grid;grid-template-columns:minmax(210px,1fr) minmax(260px,1.5fr);gap:10px;margin:10px 0}'+
      '#v75TechnologyWorkshop .tech-v75-browser select{height:180px}'+
      '#v75TechnologyWorkshop pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.45 Arial,sans-serif;background:transparent;border:1px solid #bbcbd1;padding:8px;margin:0;max-height:210px;overflow:auto}'+
      '#v75TechnologyWorkshop .tech-v75-check{flex-direction:row;align-items:center}'+
      '#v75TechnologyWorkshop .tech-v75-check input{width:auto;min-height:auto}'+
      '#v75TechnologyWorkshop button{padding:8px 12px;cursor:pointer}'+
      '@media(max-width:760px){#v75TechnologyWorkshop .tech-v75-browser{grid-template-columns:1fr}}';
    document.head.appendChild(style);
    filter.input.addEventListener("change",filterCatalogue);
    selected("v75TechSearch").addEventListener("input",filterCatalogue);
    results.addEventListener("change",showCatalogueEntry);
    add.addEventListener("click",addCatalogueEntry);
    slot.input.addEventListener("change",renderSlotEditor);
    for(const id of ["v75Quality","v75Modification","v75TechNotes","v75Approved"]) {
      const field=selected(id);
      field.addEventListener(id==="v75Approved"?"change":"input",storeCurrent);
    }
    for(const kind of ["weapon","equipment"]) {
      document.querySelectorAll('select[data-'+kind+'-select]').forEach(control=>{
        control.addEventListener("change",event=>onGearChanged(event,kind));
      });
    }
    filterCatalogue();
    renderSlots();
    updateStatus("Ready. Edit quality/modification notes for an equipped item. Source effects must be entered and adjudicated by the GM.");
  }
  window.INFINITY_BUILD=BUILD;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initTechnologyWorkshop);
  else initTechnologyWorkshop();
})();
