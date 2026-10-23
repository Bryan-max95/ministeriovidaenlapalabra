const fs = require('node:fs');
const path = require('node:path');
const { connect } = require('./db-common.cjs');
(async () => {
  let client;
  try {
    client = await connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7152026)');
    await client.query(fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Esquema PostgreSQL inicializado. Los datos existentes se conservaron.');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('No se pudo inicializar PostgreSQL. Código: ' + (error.code || 'CONNECTION_ERROR'));
    process.exitCode = 1;
  } finally { if (client) await client.end(); }
})();
