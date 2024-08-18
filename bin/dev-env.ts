#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { S3Stack } from '../lib/dev_s3-stack';
import { VpcStack } from '../lib/dev_vpc-stack';
import { Ec2Stack } from '../lib/dev_ec2-stack';
import { LambdaStack } from '../lib/dev_lambda-stack';
import { envs } from '../utils/envs';

if (envs.get('ENV_NAME') === '' || envs.get('DEPLOY_REGION') === ''){
  throw new Error('ENV_NAME or REGION is not set. Please set the environment variable in environment.yml.');
};

const app = new cdk.App();
const s3Stack = new S3Stack(app, `${envs.get('ENV_NAME')}-s3-stack`,{
  env:{ account: process.env.CDK_DEFAULT_ACCOUNT, region: envs.get('DEPLOY_REGION') }
})

const vpcStack = new VpcStack(app, `${envs.get('ENV_NAME')}-vpc-stack`,{
  env:{ account: process.env.CDK_DEFAULT_ACCOUNT, region: envs.get('DEPLOY_REGION') }
});
const devEc2 = new Ec2Stack(app, `${envs.get('ENV_NAME')}-ec2-stack`, {
  publicSubnet: vpcStack.publicSubnet,
  privateSubnets: vpcStack.privateSubnets,
  vpc: vpcStack.vpc,
  env:{ account: process.env.CDK_DEFAULT_ACCOUNT, region: envs.get('DEPLOY_REGION') }
},
{
  configS3bucket: s3Stack.bucket
});
const stopLambda = new LambdaStack(app, `${envs.get('ENV_NAME')}-lambda-stack`, {
  instance: devEc2.instance,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: envs.get('DEPLOY_REGION') }
},
{
  configS3Bucket: s3Stack.bucket
});
