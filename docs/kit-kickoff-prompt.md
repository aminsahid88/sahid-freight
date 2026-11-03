# Paste this into Claude Code to start

Read `CLAUDE.md`, then `docs/00-master-prompt-v2.json` and every file in `docs/`.

Then:
1. Summarize the product and the Phase 0 + Phase 1 scope in under 300 words.
2. List any open decisions you need, using the temporary defaults in `docs/12-decisions-log.md` unless a choice is expensive to reverse.
3. Set up the monorepo using the recommended stack in `docs/02-architecture.md`.
4. Adapt `prisma/schema.prisma` into the real schema, run the first migration, and seed the fictional "Demo Freight LLC".
5. Execute the Phase 0 task list in `docs/11-roadmap.md` in order, with tests.
6. Stop at the Phase 0 gate and report: what was built, what was tested (results), what is not done, assumptions made.
