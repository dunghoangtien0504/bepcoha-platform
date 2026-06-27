# Contributing to AI Governance Gateway

Thanks for your interest! AIGG is **human-architected, AI-executed** — contributions are very welcome, whether you write the code yourself or pair with an AI agent. What we care about is that changes are **correct, governed, and tested**.

## Ways to contribute

- 🐛 **Report bugs** — open an issue with steps to reproduce, expected vs actual, and logs.
- 💡 **Propose features** — open a discussion/issue first so we can align on scope (see the roadmap in the [README](README.md)).
- 🔧 **Send a pull request** — fixes, docs, tests, new providers, integrations.
- 🌍 **Translations** — the dashboard and landing page are bilingual (EN/VI); more languages welcome.

## Development setup

Prerequisites: Node.js ≥ 20 and Docker (for MySQL + Redis).

```bash
git clone https://github.com/techablevn/ai-governance-gateway.git
cd ai-governance-gateway
cp .env.example .env                       # fill in secrets
docker compose up -d mysql redis
cd apps/backend-gateway && npm install && npm run start:dev   # :3900
cd apps/admin-dashboard && cp .env.example .env && npm install && npm run dev   # :5173
```

First boot auto-creates the schema and seeds RBAC. See the [README quick start](README.md#quick-start) for details.

## Branch & commit conventions

- **Branches** carry a Task ID so the gateway can attribute work automatically:
  `feature/AIGG-123-short-description`, `fix/AIGG-45-...`. Run `bash ide-configs/install-hook.sh` to auto-extract it.
- **Commits**: short imperative subject (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`), with a body explaining *why* when it isn't obvious.
- One logical change per PR. Keep diffs focused.

## Code standards

- **TypeScript strict — no `any`.** The codebase is typed end to end; keep it that way.
- **Backend** (NestJS): Controller → Service → Entity → DTO. Validate input with DTOs. Never log or persist raw prompts/code — only metadata (see the security model in the README).
- **Frontend** (Vue 3): Composition API with `<script setup>`. Keep components small; reuse the shared table/card classes.
- **Lint + build must pass.** CI runs `eslint --max-warnings=0` and a full build for both apps on every push/PR:

```bash
# backend
cd apps/backend-gateway && npx eslint "src/**/*.ts" --max-warnings=0 && npm run build
# dashboard
cd apps/admin-dashboard && npx eslint "src/**/*.{ts,vue}" --max-warnings=0 && npm run build
```

## Governance invariants (please don't break these)

These are the rules the system exists to enforce — any change must keep them true:

1. **Proxy enforcement** — provider/master API keys live only behind the gateway; no client or agent can call an LLM directly with them.
2. **Quota integrity** — quota is checked in real time; an exhausted user/task budget cuts the request off, no exceptions.
3. **Audit immutability** — every request (success or failure) leaves a data footprint and syncs back to its Task ID for ROI reporting.

A PR that lets any of these be bypassed will be asked for changes, regardless of code quality.

## Pull request checklist

- [ ] Lint + build pass for any app you touched
- [ ] New behavior is covered by a test or a clear manual-verification note
- [ ] No secrets, `.env`, or generated artifacts committed
- [ ] The three governance invariants above still hold

## License of contributions

This project is licensed under **[AGPL-3.0](LICENSE)**. By submitting a contribution, you agree it is licensed under the same terms. If you need a different arrangement, open a discussion before contributing.

## Code of conduct

Be respectful and constructive. We follow the spirit of the [Contributor Covenant](https://www.contributor-covenant.org/).
