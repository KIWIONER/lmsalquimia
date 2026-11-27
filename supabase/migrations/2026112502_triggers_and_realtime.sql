-- ==============================================================================
-- Migración: Triggers de Negocio y Publicación Supabase Realtime
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_failed_attempts()
RETURNS TRIGGER AS $$
DECLARE
    fail_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fail_count
    FROM (
        SELECT is_pass
        FROM public.quiz_attempts
        WHERE user_id = NEW.user_id
          AND unit_id = NEW.unit_id
          AND session_id = NEW.session_id
        ORDER BY created_at DESC
        LIMIT 3
    ) AS last_attempts
    WHERE is_pass = FALSE;

    IF fail_count = 3 THEN
        INSERT INTO public.lms_notifications (user_id, type, unit_id, message)
        VALUES (NEW.user_id, 'fail_trigger', NEW.unit_id, 'Refuerzo pedagógico necesario');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_failures ON public.quiz_attempts;
CREATE TRIGGER tr_check_failures
    AFTER INSERT ON public.quiz_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.check_failed_attempts();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'lms_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lms_notifications;
    END IF;
END $$;
