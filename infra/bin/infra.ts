#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { K8BaseStack } from "../lib/k8-base-stack";
import { K8ClusterStack } from "../lib/k8-cluster-stack";

const app = new cdk.App();

const environment = app.node.tryGetContext("environment") || "dev";
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || "us-east-1";

const env = { account, region };

const baseStack = new K8BaseStack(app, `K8Base-${environment}`, { env, environment });

new K8ClusterStack(app, `K8Cluster-${environment}`, {
  env,
  environment,
  vpc: baseStack.vpc,
});
