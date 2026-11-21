# Traits & Talents completeness audit — 21 November 2026

**Target branch:** `main`  
**Canonical data:** root `data.js`  
**Scope:** existing Trait and Talent records only. No item removed or renamed, and no description, effect, prerequisite, or skill mapping changed.

## Post-repair validation

| Data | Records | Missing required display fields |
|---|---:|---:|
| Traits | 306 | 0 |
| Talents | 194 | 0 |

The validation checks the fields presented by the sheet, not every optional schema field.

## Changes

### Traits — 54 rows

- **51** sourcebook career/adolescent/lifepath-event entries: `rarity = "Lifepath Event"` and `cost = "Granted by Lifepath"`.
- **3** Ariadna host/heritage selections: `rarity = "Heritage"` and `cost = "Granted by Lifepath"`.
- All have `pricingNote` clarifying that no independent Infinity Point purchase price has been assigned. This avoids fabricating a price for published character-creation events or a biological heritage.
- Their previously populated source, page, restrictions, effects, and skill associations were preserved.

### Talents — 3 rows

**Catfall, Pattern Recognition, Sturdy** now have:

- `career = "General / Unrestricted"`
- `faction = "All Factions"`
- `rarity = "Common"`
- `cost = "5"`

These are **simplified-sheet house-rule fields**, based on the catalogue's Level 1 / Common convention; they are **not** official 2d20 sourcebook prices. Each record includes `pricingNote` stating that distinction.

The published corebook references retained in the records are: Catfall (p. 75), Pattern Recognition (p. 76), and Sturdy (p. 91). The current simplification of Acrobatics into Athletics for Catfall was preserved. The official corebook uses an XP-based Talent advancement system, not the sheet's Infinity Point price system.

### Provenance

- Added `source = "Infinity 2D20 Character Sheet — custom/adapted catalogue"` to **251** previously unattributed Traits and **191** previously unattributed Talents.
- This identifies the records as a custom/adapted sheet catalogue without inventing a publisher or a sourcebook page.
- The **55** Traits and **3** Talents with already specified publication sources and page numbers retain those original references.
- Optional fields such as `hostHeritageOnly`, `skillChoices`, `skillMappingNote`, and `skillBonusMode` are not required for every record; their intentional absence was not treated as missing data.

## Validation results

- All 306 Traits have nonblank name, category, primary/secondary skills, brief, effect, rarity, cost, restriction and source.
- All 194 Talents have nonblank name, category, career, faction, restriction, level, primary/secondary skills, description, effect, prerequisite, rarity, cost and source.
- Unique record names maintained and catalogue counts unchanged.
- Actual GitHub data blob re-fetched following commit and all required fields rechecked.

## Source boundary

- Corebook and Haqqislam materials were inspected for the relevant published mechanics and lifepath-event structure.
- The original Ariadna supplemental source is not among the provided project PDFs; its previously recorded source text, page references and mechanics were therefore preserved rather than silently rewritten.

## Rule for future edits

Do not auto-price a sourcebook lifepath/heritage trait as a purchasable Trait. Record the sourcebook event's benefits separately from custom point-buy values. When introducing a custom Talent cost, explicitly label it a **sheet house rule**.
