-- =============================================================================
-- Habilitar RLS en tablas public (lint Supabase: rls_disabled_in_public)
--
-- La app NO usa PostgREST/anon para SQL: el backend conecta con el rol
-- postgres (bypassa RLS). Sin políticas, anon/authenticated quedan bloqueados
-- vía API de Supabase — comportamiento correcto y seguro.
-- Idempotente. No altera datos ni lógica de negocio.
-- =============================================================================

SET search_path TO public;

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suggested_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.machine_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.component_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parameters ENABLE ROW LEVEL SECURITY;

-- Quitar acceso directo PostgREST a roles expuestos (defensa en profundidad)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
  END IF;
END $$;

-- Verificación
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'users', 'reports', 'components', 'photos', 'videos',
    'suggested_parts', 'machine_types', 'component_types',
    'resources', 'parameters'
  )
ORDER BY c.relname;
