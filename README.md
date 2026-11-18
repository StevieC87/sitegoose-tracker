# SiteGoose tracker

The script SiteGoose customers put on their pages, as source and as every released version.

- `src/`: the source as it is edited. `track.js` is the entry point; it loads the others only for features a site has turned on.
- `releases/v<version>/`: the files served at `https://t.sitegoose.com/v<version>/<file>`, byte for byte. A released folder is never changed; a fix is a new version.
- `releases.json`: every version with the SHA-384 hash the install code pins `track.js` with.
- `docs/tracker-integrity.md`: how the hash in the install code and the hashes inside `track.js` keep a changed file from running.

## Check what your site loads

The install code carries `integrity="sha384-…"`. To see that the file served is this one:

```sh
curl -s https://t.sitegoose.com/v1.0.94/track.js | openssl dgst -sha384 -binary | openssl base64 -A
```

Compare with the hash for that version in `releases.json`, and with `releases/v1.0.94/track.js` here.

## Reporting a problem

See https://sitegoose.com/security. Latest release: v1.0.94.
