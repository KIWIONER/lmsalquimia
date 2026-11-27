output "s3_bucket_name" {
  description = "Nombre del bucket S3 privado para PDFs y resultados generados"
  value       = aws_s3_bucket.alquimia_assets.bucket
}

output "s3_bucket_arn" {
  description = "ARN del bucket S3 privado"
  value       = aws_s3_bucket.alquimia_assets.arn
}

output "sqs_queue_url" {
  description = "URL de la cola principal SQS (asignar a AWS_SQS_QUEUE_URL en Next.js)"
  value       = aws_sqs_queue.alquimia_jobs.url
}

output "sqs_dlq_url" {
  description = "URL de la Dead-Letter Queue (DLQ) tras 3 fallos"
  value       = aws_sqs_queue.alquimia_jobs_dlq.url
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR para subir la imagen Docker de cerebro-py"
  value       = aws_ecr_repository.alquimia_worker.repository_url
}

output "lambda_function_name" {
  description = "Nombre de la función AWS Lambda worker"
  value       = aws_lambda_function.alquimia_worker.function_name
}
