data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  bucket_name = "${local.name_prefix}-assets-${data.aws_caller_identity.current.account_id}"
  worker_name = "${local.name_prefix}-cerebro-worker"
  lambda_uri  = var.lambda_image_uri != "" ? var.lambda_image_uri : "${aws_ecr_repository.alquimia_worker.repository_url}:latest"
}

# ==============================================================================
# 1. Amazon S3 — Almacenamiento Privado para PDFs, Informes y Certificados
# ==============================================================================
resource "aws_s3_bucket" "alquimia_assets" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_public_access_block" "alquimia_assets_block" {
  bucket = aws_s3_bucket.alquimia_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alquimia_assets_sse" {
  bucket = aws_s3_bucket.alquimia_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alquimia_assets_lifecycle" {
  bucket = aws_s3_bucket.alquimia_assets.id

  rule {
    id     = "cleanup-tmp-and-incomplete-uploads"
    status = "Enabled"

    filter {
      prefix = "uploads/tmp/"
    }

    expiration {
      days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "alquimia_assets_cors" {
  bucket = aws_s3_bucket.alquimia_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 300
  }
}

# ==============================================================================
# 2. Amazon SQS + Dead-Letter Queue (DLQ)
# ==============================================================================
resource "aws_sqs_queue" "alquimia_jobs_dlq" {
  name                      = "${local.name_prefix}-async-jobs-dlq"
  message_retention_seconds = 1209600 # 14 días
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "alquimia_jobs" {
  name                       = "${local.name_prefix}-async-jobs"
  visibility_timeout_seconds = 360    # 6x timeout de Lambda (60s)
  message_retention_seconds  = 345600 # 4 días
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.alquimia_jobs_dlq.arn
    maxReceiveCount     = 3
  })
}

# ==============================================================================
# 3. Amazon ECR + CloudWatch Logs + AWS Lambda (Python Container Worker)
# ==============================================================================
resource "aws_ecr_repository" "alquimia_worker" {
  name                 = local.worker_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "alquimia_worker_cleanup" {
  repository = aws_ecr_repository.alquimia_worker.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Mantener solo las últimas 3 imágenes para permanecer dentro del Free Tier (500 MB)"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 3
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "alquimia_worker_logs" {
  name              = "/aws/lambda/${local.worker_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "alquimia_worker" {
  function_name = local.worker_name
  role          = aws_iam_role.lambda_worker.arn
  package_type  = "Image"
  image_uri     = local.lambda_uri

  timeout     = 60
  memory_size = 512

  environment {
    variables = {
      ENVIRONMENT               = var.environment
      S3_BUCKET                 = aws_s3_bucket.alquimia_assets.bucket
      SUPABASE_URL              = var.supabase_url
      SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.alquimia_worker_logs,
    aws_iam_role_policy.lambda_worker_policy
  ]
}

resource "aws_lambda_event_source_mapping" "sqs_to_lambda" {
  event_source_arn        = aws_sqs_queue.alquimia_jobs.arn
  function_name           = aws_lambda_function.alquimia_worker.arn
  batch_size              = 5
  function_response_types = ["ReportBatchItemFailures"]

  scaling_config {
    maximum_concurrency = 5 # Límite FinOps compatible con cuentas nuevas (cuota >= 10)
  }
}

# ==============================================================================
# 4. Control FinOps — AWS Budgets (Alerta Mensual 5 USD)
# ==============================================================================
resource "aws_budgets_budget" "monthly_cost" {
  count = var.budget_alert_email != "" ? 1 : 0

  name         = "${local.name_prefix}-monthly-budget"
  budget_type  = "COST"
  limit_amount = "5"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
