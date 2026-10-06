// Manual Amplify deployment from the existing Angular build; no GitHub token needed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const profile = process.env.AWS_PROFILE || 'shimmer-admin';
const region = 'us-east-2';
const aws = (...args) => JSON.parse(execFileSync('aws', [...args,
  '--profile', profile, '--region', region, '--output', 'json'], { encoding: 'utf8' }));
if (aws('sts', 'get-caller-identity').Account !== '837873138796') {
  throw new Error('Refusing deployment in a different AWS account');
}
const stack = aws('cloudformation', 'describe-stacks', '--stack-name',
  'shimmer-dashboard-clone').Stacks[0];
if (!['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(stack.StackStatus)) {
  throw new Error('Frontend infrastructure is not ready');
}
const outputs = Object.fromEntries(stack.Outputs.map(i => [i.OutputKey, i.OutputValue]));
const app = aws('amplify', 'get-app', '--app-id', outputs.AmplifyAppId).app;
if (!app.appArn.startsWith('arn:aws:amplify:us-east-2:837873138796:')) {
  throw new Error('Unexpected Amplify app ownership');
}
const build = new URL('../dist/shimmer-server-ui/browser/', import.meta.url);
if (!existsSync(new URL('index.html', build))) throw new Error('Run npm run build first');
const temp = mkdtempSync(join(tmpdir(), 'shimmer-dashboard-deploy-'));
const archive = join(temp, 'frontend.zip');
execFileSync('zip', ['-qr', archive, '.'], { cwd: build });
const deployment = aws('amplify', 'create-deployment', '--app-id', app.appId,
  '--branch-name', 'clone');
// Keep the presigned upload URL in memory; do not log it or commit it.
const upload = await fetch(deployment.zipUploadUrl, {
  method: 'PUT', body: readFileSync(archive), headers: { 'Content-Type': 'application/zip' }
});
if (!upload.ok) throw new Error('Artifact upload failed: HTTP ' + upload.status);
aws('amplify', 'start-deployment', '--app-id', app.appId, '--branch-name', 'clone',
  '--job-id', deployment.jobId);
console.log('Deploying app ' + app.appId + ', branch clone, job ' + deployment.jobId);
for (let attempt = 0; attempt < 60; attempt++) {
  const job = aws('amplify', 'get-job', '--app-id', app.appId, '--branch-name', 'clone',
    '--job-id', deployment.jobId).job;
  const status = job.summary.status;
  if (attempt % 4 === 0) console.log('Deployment status: ' + status);
  if (status === 'SUCCEED') {
    console.log('PASS deployment: ' + outputs.FrontendUrl);
    console.log('Steps: ' + JSON.stringify(job.steps.map(s => ({ step: s.stepName, status: s.status }))));
    process.exit(0);
  }
  if (['FAILED', 'CANCELLED'].includes(status)) throw new Error('Deployment ' + status);
  await new Promise(resolve => setTimeout(resolve, 5000));
}
throw new Error('Deployment still pending; inspect the logged app/branch/job');
