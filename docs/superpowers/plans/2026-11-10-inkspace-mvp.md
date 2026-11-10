# InkSpace MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Android-first offline handwriting workspace with best-effort hybrid palm rejection and optional cloud sync.

**Architecture:** Browser Canvas 2D + Pointer Events + IndexedDB and a PWA service worker. A standalone classifier and pointer controller feed vector strokes to notebook, board and document pages; an optional RLS-protected Supabase REST backend syncs document JSON.

**Tech Stack:** Vanilla JavaScript ES modules, HTML Canvas, IndexedDB, service worker, node:test, Netlify, Supabase.

**Spec:** `docs/superpowers/specs/2026-11-10-inkspace-design.md`

## Global Constraints

- Android Chrome is first priority, work offline without an account.
- Never publish Supabase secret keys.
- Hybrid classifier runs on-device; synthetic bootstrap MUST be labeled unvalidated.
- Never overwrite unrelated GitHub, Netlify, or Supabase resources.

## Review Focus

- Palm remains down while multiple handwriting strokes are started.
- Misclassified large palm must not create strokes.
- Browser omits PointerEvent contact geometry.
- Unexpected cancellation of an active pointer must not leave the editor stuck.
- Concurrent offline and remote edits must not be silently discarded.

---

### Task 1: Input classification

**Files:** `src/input.js`, `tests/input.test.js`

**Interfaces:** `extractFeatures(event)`, `scoreTouch(event)`, `classifyPointer(event,options)`, `trainPersonalModel(samples,epochs)`, `predictPalm(model,features)`.

- [x] Write tests for stylus priority, oversized palm rejection, geometry and calibration.
- [x] Verify RED before implementing.
- [x] Implement lightweight classifier, no raw-contact upload.
- [x] Verify tests pass.
- [ ] Test on real Android touchscreens.

### Task 2: Single pointer control

**Files:** `src/tracker.js`, `tests/input.test.js`

**Interfaces:** `createPointerTracker({onStart,onMove,onEnd,getOptions})`.

- [x] Test that ignored palm does not block a later finger stroke.
- [x] Verify RED before implementing.
- [x] Implement one active pointer and stable ID tracking.
- [x] Verify tests pass.
- [ ] Test pointercancel/lostpointercapture across browsers.

### Task 3: Offline editor and storage

**Files:** `src/app.js`, `src/db.js`, `src/styles.css`, `index.html`, `manifest.webmanifest`, `sw.js`.

- [x] Implement local document autosave, drawing toolbar, notebooks and whiteboards.
- [x] Include note page controls, image and PDF page import.
- [x] Add PWA shell caching and responsive Android UI.
- [ ] Automated browser end-to-end tests on Android and desktop.

### Task 4: Cloud sync and release

**Files:** `src/cloud.js`, `supabase/migrations/20261110000100_workspace_docs.sql`, `netlify.toml`, `scripts/build.mjs`.

- [x] Prepare RLS-secured schema and optional cloud client.
- [x] Add a zero-dependency Netlify build and run local tests.
- [ ] Create GitHub repository and commit source after available GitHub repo-creation access.
- [x] Create dedicated Netlify site.
- [ ] Create dedicated Supabase project after organization and cost selection.
- [ ] Configure env vars and deploy a GitHub-connected Netlify site.
- [ ] Test cloud auth, RLS, sync, conflict handling, and release.
