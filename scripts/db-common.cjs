const { createRequire } = require('node:module');
const nextRequire = createRequire(require.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(process.cwd());
const { Client } = require('pg');
exports.connect = async () => {
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en .env.local o en el servidor.');
  const connectionUrl = new URL(process.env.DATABASE_URL);
  if (connectionUrl.searchParams.get('sslmode') === 'require') connectionUrl.searchParams.set('sslmode', 'verify-full');
  const client = new Client({ connectionString: connectionUrl.toString(), enableChannelBinding: true, connectionTimeoutMillis: 15000 });
  await client.connect();
  return client;
};
