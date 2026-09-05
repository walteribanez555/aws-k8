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
  --role-arn "$(aws iam get-role --role-name k8-cluster-admin-${ENVIRONMENT} --query 'Role.Arn' --output text)" \
  --alias "${CLUSTER_NAME}" \
  --quiet 2>/dev/null || true

# Discover the ArgoCD server service via label (excludes repo-server, redis, etc.)
ARGO_SVC=$(kubectl get svc -n argocd \
  -l "app.kubernetes.io/name=argocd-server" \
  --no-headers -o custom-columns=NAME:.metadata.name | head -1)

echo "==> ArgoCD UI available at http://localhost:8080  (service: ${ARGO_SVC})"
echo "    (Ctrl+C to stop)"
kubectl port-forward "svc/${ARGO_SVC}" -n argocd 8080:80
