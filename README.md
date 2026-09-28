# FAU Owls Weather 🦉

A weather app themed in Florida Atlantic University colors (FAU Blue `#003366`, FAU Red `#CC0000`, gray `#CCCCCC`).
It defaults to the **FAU Boca Raton campus** and uses the free [Open-Meteo](https://open-meteo.com/) APIs, so no API keys or logins are needed.

## Features
- Current conditions for FAU Boca Raton by default (feels-like, humidity, wind, rain chance, UV, pressure, sunrise/sunset)
- 24-hour and 7-day forecasts
- City search (Open-Meteo Geocoding API)
- "My location" button (browser geolocation) and a "FAU Boca" button to jump back
- °F / °C toggle; your last city and unit are remembered in the browser
- Mobile-friendly layout

## Project structure
```
index.html          Page markup
styles.css          FAU theme
app.js              Open-Meteo API calls and rendering
assets/fau-logo.svg FAU owl logo (header)
favicon.svg         Browser tab icon
netlify.toml        Netlify deploy settings + security headers
```
It's plain HTML/CSS/JS: no build step, no dependencies.

## Run locally
Any static server works, for example:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to Netlify
**Option A: connect the GitHub repo (auto-deploys on every push)**
1. Log in at https://app.netlify.com → **Add new site → Import an existing project → GitHub**.
2. Pick this repository and the branch you want to deploy.
3. Leave **Build command** empty and set **Publish directory** to `.` (these are already set in `netlify.toml`).
4. Click **Deploy**.

**Option B: drag and drop**
Drag the project folder onto https://app.netlify.com/drop.

**Option C: Netlify CLI**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir .
```

## Logo
`assets/fau-logo.svg` is an FAU-colored owl mark made for this project. To use FAU's official logo instead,
download it from FAU's brand resources and save it over `assets/fau-logo.svg` (or change the `<img src>` in `index.html`
if it's a PNG). FAU logos are university trademarks, so use them in line with FAU's brand guidelines.

## Credits
Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0).
