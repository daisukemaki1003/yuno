# Repository Guidelines

## Project Structure & Module Organization
- `apps/`: Next.js client using the App Router; feature slices live in `src/features`, shared UI/logic under `src/shared`, and global utilities in `src/lib`; static assets go in `public/`.
- `services/`: Hono API; requests flow from `src/routes` to `src/controllers` and `src/services`, with validation schemas in `src/schemas` and helpers in `src/utils`; integration and unit specs reside in `services/tests`.
- `docs/`: Architecture and runbook references—update relevant markdown (e.g. `services/docs/`) whenever behaviours change or new operations are added.

## Build, Test, and Development Commands
- `cd apps && pnpm dev` launches the web client on `http://localhost:3000`; `pnpm build` + `pnpm start` produces the production bundle.
- `cd services && pnpm dev` starts the API with hot reload; `pnpm build` compiles to `dist/` and `pnpm start` runs the compiled server.
- Run `pnpm test`, `pnpm test:watch`, and `pnpm test:coverage` inside each package; add `pnpm lint` and `pnpm format:check` (frontend) or `pnpm lint` (API) before pushing.

## Coding Style & Naming Conventions
- TypeScript is required; use PascalCase for React components, camelCase for hooks/utilities, and kebab-case for route filenames to mirror current folders.
- Prettier (2-space indent, double quotes, trailing semicolons) and Next ESLint rules (`apps/eslint.config.mjs`) enforce formatting—run `pnpm format` then `pnpm lint` to autofix drift.
- Prefer alias imports (`@/`) over deep relative paths; group feature code within its folder and expose re-exports through local `index.ts`.

## Testing Guidelines
- Frontend tests live beside components or in `__tests__`; rely on Testing Library helpers configured in `apps/jest.setup.js` and name specs `*.test.tsx`.
- Backend tests belong under `services/tests`, mirroring `src` subdirectories (e.g. `routes/healthz.test.ts`); Jest runs in ESM mode with an 80% global coverage threshold (`services/jest.config.cjs`).
- Update fixtures in `services/tests/fixtures` and refresh `docs/testing-guide.md` when API contracts or manual flows change.

## Commit & Pull Request Guidelines
- Follow the existing history: single-line, descriptive Japanese summaries ending with `。`; add a second sentence for broader context or side-effects.
- Reference related issues, list behaviour changes, and attach screenshots for UI updates to aid reviewers.
- PR descriptions should include test commands executed, highlight schema or env changes (`apps/.env.local`, `services/.env`), and link any synchronized documentation updates.

## Configuration Notes
- Store secrets only in local `.env` files and keep `.env.example` entries current; never commit keys.
- When touching Firebase or Meeting BaaS settings, sync values with the README matrix and ensure logs respect scrubbing rules in `services/src/utils/logger.ts`.
