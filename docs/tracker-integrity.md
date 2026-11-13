# Tracker file integrity

The install snippet pins `track.js` with a SHA-384 integrity hash, and `track.js`
then loads up to 12 more files by dynamic `import()`. Those files were covered
by nothing. They are not peripheral: `snapshot.js` serializes the DOM,
`leadform.js` renders forms and submits them, `shield.js` guards submissions,
`replay.js` records sessions. Arbitrary code in any of them is full control of
the customer's page, which is what the snippet's hash was supposed to prevent.

Pinning the entry point while it loads unpinned code from the same origin means
an attacker who reaches the origin still wins, which is why a pinned install
now refuses a file that doesn't match (below).

Two facts make this closable rather than structural. `trackerFile()` resolves
siblings to `../v<release>/<file>`, so even an auto-updating `/v1/track.js`
loads from its own frozen folder — a hash baked into a given `track.js` stays
valid for that file's whole life. And on a pinned install `track.js` is itself
pinned, so anything it asserts is as trustworthy as it is.

So the release writes each sibling's SHA-384 into `track.js`, and then hashes
`track.js`. On a pinned install the snippet vouches for `track.js`, and
`track.js` vouches for the rest.

An auto-updating install (`/v1/track.js`) carries no hash, so nothing in the
browser vouches for `track.js` there: whoever controls the server can change it
and the hashes inside it together, and no report is sent. That is covered from
outside instead (below).

## Pinned installs block; the rest report

On a **pinned install** a file that doesn't match is refused: its feature (the
survey, replay, the lead form…) doesn't run, and the mismatch is reported.
Tracking itself still runs, since `track.js` was checked by the browser.
"Pinned" means the tag carries an `integrity` attribute (`current.integrity`),
not that the URL names a version: that attribute is what makes the hashes
inside `track.js` trustworthy.

`import()` cannot carry an integrity attribute, so `loadModule()` first has the
browser fetch the file against its hash, without running it:
`<link rel="modulepreload" integrity crossorigin>`, or `<script type="module"
integrity>` where modulepreload isn't supported (Safari before 17). The browser
keeps the checked module, or the failure, under the file's address, and the
`import()` that follows uses it rather than fetching again. modulepreload comes
first because a link's `href` isn't a Trusted Types sink while a script's `src`
is, so a site enforcing Trusted Types keeps working. No blob URLs, so no
customer CSP needs `blob:`.

`replay.js` imports `snapshot.js` and `picker.js` imports `editor.js`
themselves (`MODULE_IMPORTS`). On a pinned install each of those is checked
before the file that imports it, so the browser's own import finds the checked
copy. A changed `snapshot.js` refuses replay as well.

Everywhere else a mismatch is only reported and the module still runs:

- An auto-updating install (`/v1/track.js`) carries no hash, so whoever changed
  a file could change `track.js` and the hashes inside it together. Blocking
  there would stop no one.
- A mismatch has innocent causes: a corporate proxy that rewrites JavaScript in
  transit, or a customer serving the tracker through their own CDN. On a pinned
  install those already break `track.js` itself, far harder (nothing works), so
  refusing its other files adds no new way to fail; on the other installs it
  would.

The report runs alongside the load either way, because a refused load alone
can't tell a changed file from a dropped connection.

## The WordPress plugin follows a signed file

**Not set up yet (2026-11-13).** No key has been made: `tracker-release-keys.json`
is `[]` and the plugin's `SITE_ANALYTICS_RELEASE_KEYS` is empty. So
`release:tracker` asks for no key and releases unsigned, no
`public/tracker-release.json` exists, the pre-push hook doesn't check for one,
and a plugin stays on the version it was built with until it is rebuilt.
Everything below describes how it works once `npm run tracker:keygen` has been
run. The SRI hashes above don't depend on it and work today.

Pasted code is pinned by its hash; the WordPress plugin has to move to new
releases on its own, and used to do it by loading `/v1/s.js`, unpinned, on
every site that ran it. Its tag now always names one version with its hash
(`sdk/wordpress-plugin/site-analytics/release.php`), so it is a pinned install
like any other. Which version: the one built into the plugin, until it reads a
newer one from `/tracker-release.json` on the collector, once a day and on
Save.

The plugin believes that file only when it is signed (Ed25519) by a key it
lists, and only when its `seq` is above the last one it took, so an old file
served again can't move sites back. The private key is never on a server: it
is one line (`sgk1-…`) kept in the password manager, so a release can be made
from any computer that has it. `scripts/trackerSigning.mjs` has the format.

