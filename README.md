# Ministerio Vida en la Palabra — RMS

Aplicación Next.js para registrar invitados y administrar personas, visitas, formularios, códigos QR, reportes, usuarios y permisos. La persistencia utiliza Neon/PostgreSQL exclusivamente desde el servidor.

## Rutas

- `/`: formulario público principal.
- `/registro/[slug]`: formulario personalizado del miembro.
- `/miniterio/bwp`: panel administrativo con inicio de sesión.

Los enlaces para compartir y los códigos QR utilizan `https://ministeriovidaenlapalabra.online`. Para probar localmente, visita las rutas en `http://localhost:3000`. El formulario no incluye botones de acceso al panel y `?view=rms` ya no lo abre.

## Instalación

1. Instala las dependencias con `pnpm install`.
2. Crea `.env.local` a partir de `.env.example` y configura las variables privadas.
3. Inicializa PostgreSQL con `npm run db:setup`.
4. Inicia el desarrollo con `npm run dev`.
5. Para producción: `npm run build` y `npm run start`.

El usuario raíz y su contraseña se configuran en las variables privadas `ROOT_SUPERUSER_USERNAME` y `ROOT_SUPERUSER_PASSWORD`. No hay contraseñas de acceso predeterminadas en el código. Cambia el PIN inicial de corrección de fechas desde Configuración antes de usar la plataforma públicamente.

## Base de datos y respaldos

Consulta [sqlposgres.md](sqlposgres.md) para el SQL completo, variables, tablas, migración de respaldos anteriores y configuración del dominio. El esquema ejecutable es [sql/schema.sql](sql/schema.sql).

- `npm run db:setup`: crea el esquema sin borrar los datos existentes.
- `npm run db:import -- "ruta/respaldo.json"`: importa un respaldo anterior a una base vacía.
- `npm run db:docs`: actualiza la documentación y el SQL descargable desde el panel.

Las escrituras son transaccionales y serializadas entre instancias para evitar pérdida de registros simultáneos. El sistema devuelve error si no puede persistir; no usa almacenamiento temporal como alternativa. La implementación actual carga una instantánea completa por solicitud; un crecimiento considerable requerirá paginación y consultas específicas por módulo.

## Despliegue

Se requiere alojamiento con Node.js/Next.js y acceso a Neon. Configura sus variables privadas, asocia `ministeriovidaenlapalabra.online`, actualiza DNS con los registros que proporcione el alojamiento y activa HTTPS. La configuración del dominio se realiza con el proveedor, fuera de este repositorio.

## Verificación de integración

Después de compilar, inicia la aplicación con `pnpm exec next start -p 3100` y ejecuta `node scripts/verify-integration.cjs` en otra terminal. La prueba usa la base configurada, crea registros temporales identificados y los elimina al terminar. Verifica rutas, autenticación, registros simultáneos, asistencia y reversión ante errores.

Para Vercel, consulta [docs/VERCEL.md](docs/VERCEL.md): configuración del proyecto, variables privadas y dominio personalizado.
