// Integration check against a locally running server. Temporary QA rows are removed in finally.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { connect } = require('./db-common.cjs');
const base = process.env.TEST_BASE_URL || 'http://localhost:3100';
const tag = 'qa-' + crypto.randomUUID();
const username = tag;
const password = crypto.randomBytes(24).toString('hex');
const phone = '9' + String(crypto.randomInt(1000000, 9999999));
const fullName = tag + ' Invitado';
let token;
let client;
async function request(path, method = 'GET', body, authenticated = false) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(authenticated ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
  return { response, data };
}
(async () => {
  try {
    client = await connect();
    for (const path of ['/', '/?view=rms', '/miniterio/bwp', '/registro/visitantes']) {
      const { response, data } = await request(path);
      assert.equal(response.status, 200, 'La ruta debe responder: ' + path);
      if (path === '/' || path === '/?view=rms' || path === '/registro/visitantes') {
        assert(!data.includes('Panel Administrativo RMS') && !data.includes('Acceso Administrativo RMS'), 'El formulario público no debe exponer botones administrativos.');
      }
    }
    assert.equal((await request('/api/rms/overview')).response.status, 401);
    assert.equal((await request('/api/public/form?slug=' + tag)).response.status, 404);
    let result = await request('/api/auth/login', 'POST', { username: process.env.ROOT_SUPERUSER_USERNAME || 'bwp', password: process.env.ROOT_SUPERUSER_PASSWORD });
    assert.equal(result.response.status, 200, 'Acceso raíz');
    token = result.data.token;
    assert(token);
    assert(result.response.headers.get('set-cookie').includes('HttpOnly'));
    const overview = (await request('/api/rms/overview','GET',undefined,true)).data;
    assert(overview.settings && Array.isArray(overview.persons));
    const slug = tag;
    result = await request('/api/rms/forms', 'POST', { name: tag, memberName: 'Equipo QA', slug }, true);
    assert.equal(result.response.status, 200, 'Crear formulario');
    assert.equal((await request('/api/public/form?slug=' + slug)).data.form.memberName, 'Equipo QA');
    assert.equal((await request('/api/rms/forms', 'POST', { name: tag, memberName: 'Equipo QA', slug }, true)).response.status, 409);
    result = await request('/api/rms/users','POST',{ username, password, fullName: tag, role: 'Registrador', allowedModules: ['dashboard','registrar'] },true);
    assert.equal(result.response.status,200,'Crear cuenta persistente');
    assert.equal((await request('/api/auth/login','POST',{ username, password })).response.status,200,'Iniciar sesión con la cuenta de PostgreSQL');
    const registration = { fullName, phone, address: 'Dirección de prueba QA', invitedByMember: 'Equipo QA', formSlug: slug };
    const registrations = await Promise.all(Array.from({length:3},()=>request('/api/public/register','POST',registration)));
    assert(registrations.every(r=>r.response.status===200),'Las tres escrituras simultáneas deben guardarse.');
    const rows = await client.query('SELECT id, "registrationNumber" FROM mvp.persons WHERE "fullName" = $1',[fullName]);
    assert.equal(rows.rowCount,1,'El teléfono debe identificar a una sola persona.');
    const personId=rows.rows[0].id;
    let visits=await client.query('SELECT id FROM mvp.visits WHERE "personId"=$1',[personId]);
    assert.equal(visits.rowCount,3,'Las tres visitas deben persistir sin sobrescribirse.');
    result=await request('/api/rms/visits','PATCH',{visitId:visits.rows[0].id,status:'attended'},true);
    assert.equal(result.response.status,200,'Confirmación de llegada');
    assert(result.data.visit.arrivedAt);
    // A database constraint must roll back a person created earlier in the same request.
    const invalidName=tag+' Fecha inválida';
    result=await request('/api/public/register','POST',{...registration, fullName:invalidName, phone:'8'+phone.slice(1),visitDate:'2099-02-31'});
    assert.equal(result.response.status,503,'El fallo de persistencia debe comunicarse.');
    assert.equal((await client.query('SELECT id FROM mvp.persons WHERE "fullName"=$1',[invalidName])).rowCount,0,'No debe quedar una persona tras la reversión.');
    const current=(await request('/api/rms/overview','GET',undefined,true)).data;
    assert.equal(current.persons.find(p=>p.id===personId).visitCount,3);
    result=await request('/api/rms/forms','PATCH',{id:current.forms.find(f=>f.slug===slug).id,isActive:false},true);
    assert.equal(result.response.status,200);
    assert.equal((await request('/api/public/register','POST',registration)).response.status,403,'Un formulario desactivado no debe aceptar registros.');
    assert.equal((await request('/api/public/register','POST',{...registration,formSlug:tag+'-missing'})).response.status,404);
    console.log('OK: rutas públicas y panel, autenticación, formularios, usuarios, 3 registros concurrentes, deduplicación, asistencia, persistencia y reversión ante fallos.');
  } catch(error) {
    console.error('Falló la verificación: '+error.message);
    process.exitCode=1;
  } finally {
    if(client) {
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(7152026)');
        await client.query('DELETE FROM mvp.persons WHERE "fullName" LIKE $1',[tag+'%']);
        await client.query('DELETE FROM mvp.users WHERE username=$1',[username]);
        await client.query('DELETE FROM mvp.forms WHERE slug=$1',[tag]);
        await client.query('COMMIT');
        console.log('Datos temporales de QA eliminados.');
      } catch { await client.query('ROLLBACK').catch(()=>{}); console.error('No se pudo completar la limpieza de QA.');process.exitCode=1; }
      await client.end();
    }
  }
})();
