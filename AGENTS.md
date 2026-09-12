# Repository Guidelines

## Project Structure & Module Organization

Science Quiz is a Vue 3, TypeScript, and Vite application for upper-primary science practice. Read `docs/PRD.md`, the confirmed `docs/ui-design/README.md`, and `docs/content-editorial.md` before changing behavior or content.

- `src/App.vue` coordinates Home, Topic, Quiz, Result, and Wrong Questions.
- `src/components/` contains quiz and material views; `src/engine/` handles validation, grouping, and scoring.
- `src/progress/` owns local records; `src/sync/` calls the optional backup service.
- `content/manifest.json` discovers topics. Banks live in `content/science/<topic-id>/questions.json`; decorative assets live in `content/assets/`. Vite serves `content/` as its public directory.
- `schemas/question.schema.json` defines Question Schema v1; `worker/github-sync/` contains the Cloudflare endpoint.
- `tests/` holds Vitest tests; `e2e/` holds Playwright journeys.

## Build, Test, and Development Commands

Use Node.js 22.12+ and `npm ci`.

- `npm run dev`: start local development.
- `npm run validate`: validate schemas, references, groups, and global IDs.
- `npm test`: run unit and boundary tests.
- `npm run build`: validate content, type-check, build, and generate offline caching.
- `npm run preview`: serve the production build.
- `npm run test:e2e`: run browser journeys after building and installing Chromium.
- `npm run check`: run tests and build.
- `npm run format:check`: enforce Prettier formatting.

## Coding Style & Naming Conventions

Use two spaces, single quotes, semicolons, and the configured Prettier rules. Vue components use PascalCase filenames and typed `<script setup>`. Preserve Chinese copy, stable question IDs, and source numbers. Keep content, deterministic quiz logic, local state, and synchronization separate. Avoid unrelated refactors.

## Testing Guidelines

Vitest files use `*.test.ts`; browser journeys use `e2e/*.spec.ts`. Test public behavior: answer sets, material ordering, persistence after reload, validation failures, and sync failures. No coverage percentage is mandated. Check desktop, mobile, both themes, and offline production reload for UI changes. Never report remote synchronization as verified from mocked tests alone.

## Commit & Pull Request Guidelines

No established commit history exists yet. Use focused imperative subjects such as `feat: add material-based science practice`. PRs should describe behavior, reference requirements, list checks and limitations, and include UI evidence. Exclude credentials, generated build output, and `.DS_Store`.

## Security & Configuration

GitHub tokens belong only in Worker secrets. Browser device keys authorize one anonymous profile. Preserve local data when storage or sync fails. Network deployment and publication require the user's authorization.
