import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as s3 from "aws-cdk-lib/aws-s3"; // Add this line
import { Construct } from "constructs"; 
import * as path from 'path';
import { envs } from '../utils/envs';

interface DevEc2StackProps extends cdk.StackProps {
    instance: ec2.Instance;
}

interface DevS3StackProps extends cdk.StackProps {
    configS3Bucket: s3.Bucket;
}

export class LambdaStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: DevEc2StackProps, props_s3: DevS3StackProps) {
        super(scope, id, props);
        const envName = envs.get('ENV_NAME');
        const accountId = this.account;
        const instanceId = props.instance.instanceId;
        const bucket = props_s3.configS3Bucket;
        const stopCron = envs.get('STOP_CRON'); // "0,14, ?, *, SUN-THU, *" のような形式で指定
        const startCron = envs.get('START_CRON'); // "0,6, *, *, MON-FRI, *" のような形式で指定

        const lambdaRole = new iam.Role(this , `${envName}-stop-lambda-role`, {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
            ]
        });
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              "ec2:*"
            ],
            resources: [`arn:aws:ec2:${envs.get('DEPLOY_REGION', '*')}:${accountId}:instance/${instanceId}`]
          }));

        const ec2ControlLambda = new lambda.Function(this, `${envName}-ec2-control-lambda`, {
            functionName: `${envName}-ec2-control-lambda`,
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'lambda_function.lambda_handler',
            code: lambda.Code.fromBucket(bucket, 'lambda/stop_ec2.zip'),
            role: lambdaRole,
            environment: {
                INSTANCE_ID: instanceId
            }
        });

        // 停止用のイベントルール
        const stopEvent = new events.Rule(this, `lambda-stop-event`, {
            schedule: events.Schedule.expression(stopCron),
        });
        stopEvent.addTarget(new targets.LambdaFunction(ec2ControlLambda));

        // 開始用のイベントルール
        const startEvent = new events.Rule(this, `lambda-start-event`, {
            schedule: events.Schedule.expression(startCron),
        });
        startEvent.addTarget(new targets.LambdaFunction(ec2ControlLambda));
    }
}