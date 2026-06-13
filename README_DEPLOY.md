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
