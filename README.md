# TV Budget

A YouTube time-budget portal for Samsung TVs (Tizen). One kid, one TV, no algorithm.

## What it does

- Custom YouTube search — no homepage suggestions, no end-screen recommendations.
- Daily time budget. Faint timer always on screen, only ticks while a video is `PLAYING`.
- Search results are filtered to videos that fit in the remaining budget.
- A video already playing is **never** cut off — only new videos are blocked when time is up.
- Wind-down banners at 2:00 and 0:30 remaining.
- Recently-watched list, parent PIN, blocklist keywords, bonus-minutes flow.
- See `DESIGN.md` for the full UI/UX spec.

## Setup

1. Get a YouTube Data API v3 key:
   - Google Cloud Console → enable "YouTube Data API v3"
   - Create an API key, restrict it to the YouTube Data API
   - Set a daily quota cap (it's free, but cap it anyway)
2. Copy `.env.example` to `.env` and paste your key:
   ```
   VITE_YT_API_KEY=AIza...
   ```
3. Install + run:
   ```
   npm install
   npm run dev
   ```
4. Open http://localhost:5173 in Chrome. Use arrow keys + Enter to navigate (simulating a TV remote).

Default parent PIN: `1234` — change it in Settings on first launch.

## Build for TV (later)

The app is a static SPA; `npm run build` produces `dist/`. To package as a Tizen `.wgt`:

1. Install Tizen Studio with TV Extensions 6.0+
2. Add a `config.xml` (Tizen manifest) pointing at `dist/index.html`
3. `tizen build-web -- dist && tizen package -t wgt -s <yourCertProfile> -- dist/.buildResult`

See the build-order section in DESIGN.md / the planning chat for the full TV deployment flow.

## Project structure

```
src/
  App.tsx              # Routes + global timer overlay + settings modal mount
  main.tsx             # Entry, HashRouter
  index.css            # Design tokens (matches DESIGN.md)
  types.ts             # Shared TS types
  storage.ts           # localStorage layer (budget, settings, recent, history)
  useBudget.ts         # Budget state + tick interval
  format.ts            # MM:SS / H:MM:SS helpers
  youtube.ts           # YouTube Data API client + filters
  components.tsx       # Button, VideoCard, TimerOverlay, WindDownBanner, Modal, ...
  HomeScreen.tsx       # Search input + recently watched
  SearchScreen.tsx     # Results list (fits / too long)
  PlayerScreen.tsx     # IFrame player + end-screen mask
  TimesUpScreen.tsx    # Friendly "all done" + bonus PIN
  SettingsModal.tsx    # PIN-gated parent settings
```
