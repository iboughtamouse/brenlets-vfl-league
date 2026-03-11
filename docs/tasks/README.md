# Task Board

Lightweight internal task tracking. Each task is a markdown file in one of three directories:

- **`active/`** — work to be done or in progress
- **`done/`** — completed work (moved here from active/)
- **`cancelled/`** — decided against (moved here from active/, with rationale)

## Conventions

- One file per task, named descriptively (e.g. `delete-fetch-page-script.md`)
- Each file has a title, context, and acceptance criteria
- Move files between directories to change status — git history tracks when
