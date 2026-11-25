# ==============================================================================
# IAM Mínimo Privilegio (Zero Wildcards: Cero Action:* y Cero Resource:*)
# ==============================================================================

# 1. Rol de ejecución para AWS Lambda Worker (cerebro-py)
resource "aws_iam_role" "lambda_worker" {
  name = "${local.worker_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaAssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_worker_policy" {
  name = "${local.worker_name}-least-privilege"
  role = aws_iam_role.lambda_worker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConsumeFromMainSQSOnly"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.alquimia_jobs.arn
        ]
      },
      {
        Sid    = "ReadInputPDFsFromS3"
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.alquimia_assets.arn}/uploads/pdfs/*"
        ]
      },
      {
        Sid    = "WriteGeneratedResultsToS3"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.alquimia_assets.arn}/generated/*"
        ]
      },
      {
        Sid    = "WriteCloudWatchLogsOnlyToWorkerGroup"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.alquimia_worker_logs.arn}:*"
        ]
      }
    ]
  })
}

# 2. Usuario técnico para BFF Next.js (Presigned URLs + Encolado SQS)
resource "aws_iam_user" "bff_nextjs" {
  name = "${local.name_prefix}-bff-nextjs"
}

resource "aws_iam_user_policy" "bff_nextjs_policy" {
  name = "${local.name_prefix}-bff-least-privilege"
  user = aws_iam_user.bff_nextjs.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PresignAndReadAllowedS3Prefixes"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.alquimia_assets.arn}/uploads/pdfs/*",
          "${aws_s3_bucket.alquimia_assets.arn}/generated/*"
        ]
      },
      {
        Sid    = "EnqueueAsyncJobsToMainSQS"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = [
          aws_sqs_queue.alquimia_jobs.arn
        ]
      }
    ]
  })
}
