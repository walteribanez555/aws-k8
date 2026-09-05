#!/usr/bin/env bash
# Build and push a Docker image to ECR.
# Usage: ./scripts/build-push.sh <app-name> [environment] [version]
#
# Example:
#   ./scripts/build-push.sh hello-api dev 1.0.1
set -euo pipefail

APP="${1:?Usage: $0 <app-name> [environment] [version]}"
ENVIRONMENT="${2:-dev}"
VERSION="${3:-latest}"
ACCOUNT="557690620729"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
REPO="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/k8-app-${ENVIRONMENT}"
TAG="${ENVIRONMENT}-${VERSION}"

echo "==> Authenticating with ECR..."
aws ecr get-login-password --region "${REGION}" \
  | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

echo "==> Building image: ${REPO}:${TAG}"
docker build \
  --build-arg ENV="${ENVIRONMENT}" \
  --build-arg VERSION="${VERSION}" \
  -t "${REPO}:${TAG}" \
  "apps/${APP}"

echo "==> Pushing image..."
docker push "${REPO}:${TAG}"

# Also tag as <env>-latest
docker tag "${REPO}:${TAG}" "${REPO}:${ENVIRONMENT}-latest"
docker push "${REPO}:${ENVIRONMENT}-latest"

echo ""
echo "  Image pushed: ${REPO}:${TAG}"
echo "  Image pushed: ${REPO}:${ENVIRONMENT}-latest"
