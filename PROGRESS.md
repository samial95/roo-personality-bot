# PROGRESS

## Current phase
6 — Delight + polish (Phases 2–5 functionally done; Phase 1 deploy blocked on `gh auth login`)

## Done
- Toolchain: Node 22 + gh in ~/.local, Blender 4.2, Figma MCP
- Vite + TS + Three + GSAP; tokens, self-hosted Geist; top bar (Home confirm, Sound)
- All 14 states with exact copy (renamed Pip → **Roo**), crossfades, scoring (Q3 breaks ties),
  randomized A–D, keyboard (A–D, 1–6, Esc, Enter), aria-live announcements
- Hover preview: personality face + light tint + **bubble coloured by option** + **3D prop scene per answer** (12)
- Stage: lights, glow, floor rings, 12-expression canvas face, look-at, blink, per-personality idles,
  boot / installing / reveal / poke sequences, 6 moves, idle attention after 20 s, adaptive DPR
- Customize: colours, finish, moves, accessories (5 slots, 3D, pop-in, balloon/flag/speaker/headphones behaviour)
- Share: URL encodes everything, shared link → reveal + "Make your own", 1200×630 PNG card, copy link, Web Share
- Phase 4: `npm run model` = bake (moves.ts → robot.json) → Blender build → roo.glb (201 KB, ~6k tris,
  Draco, 32 clips) → check-glb ✓. Runtime swaps in the GLB and plays clips via AnimationMixer
- Playwright: 33 tests (scoring/URL units + click-through of every path, desktop + mobile)

## Next 5 tasks
1. Deploy to GitHub Pages once `gh auth login` is done (repo + push + Pages)
2. Reveal props/particles: shy blanket + hearts, playful confetti + ball, dramatic curtains + spotlight + rose, calm orbs + plant
3. Re-run Playwright after the Roo rename/props/GLB changes (tests already renamed)
4. Sound polish + Lighthouse pass (perf/a11y/best practices ≥ 90), OG image, favicon
5. Mobile: tap-to-preview props (hover doesn't exist on phones)

## Known issues (ranked)
1. Not deployed — gh not logged in
2. Playwright suite not re-run since the rename/props/GLB work (paused at user's request)
3. Reveal props/particles from §6 still missing (biggest delight gap)
4. Vite base path still `/pip-personality-bot/` — rename repo to roo-*? (user's call)
5. Lighthouse / LCP not measured yet

## Last critique score (loop 2, estimated — suite not re-run)
- Visual match 7 — layout/type/robot close to Figma; reveal props missing
- Ease of use 8 — clear CTAs, Home + Esc everywhere, no dead ends found
- Delight 7 — hover props + coloured bubbles land; reveals need their props
- Performance 7 — 60 fps on GPU, initial JS 39 KB gz, GLB 201 KB; Lighthouse pending
- Accessibility 7 — focus rings, keyboard, aria-live; contrast not audited
- Code health 8 — one source of truth for moves (site + Blender), typed, tested
