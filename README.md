# Infinity 2D20 Character Sheet — Career & Faction/Homeworld refinement

Upload these four files to the **root** of your GitHub Pages repository, replacing the existing files:

- `index.html`
- `app.js`
- `data.js`
- `styles.css`

## What changed

- The interface has one visible **Career** field.
- The former `careerRole` and `restriction` values are migrated when an older saved character is loaded.
- Career controls Trait/Talent eligibility:
  - General Traits remain available.
  - Career-specific Talents are restricted to the selected Career.
  - Restriction values are derived from the matching Talent data, rather than a second form field.
- `homeworldsByFaction` is an explicit data relationship in `data.js`.
- **Homeworld / Habitat** is disabled until Faction is selected.
- Changing Faction clears a non-matching Homeworld / Habitat.
- Saving is blocked unless the selected Homeworld / Habitat belongs to the selected Faction.
- `index.html` now loads `styles.css`, `data.js`, and `app.js` externally. Do not keep an older duplicate script embedded in index.html.

## Check after upload

1. Refresh GitHub Pages with a hard refresh: `Ctrl+F5` on Windows or `Cmd+Shift+R` on Mac.
2. Choose a Faction; Homeworld / Habitat should become enabled and show only linked options.
3. Change Faction; the previous Homeworld / Habitat should clear if it is no longer valid.
4. Select a Career; Traits and Talents should refresh to the Career’s eligible options.
5. Load an older saved character and save it again to permanently migrate its old Career/Role data.
