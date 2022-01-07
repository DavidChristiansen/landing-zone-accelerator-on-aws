/**
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface IRouteTable extends cdk.IResource {
  /**
   * The identifier of the route table
   *
   * @attribute
   */
  readonly routeTableId: string;

  /**
   * The VPC associated with the route table
   *
   * @attribute
   */
  readonly vpc: IVpc;
}

export interface RouteTableProps {
  readonly name: string;
  readonly vpc: IVpc;
}

export class RouteTable extends cdk.Resource implements IRouteTable {
  public readonly routeTableId: string;

  public readonly vpc: IVpc;

  constructor(scope: Construct, id: string, props: RouteTableProps) {
    super(scope, id);

    this.vpc = props.vpc;

    const resource = new cdk.aws_ec2.CfnRouteTable(this, 'Resource', {
      vpcId: props.vpc.vpcId,
      tags: [{ key: 'Name', value: props.name }],
    });

    this.routeTableId = resource.ref;
  }

  public addTransitGatewayRoute(
    id: string,
    destination: string,
    transitGatewayId: string,
    transitGatewayAttachment: cdk.CfnResource,
  ): void {
    const route = new cdk.aws_ec2.CfnRoute(this, id, {
      routeTableId: this.routeTableId,
      destinationCidrBlock: destination,
      transitGatewayId: transitGatewayId,
    });
    route.addDependsOn(transitGatewayAttachment);
  }

  public addNatGatewayRoute(id: string, destination: string, natGatewayId: string): void {
    new cdk.aws_ec2.CfnRoute(this, id, {
      routeTableId: this.routeTableId,
      destinationCidrBlock: destination,
      natGatewayId: natGatewayId,
    });
  }

  public addInternetGatewayRoute(id: string, destination: string): void {
    if (!this.vpc.internetGatewayId) {
      throw new Error('Attempting to add Internet Gateway route without an IGW defined.');
    }

    new cdk.aws_ec2.CfnRoute(this, id, {
      routeTableId: this.routeTableId,
      destinationCidrBlock: destination,
      gatewayId: this.vpc.internetGatewayId,
    });
  }
}

export interface ISubnet extends cdk.IResource {
  /**
   * The identifier of the subnet
   *
   * @attribute
   */
  readonly subnetId: string;

  /**
   * The name of the subnet
   *
   * @attribute
   */
  readonly subnetName: string;

  /**
   * The Availability Zone the subnet is located in
   *
   * @attribute
   */
  readonly availabilityZone: string;

  // /**
  //  * The VPC associated with the subnet
  //  *
  //  * @attribute
  //  */
  // readonly routeTable: IRouteTable;

  //  /**
  //   * The route table for this subnet
  //   */
  //  readonly routeTable: IRouteTable;

  //  /**
  //   * Associate a Network ACL with this subnet
  //   *
  //   * @param acl The Network ACL to associate
  //   */
  //  associateNetworkAcl(id: string, acl: INetworkAcl): void;

  // /**
  //  * The IPv4 CIDR block for this subnet
  //  */
  //  readonly ipv4CidrBlock: string;

  //  readonly mapPublicIpOnLaunch: boolean;
}

export interface SubnetProps {
  readonly name: string;
  readonly availabilityZone: string;
  readonly ipv4CidrBlock: string;
  readonly mapPublicIpOnLaunch?: boolean;
  readonly routeTable: IRouteTable;
  readonly vpc: IVpc;
  // readonly nacl: INacl;
}

export class Subnet extends cdk.Resource implements ISubnet {
  public readonly subnetName: string;
  public readonly availabilityZone: string;
  public readonly ipv4CidrBlock: string;
  public readonly mapPublicIpOnLaunch?: boolean;
  public readonly routeTable: IRouteTable;
  public readonly subnetId: string;

  constructor(scope: Construct, id: string, props: SubnetProps) {
    super(scope, id);

    this.subnetName = props.name;
    this.availabilityZone = props.availabilityZone;
    this.ipv4CidrBlock = props.ipv4CidrBlock;
    this.mapPublicIpOnLaunch = props.mapPublicIpOnLaunch;
    this.routeTable = props.routeTable;

    const resource = new cdk.aws_ec2.CfnSubnet(this, 'Resource', {
      vpcId: props.vpc.vpcId,
      cidrBlock: props.ipv4CidrBlock,
      availabilityZone: props.availabilityZone,
      mapPublicIpOnLaunch: props.mapPublicIpOnLaunch,
      tags: [{ key: 'Name', value: props.name }],
    });

    this.subnetId = resource.ref;

    new cdk.aws_ec2.CfnSubnetRouteTableAssociation(this, 'RouteTableAssociation', {
      subnetId: this.subnetId,
      routeTableId: props.routeTable.routeTableId,
    });
  }
}

