# TV Budget — Design Guide

A consistent visual + interaction language for the YouTube time-budget portal. The user is a kid with ADHD watching on a Samsung TV from across the room with a remote. Every choice below is in service of: **calm, big, obvious, forgiving**.

---

## 1. Design principles

1. **One thing per screen.** Never two competing focal points. The kid should always know what to look at.
2. **Big and far-away-readable.** Designed for a 10ft TV viewing distance. Minimum body text 24px, minimum tap target 80×80px.
3. **Calm motion, no flashing.** Animations are slow (250–400ms ease-out), additive, and never strobe. ADHD overstimulation is the enemy.
4. **Forgiving, never punishing.** "Time's up" is a friendly screen, not a buzzer. Videos in progress always finish.
5. **No dark patterns.** No autoplay, no algorithmic suggestions, no "next up". The kid leaves the player when his choice ends — every time.
6. **D-pad first.** Everything reachable with arrow keys + Enter + Back. No hover states, no gestures, no mouse assumptions.
7. **State is visible.** Time remaining is always on screen (faint). Focus is always obvious. Loading is always shown.

---

## 2. Color palette

Dark theme only (TV in a living room, often dim). High contrast, no pure white on pure black (causes halation on OLED/LCD TVs).

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0f0f0f` | App background |
| `--surface` | `#1a1a1a` | Cards, panels |
| `--surface-2` | `#252525` | Elevated cards, focused background |
| `--border` | `#333333` | Dividers, unfocused outlines |
| `--text` | `#e8e8e8` | Body text (off-white, easier on eyes than `#fff`) |
| `--text-dim` | `#888888` | Secondary text, metadata |
| `--text-faint` | `rgba(255,255,255,0.35)` | Ambient timer overlay |
| `--accent` | `#4ea1ff` | Primary action, focus ring (calm blue, not red) |
| `--ok` | `#5ed68a` | "Fits in your budget", success states |
| `--warn` | `#ffb84d` | Wind-down banners (amber, not red) |
| `--blocked` | `#666666` | Greyed-out / disabled (videos that don't fit) |
| `--danger` | `#e06262` | Only for destructive parental actions in Settings |

**Never used:** Pure red `#ff0000` (alarming for a kid), neon/saturated colors, gradients on text.

---

## 3. Typography

- **Family:** System sans-serif stack — `'Segoe UI', system-ui, -apple-system, Arial, sans-serif`. Tizen TVs ship Segoe UI.
- **Scale (px, baseline 16):**
  | Role | Size | Weight | Line height |
  |---|---|---|---|
  | Display (titles like "Time's up!") | 56 | 700 | 1.1 |
  | H1 (screen title) | 40 | 700 | 1.2 |
  | H2 (section header) | 28 | 600 | 1.3 |
  | Body | 24 | 400 | 1.4 |
  | Meta (channel name, duration) | 20 | 400 | 1.4 |
  | Timer overlay | 28 | 500 | 1 |
- **No italics.** Hard to read on TVs.
- **Letter-spacing:** `+0.5px` on all-caps labels, `0` everywhere else.
- **Numbers in timer:** use `font-variant-numeric: tabular-nums` so digits don't jiggle as they tick.

---

## 4. Spacing & layout

8px base grid. Use only multiples of 8 for spacing.

| Token | Value | Use |
|---|---|---|
| `--space-1` | 8px | Tight (icon to label) |
| `--space-2` | 16px | Within a card |
| `--space-3` | 24px | Between related elements |
| `--space-4` | 40px | Between sections |
| `--space-5` | 64px | Screen padding |
| `--space-6` | 96px | Top-level screen margins |

**Safe zones (TV overscan):** Keep all interactive content inside a 5% margin from each screen edge. Use `--space-6` (96px) as the outer padding on a 1920×1080 layout.

**Grid:** 12-column, 24px gutters. Most screens use a single centered column max-width 1400px.

---

## 5. Focus & navigation (D-pad)

- **Focus ring:** 4px solid `--accent` with 4px offset, no fill change. Always visible — never `outline: none` without replacement.
- **Focus must move predictably:** up/down/left/right map to spatial neighbors. Use `@noriginmedia/norigin-spatial-navigation` to avoid hand-rolling.
- **Initial focus on every screen** lands on the most likely action (Search input on Home, first result on Results, Play on Player).
- **Back button** always returns to the previous screen, never closes the app, never returns to YouTube end-screens.
- **Enter** activates focused item. **No long-press**, no double-tap.
- **Scrolling lists:** focused item should auto-scroll to stay in the middle 60% of the viewport.

---

## 6. Components

### 6.1 Card (search result, recent thumb)

```
┌──────────────────────────────────────────┐
│ ┌─────────────┐  Title goes here on      │
│ │             │  one or two lines max    │
│ │  thumbnail  │                          │
│ │   16:9      │  Channel name            │
│ │             │  ⏱ 12:04  ✓ fits        │
│ └─────────────┘                          │
└──────────────────────────────────────────┘
```

- Background: `--surface`. Focused: `--surface-2` + 4px `--accent` border, scale `1.04`, transition 200ms.
- Thumbnail: 320×180 (16:9). Rounded 12px. Lazy-loaded.
- Title: max 2 lines, ellipsis after.
- Duration badge bottom-right of thumbnail (semi-transparent black pill, white tabular numbers).
- "Fits / too long" pill with `--ok` or `--blocked` color. **Too-long cards are not focusable** — they appear at half opacity at the bottom of the list, separated by a thin divider with the label "Too long for today".

### 6.2 Button

- Primary: filled `--accent`, white text, 80px tall, 32px horizontal padding, 16px radius.
- Secondary: transparent, 2px `--border`, `--text` color.
- Destructive (Settings only, PIN-gated): `--danger` border, never filled by default.
- All buttons: 700 weight, 24px text. Focused state same as cards (border + scale).

### 6.3 Input (search)

- Single big input, 96px tall, full width minus screen padding.
- Placeholder: "What do you want to watch?" in `--text-dim`.
- On focus: border becomes `--accent` 4px, on-screen keyboard slides up from bottom (custom big-key keyboard, not OS keyboard).
- Voice icon (🎤) in the right side, focusable separately.

### 6.4 Timer overlay (always visible)

- Top-right, 64px from top, 96px from right edge.
- `⏱ 42:18` format. Uses MM:SS under 1 hour, H:MM:SS at or above.
- Color: `--text-faint` normally. Transitions to `--warn` at ≤2:00 remaining, gentle 1.5s pulse animation.
- **Never red.** Never flashing fast.
- On the player screen, it's overlaid on top of the video, same position.

### 6.5 Wind-down banner

- Slides in from top, 80px tall, full width, `--warn` left border 8px.
- Text: "2 minutes left — this video will finish" (size 28, weight 600).
- Auto-dismisses after 6 seconds with a slow fade.
- Only one banner at a time.

### 6.6 Modal (PIN entry, bonus minutes, time's up)

- Backdrop: `rgba(0,0,0,0.7)` blur-3.
- Panel: centered, max-width 800px, `--surface-2`, 24px radius, 64px padding.
- Title at top, content middle, actions bottom-right.
- Closing always allowed via Back.

---

## 7. Screen-by-screen specs

### 7.1 Home

- **Above the fold:** Search bar (centered, big), greeting line below ("42 minutes left today" or "Time's up — come back tomorrow!").
- **Below:** "Pick up where you left off" — horizontal row of up to 6 recently watched cards.
- **Bottom-right:** small Settings cog (focusable, opens PIN modal).
- **Empty state** (no recents yet): friendly illustration area + "Search for something to watch above ☝".

### 7.2 Search results

- Sticky header: query echoed back ("Showing results for: minecraft tutorial") + result count.
- Vertical list of cards (one per row, full width). Why not a grid? Easier D-pad navigation, less visual noise.
- "Too long for today" divider followed by greyed cards if any.
- Empty state: "No videos found that fit in your time. Try a shorter search?" with a back button to Home.

### 7.3 Player

- Full-screen video.
- Faint timer top-right.
- Wind-down banners top-center.
- **No other UI** during playback. Back returns to Home (never to a "next video" suggestion screen).
- End-screen mask: invisible div over the bottom 25% and right 30% of the player during the last 25 seconds, blocking YouTube's end cards from being clickable, with a subtle dark gradient behind it so they fade visually too.

### 7.4 Time's Up

- Triggered when budget hits 0 AND no video is playing.
- Big friendly headline: "You're all done for today!" (Display size, `--text`).
- Subtext: "Come back tomorrow for more." (Body, `--text-dim`).
- Two buttons: **OK** (returns to Home in noNewVideos mode) and **Ask for bonus** (opens PIN modal for parent).
- No countdown to next reset. No guilt-trippy phrasing.

### 7.5 Settings (PIN-gated)

- Sectioned list:
  - Daily time limit (slider 15–180 min, increments of 5)
  - Bonus minutes for today (+10 / +20 / +30 buttons)
  - Blocklist keywords (chip input)
  - Channel allowlist (off by default; if on, paste channel IDs)
  - Cool-down between videos (toggle)
  - Change PIN
  - 7-day summary (read-only table)
- Save button bottom-right. All changes confirmed with a small toast.

---

## 8. Motion

- **Easing:** `cubic-bezier(0.2, 0.8, 0.2, 1)` for everything (calm, slightly bouncy out).
- **Durations:** 200ms (focus, scale), 350ms (modal in/out), 500ms (page transition fade).
- **Page transitions:** crossfade only. No slides, no zooms — they're disorienting on TV.
- **Loading:** 3-dot pulse `· · ·` in `--text-dim`, never spinners.
- **Reduced motion:** respect `prefers-reduced-motion`; replace all transitions with instant + opacity-only.

---

## 9. Iconography

- Single icon set: **Lucide** (open source, geometric, friendly). Use line weight 2px.
- Icon size: 32px inline with body text, 48px standalone, 64px in big buttons.
- Always pair icons with a text label except the timer ⏱ (which has the number as its label).

---

## 10. Voice & copy

Plain, kind, kid-readable. Reading level ~grade 3.

- ✅ "You're all done for today!" — ❌ "Daily quota exceeded."
- ✅ "This video is too long for the time you have left." — ❌ "Duration exceeds remaining budget."
- ✅ "Ask a parent for more time?" — ❌ "Request quota extension."
- ✅ "Pick up where you left off" — ❌ "Continue watching"
- Never use "you can't", "you're not allowed", "blocked". Use "let's try later", "save it for tomorrow", "this one doesn't fit".
- Never shame, never count down ("only 5 minutes left!!!").
- Numbers spelled out under 10 in body copy ("two minutes left"), digits in the timer ("2:00").

---

## 11. Accessibility & TV quirks

- All interactive elements get `aria-label`. The TV reader (if enabled) should narrate sensibly.
- Color contrast ≥ 7:1 for body text, ≥ 4.5:1 for meta — verified.
- No information conveyed by color alone (the "fits"/"too long" pill has both color AND a checkmark/cross icon AND a text label).
- Test on actual Samsung TV: known issues include slow CSS `filter: blur()` (avoid on player screen), no `position: sticky` on older Tizen (use `fixed` fallback), no `dialog` element (use a div modal).

---

## 12. Don't-do list

- ❌ No red badges, no notification dots, no "1 new!" indicators.
- ❌ No countdown clocks counting up (only the timer counts down, and it's faint).
- ❌ No celebratory animations when finishing a video (don't reinforce binge cycles).
- ❌ No social/share buttons.
- ❌ No ads, ever (we control the API, no surface for them).
- ❌ No "trending" or "for you" surfaces.
- ❌ No autoplay countdown ("Next video in 5… 4…").

---

## 13. CSS variables (drop-in)

```css
:root {
  --bg: #0f0f0f;
  --surface: #1a1a1a;
  --surface-2: #252525;
  --border: #333;
  --text: #e8e8e8;
  --text-dim: #888;
  --text-faint: rgba(255, 255, 255, 0.35);
  --accent: #4ea1ff;
  --ok: #5ed68a;
  --warn: #ffb84d;
  --blocked: #666;
  --danger: #e06262;

  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 40px;
  --space-5: 64px;
  --space-6: 96px;

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;

  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-fast: 200ms;
  --dur-med: 350ms;
  --dur-slow: 500ms;

  --focus-ring: 4px solid var(--accent);
  --focus-offset: 4px;

  --font: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
}
```

---

This document is the source of truth. If a future change disagrees with it, update this file first, then the code.
