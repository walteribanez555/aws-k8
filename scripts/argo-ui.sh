#!/usr/bin/env bash
# Port-forward ArgoCD UI to localhost:8080
# Usage: ./scripts/argo-ui.sh [environment]
set -euo pipefail

ENVIRONMENT="${1:-dev}"
PROJECT="k8"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
CLUSTER_NAME="${PROJECT}-cluster-${ENVIRONMENT}"

# Ensure kubeconfig points to the right cluster
aws eks update-kubeconfig \
  --name "${CLUSTER_NAME}" \
  --region "${REGION}" \
  --alias "${CLUSTER_NAME}" \
  --quiet 2>/dev/null || true

echo "==> ArgoCD UI available at http://localhost:8080"
echo "    (Ctrl+C to stop)"
kubectl port-forward svc/argocd-server -n argocd 8080:80
