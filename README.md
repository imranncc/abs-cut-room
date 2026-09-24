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

## Essay workspace — published September 24, 2026

The uncommitted essay workspace adds 12 stable essay IDs: seven TMU responses (three supplementary, regional reflection, and three exceptional-circumstances fields) and five NOSM form responses. Ottawa's former biochemistry justification letter is excluded. The original 32 ABS entries and encrypted sketch are unchanged.

Original responses, initial refined drafts, field limits, sources and review flags are encrypted in `public/essays.enc.json` using the existing invitation key. Plaintext authoring files stay in ignored `private/`. Repack from this directory with `ABS_SECRETS_FILE=/absolute/private/key/file node scripts/pack-essays.mjs`. This command only encrypts local content; it does not publish. It checks IDs and draft limits before writing.

ABS and essays share `comments.js` (create/edit/unsend/undo). Essay suggestions have the relevant character/word counter; ordinary comments do not pretend to be application responses. Each review stores `essayDrafts` alongside its ABS rankings and stable-ID threads. Edits are per reviewer, not changes to the canonical draft. Owner exports/inbox can display essay labels and drafts. No database migration is required.

On localhost, loopback IPv4 or IPv6, storage disables the live API even when production `config.json` is present. Local reviews are separated by normalized name and persist after signing out. They remain in that browser and are not automatically uploaded later. The owner preview also cannot connect to the live inbox. No live reviewer records were used in tests.

Requirements were checked directly in the logged-in **2027-entry OUAC portal** and the official school guides on September 23, 2026. TMU requires 1,700 characters for each main essay and regional reflection; exceptional circumstances is now three 1,300-character fields, plus a conditional 650-character no-document explanation. NOSM's current portal still links to the E2026-named form. Its printed 50/50/100/100/100-word approximate guidance coexists with fillable-field character caps of 250/250/500/500/500. The application was not saved or submitted. Detailed research and factual reconciliation notes are in `private/Essay requirements and review notes - 2026-09-23.md`.

The later research pass inspected those PDF caps directly and corrected the local counter to show both constraints. Four NOSM seed drafts exceed the character caps; their wording is preserved for criticism rather than silently shortened. The default pack command rejects over-limit text. Use the explicit `--review-drafts` flag only to preserve unfinished drafts in this review workspace; it logs each over-limit ID. Approximate word guidance is labelled separately from hard character caps. TMU's published applicant-authorship requirement is recorded in the school notes; these AI first-pass responses are comparison material, not final applicant-authored responses.

The earlier deployment hold was superseded by the September 24 request to add all drafts to the site. This publishes a private review workspace; it does not submit anything to OMSAS. Version-specific comments and older-client protection preserve existing reviews.


### September 24 essay publication

User authorized publishing all saved drafts. The encrypted source now holds 12 responses with eight saved versions each (the initial site seed plus V1–V7), alongside last year’s originals. V7 is the default. Published versions are immutable in the UI; each reviewer can keep a separate working draft. Version comment keys use `essay-id--version`; the original essay ID retains earlier general feedback and working-draft comments. No reviewer data migration or reset is performed.

The Worker rejects a pre-essay client save with HTTP 409 when it would discard existing essay work. Refresh that older tab to use the updated client. Historical drafts may exceed current limits or contain superseded facts; only the latest responses must pass the packer’s hard limits.


### Review cleanup and invitation recovery

The public review interface omits internal drafting notes, section commentary, revision explanations, and promotional headings. Application text and existing reviewer data are unchanged. Always share the full private invitation, including its `#key=` fragment: the base URL alone cannot unlock a fresh browser. Optional `name` in the fragment prefills the name field without auto-opening a review.

Missing or invalid access now displays beside the name field, with a full-invitation input. Open-review is no longer left disabled after a loading failure. Network requests time out after 15 seconds, and configuration loading can retry. Invalid pasted invitations never replace saved valid access. Tests cover fresh-browser recovery, returning review preservation, unavailable local storage, and connection failures.
