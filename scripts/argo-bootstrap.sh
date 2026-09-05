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
  --role-arn "$(aws iam get-role --role-name k8-cluster-admin-${ENVIRONMENT} --query 'Role.Arn' --output text)" \
  --alias "${CLUSTER_NAME}"

# Discover the ArgoCD server deployment (release name may vary)
ARGO_DEPLOYMENT=$(kubectl get deployment -n argocd \
  -o jsonpath='{.items[?(@.spec.selector.matchLabels.app\.kubernetes\.io/name=="argocd-server")].metadata.name}' 2>/dev/null \
  || kubectl get deployment -n argocd --no-headers -o custom-columns=NAME:.metadata.name \
  | grep -m1 server)

echo "==> Waiting for ArgoCD server to be ready (${ARGO_DEPLOYMENT})..."
kubectl rollout status deployment/"${ARGO_DEPLOYMENT}" \
  -n argocd \
  --timeout=180s

# Discover the ArgoCD server service via label (excludes repo-server, redis, etc.)
ARGO_SVC=$(kubectl get svc -n argocd \
  -l "app.kubernetes.io/name=argocd-server" \
  --no-headers -o custom-columns=NAME:.metadata.name | head -1)

# Retrieve admin password (secret name also follows the release prefix)
ARGO_SECRET=$(kubectl get secret -n argocd --no-headers -o custom-columns=NAME:.metadata.name \
  | grep -m1 "initial-admin-secret")

echo "==> Retrieving initial ArgoCD admin password (${ARGO_SECRET})..."
ARGO_PASSWORD=$(
  kubectl -n argocd get secret "${ARGO_SECRET}" \
    -o jsonpath="{.data.password}" | base64 -d
)

echo ""
echo "------------------------------------------------------------"
echo "  ArgoCD is ready"
echo "  URL:      http://localhost:8080  (after running argo-ui.sh)"
echo "  User:     admin"
echo "  Password: ${ARGO_PASSWORD}"
echo "  Service:  ${ARGO_SVC}"
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
