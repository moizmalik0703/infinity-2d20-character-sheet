# V80 — Vehicle / TAG Workshop

## Source and scope
- GM Guide MUH050210, Chapter 11, printed pp. 123–144 (PDF pp. 128–149).
- Existing faction Vehicle catalogue retained. Eight detailed Chapter 11 example vehicles (Car, Gecko TAG, Gūijiă TAG, Hovercraft, Motorcycle, Speedboat, Truck, Yacht) added with official acquisition data.
- PanOceania's nine Chapter 5 vehicle/TAG profiles received explicit structured stat blocks, types, built-in gear/weapons and hardpoint availability.
- 50 Mod Shop upgrades indexed from pp. 141–142 with Category, Restriction, Cost, Tariff and printed source page.

## Player experience
- The garage is a separate section after the Technology Workshop, not a Weapon or Equipment slot.
- Up to six vehicle instances per character, with nickname, pilot/operator, current Structure, operational notes, installed upgrade ledger.
- Catalogue search/type filter with detailed source profile and acquisition fields.
- Hardpoint tracking for Chassis/Comms/External/Internal/Motive/Weapons; installation only where an explicit free slot exists.
- Garage records persist in the scalar `vehicleWorkshopJson` field through autosave and XML/JSON import/export; older saves default to empty garage and legacy vehicle equipment entries are migrated.
- Printable portfolio adds a compact garage roster reference to notes; standalone vehicle dossier available as .txt export.
- Vehicle stat changes and weapon damage modifiers are **not** automatically applied to campaign house-rule totals; require GM approval.

## Source interpretation
- Source p.135: default already-fitted upgrades do not consume listed free hardpoints.
- A TAG printed with Hard Points None has 0 available hardpoints; source-incomplete profiles do **not** gain fictional capacity.
- Some faction supplement vehicles lack structured profiles in the catalogue: the workshop shows available narrative/partial stats and treats hardpoint capacity as unknown.
- GM Guide printed p.128: Fault threshold is 5 + Scale or Structure reaching 0.
- PanOceania Aeropter published speed discrepancy (stat block 1/2; summary table 2) retained as a source QA warning.

## Non-goals
- No credit conversion, unapproved vehicle ownership, automatic installed-upgrade stat bonuses, or redesign of the custom Armour rules.
- No changes to the 5 Weapon / 10 Equipment slot convention or starting loadouts.