- `npm run tracker:keygen`, once: prints the key, writes the public half to
  `tracker-release-keys.json` and the plugin, and signs the current release.
  Rebuild and update the plugin afterwards: plugins built before it list no
  key and stay on their built-in version.
- `npm run release:tracker` asks for the key first (or reads
  `TRACKER_SIGNING_KEY`, or `~/.config/sitegoose/tracker-signing.key`, which
  should be `chmod 600`) and refuses to release with a key that isn't listed.
  It also writes the new version into the plugin as its starting point.
- After marking a release `"withdrawn": true` in `releases.json`:
  `npm run sign:tracker`. Plugins go back to the release before it, because
  the newer `seq` says so.
- The pre-push hook refuses a push whose signed file is missing or names
  another release than `releases.json`'s newest.

A server that is no longer ours can, at most, withhold the file or serve an
old one, and plugins keep the release they have. A leaked key is undone with
`tracker:keygen -- --replace` and a plugin update; a lost one needs the same,
so keep the key in two places.

## The release order is load-bearing

`scripts/release-tracker.js` runs: copy, patch the version into `track.js`,
minify the other 12 files, hash those files, write the hashes into `track.js`,
minify `track.js`, then hash `track.js` for the snippet.

Two passes, because `track.js` carries the others' hashes, and hashing after
minifying so each hash covers the bytes the browser is served. Both injections
replace a literal line (`const TRACKER_RELEASE = "dev";` and
`const MODULE_INTEGRITY = null;`), which minifying would rewrite — so both must
happen while `track.js` is still readable. Each has a guard that aborts the
release and removes the half-made folder if its line is missing.

`TRACKER_MINIFY=0` still injects hashes, of the unminified bytes.

## Not crying wolf

- The tracker reports a file once per browser session, from `sessionStorage`, so
  a rewriting proxy cannot flood.
- A failed or partial download, a browser with no `crypto.subtle` (so any plain
  HTTP page), and a release with no hashes at all (development) are all silent.
  A download that does not arrive is not tampering.
- The collector aggregates into `site_page_changes` with `kind: "module"`, the
  file name in the `host` field, reusing the page-tampering counter.
- The dashboard and the alert both require `MODULE_MIN_REPORTS` (3) reports
  before showing anything, so one visitor behind a rewriting proxy never
  surfaces. This counts reports, not distinct visitors — three page views from
  one person would reach it, which is why the UI states the innocent causes
  rather than calling it an attack.
- An owner can mark a file expected (`module:<file>` in `security.expected`),
  which stops a proxy of their own alerting forever.

## Watched from outside

`pinging/trackerWatch.js`, on the checks box, fetches `/v1/track.js`, `/v1/s.js`
and the files they load every five minutes, as a browser would, and compares
their SHA-384 with a list on that box. The list is sent from the release machine
(`npm run push:tracker-hashes`, after a release and before deploying it), never
from the main server, so a server that is no longer ours can't vouch for itself.
Each lap also checks one older release folder whole, so the files pinned installs
load are covered too. A mismatch on two fetches 15 s apart sends an alert
straight from that box, without the backend; so does track.js being unfetchable
for 15 minutes. Setup: `pinging/README.md`.

With the switch set up, it also takes changed files away from visitors on its
own: the tracker's address goes from grey to orange in Cloudflare, and
Cloudflare answers the tracker files from a verified copy (`standby/`,
deployed from the release machine) while visits still reach the main server.
When it does that, and how to do it or undo it by hand: `pinging/README.md`,
"The switch".

Its blind spot: the main server's settings list the checks box's address, so a
server that is no longer ours can serve that address alone a clean copy.

## Where it lives

| Piece | File |
| --- | --- |
| Hashes, verification, `loadModule()` | `tracker/track.js` |
| Hash injection, two-pass minify | `scripts/release-tracker.js` |
| Accepting the report | `Analytics/collectAnalytics.js` |
| Counting it | `Analytics/securityCounts.js` (`notePageChange`) |
| Reading, threshold, acknowledging | `backend/Sections/CustomerDash/security/security.js` |
| Alerting | `backend/Sections/CustomerDash/security/securityAlerts.js` |
| Showing it | `frontend/src/features/security/Tampering.jsx` |
| Watching from outside | `pinging/trackerWatch.js`, `scripts/push-tracker-hashes.mjs` |

`test/trackerModules.test.js` slices the verification out of the real
`track.js` and runs it in a vm: it pins the silence cases, which are the ones
worth protecting.
