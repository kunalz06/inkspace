# InkSpace — Android-first offline handwriting workspace

**Status: early functional MVP, not yet deployed.** InkSpace provides:

- Multi-page notebooks (ruled paper), infinite whiteboards, image annotation, and PDF page annotation.
- Pen, highlighter, eraser, pan, zoom, undo/redo, single-active-pointer input.
- Rule-based palm-contact suppression, experimental local logistic classifier, optional personal calibration (8 finger + 8 palm samples). No guaranteed palm rejection. The bootstrap classifier uses **synthetic** examples and is **not a validated pretrained model**.
- Local storage in IndexedDB, service worker, installable PWA shell, and PNG/JSON exports.
- Optional Supabase account and handwritten-stroke sync once a dedicated Supabase project is configured.

## Run locally

Requires Node >=20 (for build/tests) and Python 3 for the zero-dependency static server.

```bash
npm test
npm run build
cd dist && python3 -m http.server 8000
```
Open http://localhost:8000 in Chrome. For real Android Chrome, deploy to HTTPS; service workers and PWA install require a secure context (or localhost).

## Deploy to Netlify

Netlify site `inkspace-notes` has been reserved, but no deployment was created automatically. Create a GitHub repository (or import this source there) and connect it to the Netlify project. The included `netlify.toml` runs `npm run build` and serves `dist/`.

On Netlify, set **build** environment variables after creating a dedicated Supabase project:

- `VITE_SUPABASE_URL` = Supabase Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = Supabase publishable / anon public key

Never add a service-role or secret key to a browser build. Changes to env vars require redeploying.

## Supabase setup

Create a **dedicated** project, then apply `supabase/migrations/20261110000100_workspace_docs.sql` through the migration workflow. Email/password sign-in uses Supabase Auth. Row Level Security restricts each user to their own `workspace_docs` rows. Before production use, test signup, login, RLS isolation, cross-device sync, refresh-token expiration, and conflicts.

## Limitations of this MVP

- PDF.js is loaded from a pinned external CDN on first PDF import; that first import needs connectivity. Each imported page is rasterized and retained locally, so the annotation surface works offline later. Service-worker caching of the PDF renderer is opportunistic and **not guaranteed**. A later build should bundle PDF.js for fully offline first import.
- PNG export captures the visible canvas viewport, not a complete vector PDF. JSON backup contains drawing structure, not imported image/PDF binary attachments. These files remain in local IndexedDB.
- Current cloud sync transfers drawing/document JSON but **not** large binary attachments, and uses basic timestamp/conflict-copy reconciliation rather than a production-grade revision protocol.
- Signed-in sessions are held in memory only; users must sign in again after a reload. There is no refresh-token flow yet.
- Browser event geometry differs across Android devices; finger-vs-palm classification cannot be guaranteed even with calibration. Test physical devices before making performance claims.
- This MVP has automated input-engine tests and a build check, but has not undergone comprehensive Android device testing or security review.

## Development

`src/input.js` provides the contact classifier and tiny trainable logistic model. `src/tracker.js` enforces one drawing pointer. `src/app.js` contains the canvas UI and interaction logic. `src/db.js` owns IndexedDB storage. `src/pdf.js` rasterizes imported PDF pages. `src/cloud.js` handles optional Supabase REST sync. `src/styles.css` styles the responsive PWA. `sw.js` caches the application shell.

## Privacy

Touch calibration samples remain on-device, stored only as model weights in `localStorage`. The app does not upload touch samples or raw handwriting for model training.
