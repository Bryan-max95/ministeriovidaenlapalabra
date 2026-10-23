# PostgreSQL — Ministerio Vida en la Palabra

Este documento incluye el SQL completo para Neon. El archivo ejecutable es `sql/schema.sql`; `npm run db:docs` mantiene esta documentación y la descarga SQL del panel sincronizadas.

## Rutas

- Formulario principal: https://ministeriovidaenlapalabra.online/
- Formularios personalizados: https://ministeriovidaenlapalabra.online/registro/nombre-del-miembro
- Panel con inicio de sesión: https://ministeriovidaenlapalabra.online/miniterio/bwp

Se conserva exactamente `miniterio`, según lo solicitado. El formulario público no incluye acceso al panel. Los enlaces compartidos y los QR utilizan el dominio oficial, incluso cuando el panel se ejecuta en localhost. En desarrollo se pueden visitar las mismas rutas con `http://localhost:3000`.

## Variables privadas

Configura en `.env.local` para desarrollo y en el gestor de secretos del alojamiento para producción:

```dotenv
DATABASE_URL="postgresql://USUARIO:CONTRASENA@HOST/BASE?sslmode=require&channel_binding=require"
SESSION_SECRET="UN_SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES"
ROOT_SUPERUSER_USERNAME="bwp"
ROOT_SUPERUSER_PASSWORD="UNA_CONTRASENA_PRIVADA"
```

No uses el prefijo `NEXT_PUBLIC_` para estas variables. No subas `.env` ni `.env.local` al repositorio. La conexión se usa únicamente en módulos `server-only` y scripts de administración. Renueva la contraseña compartida en el chat y actualiza `DATABASE_URL` antes de producción.

## Inicialización

```powershell
pnpm install
npm run db:setup
npm run dev
```

También puedes copiar el bloque SQL de este documento al editor SQL de Neon. Crea únicamente el esquema `mvp`, tablas, índices, configuración inicial y formulario general. No borra datos existentes ni necesita crear otra base en Neon. `CREATE TABLE IF NOT EXISTS` permite repetir la inicialización; no sustituye futuras migraciones de columnas.

## Qué se guarda

| Tabla | Información |
| --- | --- |
| `mvp.users` | Usuarios, hashes de contraseñas, roles, estado y permisos individuales |
| `mvp.forms` | Formularios, miembro, slug personalizado y estado |
| `mvp.persons` | Código único, nombre, teléfono normalizado, dirección e invitador |
| `mvp.visits` | Historial, fecha, llegada, estado de asistencia, formulario, responsable y origen |
| `mvp.settings` | Ministerio, subtítulo, zona horaria, logotipo, PIN y permisos por rol |

El superusuario raíz se configura mediante variables privadas. Sus visitas conservan su nombre, pero el identificador de usuario se guarda como NULL porque no es una cuenta de `mvp.users`. Las estadísticas y los reportes se calculan de los registros; los QR se generan desde el slug, sin almacenar imágenes duplicadas. El logotipo se conserva como una URL de datos.

Las columnas entre comillas conservan los nombres de los campos de la aplicación. Los identificadores son de tipo texto para ser compatibles con los respaldos existentes. Las consultas usan parámetros para los datos. Las escrituras se ejecutan en una transacción con bloqueo compartido entre instancias; si falla la escritura, la API devuelve error y revierte la transacción. Las lecturas usan un bloqueo compartido compatible entre lectores.

La implementación carga una instantánea del sistema por solicitud y escribe los registros modificados. Es adecuada para el volumen actual de este sistema; para grandes volúmenes se deberán introducir consultas paginadas por módulo.

## Datos del sistema anterior

El sistema anterior guardaba un JSON temporal, no una base PostgreSQL. Descarga un respaldo antes de reemplazar una instalación que contenga registros.

Para importar a una base recién inicializada:

```powershell
npm run db:import -- "C:\ruta\respaldo.json"
```

La importación rechaza una base con datos de usuarios, personas, visitas o formularios personalizados. Es transaccional y conserva los identificadores; referencias antiguas a formularios o al superusuario virtual se convierten a NULL cuando corresponda. Los teléfonos o códigos duplicados deben corregirse en el respaldo antes de importarlo. También existe la restauración explícita desde el panel, que reemplaza sus registros.

Para contraseñas antiguas HMAC, conserva el secreto con el que se crearon o configura `LEGACY_PASSWORD_SECRET` en el servidor. Las nuevas contraseñas se guardan con scrypt y sal aleatoria. Un cambio de `SESSION_SECRET` invalida las sesiones anteriores.

## Dominio y despliegue

Despliega esta aplicación en un alojamiento compatible con Next.js y Node.js con acceso a Neon. Configura allí las variables privadas, añade `ministeriovidaenlapalabra.online` como dominio personalizado y utiliza los registros DNS que indique ese proveedor. Activa HTTPS y redirige cualquier dominio alternativo al dominio oficial. Esas operaciones necesitan acceso al alojamiento y al proveedor DNS; cambiar las rutas locales no configura el dominio en Internet.

Referencia del controlador: [node-postgres: conexiones SSL](https://node-postgres.com/features/ssl) y [transacciones con un único cliente](https://node-postgres.com/apis/pool).

## SQL completo


```sql
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
```
