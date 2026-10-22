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
- Loop 3: cinematic three-point lighting + real soft shadows; full-viewport canvas framed via view offset;
  big reveal (lights out → spotlight → diorama builds → camera pulls back → letters tumble in);
  4 dioramas (blanket fort, ball-pit party, theatre, zen garden); exaggerated personalities; intro ear-drag; capital-R logo

## Next 5 tasks
1. Deploy to GitHub Pages once `gh auth login` is done (repo + push + Pages)
2. Re-run Playwright after loops 2–3 (rename, props, GLB, full-screen canvas) and fix fallout
3. Split RectArea LTC tables / environments into their own lazy chunk (3D chunk is 285 KB gz)
4. Sound polish + Lighthouse pass (perf/a11y/best practices ≥ 90), OG image, favicon
5. Mobile: tap-to-preview props (hover doesn't exist on phones)

## Known issues (ranked)
1. Not deployed — gh not logged in
2. Playwright suite not re-run since the rename/props/GLB work (paused at user's request)
3. 3D chunk grew to 285 KB gz (RectAreaLight tables + environments) — still lazy, initial JS 39 KB
4. Vite base path still `/pip-personality-bot/` — rename repo to roo-*? (user's call)
5. Lighthouse / LCP not measured yet

## Last critique score (loop 3, from GPU screenshots at 1440×900 and 390×844)
- Visual match 8 — matches Figma layout; lighting/shadows now read as a real render
- Ease of use 8 — clear CTAs, Home + Esc everywhere; ear-drag hinted by a bubble after 6 s
- Delight 9 — big reveal + dioramas + exaggerated personalities + ear-drag tantrum
- Performance 7 — 60 fps on GPU; shadows add cost; adaptive DPR fallback; Lighthouse pending
- Accessibility 7 — reveal name keeps an aria-label; reduced motion skips build/dolly/drag
- Code health 8 — modules: stage, environments, drag, props, accessories, moves (shared with Blender)
