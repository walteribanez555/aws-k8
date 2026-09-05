import { KubectlV31Layer } from "@aws-cdk/lambda-layer-kubectl-v31";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as eks from "aws-cdk-lib/aws-eks";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface K8ClusterStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
}

export class K8ClusterStack extends cdk.Stack {
  public readonly cluster: eks.Cluster;
  public readonly clusterAdminRole: iam.Role;

  constructor(scope: Construct, id: string, props: K8ClusterStackProps) {
    super(scope, id, props);

    const { environment, vpc } = props;
    const projectName = "k8";
    const isProd = environment === "prod";

    cdk.Tags.of(this).add("Project", projectName);
    cdk.Tags.of(this).add("Environment", environment);
    cdk.Tags.of(this).add("ManagedBy", "CDK");

    // --- IAM role for cluster admin access ---
    this.clusterAdminRole = new iam.Role(this, "ClusterAdminRole", {
      roleName: `${projectName}-cluster-admin-${environment}`,
      assumedBy: new iam.AccountRootPrincipal(),
    });

    // --- EKS Cluster ---
    this.cluster = new eks.Cluster(this, "Cluster", {
      clusterName: `${projectName}-cluster-${environment}`,
      version: eks.KubernetesVersion.V1_31,
      kubectlLayer: new KubectlV31Layer(this, "KubectlLayer"),
      vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      defaultCapacity: 0,
      mastersRole: this.clusterAdminRole,
      ...(isProd && {
        clusterLogging: [
          eks.ClusterLoggingTypes.API,
          eks.ClusterLoggingTypes.AUDIT,
          eks.ClusterLoggingTypes.AUTHENTICATOR,
        ],
      }),
    });

    // --- Managed Node Group ---
    this.cluster.addNodegroupCapacity("DefaultNodeGroup", {
      nodegroupName: `${projectName}-nodes-${environment}`,
      instanceTypes: [new ec2.InstanceType(isProd ? "t3.medium" : "t3.small")],
      minSize: 1,
      desiredSize: isProd ? 3 : 2,
      maxSize: isProd ? 10 : 4,
      diskSize: 20,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      capacityType: isProd ? eks.CapacityType.ON_DEMAND : eks.CapacityType.SPOT,
    });

    // --- ECR Repository (placeholder, one per app added later) ---
    const appRepo = new ecr.Repository(this, "AppRepository", {
      repositoryName: `${projectName}-app-${environment}`,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: !isProd,
      lifecycleRules: [{ maxImageCount: 10 }],
    });

    // Grant nodes pull access to ECR
    appRepo.grantPull(this.cluster.role);

    // --- Outputs ---
    new cdk.CfnOutput(this, "ClusterName", {
      value: this.cluster.clusterName,
      description: "EKS Cluster name",
      exportName: `${projectName}-${environment}-cluster-name`,
    });

    new cdk.CfnOutput(this, "ClusterEndpoint", {
      value: this.cluster.clusterEndpoint,
      description: "EKS API server endpoint",
      exportName: `${projectName}-${environment}-cluster-endpoint`,
    });

    new cdk.CfnOutput(this, "AppRepositoryUri", {
      value: appRepo.repositoryUri,
      description: "ECR repository URI for app images",
      exportName: `${projectName}-${environment}-app-repo-uri`,
    });

    new cdk.CfnOutput(this, "ClusterAdminRoleArn", {
      value: this.clusterAdminRole.roleArn,
      description: "IAM role ARN with cluster admin access — assume this to run kubectl",
      exportName: `${projectName}-${environment}-cluster-admin-role-arn`,
    });
  }
}
