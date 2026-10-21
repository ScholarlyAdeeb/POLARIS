import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDemoMayAct, assertNotOwnWork, demoSandbox, demoScopeSql, isDemoUser } from '../server/guards.ts';
import type { SessionUser } from '../server/auth.ts';

const user = (id: number, email: string, role: SessionUser['role'] = 'admin'): SessionUser => ({ id, email, name: `u${id}`, institution: '', role });
const demoAdmin = user(2, 'admin@demo.polaris.local');
const realAdmin = user(7, 'reviewer@ncpor.res.in');
const fakeDb: any = { all: async () => [{ id: 1 }, { id: 2 }] }; // demo accounts are users 1 and 2

const run = (u: SessionUser | undefined, method: string, path: string) =>
  new Promise<any>((resolve) => demoSandbox()({ user: u, method, path } as any, {} as any, (err?: any) => resolve(err ?? null)));

test('demo accounts are recognised by their email domain', () => {
  assert.equal(isDemoUser(demoAdmin), true);
  assert.equal(isDemoUser(user(3, 'USER1@DEMO.POLARIS.LOCAL')), true);
  assert.equal(isDemoUser(realAdmin), false);
  assert.equal(isDemoUser(undefined), false);
});

test('demo sandbox blocks account, proposal and destructive admin routes', async () => {
  for (const [m, p] of [
    ['GET', '/users'],
    ['PATCH', '/users/5'],
    ['GET', '/proposals'],
    ['PATCH', '/proposals/NCPOR-PRP-1'],
    ['POST', '/archive'],
    ['DELETE', '/archive/REC-1'],
    ['POST', '/uploads'],
  ]) {
    const err = await run(demoAdmin, m, p);
    assert.equal(err?.status, 403, `${m} ${p} should be blocked for the demo reviewer`);
  }
});

test('demo sandbox lets review routes through and never limits real reviewers', async () => {
  assert.equal(await run(demoAdmin, 'GET', '/submissions'), null);
  assert.equal(await run(demoAdmin, 'POST', '/archive/REC-1/review'), null);
  assert.equal(await run(demoAdmin, 'PATCH', '/outreach/4'), null);
  // Passed through; api.ts limits it to access and Hindi text on demo-owned records.
  assert.equal(await run(demoAdmin, 'PATCH', '/archive/REC-1'), null);
  assert.equal(await run(realAdmin, 'DELETE', '/archive/REC-1'), null);
  assert.equal(await run(realAdmin, 'GET', '/users'), null);
});

test('demo reviewer may only act on demo-owned content', async () => {
  await assertDemoMayAct(fakeDb, { user: demoAdmin } as any, [1]);
  await assert.rejects(assertDemoMayAct(fakeDb, { user: demoAdmin } as any, [42]), (e: any) => e.status === 403);
  await assert.rejects(assertDemoMayAct(fakeDb, { user: demoAdmin } as any, [null]), (e: any) => e.status === 403);
  await assertDemoMayAct(fakeDb, { user: realAdmin } as any, [42]); // real reviewers are not limited
});

test('demo scope SQL filters lists to demo owners only for demo users', async () => {
  const demo = await demoScopeSql(fakeDb, { user: demoAdmin } as any, 'a.owner_id');
  assert.match(demo.sql, /a\.owner_id IN \(\?,\?\)/);
  assert.deepEqual(demo.params.sort(), [1, 2]);
  assert.deepEqual(await demoScopeSql(fakeDb, { user: realAdmin } as any, 'a.owner_id'), { sql: '', params: [] });
});

test('two-person rule: nobody approves their own work', () => {
  assert.throws(() => assertNotOwnWork(realAdmin, [7], 'a post'), (e: any) => e.status === 409 && /Two-person rule/.test(e.message));
  assertNotOwnWork(realAdmin, [8], 'a post');
  assertNotOwnWork(realAdmin, [null, undefined], 'a post');
  assertNotOwnWork({ ...realAdmin, id: 0 }, [0], 'a post'); // the shared admin token owns nothing
});
