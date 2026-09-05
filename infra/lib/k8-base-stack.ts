import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

interface K8BaseStackProps extends cdk.StackProps {
  environment: string;
}

export class K8BaseStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: K8BaseStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const projectName = "k8";

    cdk.Tags.of(this).add("Project", projectName);
    cdk.Tags.of(this).add("Environment", environment);
    cdk.Tags.of(this).add("ManagedBy", "CDK");

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      vpcName: `${projectName}-vpc-${environment}`,
      natGateways: 1,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
      description: "VPC ID",
      exportName: `${projectName}-${environment}-vpc-id`,
    });
  }
}
