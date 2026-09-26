# Instructions for Claude Code

## Update 2026-09-26: Claude reviews and promotes drafts

Aaron no longer marks art as production ready. **Claude Code reviews drafted art, tests that it works in the game,
and promotes it into `ready-for-production/` itself.** For each promotion:

1. Review the draft package in `art/drafts/` (read its README and manifests; never modify anything in `drafts/`).
2. Test it: dimensions, transparency, file names, silhouettes and alignment against the sprites the game uses,
   hit-zone fairness (cosmetics never change what can be hit), and a phone-size browser check in the game.
3. Only what passes goes in: create `ready-for-production/<package>/` with the chosen files (copies, or
   deterministic derivatives such as a recolour made with the package's own script and palettes), a `HANDOFF.md`
   written by Claude that records the review, the tests and their results, and the line `STATUS: READY`.
   Anything that fails is listed as rejected with the reason.
4. Then integrate as below (exports, code, `INTEGRATED.md`), and report what was promoted and what was rejected.

Claude still never draws new art, never retouches or paints over pixels, and never edits SVG masters. Repositioning,
scaling, cropping and deterministic recolours of runtime copies are allowed and must be recorded in the handoff.
Aaron's session request is the go-ahead to integrate; he doesn't create `APPROVED.txt` or `STATUS: READY` any more.

## Original rules (still apply to packages Aaron or an artist hands off)

`art/ready-for-production/` is the only inbox for new artwork. Follow these rules exactly.

1. Never integrate artwork from `art/drafts/` or `art/references/`.
2. Ignore every folder beginning with `_`; those are templates or pipeline tests. `_pipeline-test` has `STATUS: TEST ONLY` and must not be integrated.
3. Integrate a package only when its `HANDOFF.md` contains the exact line `STATUS: READY`.
4. Read the entire handoff before changing anything.
5. Validate the asset dimensions, transparency, filenames, intended use, attachment points, and animation notes. If the package is incomplete or doesn't match its handoff, stop and ask Aaron.
6. Copy optimized runtime files into the appropriate `art/exports/<type>/` folder. Do not import files directly from `ready-for-production`.
7. Do not modify, flatten, trace, rename, or overwrite the approved SVG master.
8. Integrate the exported assets into the game and run the relevant checks (at minimum `npm run build`; visually verify in a browser when possible).
9. Add `INTEGRATED.md` to the package recording the date, destination files, code changed, checks performed, and any unresolved issue.
10. Update `Apps/_STATUS.md` and commit the working result according to the repository instructions.

Only integrate when Aaron asks. A new package appearing here is not by itself a request to integrate it.
