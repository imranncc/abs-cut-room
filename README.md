# ABS Cut Room

A standalone review site for 32 ABS activities. Visitors do not need Claude or GitHub accounts.

The frontend preserves the approved descriptions and original design. Application text is AES-GCM encrypted in `public/sketch.enc.json`; only the private invitation link carries its decryption key. Do not commit invitation or owner links, unencrypted application exports, or deployment secrets. Search indexing is discouraged; encryption supplies the actual content boundary.

## Current hosting

GitHub Pages serves `public/` through the deployed `gh-pages` branch. Cloudflare Workers and D1 provide private online feedback storage at the `apiBase` in `public/config.json`. Browser drafts and downloaded backups remain available. Files can also be opened in `owner.html`.

Online saving uses the Cloudflare Worker and D1 database below; each reviewer uses a unique private review link rather than their name as a credential. Review records are isolated by a 256-bit token and updates use revision checks so a stale tab cannot silently replace a newer saved review. The private owner link lists all reviews. No third-party reviewer accounts are needed.

Reviewers can edit their own messages or unsend them, with an immediate Undo option. Unsent messages are removed from the saved review and the admin inbox after a successful save. This cannot retract a comment the owner already read or exported. Admin feedback is grouped by reviewer and activity; rankings and verdicts remain available in an expandable section. No reviewer token can list all reviews or access another record.

The invitation, reviewer return links, and admin link serve different purposes. Share only the invitation with new consultants. Each consultant should bookmark their own return link to reopen their full record on another device. Keep the admin link private; possession of a private link grants its access. Names are display labels, not passwords. New visitors do not receive a prefilled QA name.

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

No Cloudflare billing upgrade is required. Local drafts and downloaded review files remain available if the free backend limit is reached. Existing Claude reviewer data has not been automatically migrated; the prior audit found only synthetic QA records. The Claude artifact remains unchanged.

Each entry has a Section dropdown below its rank arrows. Placement suggestions apply to both ranking views, with independent ordering in each. Comments and verdicts stay attached to the entry; the admin inbox lists suggested moves. Original application data and other reviewers are unaffected.
