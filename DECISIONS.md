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
- Bubble copy for the 9 unspecified answers written to match the 3 given lines.
- Ties: only 1-1-1 is possible with 3 answers, so the Q3 answer always wins a tie; mix rounds to 100 with the remainder on the winner.
- Mix encoded in the share URL as `m=p67d33`; switching reveal chips to a non-winning personality shows it at 100%.
- "Try again" keeps the customised look; Home resets everything (with confirm if customised).
- Preview glow tints 50% toward the hovered colour (spec says 30%; Figma shows a full-colour glow — compromise).
- Playwright runs Chromium with Metal GPU flags; headless software GL ran the stage at ~3 fps.
- Adaptive quality: DPR drops to 1 after ~90 slow frames (>24 ms).
- Renamed Pip → Roo (user request). Repo/base path name left as `pip-personality-bot` until the user decides.
- Hover props: one cached mini-scene per answer, pop-in like accessories; disposed when the quiz ends.
- Q3 "Invisibility" fades body + joints to 15% so only the eyes (screen) and foot stay visible.
- Moves live in src/three/moves.ts (pure GSAP). scripts/bake-clips.ts samples them at 30 fps → blender/robot.json,
  so Blender clips and the site's fallback motion can't drift apart.
- Blender exports with NLA_TRACKS mode so each clip name becomes one glTF animation spanning all nodes.
- During a baked clip, GSAP still runs on a throwaway pose to fire face/floor events at the same times.
- Procedural robot stays as the instant placeholder and fallback if the GLB fails to load.
- Using three r186's bundled Draco decoder (Vite hashes it) instead of copying it to public/.
