// Generate the existing Amplify config import from NEW, public resource IDs.
// No credentials, passwords or client secrets are written to this file.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const region = 'us-east-2';
const account = '837873138796';
let pool = process.env.SHIMMER_USER_POOL_ID;
let client = process.env.SHIMMER_USER_POOL_CLIENT_ID;
let identity = process.env.SHIMMER_IDENTITY_POOL_ID;
if (!(pool && client && identity)) {
  const profile = process.env.AWS_PROFILE || 'shimmer-admin';
  const aws = (...args) => JSON.parse(execFileSync('aws', [...args,
    '--profile', profile, '--region', region, '--output', 'json'], { encoding: 'utf8' }));
  if (aws('sts', 'get-caller-identity').Account !== account) {
    throw new Error('Refusing to generate config from a different AWS account');
  }
  const stack = aws('cloudformation', 'describe-stacks', '--stack-name',
    'shimmer-dashboard-clone').Stacks[0];
  const outputs = Object.fromEntries(stack.Outputs.map(i => [i.OutputKey, i.OutputValue]));
  pool = outputs.UserPoolId;
  client = outputs.UserPoolClientId;
  identity = outputs.IdentityPoolId;
}
if (!pool?.startsWith(region + '_') || !client || !identity?.startsWith(region + ':')) {
  throw new Error('Missing or incorrect-region clone Cognito resource IDs');
}
const config = {
  aws_project_region: region,
  aws_cognito_region: region,
  aws_cognito_identity_pool_id: identity,
  aws_user_pools_id: pool,
  aws_user_pools_web_client_id: client,
  aws_cognito_username_attributes: [],
  aws_cognito_signup_attributes: ['EMAIL'],
  aws_cognito_verification_mechanisms: ['EMAIL'],
  aws_cognito_mfa_configuration: 'OFF',
  aws_cognito_mfa_types: ['SMS'],
  aws_cognito_password_protection_settings: {
    passwordPolicyMinLength: 8,
    passwordPolicyCharacters: []
  },
  aws_cognito_social_providers: []
};
writeFileSync(new URL('../src/amplifyconfiguration.json', import.meta.url),
  JSON.stringify(config, null, 2) + '\n');
console.log('Generated public Amplify configuration for the clone in ' + region);
