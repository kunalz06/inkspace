# InkSpace MVP Design

## Intent

An Android-first, offline-first web workspace for handwritten notebook pages, infinite whiteboards, and imported PDF/image annotation; works with fingers and styluses. User work is local by default, with optional cloud sync.

## Goals

- One writing pointer at a time; a palm may remain in contact while subsequent finger/pen strokes are acquired.
- Best-effort intelligent touch classification: rule-based suppression and small on-device ML classifier, optional personalization.
- No claims of perfect palm rejection or validated pretrained data without device studies.
- Accessible responsive UI, local autosave, no account required for offline operation.
- GitHub + Netlify deployment workflow, dedicated Supabase backend with RLS.

## Non-goals (first build)

Full collaborative editing, reliable palm rejection on all hardware, exporting annotated vector PDFs, synchronizing binary attachment files, validated real-data pretrained ML, and production conflict-free multi-device editing.

## Approach decisions

- Use a no-dependency static ES module PWA for small bundle and deploy simplicity; React and a canvas framework can be reconsidered if the UI grows significantly.
- Draw using HTML Canvas 2D and Pointer Events. Track a single active pointer; do not automatically promote existing resting contacts on pointerup.
- The classifier applies pen priority and obvious contact-size rules before the logistic model. A synthetic-only bootstrap demonstrates the ML execution path; user calibration replaces it with locally trained weights.
- Persist document objects and imported image/PDF raster pages separately in IndexedDB.
- Supabase REST + RLS for optional JSON sync, no backend dependency for offline use.

## Constraints and risks

- Android Chrome PointerEvent width/height may be missing, constant or inaccurate. Finger versus palm is physically ambiguous; contact-size heuristics can fail.
- PDF.js CDN dependency must be bundled before guaranteeing first-use PDF imports offline.
- Cloud conflicts and binary attachment synchronization require a later milestone.
- Avoid touching existing repositories or cloud databases unrelated to this new app.
