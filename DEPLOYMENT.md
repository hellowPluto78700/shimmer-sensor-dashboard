# Clone frontend deployment

Frontend baseline: `f772695fd0e34d5b1887a5e9b12c7e87f6f0ed76`.
Deployment branch: `deploy/aws-clone`. Validated 2026-10-06 in AWS account
`837873138796`, region `us-east-2`, using the existing `shimmer-admin` SSO profile.
No AWS credentials or account settings were changed. Android was not modified.

## Deployed resources

| Resource | Value |
| --- | --- |
| CloudFormation stack | `shimmer-dashboard-clone`, `CREATE_COMPLETE` |
| Amplify app name | `shimmer-dashboard-clone` |
| Amplify app ID | `djm6m1z6lh719` |
| Hosting branch | `clone` (manual deployments, auto-build disabled) |
| Frontend URL | https://clone.djm6m1z6lh719.amplifyapp.com |
| Amplify deployment | Job `1`, `SUCCEED`; DEPLOY and VERIFY succeeded |
| Cognito user pool | `us-east-2_dEitkPuXm` |
| Public app client | `68vcb5796gfvqqcebk6lh7qkj0` (no secret) |
| Cognito identity pool | `us-east-2:d32de17e-0a32-4084-a7ef-7379860326cf` |
| Backend API | https://wwr1eh4vg9.execute-api.us-east-2.amazonaws.com |

Resource IDs are public configuration, not credentials. AWS resource ARNs and
ownership were verified against the new account. The separate backend stack
and its code/configuration were not changed in this iteration; validation
reused its existing clone-only fixture and reran one already-tested aggregation
date. Parent repository deployment pins include the completed backend commit
`075185f45fdccadd854113303601acfdff0986a0`, as explicitly requested by the user.

## Migration scope and old values

The exhaustive frontend search found four old API call sites: the base URL and
decode URL in `src/app/services/api.service.ts`, and direct download/ZIP URLs in
`src/app/comp/files-grid/files-grid.ts`. All four now use the new API without
changing endpoint paths, requests, response handling, charts, UI or routing.
Runtime source and production bundles contain no old API hostname.

`amplify/team-provider-info.json` previously pointed to account `070563319319`,
Amplify app `dlsx7mndat10j`, its deployment bucket, IAM role names/ARNs and
CloudFormation stack name/ARN. Its obsolete environment is cleared (`{}`), so
it cannot direct a clone deployment to those resources. No old pool/client IDs
were recoverable: the generated `src/amplifyconfiguration.json` was absent.
The nested `shimmer-amplify/` files are empty/inactive scaffolding and contain
no old API/resource references.

Committed Gen1 `amplify/backend/auth/.../cli-inputs.json`, backend config and
project config remain as source evidence. Their logical names are NOT reused
as physical resources or connected to the old account. `deployment/template.yaml`
recreates the equivalent auth and hosting resources independently; do not run
`amplifyPush`/`amplify push` against obsolete Gen1 deployment state.

`amplify.yml` retains the Node version, locked dependency install, output
directory and caching structure. The old `amplifyPush` step is replaced by
source-defined infrastructure and public config generation; the build uses the
locked local Angular CLI through `npm run build`, not a global unpinned CLI.
`scripts/configure-auth.mjs` generates the same imported config filename from
new stack outputs or the stack's public Amplify build environment variables.
Missing or wrong-region IDs fail; no old-resource fallback exists. Generated
config remains ignored. No secrets, credentials, build outputs or caches are
committed.

## Preserved authentication

Source evidence specifies username/password sign-in, case-insensitive usernames,
required and automatically verified email, email confirmation codes, MFA OFF,
password minimum length 8 with no character-class requirements, no social
providers or configured groups, no SPA client secret, and a 30-day refresh token.
These settings were verified directly on the new resources. SRP and refresh
flows support the existing Amplify v6 Authenticator; no Hosted UI/OAuth domain
is needed by this application.

The identity pool remains authenticated-only. Its new IAM role trust is scoped
to this pool and the authenticated claim. It deliberately has no S3/DynamoDB
permissions: browser data operations use the existing HTTP API and presigned
URLs. No old users/passwords or AWS policies were migrated. The existing
client-side admin-email UI check remains unchanged; this deployment does not
create or confer an administrator identity. Existing API authorization behavior
also remains unchanged; frontend login is not a new API authorization boundary.

Relaxed password/MFA settings are intentional compatibility exceptions, not a
security modernization. User/identity pools are retained on deletion/replacement.
The IAM skill guided identity-pool-specific trust scoping; CloudFormation skill
guided source-defined resources, validation and retention safety.

## Reproduce deployment

Prerequisites: existing authorized SSO profile, AWS CLI, SAM CLI for template
linting, Node >=20.19 compatible with Angular 20, npm and `zip`.

