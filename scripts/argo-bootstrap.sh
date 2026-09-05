#!/usr/bin/env bash
# Post-deploy: configures kubectl, retrieves ArgoCD admin password, and logs in.
# Usage: ./scripts/argo-bootstrap.sh [environment]
set -euo pipefail

ENVIRONMENT="${1:-dev}"
PROJECT="k8"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
CLUSTER_NAME="${PROJECT}-cluster-${ENVIRONMENT}"

echo "==> Updating kubeconfig for cluster: ${CLUSTER_NAME}"
aws eks update-kubeconfig \
  --name "${CLUSTER_NAME}" \
  --region "${REGION}" \
  --alias "${CLUSTER_NAME}"

echo "==> Waiting for ArgoCD server to be ready..."
kubectl rollout status deployment/argocd-server \
  -n argocd \
  --timeout=180s

echo "==> Retrieving initial ArgoCD admin password..."
ARGO_PASSWORD=$(
  kubectl -n argocd get secret argocd-initial-admin-secret \
    -o jsonpath="{.data.password}" | base64 -d
)

echo ""
echo "------------------------------------------------------------"
echo "  ArgoCD is ready"
echo "  URL:      http://localhost:8080  (after running argo-ui.sh)"
echo "  User:     admin"
echo "  Password: ${ARGO_PASSWORD}"
echo "------------------------------------------------------------"
echo ""

# Log in via argocd CLI if available
if command -v argocd &>/dev/null; then
  echo "==> Logging in via argocd CLI (port-forward must be running)..."
  echo "    Run ./scripts/argo-ui.sh in another terminal first, then re-run this step."
  argocd login localhost:8080 \
    --username admin \
    --password "${ARGO_PASSWORD}" \
    --insecure || echo "  (skipped — start port-forward first)"
else
  echo "  argocd CLI not found. Install it to manage apps from the terminal:"
  echo "  brew install argocd"
fi

# Apply the root app-of-apps bootstrap manifest
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_MANIFEST="${SCRIPT_DIR}/../gitops/bootstrap/${ENVIRONMENT}.yaml"

if [[ -f "${BOOTSTRAP_MANIFEST}" ]]; then
  echo ""
  echo "==> Applying root app-of-apps: gitops/bootstrap/${ENVIRONMENT}.yaml"
  kubectl apply -f "${BOOTSTRAP_MANIFEST}" -n argocd
  echo "  ArgoCD will now sync all apps defined in gitops/apps/${ENVIRONMENT}/"
else
  echo "  (no bootstrap manifest found at gitops/bootstrap/${ENVIRONMENT}.yaml)"
fi
