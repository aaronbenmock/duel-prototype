# Production-ready inbox

Each approved asset gets its own folder here. Claude Code may integrate a package only when its `HANDOFF.md` contains `STATUS: READY`.

Required package contents:

- `HANDOFF.md` with exact filenames, dimensions, intended use, and integration notes
- approved runtime PNG, WebP, or optimized SVG files
- the approved editable SVG master when one exists
- a preview image when useful

Claude Code validates the package, copies runtime files to `../exports/<type>/`, integrates and tests them, then adds `INTEGRATED.md`. It does not alter source masters. Folders beginning with `_` are never production assets.
