#!/usr/bin/env bash
# Installs the AWS Load Balancer Controller via Helm.
# Run once after the cluster is deployed.
# Usage: ./scripts/install-lb-controller.sh [environment]
set -euo pipefail

ENVIRONMENT="${1:-dev}"
PROJECT="k8"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
CLUSTER_NAME="${PROJECT}-cluster-${ENVIRONMENT}"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "==> Updating kubeconfig..."
aws eks update-kubeconfig \
  --name "${CLUSTER_NAME}" \
  --region "${REGION}" \
  --role-arn "arn:aws:iam::${ACCOUNT}:role/${PROJECT}-cluster-admin-${ENVIRONMENT}" \
  --alias "${CLUSTER_NAME}"

echo "==> Adding eks-charts Helm repo..."
helm repo add eks https://aws.github.io/eks-charts
helm repo update

echo "==> Creating service account with IRSA annotation..."
SA_ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name "K8Ingress-${ENVIRONMENT}" \
  --query "Stacks[0].Outputs[?OutputKey=='LBControllerSARoleArn'].OutputValue" \
  --output text 2>/dev/null || echo "")

kubectl create namespace kube-system --dry-run=client -o yaml | kubectl apply -f -

if [[ -n "${SA_ROLE_ARN}" ]]; then
  kubectl create serviceaccount aws-load-balancer-controller \
    -n kube-system \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl annotate serviceaccount aws-load-balancer-controller \
    -n kube-system \
    eks.amazonaws.com/role-arn="${SA_ROLE_ARN}" \
    --overwrite
  echo "  Service account annotated with role: ${SA_ROLE_ARN}"
else
  echo "  IRSA role ARN not found in stack outputs — using node role permissions"
fi

echo "==> Installing AWS Load Balancer Controller..."
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName="${CLUSTER_NAME}" \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region="${REGION}" \
  --set vpcId="$(aws eks describe-cluster --name "${CLUSTER_NAME}" --query 'cluster.resourcesVpcConfig.vpcId' --output text)" \
  --version 1.11.0 \
  --wait

echo ""
echo "==> Verifying controller is running..."
kubectl rollout status deployment/aws-load-balancer-controller -n kube-system --timeout=120s

echo ""
echo "  AWS Load Balancer Controller installed successfully"
echo "  Any Ingress with ingressClassName=alb will now get a public ALB automatically"
