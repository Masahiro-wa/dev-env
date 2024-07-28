import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs"; 
import * as path from 'path';

interface DevEc2StackProps extends cdk.StackProps {
    instance: ec2.Instance;
}

export class LambdaStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: DevEc2StackProps){
        super(scope, id, props);
        const ec2Name = 'devEc2';
        const instanceId = props.instance.instanceId;
        const lambdaPath = path.join(__dirname,'..','src','lambda','stop_ec2');

        const lambdaRole = new iam.Role(this , `${ec2Name}-stop-lambda-role`, {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            //EC2を停止するための権限を付与
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2FullAccess")
            ]
        });

        const stopEc2Lambda = new lambda.Function(this, `${ec2Name}-stop-lambda`, {
            functionName: `${ec2Name}-stop-lambda`,
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: 'stop_ec2.lambda_handler',
            code: new lambda.AssetCode(lambdaPath),
            role: lambdaRole,
            environment: {
                INSTANCE_ID: instanceId
            }
        });

        const event = new events.Rule(this, `lambda-stop-event`, {
            schedule: events.Schedule.cron({
                hour: "16",
                minute: "00"
            }),
        });

        event.addTarget(new targets.LambdaFunction(stopEc2Lambda));
    }
}