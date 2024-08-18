import {
    Aspects,
    Stack,
    StackProps,
    Tags,
  } from 'aws-cdk-lib';
  import {
    Construct
  } from 'constructs';
  import {
    CfnInternetGateway,
    CfnNatGateway,
    CfnEIP,
    CfnRoute,
    CfnRouteTable,
    CfnSubnet,
    CfnSubnetRouteTableAssociation,
    CfnVPCGatewayAttachment,
    SubnetType,
    Vpc,
    IpAddresses,
  } from 'aws-cdk-lib/aws-ec2';
  import {
    envs
  } from '../utils/envs';
  
  interface VpcStackProps extends StackProps {}
  
  export class VpcStack extends Stack {
    public readonly publicSubnet: CfnSubnet;
    public readonly privateSubnets: CfnSubnet[];
    public readonly vpc: Vpc;
  
    constructor(scope: Construct, id: string, props: VpcStackProps) {
      super(scope, id, props);
      const envName = envs.get('ENV_NAME');
      const cidr = envs.get('VPC_CIDR');
  
      const vpc = new Vpc(this, `${envName}-vpc`, {
        vpcName: `${envName}-vpc`,
        ipAddresses: IpAddresses.cidr(cidr),
        natGateways: 0, // デフォルトは1
        subnetConfiguration: [], // サブネットの自動作成はなし
      });
      Tags.of(vpc).add('Name', `${envName}-vpc`);
  
      const igw = new CfnInternetGateway(this, `${envName}-igw`, {
        tags: [{
          key: "Name",
          value: `${envName}-igw`
        }]
      });
  
      new CfnVPCGatewayAttachment(this, `${envName}-igw-attach`, {
        vpcId: vpc.vpcId,
        internetGatewayId: igw.ref
      });
  
      // Public Subnets and Route Table
      const publicRouteTable = new CfnRouteTable(this, `${envName}-public-route`, {
        vpcId: vpc.vpcId,
        tags: [{
          key: "Name",
          value: "public-rt"
        }]
      });
  
      const assosiateIgw = new CfnRoute(this, `${envName}-public-route-igw`, {
        routeTableId: publicRouteTable.ref,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: igw.ref
      });
  
      const publicSubnetsInfo = envs.getList < {
        az: string,
        cidr: string
      } > (`PUB_SUBNET_CIDR`);
      const publicSubnets = publicSubnetsInfo.map((subnet, i) => {
        const publicSubnet = new CfnSubnet(this, `${envName}-pub-subnet${i}`, {
          vpcId: vpc.vpcId,
          cidrBlock: subnet.cidr,
          availabilityZone: subnet.az,
          tags: [{
            key: "Name",
            value: `${envName}-pub-subnet${i}`
          }]
        });
  
        Tags.of(publicSubnet).add('Name', `${envName}-pub-subnet${i}`);
        Tags.of(publicSubnet).add('aws-cdk:subnet-type', SubnetType.PUBLIC);
  
        new CfnSubnetRouteTableAssociation(this, `route-association-${envName}-public${i}`, {
          routeTableId: publicRouteTable.ref,
          subnetId: publicSubnet.ref
        });
  
        return publicSubnet;
      });
  
      // Private Subnets and Route Table (conditional)
      let privateSubnets: CfnSubnet[] = [];
      if (envs.get('CREATE_PRIV_SUBNET').toLowerCase() === 'yes') {
        const natEip = new CfnEIP(this, `${envName}-nat-eip`, {
          domain: "vpc",
          tags: [{
            key: "Name",
            value: `nat-${envName}-eip`
          }]
        });
  
        const natGateways = new CfnNatGateway(this, `${envName}-nat`, {
          subnetId: publicSubnets[0].ref,
          allocationId: natEip.attrAllocationId,
          tags: [{
            key: "Name",
            value: `${envName}-nat`
          }]
        });
  
        const privateRouteTable = new CfnRouteTable(this, `${envName}-private-route`, {
          vpcId: vpc.vpcId,
          tags: [{
            key: "Name",
            value: "private-rt"
          }]
        });
  
        new CfnRoute(this, `${envName}-private-route-nat`, {
          routeTableId: privateRouteTable.ref,
          destinationCidrBlock: "0.0.0.0/0",
          natGatewayId: natGateways.ref
        });
  
        const privateSubnetsInfo = envs.getList < {
          az: string,
          cidr: string
        } > (`PRIV_SUBNET_CIDR`);
        privateSubnets = privateSubnetsInfo.map((subnet, i) => {
          const privateSubnet = new CfnSubnet(this, `${envName}-priv-subnet${i}`, {
            vpcId: vpc.vpcId,
            cidrBlock: subnet.cidr,
            availabilityZone: subnet.az,
            tags: [{
              key: "Name",
              value: `${envName}-priv-subnet${i}`
            }]
          });
  
          Tags.of(privateSubnet).add('Name', `private-subnet-${i}`);
          Tags.of(privateSubnet).add('aws-cdk:subnet-type', SubnetType.PRIVATE_ISOLATED);
  
          new CfnSubnetRouteTableAssociation(this, `route-association-${envName}-priv${i}`, {
            routeTableId: privateRouteTable.ref,
            subnetId: privateSubnet.ref
          });
  
          return privateSubnet;
        });
      }
  
      // Common Tags and Outputs
      Tags.of(this).add('Stack', id);
      this.vpc = vpc;
      this.publicSubnet = publicSubnets[0];
      this.privateSubnets = privateSubnets;
    }
  }
  