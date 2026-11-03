# AI Trucking Back-Office Platform — Starter Kit

Everything needed to start the build in Claude Code.

| File | What it is |
| --- | --- |
| `KICKOFF_PROMPT.md` | The first message to paste into Claude Code |
| `CLAUDE.md` | Standing rules the agent reads every session (put at repo root) |
| `docs/00-master-prompt-v2.json` | Full product brief — source of truth |
| `docs/01-product-brief.md` | Product, customer, promise, MVP scope |
| `docs/02-architecture.md` | System design and recommended stack |
| `docs/03-data-model.md` | Tables and relationships |
| `prisma/schema.prisma` | Draft database schema (validated) |
| `docs/04-validation-rules.md` | Rule catalog with codes |
| `docs/05-ifta-logic.md` | IFTA worksheet math |
| `docs/06-extraction-contract.md` | What the AI must return, plus JSON schema |
| `docs/07-intake-channels.md` | Upload, phone, email, SMS/WhatsApp, fuel card, ELD |
| `docs/08-deliverables-spec.md` | PDF, CSV, ZIP, IFTA worksheet |
| `docs/09-security.md` | Security and retention |
| `docs/10-test-plan.md` | Golden dataset and tests |
| `docs/11-roadmap.md` | Phases, gates, Phase 0 task list |
| `docs/12-decisions-log.md` | Decisions and temporary defaults |
| `.env.example` | Environment variables |
| `locales/en.json`, `locales/so.json` | Starter UI strings (English, Somali) |

**How to start:** unzip into an empty repo folder, open Claude Code there, paste `KICKOFF_PROMPT.md`.
