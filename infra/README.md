# Infraestructura AWS — Alquimia LMS (Terraform IaC)

Infraestructura serverless asíncrona declarada 100% en Terraform dentro del presupuesto objetivo **0–2 €/mes (AWS Free Tier)**.

## Recursos Provisionados
- **Amazon S3 (`main.tf`):** Bucket privado (`block_public_acls = true`, cifrado `AES256`, lifecycle para `uploads/tmp/`, CORS acotado).
- **Amazon SQS + DLQ (`main.tf`):** Cola `alquimia-lms-<env>-async-jobs` con `visibility_timeout_seconds = 360` y `redrive_policy` (`maxReceiveCount = 3`) hacia `alquimia-lms-<env>-async-jobs-dlq`.
- **Amazon ECR + AWS Lambda (`main.tf`):** Repositorio ECR (retención de 3 imágenes) + Lambda Container Image (`512 MB`, `timeout = 60s`, `reserved_concurrent_executions = 5`) conectada a SQS con `ReportBatchItemFailures`.
- **CloudWatch Logs + AWS Budgets (`main.tf`):** Retención de 14 días y alerta de presupuesto mensual a `5 EUR`.
- **IAM Mínimo Privilegio (`iam.tf`):** Cero comodines `*` en `Action` o `Resource`.

## Flujo de Despliegue

```bash
cd infra

# 1. Inicializar providers
terraform init

# 2. Validar formato y sintaxis
terraform fmt -check
terraform validate

# 3. Revisar plan de cambios
terraform plan -var="environment=dev" -var="budget_alert_email=tu-email@ejemplo.com"

# 4. Construir y subir la imagen del worker a ECR (antes de crear la Lambda)
# aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com
# docker build -f ../cerebro-py/Dockerfile.lambda -t <ECR_REPO_URL>:latest ../cerebro-py
# docker push <ECR_REPO_URL>:latest

# 5. Aplicar infraestructura
terraform apply -var="environment=dev" -var="budget_alert_email=tu-email@ejemplo.com"

# 6. Destruir entorno temporal cuando no se necesite
terraform destroy -var="environment=dev"
```