```bash
aws sts get-caller-identity --profile shimmer-admin --region us-east-2
aws configure get region --profile shimmer-admin
sam validate --lint --template-file deployment/template.yaml --region us-east-2
aws cloudformation deploy --template-file deployment/template.yaml --stack-name shimmer-dashboard-clone --capabilities CAPABILITY_IAM --profile shimmer-admin --region us-east-2 --no-fail-on-empty-changeset
npm ci
node scripts/configure-auth.mjs
npm run build
node scripts/deploy-hosting.mjs
```

Confirm account `837873138796` and region `us-east-2` before AWS mutation.
The hosting script independently verifies ownership, resolves the app from stack
outputs, ZIPs only `dist/shimmer-server-ui/browser/` contents with `index.html`
at the archive root, uploads via a presigned URL kept in memory, starts a manual
deployment on `clone`, and waits for a successful job. ZIPs are generated in
unique `/tmp` directories. It never needs a GitHub token or prints signed URLs.

Manual static hosting is an [official Amplify deployment path](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html).
There is no repository-connected CI/CD yet; connecting GitHub later is optional,
not required to run this deployed clone. Builds happen locally, not in Amplify;
therefore there are deployment/verification logs, not an Amplify compilation log.

## Validation results

| Check | Result / evidence |
| --- | --- |
| `npm ci` | PASS: 903 locked packages installed; lockfile unchanged |
| Initial build | Failed solely because generated auth config was absent |
| Build after real config generation | PASS: production output, initial bundle 3.30 MB |
| Template lint | PASS through `sam validate --lint` / cfn-lint |
| CloudFormation deployment validation | No validation errors; stack CREATE_COMPLETE |
| Live page and `/login` deep link | PASS: HTTP 200, Angular bootstrap and Authenticator render |
| Signup form | PASS: required email and password confirmation render; no user created |
| Unauthenticated `/dashboard` | PASS: redirects to `/login` |
| Browser-origin file metadata | PASS: HTTP 200, 3 rows, no error field |
| Browser-origin combined metadata | PASS: HTTP 200, 4 rows, no error field |
| Existing device/patient mapping read | PASS: HTTP 200 for `CLONE_TEST_DEVICE` |
| Decoded chart retrieval | PASS: timestampCal, Accel_WR_Absolute, uwbDis each 30,240 values |
| Raw/decoded download URL endpoints | PASS: HTTP 200, new-bucket URLs |
| Presigned raw download | PASS: HTTP 200, 998,176 bytes from new bucket |
| Combined listing and JSON | PASS: HTTP 200, nonempty listing and combined content |
| Combined chart retrieval | PASS: 605 downsampled values |
| Daily aggregation from frontend origin | PASS: POST for existing clone test date `2010-10-03`, HTTP 200 |
| Browser CORS / routing | PASS: real browser fetches from deployed frontend origin, no CORS failures |
| Old-server requests | Zero observed; old-host requests would have been blocked during tests |
| Browser uncaught errors | Zero observed |
| Amplify logs | DEPLOY log inspected, no errors; DEPLOY/VERIFY SUCCEED |
| Recent backend CloudWatch logs | 98 events inspected, no runtime/IAM/schema/storage errors |

Browser testing used isolated Playwright/Chromium in `/tmp` with already-present
shared libraries, not additional application dependencies or system changes.
Screenshots confirmed the existing login UI. Authenticated UI/chart rendering,
successful sign-in/sign-out, email delivery/confirmation, identity credential
exchange and mapping edits are **pending**, because the user explicitly selected
validation without a signed-in user. Direct browser-origin data requests do not
prove authenticated dashboard interaction. No fake sessions or credentials were
used to bypass this gate. To complete it, open the frontend URL, Create Account,
verify your email and sign in, then exercise dashboard/chart/mapping controls.

## Known limits and remaining work

- Existing build warnings: initial bundle exceeds the 3 MB warning threshold
  (but is below the unchanged 4 MB error threshold), plus upstream CommonJS
  dependencies. No UI/dependency/budget redesign was performed.
- Optional hide/unhide/admin-comment UI calls `PATCH /decoded-files/metadata/`,
  which is absent from this backend's OpenAPI. This is a pre-existing frontend
  handoff feature gap, not an URL/Cognito migration defect; it was not implemented
  or bypassed. That feature needs a separately authorized backend contract update.
- cfn-guard formal compliance was explicitly skipped by user instruction.
  Template lint, manual security review and service deployment checks are not a
  formal compliance certification. No CloudTrail trail is configured in this
  account; event history is not durable audit retention. Audit setup was not altered.
- Next phase: Android URL migration, APK/device testing, then full
  phone-to-dashboard end-to-end validation. Signed-in frontend acceptance remains
  a manual gate as described above.
