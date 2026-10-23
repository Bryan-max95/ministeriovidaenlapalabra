const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'sql/schema.sql'), 'utf8');
fs.writeFileSync(path.join(root, 'lib/schema-sql.ts'), '// Generated from sql/schema.sql by npm run db:docs. Contains no credentials.\nexport const POSTGRESQL_SCHEMA_DDL = '+JSON.stringify(sql)+';\n');
const intro = fs.readFileSync(path.join(root, 'sql/README-intro.md'), 'utf8');
fs.writeFileSync(path.join(root, 'sqlposgres.md'), intro+'\n\n```sql\n'+sql+'```\n');
console.log('Documentación SQL actualizada.');
