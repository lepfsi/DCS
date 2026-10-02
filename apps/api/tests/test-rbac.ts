import assert from 'assert';
import { requireRoles } from '../src/auth';

// RBAC : viewer refusé sur route doc_manager, admin passe toujours.
function fakeRes() {
  let code = 0; let body: any = null;
  const res: any = { status: (c: number) => { code = c; return { json: (b: any) => { body = b; } }; } };
  return { res, get: () => ({ code, body }) };
}
function main() {
  let nextCalled = false;
  const mw = requireRoles('admin', 'doc_manager');
  const { res, get } = fakeRes();
  mw({ user: { role: 'viewer' } } as any, res, () => { nextCalled = true; });
  assert.strictEqual(get().code, 403, 'viewer aurait dû être refusé (403)');
  assert.strictEqual(nextCalled, false);
  nextCalled = false;
  const r2 = fakeRes();
  mw({ user: { role: 'admin', id: 'x', email: 'a', displayName: 'a' } } as any, r2.res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'admin doit passer');
  console.log('test-rbac OK (403 viewer, pass admin)');
}
main();
