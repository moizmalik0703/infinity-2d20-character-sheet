# Infinity 2D20 Web Character Sheet

This folder is a static website version of the campaign character sheet.

## What it does

- Fixed webpage layout, so players cannot resize rows or break formulas.
- Dropdowns for factions, homeworlds, career roles, doctrines, restrictions, traits, talents, weapons, equipment, and conditions.
- Trait/Talent/Equipment/Condition details auto-fill from `data.js`.
- Save/load in the browser using localStorage.
- Download/import character JSON files.
- Print layout set to A4 landscape.

## What it does not do yet

- It does not save characters to a shared online database.
- It does not have login/accounts.
- It does not sync across devices unless players export/import JSON.

This is intentional for the free static-hosting version.

## Free hosting options

### Option A: GitHub Pages

Needs:
- A free GitHub account.
- A public repository.
- Upload these files.
- Enable GitHub Pages from repository settings.

Good for:
- Free public hosting.
- Simple static HTML/CSS/JS.

### Option B: Netlify

Needs:
- A free Netlify account.
- Drag-and-drop this folder or connect a GitHub repository.

Good for:
- Very easy upload.
- Free static site hosting.

### Option C: Cloudflare Pages

Needs:
- A free Cloudflare account.
- Upload prebuilt assets or connect GitHub.

Good for:
- Free static hosting with strong performance.

## Recommended first deployment

Use Netlify drag-and-drop first, because it is the easiest test:
1. Zip this folder or keep it as a folder.
2. Go to Netlify.
3. Add new site.
4. Drag and drop the folder.
5. Share the generated URL with players.

## File list

- `index.html` - main webpage
- `styles.css` - fixed layout and print styling
- `app.js` - interactive logic
- `data.js` - dropdown and rules data from the workbook
- `README_DEPLOY.md` - this guide

## Privacy note

In this free static version, the character is saved in the player's browser only. It is not uploaded to a server unless the player downloads/sends the JSON file.


## Skill bonus automation

This refined version links selected Traits and Talents to the skill table.

Rule used:
- Each selected Trait adds +1 to its Primary skill and +1 to its Secondary skill.
- Each selected Talent adds +1 to its Primary skill and +1 to its Secondary skill.
- If the linked skill is a main skill, the bonus flows to the sub-skills under that main skill.
- The Rating cell displays the final rating, for example `8 (+1)`.
- Bonus cells are highlighted light green.


## Multi-character saving

This version can save multiple character sheets in the same browser.

Buttons:
- `Save character` saves the current sheet using the Character Name as the save-slot name.
- `Saved characters...` lets you choose a saved character.
- `Load selected` loads the selected character.
- `Delete selected` removes the selected saved character from this browser.
- `Download JSON` exports the current character only.
- `Export all saves` exports every saved character in this browser as one backup file.
- `Import JSON` can import either one character file or a full backup file.

Important:
- Saves are stored in the player's browser using localStorage.
- Players using different computers or browsers will not overwrite each other.
- Browser saves do not automatically sync across devices.
- For safety, players should export JSON after each session.
