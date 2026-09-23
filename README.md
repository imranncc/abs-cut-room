# ABS Cut Room

A standalone review site for 32 ABS activities. Visitors do not need Claude or GitHub accounts.

The frontend preserves the approved descriptions and original design. Application text is AES-GCM encrypted in `public/sketch.enc.json`; only the private invitation link carries its decryption key. Do not commit invitation or owner links, unencrypted application exports, or deployment secrets. Search indexing is discouraged; encryption supplies the actual content boundary.

## Current hosting

GitHub Pages serves `public/` through the deployed `gh-pages` branch. Cloudflare Workers and D1 provide private online feedback storage at the `apiBase` in `public/config.json`. Feedback saves automatically, with local drafts retained for recovery and automatic retries after connection failures. Previously exported review files can still be opened in `owner.html`.

Reviewers use the shared invitation and enter the same name each time to reopen their feedback, including on another device. Names are normalized for case and spacing. This intentionally permits anyone with the invitation to access a review by entering its name; the owner explicitly accepted this tradeoff. The UI discloses it. There is no public reviewer directory.

The Worker resolves names to stable review IDs and issues server-derived tokens. Names attach to existing reviews without deleting their content or invalidating legacy tokens. Duplicate legacy names require owner resolution rather than choosing a record arbitrarily. Updates retain revision checks against concurrent overwrites. Admin access still requires the separate private owner credential; name login cannot access the admin inbox.

Reviewers can edit or unsend comments, with an immediate Undo option, and suggest section moves. Changes save automatically. Sign out returns to the name form. The previous private-return-link controls are removed; the same shared invitation works for every visit.

## Backend deployment

1. Sign in to Cloudflare and keep the Workers Free plan.
2. From `worker/`, run `npx wrangler d1 create abs-cut-room-feedback` and insert its database ID in `wrangler.jsonc`.
3. Run `npx wrangler d1 execute abs-cut-room-feedback --remote --file=schema.sql`.
4. Set `SKETCH_KEY_HASH` and `ADMIN_KEY_HASH` with `npx wrangler secret put`. These are SHA-256 hashes of the separately saved invitation key and owner token, never the frontend review tokens.
5. Deploy with `npx wrangler deploy`. Set `public/config.json` `apiBase` to the resulting HTTPS worker URL and republish the Pages branch.
6. Test real cloud save/reopen, unauthorized reads, a concurrent-tab revision conflict and the owner inbox before declaring online feedback ready.

## Local checks

`npm test` runs the backend against a real in-memory SQLite database and checks access control, save/reopen, stale revisions, input validation and payload limits. `npm run preview` serves the frontend on `http://127.0.0.1:4173`.

After deployment, `ABS_SECRETS_FILE=/absolute/private/path node scripts/verify-cloud.mjs` verifies two synthetic reviewers against the real API, including edit/unsend and admin isolation. It prints only the disposable record IDs so those exact test records can be removed afterward.

No Cloudflare billing upgrade is required. Local drafts are retained if online saving is interrupted. The page reports unsaved changes and retries transient failures automatically. Existing Claude reviewer data has not been automatically migrated; the prior audit found only synthetic QA records. The Claude artifact remains unchanged.

Each entry has a Section dropdown below its rank arrows. Placement suggestions apply to both ranking views, with independent ordering in each. Comments and verdicts stay attached to the entry; the admin inbox lists suggested moves. Original application data and other reviewers are unaffected.
