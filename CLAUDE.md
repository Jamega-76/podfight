# Development Guide for Podcast Fighter II Turbo

## 🎮 ⭐ FINAL MODEL - VERSION DÉFINITIVE À CONSERVER ⭐

**Ce modèle (commit: d75edf7) est la version FINALE et DÉFINITIVE du projet.**

**Conservez cette version. C'est LE modèle de référence.**

**Marqué avec Git tag:** `FINAL_MODEL`

Toutes les améliorations de Gemini ont été intégrées:
- ✅ Logo avec animation de clignotement 3D
- ✅ Boutons navigation avec codes couleur et relief arcade (6 couleurs distinctes)
- ✅ Titres de section avec animation dynamique
- ✅ Sprites décoratives animées (lasers, vaisseaux, explosions)
- ✅ Tableau classement amélioré avec meilleure lisibilité
- ✅ Bouton START vert clignotant

---

## Project Overview
- **Purpose**: A retro arcade-inspired podcast RSS feed comparison tool
- **Stack**: Vanilla HTML/CSS/JS + Tailwind CSS
- **Deployment**: GitHub Pages (automatic from main branch)
- **Model**: Use Haiku for development (cost-efficient)

## Auto-Push Setup
The project has a git post-commit hook that automatically pushes to GitHub after each commit. To enable it:

1. Get a GitHub Personal Access Token from https://github.com/settings/tokens
2. Run: `git config --global credential.helper osxkeychain`
3. First push: `git push -u origin main` (paste token as password)
4. The token will be saved and future commits will auto-push!

Or install GitHub CLI: `brew install gh && gh auth login`

## Key Files
- `index.html` - Main page with design and structure
- `app.js` - RSS parser and stats calculator
- `.git/hooks/post-commit` - Auto-push after commits

## Design System
See `DESIGN.md` for the arcade-inspired design specifications. Key colors:
- **Primary (Pink)**: #ff89ab - Player 1
- **Secondary (Yellow)**: #ffd709 - Player 2
- **Tertiary (Red)**: #ff7166 - Alerts/Critical
- **Background**: #0e0e0e - Dark arcade feel

## Features Currently Implemented
✅ RSS feed parsing
✅ Episode metadata extraction
✅ Battle stats: episodes today, last 7 days
✅ Average episode duration
✅ Arcade UI with comparison view

## Next Steps / Ideas
- [ ] Save favorite comparisons
- [ ] Episode list view with sorting
- [ ] Download stats as image/PDF
- [ ] Share battle results (social sharing)
- [ ] Mobile responsiveness improvements
- [ ] Dark/Light mode toggle
- [ ] Category/tag filtering

## Development Notes
- Use `loadPodcast(1)` or `loadPodcast(2)` to test with specific feeds
- CORS proxy (allorigins.win) is used for RSS fetching
- All calculations happen client-side (no backend needed)

---
**Last updated:** 2026-04-05 (FINAL MODEL CONFIRMED)
**Repository:** https://github.com/Jamega-76/podfight
**Live:** https://jamega-76.github.io/podfight/
