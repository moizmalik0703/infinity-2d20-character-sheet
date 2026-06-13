# Free Deployment Checklist

## Minimum needed

- Internet connection
- A free hosting account:
  - GitHub account for GitHub Pages, or
  - Netlify account, or
  - Cloudflare account
- The files in this folder:
  - index.html
  - styles.css
  - app.js
  - data.js

## Best free route for you

Start with Netlify drag-and-drop because it requires the least setup.

## Test before sharing

1. Open `index.html` locally in your browser.
2. Check dropdowns:
   - Faction
   - Homeworld
   - Career / Role
   - Doctrine
   - Trait
   - Talent
   - Weapons
   - Equipment
   - Conditions
3. Pick a Trait and Talent.
4. Confirm the text auto-fills.
5. Press Print and check A4 landscape view.
6. Save to browser.
7. Download JSON.
8. Import the JSON again.

## If you want shared cloud saving later

You will need a backend such as:
- Google Sheets + Google Apps Script
- Firebase
- Supabase
- Airtable

For now, this free static version avoids server complexity.
