# Stately Sketch

Stately Sketch is a responsive state machine visualizer and simulator for XState. It is designed as an alternative to infinite-canvas tooling: code stays close to the diagram, the layout works on smaller screens, and simulation stays readable on desktop and mobile.

## What It Does

- Visualizes nested XState machines as responsive diagrams
- Simulates transitions, guards, and delayed events
- Lets you edit machine code and see updates immediately
- Supports XState code, Sketch DSL, JSON, YAML, and Mermaid input

## Run It Locally

### Prerequisites

- Node.js 22+
- `pnpm` 10+

### Install

```bash
pnpm install
```

### Start The App

```bash
pnpm dev
```

Open `http://localhost:3000`.

### Run Checks

```bash
pnpm test
pnpm build
pnpm test:e2e
```

## Environment

Sketch works locally without extra setup. If you want to point the app at different Stately services while developing, create `.env.development` with any of the following:

```bash
VITE_STATELY_BASE_URL=https://stately.ai
VITE_REGISTRY_API_URL=https://stately.ai/registry/api/v1/viz
DB_PATH=sketch.db
```

`VITE_REGISTRY_API_URL` overrides the default registry API path. `DB_PATH` controls the local SQLite file used by the built-in share routes.

## Development Notes

- `pnpm test` runs the Vitest unit suite only.
- `pnpm test:e2e` runs the Playwright browser suite.
- Shared sketches are persisted through the local server routes in `server/routes/api/viz`.

## Open Source

Issues and pull requests are welcome. Start with `CONTRIBUTING.md`, use the issue templates, and keep changes scoped and well-tested.

## Self-Hosting

Self-hosting is possible, but the default experience is intentionally aligned with Stately services. For a custom deployment, you will need to provide your own hosting setup, storage strategy, and any registry/auth endpoints you want the UI to target.
