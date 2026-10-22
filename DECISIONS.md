# Decisions

- Node 22 LTS and gh 2.103 installed to ~/.local (no Homebrew on this Mac, no sudo); PATH added in ~/.zshrc.
- Blender 4.2 found at /Applications/Blender.app; invoke via full path (not on PATH).
- Figma MCP connector works; use it for per-frame design context and screenshots.
- Repo `pip-personality-bot`, public, deployed to GitHub Pages via Actions.
- Vite `base` switches to `/pip-personality-bot/` only when built in GitHub Actions; local stays `/`.
- Fonts: Geist + Geist Mono variable woff2 copied from the `geist` npm package into `public/fonts` (self-hosted, one file each).
- `geist` is a devDependency since only its font files are used.
- Playwright runs against `vite preview` (port 4173) with desktop 1440×900 and mobile 390×844 projects; Chromium only.
- H1 uses clamp(36px, 4.2vw, 60px) so the Figma 56–64px scale fits narrower windows without scrolling.
- Git identity set repo-locally (samialshatri95 / account email); no global git config existed.