export interface INatGateway extends cdk.IResource {
  /**
   * The identifier of the NAT Gateway
   *
   * @attribute
   */
  readonly natGatewayId: string;

  /**
   * The name of the NAT Gateway
   *
   * @attribute
   */
  readonly natGatewayName: string;
}

export interface NatGatewayProps {
  readonly name: string;
  readonly subnet: ISubnet;
}

export class NatGateway extends cdk.Resource implements INatGateway {
  public readonly natGatewayId: string;
  public readonly natGatewayName: string;

  constructor(scope: Construct, id: string, props: NatGatewayProps) {
    super(scope, id);

    this.natGatewayName = props.name;

    const resource = new cdk.aws_ec2.CfnNatGateway(this, 'Resource', {
      subnetId: props.subnet.subnetId,
      allocationId: new cdk.aws_ec2.CfnEIP(this, 'Eip', {
        domain: 'vpc',
      }).attrAllocationId,
      tags: [{ key: 'Name', value: props.name }],
    });

    this.natGatewayId = resource.ref;
  }
}

export interface ISecurityGroup extends cdk.IResource {
  /**
   * ID for the current security group
   * @attribute
   */
  readonly securityGroupId: string;
}

export interface SecurityGroupProps {
  /**
   * The name of the security group. For valid values, see the GroupName
   * parameter of the CreateSecurityGroup action in the Amazon EC2 API
   * Reference.
   *
   * It is not recommended to use an explicit group name.
   *
   * @default If you don't specify a GroupName, AWS CloudFormation generates a
   * unique physical ID and uses that ID for the group name.
   */
  readonly securityGroupName?: string;

  /**
   * A description of the security group.
   *
   * @default The default name will be the construct's CDK path.
   */
  readonly description?: string;

  /**
   * The VPC in which to create the security group.
   */
  readonly vpc: IVpc;
}

export interface SecurityGroupIngressRuleProps {
  readonly ipProtocol: string;
  readonly description?: string;
  readonly cidrIp?: string;
  readonly cidrIpv6?: string;
  readonly sourcePrefixListId?: string;
  readonly sourceSecurityGroup?: ISecurityGroup;
  readonly fromPort?: number;
  readonly toPort?: number;
}

export interface SecurityGroupEgressRuleProps {
  readonly ipProtocol: string;
  readonly description?: string;
  readonly cidrIp?: string;
  readonly cidrIpv6?: string;
  readonly destinationPrefixListId?: string;
  readonly destinationSecurityGroup?: ISecurityGroup;
  readonly fromPort?: number;
  readonly toPort?: number;
}

export class SecurityGroup extends cdk.Resource implements ISecurityGroup {
  public readonly securityGroupId: string;

  private readonly securityGroup: cdk.aws_ec2.CfnSecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupProps) {
    super(scope, id);

    this.securityGroup = new cdk.aws_ec2.CfnSecurityGroup(this, 'Resource', {
      groupDescription: props.description ?? '',
      groupName: props.securityGroupName,
      vpcId: props.vpc.vpcId,
    });

    this.securityGroupId = this.securityGroup.ref;
  }

  public addIngressRule(id: string, props: SecurityGroupIngressRuleProps) {
    new cdk.aws_ec2.CfnSecurityGroupIngress(this, id, {
      groupId: this.securityGroupId,
      ipProtocol: props.ipProtocol,
      description: props.description,
      cidrIp: props.cidrIp,
      cidrIpv6: props.cidrIpv6,
      sourcePrefixListId: props.sourcePrefixListId,
      sourceSecurityGroupId: props.sourceSecurityGroup?.securityGroupId,
      fromPort: props.fromPort,
      toPort: props.toPort,
    });
  }

  public addEgressRule(id: string, props: SecurityGroupEgressRuleProps) {
    new cdk.aws_ec2.CfnSecurityGroupEgress(this, id, {
      groupId: this.securityGroupId,
      ipProtocol: props.ipProtocol,
      description: props.description,
      cidrIp: props.cidrIp,
      cidrIpv6: props.cidrIpv6,
      destinationPrefixListId: props.destinationPrefixListId,
      destinationSecurityGroupId: props.destinationSecurityGroup?.securityGroupId,
      fromPort: props.fromPort,
      toPort: props.toPort,
    });
  }
}

