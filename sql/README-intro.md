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
