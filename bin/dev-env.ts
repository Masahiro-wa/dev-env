#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/dev_vpc-stack';
import { Ec2Stack } from '../lib/dev_ec2-stack';
import { LambdaStack } from '../lib/dev_lambda-stack';
import { env } from 'process';

const app = new cdk.App();
const vpcStack = new VpcStack(app, 'SeminerDevVpcStack',{
  env:{ account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
const devEc2 = new Ec2Stack(app, 'SeminerDevEc2Stack', {
    publicSubnet: vpcStack.publicSubnet,
    privateSubnetA: vpcStack.privateSubnetA,
    vpc: vpcStack.vpc,
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
})

const stopLambda = new LambdaStack(app, 'SeminerDevLambdaStack', {
  instance: devEc2.instance,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
})






