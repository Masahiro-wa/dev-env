import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs"; 
import { envs } from '../utils/envs';

interface VpcStackProps extends cdk.StackProps {
  publicSubnet: ec2.CfnSubnet;
  privateSubnets: ec2.CfnSubnet[];
  vpc: ec2.Vpc;
};

interface S3StackProps extends cdk.StackProps {
  configS3bucket: s3.Bucket;
}

export class Ec2Stack extends cdk.Stack {
  readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: VpcStackProps, props_s3: S3StackProps) {
    super(scope, id, props);
    const envName = envs.get('ENV_NAME');
    const deployRegion = envs.get('DEPLOY_REGION');
    const vpc = props.vpc;
    const instanceTypeConfig = envs.get('INSTANCE_TYPE').toUpperCase();
    const [instanceClass, instanceSize] = instanceTypeConfig.split('.');
    const sgRules = envs.getList<{ port: string; cidr: string }>("SG_RULES");
    const bucketName = props_s3.configS3bucket.bucketName;
    const configBucketArn = props_s3.configS3bucket.bucketArn;

    if (!sgRules) {
      throw new Error('SG_RULES is not set. Please set the environment variable in environment.yml.');
    }

    const instancerole = new iam.Role(this, `${envName}-ec2-instance-role`, {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    // SSMへのアクセス権限を追加
    instancerole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));

    // S3へのアクセス権限を追加
    instancerole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "s3:Get*",
        "s3:List*",
        "s3:Describe*",
        "s3-object-lambda:Get*",
        "s3-object-lambda:List*"
      ],
      resources: [`${configBucketArn}/*`]
    }));

    //const sshKeyPair = new ec2.CfnKeyPair(this, `${envName}-keypair`, {
    //  keyName: `${envName}-keypair`,
    //});
    const keyPair = new ec2.KeyPair(this, `${envName}-keypair`, {
      type: ec2.KeyPairType.ED25519,
      format: ec2.KeyPairFormat.PEM,
    });
    keyPair.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    const privateKey = keyPair.privateKey;

    const securityGroup = new ec2.SecurityGroup(this, `${envName}-ec2-sg`, {
      vpc: vpc,
      securityGroupName: `${envName}-sg`
    });

    for (const rule of sgRules) {
      const portString = rule.port.split(',').map(port => parseInt(port, 10));
      portString.forEach(port => {
        securityGroup.addIngressRule(
          ec2.Peer.ipv4(rule.cidr), 
          ec2.Port.tcp(port), 
          `allow ${rule.port} access from ${rule.cidr}`
        );
      });
    }

    const publicSubnet = ec2.Subnet.fromSubnetAttributes(this, `PublicSubnet`, {
      subnetId: props.publicSubnet.attrSubnetId,
      availabilityZone: props.publicSubnet.availabilityZone
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'aws s3 cp s3://' + bucketName + '/ec2/dev/startup.sh /tmp/startup.sh',
      'chmod +x /tmp/startup.sh',
      './tmp/startup.sh',
      'if [ $? -eq 0 ]; then',
      '  /opt/aws/bin/cfn-signal --success true --stack ' + cdk.Aws.STACK_NAME + ' --resource MyInstance --region ' + cdk.Aws.REGION,
      'else',
      '  /opt/aws/bin/cfn-signal --success false --stack ' + cdk.Aws.STACK_NAME + ' --resource MyInstance --region ' + cdk.Aws.REGION,
      'fi',
      `rm -rf /tmp/*`,
    );

    let image = 'latest';
    if (envs.get('IS_MANAGED_AMI') === 'no') {
      const images = envs.getList<{ region: string; id: string }>('CUSTOM_AMI');
      images.forEach(ig => {
        if (ig.region === deployRegion) {
          image = ig.id;
        }
      });
      if (image === 'latest') {
        throw new Error('Custom AMI is not found in the region');
      }
    }

    const createInstance = (id: string, name: string, subnet: ec2.ISubnet, image: string, userData?: ec2.UserData): ec2.Instance => {
      const machineImage = image === 'latest'
        ? ec2.MachineImage.latestAmazonLinux2023()
        : ec2.MachineImage.genericLinux({
            deployRegion: image,
          });

      const instance = new ec2.Instance(this, id, {
        vpc: vpc,
        vpcSubnets: { subnets: [subnet] },
        instanceName: name,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass[instanceClass as keyof typeof ec2.InstanceClass],
          ec2.InstanceSize[instanceSize as keyof typeof ec2.InstanceSize]
        ),
        machineImage: machineImage,
        securityGroup: securityGroup,
        availabilityZone: subnet.availabilityZone,
        role: instancerole,
        keyPair: keyPair,
        userData: userData,
        blockDevices: [
          {
            deviceName: "/dev/xvda", // デフォルトのルートボリューム
            volume: ec2.BlockDeviceVolume.ebs(32, { // 32 GiB に設定
              volumeType: ec2.EbsDeviceVolumeType.GP3, // 一般的な汎用SSD
            }),
          },
        ],
      });
      return instance;
    };

    const devInstance = createInstance(`${envName}-ec2`, `${envName}-ec2`, publicSubnet, image, userData);

    this.instance = devInstance;

    const elasticIp = new ec2.CfnEIP(this, `${envName}-eip`, {
      domain: "vpc",
      instanceId: devInstance.instanceId
    });

    new cdk.CfnOutput(this, `Get-${envName}-keypair`, {
      value: `aws ssm get-parameter --name ${privateKey.parameterName} --region ${this.region} --with-decryption --query Parameter.Value --output text > ~/.ssh/${envName}-cdk-world.pem && chmod 400 ~/.ssh/${envName}-cdk-world.pem`
    });

    new cdk.CfnOutput(this, `EC2-${envName}-IPv4`, {
      value: `${elasticIp.ref}`
    });

    // ロールのARNを出力
    new cdk.CfnOutput(this, `${envName}InstanceRoleArn`, {
      value: instancerole.roleArn,
      exportName: `${envName}Ec2RoleArnExport`
    }); 
  }
}
