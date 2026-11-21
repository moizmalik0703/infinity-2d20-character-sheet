# Trait and Talent Primary/Secondary Skill Audit — V80

**Scope:** 306 Traits and 194 Talents. The source catalogue previously contained 55 Traits with both fields empty and three Talents with Secondary empty.

## Repairs

- **12 fixed one-skill grants:** Grizzled → Survival; Sardonic → Discipline; Sole Survivor → Survival; Spirit of the 112 → Medicine; Street Fighter → Close Combat; Weight of the World → Discipline; Unbalanced → Analysis; Bookworm → Education; Crushing Expectations → Discipline; Free Spirit → Analysis; Trust Issues → Psychology; Wandering Eyes → Observation. Each now grants a single +1 Rating to the listed supported sub-skill when selected.
- **Three choice-based events:** Raised in a Barn → Animal Handling or Survival; Survivor → Ballistics or Close Combat; It Takes One to Know One → optional Thievery only when selecting the Asset-debt outcome. All start without a selected bonus. Their choice is stored in both browser saves and XML exports.
- **40 special-effect/narrative Traits:** Primary and Secondary are both explicitly marked *Not applicable*. Their source effects are preserved verbatim; no additional, invented skill bonus is applied.
- **Three Talents:** Pattern Recognition and Sturdy retain Analysis and Resistance respectively. Their Secondary is now *Not applicable*. Catfall's unsupported source skill Acrobatics is explicitly mapped to simplified skill Athletics as a **house rule**; its source text is unchanged.

## Mechanics and limitations

Automatic Trait/Talent Rating additions are limited to the implemented **sub-skills**. Main skills cannot receive automatic bonuses. An event's source description may include Vigour, Resolve, earnings, debt, drug effects, contact grants or narrative complications, which remain separate from and are not replaced by skill Rating bonuses.

**Avoid double-counting** a lifepath rank that a player already entered through manual starting allocations. Choosing a source-event Trait is the sheet's way of representing that source-specific single rank.

The deployed `index.html` includes copies of the catalogue and application. Both embedded copies and standalone `data.js` / `app.js` were updated. Existing differences in the embedded V80 equipment provenance marker were preserved. This patch does not change unrelated equipment rules or the previous iPhone mobile CSS fix.

New end-to-end coverage: `tests/e2e/trait-talent-bonus-coverage.spec.cjs`.
