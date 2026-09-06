param(
  [ValidateSet('Prepare','Deploy','Scheduler')][string]$Stage = 'Prepare',
  [switch]$Apply,
  [string]$Project = 'fifa-502907',
  [string]$Region = 'asia-southeast1',
  [string]$Database = 'ai-studio-a28db4f0-2851-4cf7-9493-a6170f5d46a4'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Runtime = "daynote-runtime@$Project.iam.gserviceaccount.com"
$Scheduler = "daynote-scheduler@$Project.iam.gserviceaccount.com"
$Bucket = "$Project-daynote-media"
$Secret = 'daynote-gemini'
if (-not $Apply) {
  Write-Output "Plan only: $Stage in project $Project, region $Region."
  Write-Output "Prepare: enable APIs, create private bucket $Bucket, empty secret $Secret, runtime/scheduler service accounts and their scoped access."
  Write-Output "Deploy: require an enabled secret version, publish Cloud Run daynote, and deploy deny-all client rules to database $Database."
  Write-Output 'Scheduler: configure the deployed service and create/update an hourly OIDC recap job.'
  Write-Output 'Read docs/CLOUD-SETUP.md. Use -Apply only for the stage you intend to execute.'
  exit 0
}
function Invoke-Cloud([string[]]$CommandArgs) {
  & gcloud @CommandArgs
  if ($LASTEXITCODE -ne 0) { throw "Google Cloud command failed: $($CommandArgs[0..1] -join ' ')" }
}
function Read-Cloud([string[]]$CommandArgs) {
  $result = & gcloud @CommandArgs 2>$null
  if ($LASTEXITCODE -eq 0) { return ($result -join "`n").Trim() }
  return ''
}
Push-Location (Join-Path $PSScriptRoot '..')
try {
  if ($Stage -eq 'Prepare') {
    Invoke-Cloud @('services','enable','run.googleapis.com','cloudbuild.googleapis.com','artifactregistry.googleapis.com','secretmanager.googleapis.com','cloudscheduler.googleapis.com','firestore.googleapis.com','identitytoolkit.googleapis.com','storage.googleapis.com',"--project=$Project",'--quiet')
    foreach ($identity in @('daynote-runtime','daynote-scheduler')) {
      $email = "$identity@$Project.iam.gserviceaccount.com"
      if (-not (Read-Cloud @('iam','service-accounts','describe',$email,"--project=$Project",'--format=value(email)'))) {
        Invoke-Cloud @('iam','service-accounts','create',$identity,"--project=$Project","--display-name=$identity",'--quiet')
      }
    }
    if (-not (Read-Cloud @('storage','buckets','describe',"gs://$Bucket",'--format=value(name)'))) {
      Invoke-Cloud @('storage','buckets','create',"gs://$Bucket","--project=$Project","--location=$Region",'--uniform-bucket-level-access','--public-access-prevention','--quiet')
    }
    if (-not (Read-Cloud @('secrets','describe',$Secret,"--project=$Project",'--format=value(name)'))) {
      Invoke-Cloud @('secrets','create',$Secret,"--project=$Project",'--replication-policy=automatic','--quiet')
    }
    foreach ($role in @('roles/datastore.user','roles/firebaseauth.viewer')) {
      Invoke-Cloud @('projects','add-iam-policy-binding',$Project,"--member=serviceAccount:$Runtime","--role=$role",'--condition=None','--quiet','--format=none')
    }
    Invoke-Cloud @('storage','buckets','add-iam-policy-binding',"gs://$Bucket","--member=serviceAccount:$Runtime",'--role=roles/storage.objectUser','--quiet','--format=none')
    Invoke-Cloud @('secrets','add-iam-policy-binding',$Secret,"--project=$Project","--member=serviceAccount:$Runtime",'--role=roles/secretmanager.secretAccessor','--quiet','--format=none')
    Write-Output 'Add a Gemini key as an enabled Secret Manager version through the Cloud Console. No key value is accepted or printed by this script.'
  }
  if ($Stage -eq 'Deploy') {
    $version = Read-Cloud @('secrets','versions','list',$Secret,"--project=$Project",'--filter=state:ENABLED','--limit=1','--format=value(name)')
    if (-not $version) { throw 'No enabled secret version was found. Add it through Secret Manager first.' }
    $configuredDatabase = (Get-Content firebase.json -Raw | ConvertFrom-Json).firestore[0].database
    if ($configuredDatabase -ne $Database) { throw 'Database does not match firebase.json. Review the deployment target before continuing.' }
    $envVars = "FIREBASE_PROJECT_ID=$Project,FIREBASE_DATABASE_ID=$Database,STORAGE_BUCKET=$Bucket,GEMINI_SECRET_VERSION=projects/$Project/secrets/$Secret/versions/latest,GEMINI_MODEL=gemini-3.8-flash"
    Invoke-Cloud @('run','deploy','daynote','--source=.',"--project=$Project","--region=$Region","--service-account=$Runtime",'--allow-unauthenticated','--memory=1Gi','--cpu=1','--concurrency=8','--max-instances=2','--min-instances=0','--timeout=1800',"--set-env-vars=$envVars",'--quiet')
    & npx --yes firebase-tools@15.29.0 deploy --only firestore --project $Project --non-interactive
    if ($LASTEXITCODE -ne 0) { throw 'Firebase rule deployment failed; do not mark release verification complete.' }
    Write-Output 'Add the Cloud Run hostname to Firebase Authentication Authorized domains and complete the two-account checklist.'
  }
  if ($Stage -eq 'Scheduler') {
    $url = Read-Cloud @('run','services','describe','daynote',"--project=$Project","--region=$Region",'--format=value(status.url)')
    if (-not $url) { throw 'Deploy the Daynote service first.' }
    $target = "$url/api/jobs/recaps"
    Invoke-Cloud @('run','services','update','daynote',"--project=$Project","--region=$Region","--update-env-vars=SCHEDULER_AUDIENCE=$target,SCHEDULER_SERVICE_ACCOUNT=$Scheduler",'--quiet')
    $existing = Read-Cloud @('scheduler','jobs','describe','daynote-recaps',"--project=$Project","--location=$Region",'--format=value(name)')
    $operation = if ($existing) {'update'} else {'create'}
    Invoke-Cloud @('scheduler','jobs',$operation,'http','daynote-recaps',"--project=$Project","--location=$Region",'--schedule=17 * * * *','--time-zone=UTC',"--uri=$target",'--http-method=POST',"--oidc-service-account-email=$Scheduler","--oidc-token-audience=$target",'--attempt-deadline=1800s','--max-retry-attempts=2','--min-backoff=300s','--quiet')
    Write-Output 'Scheduler configured. Use opted-in synthetic accounts to verify job execution before declaring automatic recaps live.'
  }
} finally { Pop-Location }
