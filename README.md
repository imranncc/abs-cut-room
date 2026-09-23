# ABS Cut Room

A standalone review site for 32 ABS activities. Visitors do not need Claude or GitHub accounts.

The frontend preserves the approved descriptions and original design. Application text is AES-GCM encrypted in `public/sketch.enc.json`; only the private invitation link carries its decryption key. Do not commit invitation or owner links, unencrypted application exports, or deployment secrets. Search indexing is discouraged; encryption supplies the actual content boundary.

## Current hosting

GitHub Pages serves `public/` through the deployed `gh-pages` branch. The encrypted site can operate without a backend: reviewers save drafts in their browser and download feedback files to send to the applicant. The page explicitly labels this mode. Files can be opened in `owner.html`.

Online saving requires the Cloudflare Worker and D1 database below. Once configured, each reviewer uses a unique private review link rather than their name as a credential. Review records are isolated by a 256-bit token and updates use revision checks so a stale tab cannot silently replace a newer saved review. The private owner link lists all reviews. No third-party reviewer accounts are needed.

## Backend deployment

1. Sign in to Cloudflare and keep the Workers Free plan.
2. From `worker/`, run `npx wrangler d1 create abs-cut-room-feedback` and insert its database ID in `wrangler.jsonc`.
3. Run `npx wrangler d1 execute abs-cut-room-feedback --remote --file=schema.sql`.
4. Set `SKETCH_KEY_HASH` and `ADMIN_KEY_HASH` with `npx wrangler secret put`. These are SHA-256 hashes of the separately saved invitation key and owner token, never the frontend review tokens.
5. Deploy with `npx wrangler deploy`. Set `public/config.json` `apiBase` to the resulting HTTPS worker URL and republish the Pages branch.
6. Test real cloud save/reopen, unauthorized reads, a concurrent-tab revision conflict and the owner inbox before declaring online feedback ready.

## Local checks

`npm test` runs the backend against a real in-memory SQLite database and checks access control, save/reopen, stale revisions, input validation and payload limits. `npm run preview` serves the frontend on `http://127.0.0.1:4173`.

No Cloudflare billing upgrade is required. Local drafts and downloaded review files remain available if the free backend limit is reached. Existing Claude reviewer data has not been automatically migrated; the prior audit found only synthetic QA records. The Claude artifact remains unchanged.
