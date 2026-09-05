# Cost Estimate

All prices are for **us-east-1** using **on-demand** pricing as of 2026.
Dev uses Spot instances where possible; prod uses On-Demand.

---

## Dev Environment

| Service | Resource | Unit price | Qty | Monthly est. |
|---|---|---|---|---|
| **EKS** | Cluster fee | $0.10/hr | 1 | **$73** |
| **EC2** | t3.small (Spot, ~70% discount) | ~$0.007/hr | 2 nodes | **~$10** |
| **NAT Gateway** | Per hour | $0.045/hr | 1 | **$32** |
| **NAT Gateway** | Data processed (~10 GB) | $0.045/GB | 10 GB | **$0.45** |
| **ALB** | Per ALB per hour | $0.008/hr | 2 ALBs | **$11.50** |
| **ALB** | LCU usage (minimal) | $0.008/LCU | ~5 LCU | **$0.04** |
| **ECR** | Storage (~1 GB) | $0.10/GB | 1 GB | **$0.10** |
| **ECR** | Data transfer out (minimal) | $0.09/GB | ~1 GB | **$0.09** |
| **CloudWatch** | Logs (minimal) | $0.50/GB | ~1 GB | **$0.50** |

**Total dev/month: ~$127–145 USD**

> The EKS cluster fee ($73/mo) and NAT Gateway ($32/mo) are the biggest costs —
> they run 24/7 regardless of traffic. Destroy the cluster when not in use:
> `npm run infra:destroy`

---

## Prod Environment

| Service | Resource | Unit price | Qty | Monthly est. |
|---|---|---|---|---|
| **EKS** | Cluster fee | $0.10/hr | 1 | **$73** |
| **EC2** | t3.medium (On-Demand) | $0.0416/hr | 3 nodes | **$90** |
| **NAT Gateway** | Per hour | $0.045/hr | 1 | **$32** |
| **NAT Gateway** | Data processed (~50 GB) | $0.045/GB | 50 GB | **$2.25** |
| **ALB** | Per ALB per hour | $0.008/hr | 2 ALBs | **$11.50** |
| **ALB** | LCU usage | $0.008/LCU | ~20 LCU | **$0.16** |
| **ECR** | Storage + transfer | — | — | **~$1** |
| **CloudWatch** | Logs + metrics | — | ~5 GB | **~$5** |

**Total prod/month: ~$215–230 USD**

> Prod uses On-Demand t3.medium nodes (3 desired, up to 10 with autoscaling).
> EC2 cost scales with actual node count.

---

## Cost-Saving Tips

| Tip | Saving |
|---|---|
| Use Spot instances in dev | ~70% off EC2 (~$30 saved vs On-Demand) |
| **Destroy cluster when not in use** | $105/day saved (EKS + NAT) |
| Use a single NAT Gateway (already done) | vs $96/mo for one per AZ |
| Set ECR lifecycle rules (already done, keeps last 10 images) | Minimal |
| Disable cluster logging in dev (already done) | Avoids CloudWatch ingestion cost |
| Scale nodes to 0 overnight (Karpenter or scheduled scaling) | ~$10/mo EC2 saving |

---

## Daily Cost Breakdown (Dev)

| | Always on | Destroyable |
|---|---|---|
| EKS cluster | $2.40/day | ✅ yes |
| NAT Gateway | $1.08/day | ✅ yes (with VPC) |
| EC2 nodes (2× t3.small Spot) | ~$0.33/day | ✅ yes |
| ALBs (2×) | ~$0.38/day | ✅ yes (with cluster) |
| **Total** | **~$4.20/day** | |

> Run `npm run infra:destroy` after each practice session and `npm run infra:deploy:dev`
> when you come back. A full destroy + redeploy takes ~25 minutes.