export interface IVpc extends cdk.IResource {
  /**
   * The identifier of the vpc
   *
   * @attribute
   */
  readonly vpcId: string;

  /**
   * The Internet Gateway Id
   */
  readonly internetGatewayId?: string;
}

/**
 * Construction properties for a  VPC object.
 */
export interface VpcProps {
  readonly name: string;
  readonly ipv4CidrBlock: string;
  readonly enableDnsHostnames?: boolean;
  readonly enableDnsSupport?: boolean;
  readonly instanceTenancy?: 'default' | 'dedicated';
  readonly internetGateway?: boolean;
}

/**
 * Defines a  VPC object
 */
export class Vpc extends cdk.Resource implements IVpc {
  public readonly vpcId: string;
  public readonly internetGatewayId: string | undefined;

  constructor(scope: Construct, id: string, props: VpcProps) {
    super(scope, id);

    const resource = new cdk.aws_ec2.CfnVPC(this, 'Resource', {
      cidrBlock: props.ipv4CidrBlock,
      enableDnsHostnames: props.enableDnsHostnames,
      enableDnsSupport: props.enableDnsSupport,
      instanceTenancy: props.instanceTenancy,
      tags: [{ key: 'Name', value: props.name }],
    });

    this.vpcId = resource.ref;

    if (props.internetGateway) {
      const igw = new cdk.aws_ec2.CfnInternetGateway(this, 'InternetGateway', {});

      new cdk.aws_ec2.CfnVPCGatewayAttachment(this, 'InternetGatewayAttachment', {
        internetGatewayId: igw.ref,
        vpcId: this.vpcId,
      });

      this.internetGatewayId = igw.ref;
    }
  }

  public addGatewayVpcEndpoint(id: string, service: string, routeTableIds: string[]): void {
    new cdk.aws_ec2.CfnVPCEndpoint(this, id, {
      serviceName: new cdk.aws_ec2.GatewayVpcEndpointAwsService(service).name,
      vpcId: this.vpcId,
      routeTableIds,
    });
  }

  public addFlowLogs(props: {
    destinations: ('s3' | 'cloud-watch-logs')[];
    trafficType: 'ALL' | 'REJECT' | 'ACCEPT';
    maxAggregationInterval: number;
    logFormat?: string;
    encryptionKey?: cdk.aws_kms.IKey | undefined;
    bucketArn?: string;
  }) {
    // Validate maxAggregationInterval
    const maxAggregationInterval = props.maxAggregationInterval;
    if (maxAggregationInterval != 60 && maxAggregationInterval != 600) {
      throw new Error(`Invalid maxAggregationInterval (${maxAggregationInterval}) - must be 60 or 600 seconds`);
    }

    // Destination: CloudWatch Logs
    if (props.destinations.includes('cloud-watch-logs')) {
      if (props.encryptionKey === undefined) {
        throw new Error('encryptionKey not provided for cwl flow log');
      }

      const logGroup = new cdk.aws_logs.LogGroup(this, 'FlowLogsGroup', {
        encryptionKey: props.encryptionKey,
      });

      const role = new cdk.aws_iam.Role(this, 'FlowLogsRole', {
        assumedBy: new cdk.aws_iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
      });

      role.addToPrincipalPolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'logs:CreateLogDelivery',
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:DeleteLogDelivery',
            'logs:DescribeLogGroups',
            'logs:DescribeLogStreams',
            'logs:PutLogEvents',
          ],
          resources: [logGroup.logGroupArn],
        }),
      );

      new cdk.aws_ec2.CfnFlowLog(this, 'CloudWatchFlowLog', {
        deliverLogsPermissionArn: role.roleArn, // import * as logs from 'aws-cdk-lib/aws-logs';
        logDestinationType: 'cloud-watch-logs',
        logDestination: logGroup.logGroupArn,
        resourceId: this.vpcId,
        resourceType: 'VPC',
        trafficType: props.trafficType,
        maxAggregationInterval,
        logFormat: props.logFormat,
      });
    }

    // Destination: S3
    if (props.destinations.includes('s3')) {
      new cdk.aws_ec2.CfnFlowLog(this, 'S3FlowLog', {
        logDestinationType: 's3',
        logDestination: props.bucketArn,
        resourceId: this.vpcId,
        resourceType: 'VPC',
        trafficType: props.trafficType,
        maxAggregationInterval,
        logFormat: props.logFormat,
      });
    }
  }
}
