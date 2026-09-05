#!/usr/bin/env bash
# Register an ArgoCD Application pointing to a Git repo path.
# Requires: argocd CLI logged in (run argo-bootstrap.sh first).
# Usage: ./scripts/argo-add-app.sh <app-name> <git-repo-url> <path> [environment]
#
# Example:
#   ./scripts/argo-add-app.sh my-api https://github.com/org/repo gitops/my-api dev
set -euo pipefail

APP_NAME="${1:?Usage: $0 <app-name> <git-repo-url> <path> [environment]}"
REPO_URL="${2:?Missing git-repo-url}"
APP_PATH="${3:?Missing path inside repo}"
ENVIRONMENT="${4:-dev}"

NAMESPACE="${APP_NAME}"
DEST_SERVER="https://kubernetes.default.svc"

echo "==> Creating namespace '${NAMESPACE}' if it does not exist..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

echo "==> Registering ArgoCD Application: ${APP_NAME}"
argocd app create "${APP_NAME}" \
  --repo "${REPO_URL}" \
  --path "${APP_PATH}" \
  --dest-server "${DEST_SERVER}" \
  --dest-namespace "${NAMESPACE}" \
  --sync-policy automated \
  --auto-prune \
  --self-heal \
  --revision HEAD \
  --upsert

echo ""
echo "  App:       ${APP_NAME}"
echo "  Repo:      ${REPO_URL}"
echo "  Path:      ${APP_PATH}"
echo "  Namespace: ${NAMESPACE}"
echo ""
echo "==> Triggering initial sync..."
argocd app sync "${APP_NAME}"

echo "==> Done. Watch status with:"
echo "    argocd app get ${APP_NAME}"
