# Matriz de Permisos Row Level Security (RLS) — Alquimia LMS

Todas las tablas en `public` y `nutricionista` tienen `ENABLE ROW LEVEL SECURITY` activo. El rol `service_role` (utilizado exclusivamente en Route Handlers server-side y AWS Lambda) omite RLS por diseño de PostgreSQL/Supabase bajo autenticación de servidor.

| Esquema y Tabla | `anon` (Sin sesión) | `authenticated` (Estudiante) | `service_role` (BFF / Admin / Lambda) |
| :--- | :--- | :--- | :--- |
| `public.quiz_attempts` | Sin acceso | `SELECT`, `INSERT` solo si `auth.uid() = user_id` | Acceso completo |
| `public.lms_notifications` | Sin acceso | `SELECT`, `UPDATE` solo si `auth.uid() = user_id` | Acceso completo |
| `public.async_jobs` | Sin acceso | `SELECT` solo si `auth.uid() = user_id` | Acceso completo |
| `nutricionista.pasos_completados` | Sin acceso | `SELECT`, `INSERT`, `DELETE` solo si `auth.uid() = user_id` | Acceso completo |
| `nutricionista.documentos` | Sin acceso | `SELECT` (catálogo de estudio) | Acceso completo (mutaciones `/api/admin/*`) |
| `nutricionista.tarjetas` | Sin acceso | `SELECT` (tarjetas de lección) | Acceso completo (mutaciones `/api/admin/*`) |

## Consulta de Auditoría SQL

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname IN ('public', 'nutricionista')
ORDER BY schemaname, tablename;
```
Todas las filas deben devolver `rowsecurity = true`.
