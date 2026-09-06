# Connect the real Google services

## Read-only status checked September 6, 2026

- Project: fifa-502907; billing is enabled.
- The existing named Firestore database exists in asia-southeast1:
  ai-studio-a28db4f0-2851-4cf7-9493-a6170f5d46a4.
- Private media bucket `fifa-502907-daynote-media` now exists in `asia-southeast1`.
- Secret Manager is enabled and `daynote-gemini` now exists with automatic replication, but it has no versions yet.
- No Gemini secret value was read, created or copied during this rebuild.
- Runtime IAM, Google sign-in domains and scheduled execution still require live verification.

## Prepare and review

The script infra/deploy.ps1 is an explicit staged deployment plan. Without -Apply it only prints the proposed stage. It was syntax-checked, not executed against the project.

```powershell
./infra/deploy.ps1 -Stage Prepare
./infra/deploy.ps1 -Stage Prepare -Apply
```

Prepare enables the required APIs, creates separate runtime and scheduler identities, a private Cloud Storage bucket named fifa-502907-daynote-media in asia-southeast1, and an empty Secret Manager secret daynote-gemini. It grants the runtime identity Firestore access, Firebase Auth read access for revocation checks, object access on that bucket, and secret access on that single secret.

Review project IAM before applying. The example datastore.user role is project scoped; for a larger shared project, use a dedicated project or a database-scoped IAM condition reviewed for the Firestore API operations you use.

**Add the Gemini key as a new version using Google Cloud Secret Manager's console.** Never paste the value into this repository, an AI Studio prompt, a public issue, a frontend variable, or terminal history. The app accepts only the Secret Manager resource name. A version must exist before deployment. Restrict the Gemini key to the Generative Language API. Keep the Firebase browser key separate.

## Publish

```powershell
./infra/deploy.ps1 -Stage Deploy
./infra/deploy.ps1 -Stage Deploy -Apply
```

Deploy builds the Docker image via Cloud Run source deployment, uses the runtime service account, and limits initial scaling. Public access is for the web shell; every journal endpoint verifies a Firebase token. It publishes this repository's deny-all client rules **only to the named database**, because all journal reads/writes now go through the authenticated server.

This changes the access pattern of the old AI Studio frontend sharing that named database: its direct Firestore calls will stop working. Move users to the rebuilt app and retain the old code for rollback. Other Firestore databases are not targeted.

The deployer's account and build service account need the standard Cloud Run source-deployment permissions. If a deployment reports an IAM error, follow Google's specific missing-role guidance; do not grant Owner as a workaround.

In Firebase Authentication:
1. Enable Google as a sign-in provider if necessary.
2. Add the deployed Cloud Run hostname to Authorized domains.
3. Add localhost only for local development if needed.
4. Confirm the public Firebase browser key is restricted to the Firebase APIs it needs.

Then perform the two-account verification checklist before using real journal content.

## Enable automatic recaps

```powershell
./infra/deploy.ps1 -Stage Scheduler
./infra/deploy.ps1 -Stage Scheduler -Apply
```

The scheduler uses OIDC, an exact audience and a dedicated verified service-account email. An hourly job picks up to ten accounts, oldest checkpoint first. A user's configured time zone determines completed months and years. Failed accounts receive a checkpoint too, so they cannot indefinitely prevent other accounts being processed. The app returns a non-success status for failed work so monitoring can detect it.

The Settings switch is consent for processing; cloud scheduler provisioning is a separate infrastructure requirement. A switch alone is not evidence that a scheduled job exists.

## Local authenticated development

```sh
gcloud auth application-default login
```

Use developer credentials with least-privilege access to the project. Copy .env.example to an ignored .env and set STORAGE_BUCKET to the prepared bucket. GEMINI_SECRET_VERSION is a resource name, not a key. Do not download a service-account JSON key.

## Verify cloud behavior

Complete VERIFICATION.md with disposable accounts and synthetic memories. Include successful Secret Manager access in an audit log screenshot **without secret payloads**. Record the real Cloud Run URL, runtime identity, deployed rules, two-account isolation results and Cloud Scheduler job execution. Configure Cloud Monitoring alerts and an appropriate billing budget before broad public use.

Official references:
- [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase Admin Cloud Storage](https://firebase.google.com/docs/storage/admin/start)
- [Secret Manager access](https://docs.cloud.google.com/secret-manager/docs/access-secret-version)
- [Cloud Run source deployment](https://docs.cloud.google.com/run/docs/deploying-source-code)
- [Cloud Scheduler OIDC authentication](https://docs.cloud.google.com/scheduler/docs/http-target-auth)
- [Deploying Firebase rules](https://firebase.google.com/docs/rules/manage-deploy)
