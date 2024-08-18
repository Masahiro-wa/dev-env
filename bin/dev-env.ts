#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { S3Stack } from '../lib/dev_s3-stack';
import { VpcStack } from '../lib/dev_vpc-stack';
import { Ec2Stack } from '../lib/dev_ec2-stack';
import { LambdaStack } from '../lib/dev_lambda-stack';
import { envs } from '../utils/envs';

if (envs.get('ENV_NAME') === ''){
  throw new Error('ENV_NAME is not set. Please set the environment variable in environment.yml.');
};

const app = new cdk.App();
const s3Stack = new S3Stack(app, 'DevS3Stack',{
  env:{ account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
})

const vpcStack = new VpcStack(app, 'DevVpcStack',{
  env:{ account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
const devEc2 = new Ec2Stack(app, 'SeminerDevEc2Stack', {
  publicSubnet: vpcStack.publicSubnet,
  privateSubnetA: vpcStack.privateSubnetA,
  vpc: vpcStack.vpc,
  env:{ account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
},
{
  configS3bucket: s3Stack.bucket
});
const stopLambda = new LambdaStack(app, 'SeminerDevLambdaStack', {
  instance: devEc2.instance,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
})
