# aws-k8

Kubernetes practice project on AWS EKS using CDK for infrastructure and ArgoCD for GitOps-based deployments.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  GitHub (aws-k8)                                        │
│  ├── infra/          CDK stacks (4 stacks)              │
│  ├── apps/           Application source code            │
│  └── gitops/         ArgoCD manifests (app-of-apps)     │
└────────────────────┬────────────────────────────────────┘
                     │ git push → ArgoCD detects
                     ▼
┌─────────────────────────────────────────────────────────┐
│  AWS (us-east-1)                                        │
│                                                         │
│  VPC (2 AZs)                                            │
│  ├── Public Subnets   → ALB (internet-facing)           │
│  └── Private Subnets  → EKS Nodes (t3.small × 2)       │
│                                                         │
│  EKS Cluster (v1.31)                                    │
│  ├── argocd ns   → ArgoCD (GitOps controller)           │
│  ├── hello-api ns → hello-api  → ALB → public           │
│  └── sample-app ns → sample-app → ALB → public          │
│                                                         │
│  ECR → k8-app-dev (Docker images)                       │
└─────────────────────────────────────────────────────────┘
```

## CDK Stacks

| Stack | Description | Deploy time |
|---|---|---|
| `K8Base-dev` | VPC, subnets, NAT Gateway | ~3 min |
| `K8Cluster-dev` | EKS cluster, node group, ECR | ~20 min |
| `K8Argo-dev` | ArgoCD via Helm | ~5 min |
| `K8Ingress-dev` | AWS Load Balancer Controller IRSA | ~1 min |

## Project Structure

```
.
├── apps/
│   └── hello-api/          Node.js API (no dependencies)
│       ├── src/index.js
│       ├── package.json
│       └── Dockerfile
├── gitops/
│   ├── bootstrap/          Root app-of-apps (apply once)
│   │   ├── dev.yaml
│   │   └── prod.yaml
│   ├── apps/
│   │   ├── dev/            ArgoCD Application manifests for dev
│   │   └── prod/           ArgoCD Application manifests for prod
│   └── manifests/
│       ├── hello-api/      K8s manifests (base + overlays)
│       └── sample-app/     K8s manifests (base + overlays)
├── infra/
│   ├── bin/infra.ts        CDK app entry point
│   └── lib/
│       ├── k8-base-stack.ts
│       ├── k8-cluster-stack.ts
│       ├── k8-argo-stack.ts
│       └── k8-ingress-stack.ts
├── scripts/
│   ├── argo-bootstrap.sh   Post-deploy: kubeconfig + admin password + root app
│   ├── argo-ui.sh          Port-forward to ArgoCD UI (localhost:8080)
│   ├── argo-add-app.sh     Register a new ArgoCD Application
│   ├── build-push.sh       Build (linux/amd64) and push image to ECR
│   └── install-lb-controller.sh  Install AWS LB Controller via Helm
└── packages/               Shared packages (empty, ready to use)
```

## Quick Start

### Prerequisites

```bash
aws --version       # AWS CLI v2
cdk --version       # AWS CDK
kubectl version --client
helm version
argocd version --client   # brew install argocd
docker buildx version     # for multi-platform builds
```

### 1. Deploy infrastructure

```bash
# Bootstrap CDK (once per account/region)
cd infra && npx cdk bootstrap aws://ACCOUNT_ID/us-east-1

# Deploy all stacks (~25 min total)
npm run infra:deploy:dev
```

### 2. Install AWS Load Balancer Controller

```bash
bash scripts/install-lb-controller.sh dev
```

### 3. Bootstrap ArgoCD

```bash
# Terminal 1 — open UI at http://localhost:8080
npm run argo:ui

# Terminal 2 — configure kubectl, get admin password, apply root app
npm run argo:bootstrap
```

### 4. Build and push an app image

```bash
npm run docker:push:hello-api
# or for a specific version:
bash scripts/build-push.sh hello-api dev 1.0.1
```

ArgoCD detects the new image and rolls it out automatically.

### 5. Verify

```bash
kubectl get pods -A
kubectl get ingress -A   # shows public ALB URLs
```

### Destroy all resources

```bash
npm run infra:destroy
```

## GitOps Flow

```
git push
  └── ArgoCD polls GitHub every 3 min (or webhook)
        └── detects diff in gitops/
              └── kubectl apply automatically
                    └── AWS LB Controller provisions ALB if Ingress changed
```

To add a new app:
1. Add K8s manifests in `gitops/manifests/<app-name>/base/`
2. Add overlays in `gitops/manifests/<app-name>/overlays/dev/`
3. Add an `Application` manifest in `gitops/apps/dev/<app-name>.yaml`
4. Push — ArgoCD syncs it automatically

## npm Scripts

| Script | Description |
|---|---|
| `npm run infra:deploy:dev` | Deploy all CDK stacks to dev |
| `npm run infra:deploy:prod` | Deploy all CDK stacks to prod |
| `npm run infra:destroy` | Destroy all stacks |
| `npm run argo:bootstrap` | Configure kubectl + apply root app |
| `npm run argo:ui` | Port-forward ArgoCD UI to localhost:8080 |
| `npm run argo:add-app` | Register a new ArgoCD Application |
| `npm run docker:push:hello-api` | Build and push hello-api to ECR |

## Estimated Cost

See [docs/cost-estimate.md](docs/cost-estimate.md) for a detailed breakdown.

**Dev environment monthly estimate: ~$145–165 USD**
