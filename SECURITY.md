# Credentials and secret handling

## Public Firebase configuration

`firebase-applet-config.json` contains the Firebase web app configuration. Its
`apiKey` identifies the Firebase project; it is not the server's Gemini credential.
Firebase web configuration must be available to the browser, so removing it from
Git does not make the running application's configuration secret.

Firebase data access must be protected by authentication, Firestore rules and
backend authorization. Never add `generativelanguage.googleapis.com` to the
public Firebase browser key's API allowlist. Use a separate restricted key for
Gemini. Do not replace the Firebase configuration's key with a Gemini key.

See [Firebase's API-key guidance](https://firebase.google.com/docs/projects/api-keys).

## Private credentials

- `GEMINI_API_KEY` is read only by `server/geminiService.ts` from the server
  environment. In production, supply it through a Google Cloud Secret Manager
  binding to the runtime.
- Never put private credentials in variables prefixed with `VITE_`, client source,
  frontend build replacements, committed environment files, URLs or logs.
- Keep `.env.example` limited to empty values or obvious placeholders.
- Prefer runtime identity/Application Default Credentials for Firebase Admin.
  Do not commit service-account JSON, OAuth client secrets or private-key files.
- GitHub secret scanning and push protection are enabled. Do not bypass a warning
  for a private key. The ignore rules are an additional guard, not a secret scan.

## Repository credential review: 2026-09-06

The available repository history contained two commits on `main`, with no tags,
other branches or pull-request heads observed at review time. Pattern scans of
the tracked contents in both commits found one Google API key, in the Firebase
web configuration, and no matching Gemini/private-key/GitHub-token/OAuth-secret
patterns. `.env.example` contains empty credential values.

An authenticated Google Cloud comparison confirmed that the published value
matches `Browser key (auto created by Firebase)`. Its API restriction allowlist
does not include the Gemini Developer API. A separate Gemini-only key exists in
the Cloud project. The Gemini service uses a server environment variable; the
review did not retrieve or rotate that separate secret.

The GitHub Google API Key alert points to this public Firebase configuration.
This finding is a public Firebase credential, not evidence of a leaked Gemini
secret. The review is limited to the repository history and key configuration;
it is not an audit of external deployment artifacts, usage/billing or the entire
application's security.

## If a private credential is exposed later

Revoke or rotate it at its provider immediately, update its authorized consumers,
and review provider usage. Removing a value from the latest commit does not
remove old commits or invalidate a credential. Assess history cleanup and hosted
artifacts separately, and never copy the credential into an issue or chat.
