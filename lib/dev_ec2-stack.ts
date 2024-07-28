import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as fs from 'fs';
import * as readline from 'readline';
import { Construct } from "constructs"; 

interface VpcStackProps extends cdk.StackProps {
    publicSubnet: ec2.CfnSubnet;
    privateSubnetA: ec2.CfnSubnet;
    vpc: ec2.Vpc;
}

export class Ec2Stack extends cdk.Stack {
    readonly instance: ec2.Instance;

    constructor(scope: Construct, id: string, props: VpcStackProps){
        super(scope, id, props);
        const projName = "seminer";
        const envName = "dev";
        const vpc = props.vpc;
        const accountId = this.account;
        //const filePath = './lib/startup.sh'
        //const fileStream = fs.createReadStream(filePath);
        //const rl = readline.createInterface({
        //    input: fileStream,
        //    crlfDelay: Infinity
        //});

        //const bastionUserData = ec2.UserData.forLinux({ shebang: "#!/bin/bash" });

        //rl.on('line', (line) => {
        //    bastionUserData.addCommands(line);
        //});

        const instancerole = new iam.Role(this , `${projName}-${envName}-instance-role`, {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        });
        instancerole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));
        //S3へのアクセス権限を追加
        instancerole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess"));
        //ECRへのアクセス権限を追加
        instancerole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryPowerUser"));
        //S3へのアクセス権限を追加
        instancerole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"));

        const eksAdminPolicy = new iam.ManagedPolicy(this, 'EksAdminPolicy', {
            statements: [
                new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "eks:*",
                ],
                resources: ["*"],
                }),
            ],
            });
        const eksEbsCsiDriverPolicy = new iam.ManagedPolicy(this, 'EksEbsCsiDriverPolicy', {
            statements: [
                new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "iam:PassRole",
                    "iam:DeleteRole",
                    "iam:CreateRole",
                    "iam:AttachRolePolicy",
                    "iam:DetachRolePolicy",
                    "iam:FullAccess"
                ],
                resources: [`arn:aws:iam::${accountId}:role/AmazonEKS_EBS_CSI_DriverRole`],
                }),
            ],
            });

        instancerole.addManagedPolicy(eksAdminPolicy);
        instancerole.addManagedPolicy(eksEbsCsiDriverPolicy);
        //roleをリストするための権限を追加
        instancerole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("IAMReadOnlyAccess"));
        //cloudformation:CreateStackの権限を追加
        instancerole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AWSCloudFormationFullAccess"));


        const sshKeyPair = new ec2.CfnKeyPair(this, `${projName}-${envName}-keypair`, {
            keyName: `${projName}-${envName}-keypair`,
            
        });
        sshKeyPair.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

        const securityGroup = new ec2.SecurityGroup(this, `${projName}-${envName}-sg`, {
            vpc: vpc,
            securityGroupName: `${projName}-${envName}-sg`
        });

        securityGroup.addIngressRule(
            ec2.Peer.ipv4("10.1.0.0/16"), 
            ec2.Port.tcp(22), 
            "allow ssh access from internal"
            );
        securityGroup.addIngressRule(
            ec2.Peer.ipv4("60.65.126.143/32"),
            ec2.Port.tcp(22),
            "allow ssh access from mypc"
            );



        const publicSubnet = ec2.Subnet.fromSubnetAttributes(this, `PublicSubnet`, {
            subnetId: props.publicSubnet.attrSubnetId,
            availabilityZone: props.publicSubnet.availabilityZone
        });

        const privateSubnet = ec2.Subnet.fromSubnetAttributes(this, `PrivateSubnet`, {
            subnetId: props.privateSubnetA.attrSubnetId,
            availabilityZone: props.privateSubnetA.availabilityZone
        });
        
        const createInstance = (id: string, name: string, subnet:ec2.ISubnet,userData?: ec2.UserData ) : ec2.Instance => {
            const instance = new ec2.Instance(this, id, {
                vpc: vpc,
                vpcSubnets: {subnets: [subnet]},
                instanceName: name,
                instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
                //Ubuntu22.04のAMIを指定する
                machineImage: ec2.MachineImage.genericLinux({
                    "ap-northeast-1": "ami-09710f665a7c81b4b",
                }),
                //machineImage: ec2.MachineImage.latestAmazonLinux({
                  //  generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
                //}),
                securityGroup: securityGroup,
                availabilityZone: subnet.availabilityZone,
                role: instancerole,
                keyName: sshKeyPair.keyName,
                //userData: userData
            });
            return instance;
        }

        const pubInstance_1 = createInstance(`${projName}-${envName}-instance`, `${projName}-${envName}-instance`, publicSubnet);
        //const manageInstance = createInstance(`${projName}-${envName}-instance`, `${projName}-${envName}-instance`, privateSubnet);

        this.instance = pubInstance_1;

        const elasticIp = new ec2.CfnEIP(this, `${projName}-${envName}-eip`, {
            domain: "vpc",
            instanceId: pubInstance_1.instanceId
        });

        new cdk.CfnOutput(this, `Get-${projName}-${envName}-keypair`, {
            value: `aws ssm get-parameter --name /ec2/keypair/${sshKeyPair.attrKeyPairId} --region ${this.region} --with-decryption --query Parameter.Value --output text > ~/.ssh/cdk-key-${elasticIp.attrPublicIp.toString}.pem && chmod 400 ~/.ssh/cdk-key-${elasticIp.attrPublicIp.toString}.pem`
        });

        //ロールのARNを出力
        new cdk.CfnOutput(this, `InstanceRoleArn`, {
            value: instancerole.roleArn,
            exportName: 'Ec2RoleArnExport'
        }); 
        

    };


}

