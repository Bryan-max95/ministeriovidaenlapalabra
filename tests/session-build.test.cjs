const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Load the real auth module with an isolated environment and no database/network.
// This reproduces Next.js importing the route dependency during its build.
function loadAuth(env) {
  const source = fs.readFileSync(path.join(__dirname, '../lib/server-db.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = name => {
    if (name === 'server-only') return {};
    if (name === './postgres-store') return {
      currentDatabase() { throw new Error('Unexpected database access'); },
      stageDatabase() { throw new Error('Unexpected database write'); },
    };
    if (name === './types') return { ALL_RMS_MODULES: [] };
    if (name === './date-utils') return {};
    return require(name);
  };
  new Function('require', 'module', 'exports', 'process', compiled)(localRequire, module, module.exports, { env });
  return module.exports;
}

const root = { id: 'usr-root-bwp', username: 'bwp', fullName: 'Root', role: 'SuperUsuario', isRoot: true };

test('the server module imports without SESSION_SECRET during a build', () => {
  assert.equal(typeof loadAuth({}).createSessionToken, 'function');
});

test('authentication still rejects absent, short or whitespace-only secrets', () => {
  for (const secret of [undefined, '', 'short', ' '.repeat(48)]) {
    const auth = loadAuth({ SESSION_SECRET: secret });
    assert.throws(() => auth.createSessionToken(root), /SESSION_SECRET/);
    assert.throws(() => auth.verifySessionToken('payload.signature'), /SESSION_SECRET/);
  }
});

test('a valid private key signs and verifies sessions; tampering fails', () => {
  const auth = loadAuth({ SESSION_SECRET: 'a'.repeat(48) });
  const token = auth.createSessionToken(root);
  assert.equal(auth.verifySessionToken(token).id, root.id);
  assert.equal(auth.verifySessionToken(token + 'tampered'), null);
  assert.equal(loadAuth({ SESSION_SECRET: 'b'.repeat(48) }).verifySessionToken(token), null);
});
