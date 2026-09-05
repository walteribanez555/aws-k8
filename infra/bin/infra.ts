#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { K8ArgoStack } from "../lib/k8-argo-stack";
import { K8BaseStack } from "../lib/k8-base-stack";
import { K8ClusterStack } from "../lib/k8-cluster-stack";
import { K8IngressStack } from "../lib/k8-ingress-stack";

const app = new cdk.App();

const environment = app.node.tryGetContext("environment") || "dev";
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || "us-east-1";

const env = { account, region };

// Stack 1 — VPC and networking
const baseStack = new K8BaseStack(app, `K8Base-${environment}`, { env, environment });

// Stack 2 — EKS cluster, node group, ECR
const clusterStack = new K8ClusterStack(app, `K8Cluster-${environment}`, {
  env,
  environment,
  vpc: baseStack.vpc,
});

// Stack 3 — ArgoCD installed via Helm on the cluster
new K8ArgoStack(app, `K8Argo-${environment}`, {
  env,
  environment,
  cluster: clusterStack.cluster,
  clusterAdminRole: clusterStack.clusterAdminRole,
});

// Stack 4 — AWS Load Balancer Controller (exposes apps via ALB Ingress)
new K8IngressStack(app, `K8Ingress-${environment}`, {
  env,
  environment,
  cluster: clusterStack.cluster,
});
