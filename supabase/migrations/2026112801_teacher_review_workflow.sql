-- Fase B1: Flujo de revisión docente (borrador | publicado) y reporte de verificación numérica

ALTER TABLE nutricionista.documentos
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'publicado'
    CHECK (estado IN ('borrador', 'publicado')),
  ADD COLUMN IF NOT EXISTS verification_report jsonb;

ALTER TABLE nutricionista.tarjetas
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_documentos_estado
  ON nutricionista.documentos (estado);
