-- ==============================================================================
-- Migración Fase 1: Tabla async_jobs + RLS + Realtime
-- Alquimia LMS — Backend Asíncrono (Next.js + SQS/Lambda + Supabase)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.async_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('pdf_structure', 'generate_quiz_long', 'progress_report')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    input_key TEXT,
    result_url TEXT,
    result_payload JSONB,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    correlation_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para polling y consulta de historial por usuario
CREATE INDEX IF NOT EXISTS idx_async_jobs_user_created
    ON public.async_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_async_jobs_status
    ON public.async_jobs (status);

-- Trigger automático para updated_at
CREATE OR REPLACE FUNCTION public.set_async_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_async_jobs_updated_at ON public.async_jobs;
CREATE TRIGGER tr_async_jobs_updated_at
    BEFORE UPDATE ON public.async_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_async_jobs_updated_at();

-- Row Level Security (Zero Trust: usuarios solo leen sus propios jobs)
ALTER TABLE public.async_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "async_jobs_select_own" ON public.async_jobs;
CREATE POLICY "async_jobs_select_own"
    ON public.async_jobs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Habilitar Supabase Realtime para notificaciones al frontend
ALTER PUBLICATION supabase_realtime ADD TABLE public.async_jobs;
