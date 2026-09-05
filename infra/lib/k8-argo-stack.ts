import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface K8ArgoStackProps extends cdk.StackProps {
  environment: string;
  cluster: eks.Cluster;
  clusterAdminRole: iam.Role;
}

export class K8ArgoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: K8ArgoStackProps) {
    super(scope, id, props);

    const { environment, cluster, clusterAdminRole } = props;
    const projectName = "k8";
    const isProd = environment === "prod";

    cdk.Tags.of(this).add("Project", projectName);
    cdk.Tags.of(this).add("Environment", environment);
    cdk.Tags.of(this).add("ManagedBy", "CDK");

    // Grant the admin role permission to manage ArgoCD resources via kubectl
    clusterAdminRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSClusterPolicy")
    );

    // --- ArgoCD via Helm (chart: argo-cd, repo: argoproj.github.io/argo-helm) ---
    cluster.addHelmChart("ArgoCD", {
      chart: "argo-cd",
      repository: "https://argoproj.github.io/argo-helm",
      namespace: "argocd",
      createNamespace: true,
      // Pin to a stable release; bump deliberately when upgrading ArgoCD
      version: "7.7.0",
      values: {
        global: {
          // Keep resources lean in dev; prod gets proper sizing
          ...(isProd
            ? {}
            : {
                resources: {
                  limits: { cpu: "200m", memory: "256Mi" },
                  requests: { cpu: "100m", memory: "128Mi" },
                },
              }),
        },
        configs: {
          params: {
            // Disable TLS termination at the server — handled by ALB/ingress or port-forward
            "server.insecure": "true",
          },
          cm: {
            "application.resourceTrackingMethod": "annotation",
          },
        },
        server: {
          replicas: isProd ? 2 : 1,
          autoscaling: {
            enabled: isProd,
            minReplicas: 2,
            maxReplicas: 5,
            targetCPUUtilizationPercentage: 70,
          },
        },
        repoServer: {
          replicas: isProd ? 2 : 1,
          autoscaling: { enabled: isProd },
        },
        applicationSet: {
          replicas: isProd ? 2 : 1,
        },
        // Disable dex (SSO) in dev — enable + configure in prod when needed
        dex: {
          enabled: false,
        },
      },
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "ArgoNamespace", {
      value: "argocd",
      description: "Namespace where ArgoCD is installed",
    });

    new cdk.CfnOutput(this, "ArgoPortForwardCmd", {
      value: `kubectl port-forward svc/argocd-server -n argocd 8080:80`,
      description: "Command to access ArgoCD UI locally — then open http://localhost:8080",
    });

    new cdk.CfnOutput(this, "ArgoAdminPasswordCmd", {
      value: `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d`,
      description: "Command to retrieve the initial ArgoCD admin password",
    });
  }
}
