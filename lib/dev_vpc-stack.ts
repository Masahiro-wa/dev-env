import { Aspects, Stack, StackProps, Tag, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnInternetGateway,CfnNatGateway ,CfnEIP,CfnRoute, CfnRouteTable, CfnSubnet, CfnSubnetRouteTableAssociation, CfnVPCGatewayAttachment, PrivateSubnet, PrivateSubnetProps, PublicSubnet, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';

interface VpcStackProps extends StackProps {

}
export class VpcStack extends Stack {
  public readonly publicSubnet: CfnSubnet;
  public readonly privateSubnetA: CfnSubnet;
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, { ...props, subnetGroupName: undefined } as StackProps);
    const projName = "seminer";
    const envName = "dev";
    const cidr = '10.1.0.0/16';
    const vpc = new Vpc(this, `${projName}-${envName}-vpc`, {
      vpcName: `${projName}-${envName}-vpc`,
      cidr,
      natGateways: 0, // デフォルトは1
      subnetConfiguration: [], // サブネットの自動作成はなし
    })
    // Tags.of(vpc).add('Stack', id);
    Tags.of(vpc).add('Name', 'vpc');


    const publicSubnet = new CfnSubnet(this, `${projName}-${envName}-subnet`, {
      vpcId: vpc.vpcId,
      cidrBlock: "10.1.0.0/26",
      availabilityZone: this.availabilityZones[0],
      tags: [{ key: "Name", value: `${projName}-${envName}-subnet` }]
    });

    //const natEip = new CfnEIP(this, `${projName}-${envName}-eip`, {
    //    domain: "vpc",
    //    tags: [{ key: "Name", value: `nat-${projName}-${envName}-eip` }]
    //});

    //const natGateways = new CfnNatGateway(this, `${projName}-${envName}-nat`, {
    //    subnetId: publicSubnet.ref,
    //    allocationId: natEip.attrAllocationId,
    //    tags: [{ key: "Name", value: `${projName}-${envName}-nat` }]
    //});

    const igw = new CfnInternetGateway(this, `${projName}-${envName}-igw`, {
      tags: [{ key: "Name", value: `${projName}-${envName}-igw` }]
    });

    const igwAttach = new CfnVPCGatewayAttachment(this, `${projName}-${envName}-igw-attach`, {
      vpcId: vpc.vpcId,
      internetGatewayId: igw.ref
    });

    const publicRouteTable = new CfnRouteTable(this, `${projName}-${envName}-public-route`, {
      vpcId: vpc.vpcId,
      tags: [{ key: "Name", value: "public-rt" }]
    });

    const igwRoute = new CfnRoute(this, `${projName}-${envName}-public-route-igw`, {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: igw.ref
    });

    const association = new CfnSubnetRouteTableAssociation(this, `route-association-${projName}-${envName}-public`, {
      routeTableId: publicRouteTable.ref,
      subnetId: publicSubnet.ref
    });

    // ---------------------------------------------------------
    // private
    const privateRouteTable = new CfnRouteTable(this, `${projName}-${envName}-private-route`, {
      vpcId: vpc.vpcId,

      tags: [{ key: "Name", value: "private-rt" }]
    });

    //const natRoute = new CfnRoute(this, `${projName}-${envName}-private-route-nat`, {
    //    routeTableId: privateRouteTable.ref,
    //    destinationCidrBlock: "0.0.0.0/0",
    //    natGatewayId: natGateways.ref
    //});

    // プライベートSubnet
    const privateSubnetProps: PrivateSubnetProps[] = [
      { availabilityZone: 'ap-northeast-1a', vpcId: vpc.vpcId, cidrBlock: '10.1.1.0/24' },
      { availabilityZone: 'ap-northeast-1c', vpcId: vpc.vpcId, cidrBlock: '10.1.2.0/24' },
      // ap-northeast-1b は使えない
    ]

    const subnets = privateSubnetProps.map((prop, i) => {
      const subnet = new CfnSubnet(this, `MyPrivateSubnet${i}`, {
        vpcId: vpc.vpcId,
        cidrBlock: prop.cidrBlock,
        availabilityZone: prop.availabilityZone,
        tags: [{ key: "Name", value: `MyPrivateSubnet${i}` }]
      });
      Tags.of(subnet).add('Name', `private-subnet-${i}`);
      Tags.of(subnet).add('aws-cdk:subnet-type', SubnetType.PRIVATE_ISOLATED);
      new CfnSubnetRouteTableAssociation(this, `MyPrivateSubnet-associations-${i}`, {
        routeTableId: privateRouteTable.ref,
        subnetId: subnet.ref
      })
      return subnet
    });

    //------------------ 共通設定 ----------------------------------
    // 作成したリソース全てにタグをつける
    Aspects.of(this).add(new Tag('Stack', id));
    this.vpc = vpc;
    this.publicSubnet = publicSubnet;
    this.privateSubnetA = subnets[0];
  }
}



