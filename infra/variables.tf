variable "project_name" {
  description = "Nombre base del proyecto para prefijos de recursos AWS"
  type        = string
  default     = "alquimia-lms"
}

variable "environment" {
  description = "Entorno de despliegue (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "Región AWS de despliegue (eu-west-1 recomendada para baja latencia en España)"
  type        = string
  default     = "eu-west-1"
}

variable "allowed_origins" {
  description = "Orígenes CORS permitidos para subida directa S3 vía Presigned URLs"
  type        = list(string)
  default     = ["http://localhost:3100", "http://127.0.0.1:3100"]
}

variable "lambda_image_uri" {
  description = "URI completa de la imagen Docker en ECR para el worker cerebro-py (opcional; por defecto usa :latest del repo ECR creado)"
  type        = string
  default     = ""
}

variable "budget_alert_email" {
  description = "Email para alertas de AWS Budgets (5 EUR/mes). Si está vacío, se omite el envío por correo."
  type        = string
  default     = ""
}

variable "supabase_url" {
  description = "URL del proyecto Supabase para actualizar estado de async_jobs desde Lambda"
  type        = string
  default     = ""
}

variable "supabase_service_role_key" {
  description = "Service Role Key de Supabase (solo servidor/worker, nunca exponer en logs)"
  type        = string
  sensitive   = true
  default     = ""
}
