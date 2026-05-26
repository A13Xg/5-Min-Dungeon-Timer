# 5-Minute Dungeon Companion App

A fully static, mobile-first companion timer for **5-Minute Dungeon**, themed with a brutalist fantasy UI.

https://a13xg.github.io/5-Min-Dungeon-Timer/

## Features
- 5 rounds, each with a 5:00:0 countdown
- Stage progression tracker with 5 dots and animated transitions
- Large intuitive controls: Start/Pause, Reset, Next, and Back
- Dynamic urgency color shifts:
  - Green at start
  - Teal/blue under 4:00
  - Yellow/orange under 3:00
  - Red under 2:00
  - Flashing red under 1:00
- Stage card badges:
  - Stage 1 → 20 cards
  - Stage 2 → 25 cards
  - Stage 3 → 30 cards
  - Stage 4 → 35 cards
  - Stage 5 → 40 cards
- Audio system:
  - Minute threshold beeps (4/3/2/1 beeps)
  - Escalating urgency beeps below 30s down to sub-second intervals
  - Ambient music loaded from `assets/ambient/*.mp3` and picked randomly each track end
- Keep-awake support using Wake Lock API (when available)
- Top-right expandable settings menu:
  - Music toggle (default ON)
  - Beeps toggle (default ON)
  - Keep awake toggle
  - Dark/Light mode toggle
  - Advanced/Simple graphics toggle (default Advanced)
  - GitHub repo link
- Advanced graphics mode with subtle smoke + particles (simple mode disables effects)
  - Uses tsParticles fire preset for smoke + ember visuals with built-in fallback renderer

## Quick board game context
5-Minute Dungeon is a frantic, cooperative, real-time card game where players race against a 5-minute timer to clear dungeon cards and defeat a boss each stage. Difficulty increases across five stages, with larger dungeon door card counts.

## GitHub Pages setup
This repository includes `.github/workflows/pages.yml` for static site deployment via GitHub Actions.

To enable Pages in repository settings:
1. Go to **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to your deployment branch (workflow is configured for `main` and `copilot/add-5-minute-dungeon-app`).

## Wiki-style docs
See `docs/wiki/Home.md` for a concise in-repo wiki page.

## Local run
Open `index.html` directly in a browser, or serve statically:

```bash
python -m http.server
```

Then open `http://localhost:8000`.

## Linting

Lint hooks (HTML, CSS, JS syntax) are configured in `.pre-commit-config.yaml` and run in CI via `.github/workflows/lint.yml`. To run them locally without installing anything globally, use [`prek`](https://github.com/j178/prek) (a Rust-based reimplementation of `pre-commit`) via [`uv`](https://docs.astral.sh/uv/):

```bash
uvx prek run --all-files       # run every hook against every file
uvx prek run                   # run only against files changed vs. HEAD
```

To have the hooks run automatically on `git commit`:

```bash
uvx prek install
```

What's checked: HTML validity (`html5validator`), CSS (`stylelint`), JS syntax (`node --check`), plus YAML/JSON syntax and basic whitespace hygiene.

## Ambient Music Files
- Replace these placeholder files with real MP3s:
  - `assets/ambient/track-1.mp3`
  - `assets/ambient/track-2.mp3`
  - `assets/ambient/track-3.mp3`
  - `assets/ambient/track-4.mp3`
- Keep the same names, or update `AMBIENT_TRACKS` in `script.js`.

## Smoke + Ember Visual FX
- Primary effect library: `@tsparticles/engine` + `@tsparticles/preset-fire` (loaded as ESM from npm CDNs).
- Redundancy:
  - Multi-CDN load fallback (`jsDelivr` then `unpkg`).
  - Multi-attempt initialization with backoff.
  - Existing in-app canvas ember renderer is used automatically if library loading fails.
- GitHub Pages workflow now validates FX library URL availability before deploying.
