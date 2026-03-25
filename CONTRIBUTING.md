# Contributing

## Setup

```bash
pnpm install
pnpm dev
```

## Before opening a PR

Run:

```bash
pnpm test
pnpm build
pnpm test:e2e
```

## Guidelines

- Keep changes focused.
- Add or update tests when behavior changes.
- Preserve existing product decisions around Stately integration unless the change explicitly targets that area.
- Use issue templates for bugs and feature proposals when possible.
- ⚠️ **Do not open AI-generated PRs.** I prefer you open an issue with context/prompt instead of opening an AI-generated PR. I can run Codex/Claude/etc myself.

## Pull Requests

- Describe the user-visible change.
- Call out any follow-up work or known gaps.
- Include screenshots or short recordings for UI changes.
