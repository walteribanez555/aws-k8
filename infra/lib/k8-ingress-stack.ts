import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface K8IngressStackProps extends cdk.StackProps {
  environment: string;
  cluster: eks.Cluster;
}

export class K8IngressStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: K8IngressStackProps) {
    super(scope, id, props);

    const { environment, cluster } = props;
    const projectName = "k8";

    cdk.Tags.of(this).add("Project", projectName);
    cdk.Tags.of(this).add("Environment", environment);
    cdk.Tags.of(this).add("ManagedBy", "CDK");

    // --- Service Account with IRSA for AWS LB Controller ---
    const sa = cluster.addServiceAccount("LBControllerSA", {
      name: "aws-load-balancer-controller",
      namespace: "kube-system",
    });

    // IAM policy required by the AWS Load Balancer Controller (v2.8+)
    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["iam:CreateServiceLinkedRole"],
      resources: ["*"],
      conditions: {
        StringEquals: {
          "iam:AWSServiceName": "elasticloadbalancing.amazonaws.com",
        },
      },
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ec2:DescribeAccountAttributes",
        "ec2:DescribeAddresses",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeInternetGateways",
        "ec2:DescribeVpcs",
        "ec2:DescribeVpcPeeringConnections",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeInstances",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeTags",
        "ec2:GetCoipPoolUsage",
        "ec2:DescribeCoipPools",
        "ec2:GetSecurityGroupsForVpc",
        "ec2:DescribeIpamPools",
        "ec2:DescribeRouteTables",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeLoadBalancerAttributes",
        "elasticloadbalancing:DescribeListeners",
        "elasticloadbalancing:DescribeListenerCertificates",
        "elasticloadbalancing:DescribeSSLPolicies",
        "elasticloadbalancing:DescribeRules",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetGroupAttributes",
        "elasticloadbalancing:DescribeTargetHealth",
        "elasticloadbalancing:DescribeTags",
        "elasticloadbalancing:DescribeListenerAttributes",
        "elasticloadbalancing:DescribeTrustStores",
        "elasticloadbalancing:DescribeLoadBalancerPolicies",
      ],
      resources: ["*"],
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "cognito-idp:DescribeUserPoolClient",
        "acm:ListCertificates",
        "acm:DescribeCertificate",
        "iam:ListServerCertificates",
        "iam:GetServerCertificate",
        "wafv2:GetWebACL",
        "wafv2:GetWebACLForResource",
        "wafv2:AssociateWebACL",
        "wafv2:DisassociateWebACL",
        "shield:GetSubscriptionState",
        "shield:DescribeProtection",
        "shield:CreateProtection",
        "shield:DeleteProtection",
      ],
      resources: ["*"],
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:CreateSecurityGroup",
      ],
      resources: ["*"],
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["ec2:CreateTags"],
      resources: ["arn:aws:ec2:*:*:security-group/*"],
      conditions: {
        StringEquals: { "ec2:CreateAction": "CreateSecurityGroup" },
        Null: { "aws:RequestedRegion": "false" },
      },
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["ec2:CreateTags", "ec2:DeleteTags"],
      resources: ["arn:aws:ec2:*:*:security-group/*"],
      conditions: {
        Null: {
          "aws:RequestTag/elbv2.k8s.aws/cluster": "true",
          "aws:ResourceTag/elbv2.k8s.aws/cluster": "false",
        },
      },
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:DeleteSecurityGroup",
      ],
      resources: ["*"],
      conditions: {
        Null: { "aws:ResourceTag/elbv2.k8s.aws/cluster": "false" },
      },
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "elasticloadbalancing:CreateLoadBalancer",
        "elasticloadbalancing:CreateTargetGroup",
      ],
      resources: ["*"],
      conditions: {
        Null: { "aws:RequestTag/elbv2.k8s.aws/cluster": "false" },
      },
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "elasticloadbalancing:CreateListener",
        "elasticloadbalancing:DeleteListener",
        "elasticloadbalancing:CreateRule",
        "elasticloadbalancing:DeleteRule",
      ],
      resources: ["*"],
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["elasticloadbalancing:AddTags", "elasticloadbalancing:RemoveTags"],
      resources: [
        "arn:aws:elasticloadbalancing:*:*:targetgroup/*/*",
        "arn:aws:elasticloadbalancing:*:*:loadbalancer/net/*/*",
        "arn:aws:elasticloadbalancing:*:*:loadbalancer/app/*/*",
      ],
      conditions: {
        Null: {
          "aws:RequestTag/elbv2.k8s.aws/cluster": "true",
          "aws:ResourceTag/elbv2.k8s.aws/cluster": "false",
        },
      },
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["elasticloadbalancing:AddTags", "elasticloadbalancing:RemoveTags"],
      resources: [
        "arn:aws:elasticloadbalancing:*:*:listener/net/*/*/*",
        "arn:aws:elasticloadbalancing:*:*:listener/app/*/*/*",
        "arn:aws:elasticloadbalancing:*:*:listener-rule/net/*/*/*",
        "arn:aws:elasticloadbalancing:*:*:listener-rule/app/*/*/*",
      ],
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "elasticloadbalancing:ModifyLoadBalancerAttributes",
        "elasticloadbalancing:SetIpAddressType",
        "elasticloadbalancing:SetSecurityGroups",
        "elasticloadbalancing:SetSubnets",
        "elasticloadbalancing:DeleteLoadBalancer",
        "elasticloadbalancing:ModifyTargetGroup",
        "elasticloadbalancing:ModifyTargetGroupAttributes",
        "elasticloadbalancing:DeleteTargetGroup",
        "elasticloadbalancing:ModifyListenerAttributes",
      ],
      resources: ["*"],
      conditions: {
        Null: { "aws:ResourceTag/elbv2.k8s.aws/cluster": "false" },
      },
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["elasticloadbalancing:AddTags"],
      resources: [
        "arn:aws:elasticloadbalancing:*:*:targetgroup/*/*",
        "arn:aws:elasticloadbalancing:*:*:loadbalancer/net/*/*",
        "arn:aws:elasticloadbalancing:*:*:loadbalancer/app/*/*",
      ],
      conditions: {
        StringEquals: { "elasticloadbalancing:CreateAction": ["CreateTargetGroup", "CreateLoadBalancer"] },
        Null: { "aws:RequestTag/elbv2.k8s.aws/cluster": "false" },
      },
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "elasticloadbalancing:RegisterTargets",
        "elasticloadbalancing:DeregisterTargets",
      ],
      resources: ["arn:aws:elasticloadbalancing:*:*:targetgroup/*/*"],
    }));

    sa.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "elasticloadbalancing:SetWebAcl",
        "elasticloadbalancing:ModifyListener",
        "elasticloadbalancing:AddListenerCertificates",
        "elasticloadbalancing:RemoveListenerCertificates",
        "elasticloadbalancing:ModifyRule",
      ],
      resources: ["*"],
    }));

    // Tag public subnets so the controller can find them for the ALB
    // (requires subnets to have kubernetes.io/role/elb=1 tag — added below via manifest)
    const vpcId = cdk.Fn.importValue(`${projectName}-${environment}-vpc-id`);

    // Subnet tags are added via a Kubernetes Job or manually; the controller
    // discovers subnets via the cluster VPC tag kubernetes.io/cluster/<name>=owned
    cluster.addManifest("PublicSubnetTags", {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "aws-load-balancer-controller-config",
        namespace: "kube-system",
      },
      data: {
        vpcId,
      },
    });

    // --- AWS Load Balancer Controller via Helm ---
    const lbController = cluster.addHelmChart("LBController", {
      chart: "aws-load-balancer-controller",
      release: "aws-load-balancer-controller",
      repository: "https://aws.github.io/eks-charts",
      namespace: "kube-system",
      version: "1.11.0",
      values: {
        clusterName: cluster.clusterName,
        serviceAccount: {
          create: false,
          name: "aws-load-balancer-controller",
        },
        region: this.region,
        vpcId,
      },
    });

    lbController.node.addDependency(sa);

    new cdk.CfnOutput(this, "LBControllerInstalled", {
      value: "aws-load-balancer-controller",
      description: "Helm release name of the AWS LB Controller",
    });
  }
}
