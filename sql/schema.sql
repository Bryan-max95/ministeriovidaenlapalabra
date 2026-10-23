-- Ministerio Vida en la Palabra: esquema completo para Neon/PostgreSQL.
-- Esquema separado para no interferir con tablas existentes.
CREATE SCHEMA IF NOT EXISTS mvp;

CREATE TABLE IF NOT EXISTS mvp.users (
  id text PRIMARY KEY,
  username text NOT NULL,
  "fullName" text NOT NULL,
  "passwordHash" text NOT NULL,
  role text NOT NULL CHECK (role IN ('SuperUsuario', 'Administrador', 'Registrador')),
  "isActive" boolean NOT NULL DEFAULT true,
  "allowedModules" text[],
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON mvp.users (lower(username));

CREATE TABLE IF NOT EXISTS mvp.forms (
  id text PRIMARY KEY,
  name text NOT NULL,
  "memberName" text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text NOT NULL DEFAULT '',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mvp.persons (
  id text PRIMARY KEY,
  "registrationNumber" integer NOT NULL UNIQUE CHECK ("registrationNumber" > 0),
  "fullName" text NOT NULL,
  phone text NOT NULL,
  "normalizedPhone" text NOT NULL UNIQUE,
  address text NOT NULL DEFAULT '',
  "invitedByMember" text NOT NULL DEFAULT '',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS persons_name_idx ON mvp.persons (lower("fullName"));

CREATE TABLE IF NOT EXISTS mvp.visits (
  id text PRIMARY KEY,
  "personId" text NOT NULL REFERENCES mvp.persons(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  "visitDate" date NOT NULL,
  "registeredAt" timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('invited', 'attended')),
  "arrivedAt" timestamptz,
  "invitedByMember" text NOT NULL DEFAULT '',
  "registeredByUserId" text REFERENCES mvp.users(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  "registeredByName" text NOT NULL DEFAULT '',
  "formId" text REFERENCES mvp.forms(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  source text NOT NULL CHECK (source IN ('public_form', 'admin_panel'))
);
CREATE INDEX IF NOT EXISTS visits_person_idx ON mvp.visits ("personId");
CREATE INDEX IF NOT EXISTS visits_date_status_idx ON mvp.visits ("visitDate", status);
CREATE INDEX IF NOT EXISTS visits_form_idx ON mvp.visits ("formId");

CREATE TABLE IF NOT EXISTS mvp.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "ministryName" text NOT NULL,
  subtitle text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Tegucigalpa',
  "customLogoDataUrl" text,
  "adminDateOverridePin" text NOT NULL,
  "adminAllowedModules" text[] NOT NULL,
  "registradorAllowedModules" text[] NOT NULL
);

INSERT INTO mvp.settings (id, "ministryName", subtitle, timezone,
  "adminDateOverridePin", "adminAllowedModules", "registradorAllowedModules")
VALUES (1, 'MINISTERIO VIDA EN LA PALABRA',
  'Sistema de Registro de Invitados y Verificación de Visitas', 'America/Tegucigalpa',
  '2026', ARRAY['dashboard','visitantes','registrar','formularios','qr','reportes','usuarios','configuracion'],
  ARRAY['dashboard','visitantes','registrar','formularios','qr'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO mvp.forms (id, name, "memberName", slug, description)
VALUES ('frm-principal', 'Formulario general', '', 'visitantes', 'Registro público de invitados')
ON CONFLICT DO NOTHING;
