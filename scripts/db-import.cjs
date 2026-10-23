// Importación explícita del respaldo JSON anterior, únicamente a una BD vacía.
const fs = require('node:fs');
const { connect } = require('./db-common.cjs');
(async () => {
  let client;
  try {
    if (!process.argv[2]) throw new Error('Uso: npm run db:import -- ruta-del-respaldo.json');
    const parsed = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const db = parsed.backup || parsed;
    for (const table of ['users','forms','persons','visits']) {
      if (!Array.isArray(db[table])) throw new Error('El respaldo no es válido: ' + table);
    }
    if (!db.settings) throw new Error('Falta la configuración del respaldo.');
    client = await connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7152026)');
    const existing = await client.query("SELECT (SELECT count(*) FROM mvp.persons) + (SELECT count(*) FROM mvp.visits) + (SELECT count(*) FROM mvp.users) + (SELECT count(*) FROM mvp.forms WHERE id <> 'frm-principal') AS total");
    if (Number(existing.rows[0].total)) throw new Error('La base contiene registros. Usa la restauración del panel para reemplazarlos explícitamente.');
    if (db.forms.some(f => f.slug === 'visitantes' && f.id !== 'frm-principal')) {
      await client.query("DELETE FROM mvp.forms WHERE id = 'frm-principal'");
    }
    const users = new Set(db.users.map(u=>u.id));
    const forms = new Set(db.forms.map(f=>f.id));
    db.visits = db.visits.map(v=>({...v, registeredByUserId: users.has(v.registeredByUserId) ? v.registeredByUserId : null, formId: forms.has(v.formId) ? v.formId : null}));
    for (const table of ['users','forms','persons','visits']) {
      if (!db[table].length) continue;
      const columns = await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position', ['mvp',table]);
      const names = columns.rows.map(r=>'"'+r.column_name+'"');
      const updates = names.filter(n=>n!=='"id"').map(n=>n+'=EXCLUDED.'+n);
      await client.query('INSERT INTO mvp.'+table+' ('+names.join(',')+') SELECT '+names.join(',')+' FROM jsonb_populate_recordset(NULL::mvp.'+table+', $1::jsonb) ON CONFLICT (id) DO UPDATE SET '+updates.join(','), [JSON.stringify(db[table])]);
    }
    const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'mvp' AND table_name = 'settings' AND column_name <> 'id'");
    const assignments = columns.rows.map(r=>'"'+r.column_name+'"=s."'+r.column_name+'"');
    await client.query('UPDATE mvp.settings SET '+assignments.join(',')+' FROM jsonb_populate_record(NULL::mvp.settings, $1::jsonb) s WHERE mvp.settings.id = 1', [JSON.stringify(db.settings)]);
    await client.query('COMMIT');
    console.log('Respaldo importado a PostgreSQL.');
  } catch(error) {
    if (client) await client.query('ROLLBACK').catch(()=>{});
    console.error(error.message.startsWith('Uso:') || error.message.startsWith('La base') || error.message.startsWith('Falta') || error.message.startsWith('El respaldo') ? error.message : 'No se pudo importar el respaldo. Código: '+(error.code || 'IMPORT_ERROR'));
    process.exitCode = 1;
  } finally { if (client) await client.end(); }
})();
