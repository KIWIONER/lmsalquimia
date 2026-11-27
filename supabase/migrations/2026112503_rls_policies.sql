-- ==============================================================================
-- Migración: Row Level Security (RLS) Estricto (Zero Trust)
-- 100% de las tablas protegidas. Ninguna tabla privada permite acceso cruzado.
-- ==============================================================================

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.async_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutricionista.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutricionista.tarjetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutricionista.pasos_completados ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de aislamiento por usuario (public.quiz_attempts)
DROP POLICY IF EXISTS "quiz_attempts_select_own" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_select_own"
    ON public.quiz_attempts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "quiz_attempts_insert_own" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_insert_own"
    ON public.quiz_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. Políticas de aislamiento por usuario (public.lms_notifications)
DROP POLICY IF EXISTS "lms_notifications_select_own" ON public.lms_notifications;
CREATE POLICY "lms_notifications_select_own"
    ON public.lms_notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lms_notifications_update_own" ON public.lms_notifications;
CREATE POLICY "lms_notifications_update_own"
    ON public.lms_notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Políticas de aislamiento por usuario (public.async_jobs)
DROP POLICY IF EXISTS "async_jobs_select_own" ON public.async_jobs;
CREATE POLICY "async_jobs_select_own"
    ON public.async_jobs FOR SELECT
    USING (auth.uid() = user_id);

-- 5. Políticas de aislamiento por usuario (nutricionista.pasos_completados)
DROP POLICY IF EXISTS "pasos_completados_select_own" ON nutricionista.pasos_completados;
CREATE POLICY "pasos_completados_select_own"
    ON nutricionista.pasos_completados FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pasos_completados_insert_own" ON nutricionista.pasos_completados;
CREATE POLICY "pasos_completados_insert_own"
    ON nutricionista.pasos_completados FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pasos_completados_delete_own" ON nutricionista.pasos_completados;
CREATE POLICY "pasos_completados_delete_own"
    ON nutricionista.pasos_completados FOR DELETE
    USING (auth.uid() = user_id);

-- 6. Catálogo docente (nutricionista.documentos y tarjetas):
-- Lectura para usuarios autenticados; escritura reservada a service_role (panel /admin server-side)
DROP POLICY IF EXISTS "documentos_select_authenticated" ON nutricionista.documentos;
CREATE POLICY "documentos_select_authenticated"
    ON nutricionista.documentos FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "tarjetas_select_authenticated" ON nutricionista.tarjetas;
CREATE POLICY "tarjetas_select_authenticated"
    ON nutricionista.tarjetas FOR SELECT
    TO authenticated
    USING (true);
