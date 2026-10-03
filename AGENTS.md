## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `montara-project/tera-router`; use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, each label string equal to its role name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### UI/UX skills

`npx skills add nextlevelbuilder/ui-ux-pro-max-skill --all -y` installed seven skills under `.agents/skills/`, mirrored by symlink into `.claude/skills/` and `.zcode/skills/`: `ui-ux-pro-max` (design intelligence + design-system generator), `ui-styling` (shadcn/Tailwind, canvas designs), `design`, `design-system`, `brand`, `slides`, `banner-design`. Use them for interface work; refresh with `npx skills update`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root, shared by all three apps. See `docs/agents/domain.md`.
