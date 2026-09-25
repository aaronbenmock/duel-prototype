# Instructions for Claude Code

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
