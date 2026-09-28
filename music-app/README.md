# Music Studio 🎵

A one-page AI music generator built on the [Suno API](https://docs.sunoapi.org). Plain HTML/CSS/JS: no build step, no server code.

## Features
- **Simple mode**: describe a song in a sentence; Suno writes the lyrics and music.
- **Custom mode**: title, style, your own lyrics, instrumental toggle, voice (male/female), styles to exclude,
  style strength, weirdness, variety, and song length.
- **✍️ Write lyrics with AI** (Suno lyrics API) right inside custom mode.
- Model picker: V6 (default), V6 Mini, V6 Wild, V5.
- Live progress, with a streaming preview as soon as the first version is ready.
- "Your songs" library (saved in the browser) with player, MP3 download, lyrics, and "Reuse settings".
- Remaining credits shown in the top bar.

## API key
Each user adds their own Suno API key with the **🔑 Add API key** button (get one at https://sunoapi.org/api-key).
The key is checked against Suno, stored only in that browser (optionally remembered), and sent only to `api.sunoapi.org`.

## Deploy to Netlify
This app lives in the `music-app/` folder of the repo.
1. Netlify → **Add new site → Import an existing project → GitHub** → pick this repo.
2. Set **Base directory** to `music-app`. Leave the build command empty; the publish directory comes from `netlify.toml`.
3. Deploy.

Or drag the `music-app` folder onto https://app.netlify.com/drop.

## Run locally
```bash
cd music-app
python3 -m http.server 8000
```
