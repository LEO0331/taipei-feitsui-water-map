# AGENTS.md

Project harness for reliable agent-assisted development in the Taipei Feitsui Reservoir Water Quality Map.

This is a static Vite + React + TypeScript + Leaflet app. The browser reads local JSON from `public/data`; live Taipei Open Data calls belong only in Node scripts under `scripts/`.

## Startup Workflow

Before writing code:

1. **Confirm working directory** with `pwd`
2. **Read this file** completely
3. **Read `README.md`** for product/data constraints and commands
4. **Run `./init.sh`** to verify the environment is healthy
5. **Read `feature_list.json`** to see current feature state
6. **Review recent commits** with `git log --oneline -5`

If baseline verification is failing, repair that first before adding new scope.

## Working Rules

- **One feature at a time**: Pick exactly one unfinished feature from `feature_list.json`
- **Verification required**: Don't claim done without running verification commands
- **Update artifacts**: Before ending session, update `progress.md` and `feature_list.json`
- **Stay in scope**: Don't modify files unrelated to the current feature
- **Static browser app**: Do not add a backend, database, login, admin UI, or browser-side Taipei Open Data API calls
- **Coordinate honesty**: Render map markers only for stations with `coordinateStatus: "verified"` and numeric coordinates in `public/data/station-locations.json`
- **Data semantics**: Preserve raw water-quality values and qualifiers; do not coerce `ND`, `<10`, `-`, or empty values to zero
- **Deployment path**: Keep GitHub Pages builds compatible with `/taipei-feitsui-water-map/` via Vite `base`
- **Leave clean state**: Next session must be able to run `./init.sh` immediately

## Required Artifacts

- `feature_list.json` — Feature state tracker (source of truth)
- `progress.md` — Session continuity log
- `init.sh` — Standard startup and verification path
- `session-handoff.md` — Optional, for larger sessions

## Definition of Done

A feature is done only when ALL of the following are true:

- [ ] Target behavior is implemented
- [ ] Required verification actually ran (tests / lint / type-check)
- [ ] Evidence recorded in `feature_list.json` or `progress.md`
- [ ] Repository remains restartable from standard startup path

## End of Session

Before ending a session:

1. Update `progress.md` with current state
2. Update `feature_list.json` with new feature status
3. Record any unresolved risks or blockers
4. Commit with descriptive message once work is in safe state
5. Leave repo clean enough for next session to run `./init.sh` immediately

## Verification Commands

```bash
# Full verification (recommended)
./init.sh
```

Required checks:
- `npm ci`
- `npm run convert:data`
- `npm test`
- `npm run build`
- `GITHUB_PAGES=true npm run build`

Use `npm run fetch:data` only when the task explicitly requires refreshing Taipei Open Data resources. It performs network I/O and can rewrite many raw JSON files.

## Escalation

If you encounter:
- **Architecture decisions**: Prefer the current static-data frontend architecture unless the user explicitly changes scope
- **Unclear requirements**: Check `README.md`, `feature_list.json`, and `progress.md`; ask only when behavior cannot be inferred safely
- **Repeated test failures**: Update progress, flag for human review
- **Scope ambiguity**: Re-read `feature_list.json` for definition of done
