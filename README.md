# InkSpace — Android-first offline handwriting workspace

**Status: early functional MVP deployed to [inkspace-notes.netlify.app](https://inkspace-notes.netlify.app).** InkSpace provides:

- Multi-page notebooks (ruled paper), infinite whiteboards, image annotation, and PDF page annotation.
- Pen, highlighter, eraser, pan, zoom, undo/redo, single-active-pointer input.
- Rule-based palm-contact suppression, experimental local logistic classifier, optional personal calibration (8 finger + 8 palm samples). No guaranteed palm rejection. The bootstrap classifier uses **synthetic** examples and is **not a validated pretrained model**.
- Local storage in IndexedDB, service worker, installable PWA shell, and PNG/JSON exports.
- Optional Supabase account and handwritten-stroke sync through the dedicated `inkspace-notes` Supabase project (cloud sync requires signing in).

## Run locally

Requires Node >=20 (for build/tests) and Python 3 for the zero-dependency static server.

```bash
npm test
npm run build
cd dist && python3 -m http.server 8000
```
Open http://localhost:8000 in Chrome. For real Android Chrome, deploy to HTTPS; service workers and PWA install require a secure context (or localhost).

## Deploy to Netlify

Netlify site `inkspace-notes` is linked to this repository's `main` branch. Pushes automatically build via `npm run build` and publish `dist/`.

On Netlify, set **build** environment variables after creating a dedicated Supabase project:

- `VITE_SUPABASE_URL` = Supabase Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = Supabase publishable / anon public key

Never add a service-role or secret key to a browser build. Changes to env vars require redeploying.

## Supabase setup

The dedicated **free** Supabase project `dtonxfmksurzggjrydfo` (Mumbai region) has been created, and the `workspace_docs` migration applied. Email/password sign-in uses Supabase Auth. Row Level Security restricts each user to their own `workspace_docs` rows. Before production use, test signup, login, RLS isolation, cross-device sync, refresh-token expiration, and conflicts.

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

## Deployment links

- App: https://inkspace-notes.netlify.app
- Source: https://github.com/kunalz06/inkspace
- Netlify dashboard: https://app.netlify.com/projects/inkspace-notes
- Supabase project: https://supabase.com/dashboard/project/dtonxfmksurzggjrydfo

The browser bundle contains only a Supabase publishable key. Never ship a secret/service-role key to the client.
