# Despliegue en Vercel

## Importar el repositorio

1. En Vercel selecciona **Add New → Project** e importa `Bryan-max95/ministeriovidaenlapalabra`.
2. Usa la raíz del repositorio, framework **Next.js**, Node.js **22.x** y la rama `main`.
3. Conserva la instalación automática de dependencias. El proyecto utiliza `pnpm-lock.yaml` y declara `pnpm@9.15.4`. Si activas Corepack, utiliza esa versión declarada.
4. Añade las variables privadas siguientes antes del primer despliegue. No copies los valores de ejemplo literalmente.

| Variable | Valor que debes configurar |
| --- | --- |
| `DATABASE_URL` | Conexión privada de Neon, con SSL y channel binding |
| `SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres; usa el mismo del entorno que quieras conservar |
| `ROOT_SUPERUSER_USERNAME` | Usuario raíz privado |
| `ROOT_SUPERUSER_PASSWORD` | Contraseña privada del usuario raíz |
| `LEGACY_PASSWORD_SECRET` | Opcional: secreto anterior solo si importaste cuentas con hashes HMAC |

Configura los valores para **Production** y, si vas a usarla, **Preview**. No añadas `NEXT_PUBLIC_` a estos nombres. `.env`, `.env.local`, las compilaciones y el almacén de dependencias están excluidos de Git. El SQL y `.env.example` no incluyen credenciales reales.

El esquema de Neon ya se inicializó durante la preparación local. Si cambias a otra base, ejecuta `npm run db:setup` desde un entorno de confianza con su conexión privada, o ejecuta `sql/schema.sql` en el editor de Neon. El comando de compilación no reinicia ni modifica la base.

El proyecto valida `SESSION_SECRET` cuando necesita firmar o verificar una sesión, sin bloquear la compilación si falta. Es obligatorio configurarlo para que el inicio de sesión funcione. Las cookies administrativas usan HTTPS en producción. El alojamiento debe poder conectarse al endpoint de Neon.

## Dominio

Después del despliegue añade `ministeriovidaenlapalabra.online` en **Settings → Domains** y configura en el proveedor DNS los registros que indique Vercel. Espera a que Vercel confirme el dominio y su certificado HTTPS.

- `/`: formulario para que los hermanos registren invitados.
- `/registro/[slug]`: formularios personalizados.
- `/miniterio/bwp`: acceso administrativo con inicio de sesión.

Los QR y enlaces compartidos ya utilizan el dominio oficial. Hasta que el dominio esté conectado, prueba las rutas directamente en la URL del despliegue de Vercel.

Renueva la contraseña de Neon compartida en el chat antes de producción y actualiza la variable privada correspondiente en Vercel.

Documentación oficial: [paquetes y lockfiles](https://vercel.com/docs/package-managers), [Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [variables privadas](https://vercel.com/docs/environment-variables).

## Error: SESSION_SECRET debe tener al menos 32 caracteres

Este error indica que la variable está ausente, vacía o es demasiado corta en el entorno del despliegue. En Settings → Environment Variables crea o corrige SESSION_SECRET, selecciona Production y, si corresponde, Preview, y pega el valor real del archivo privado local .env.vercel, sin las comillas exteriores. No pegues el nombre de la variable ni un valor de ejemplo.

Los archivos .env locales no se publican en GitHub ni se copian automáticamente a Vercel. Después de guardar las variables, crea un nuevo despliegue desde el último commit de main. Los despliegues anteriores no reciben los cambios de variables.
