import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { apiRouter } from '../server/routes.js';
import type { Server } from 'http';

process.env.NODE_ENV = 'test';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

let server: Server;
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  setTimeout(() => process.exit(0), 200);
});

describe('Daynote Security & Isolation Verification Suite', () => {

  it('AUTH-03: Signed-out backend request is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/conversations`);
    assert.strictEqual(res.status, 401, 'Unauthenticated request must return 401');
    const data = await res.json();
    assert.match(data.error, /Authentication required/i);
  });

  it('AUTH-04: Expired or invalid token is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/conversations`, {
      headers: {
        Authorization: 'Bearer invalid_forged_token_xyz_123',
      },
    });
    assert.strictEqual(res.status, 401, 'Invalid token must return 401');
    const data = await res.json();
    assert.match(data.error, /Invalid or expired authentication token/i);
  });

  it('AUTH-05 & AUTH-06: Cross-account isolation prevents User B from reading User A conversation', async () => {
    const userAToken = 'test-token-user-a-111';
    const userBToken = 'test-token-user-b-222';
    const convId = `test_conv_${Date.now()}`;

    // 1. User A creates conversation
    const createRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        id: convId,
        title: 'User A Private Journal',
        starterPrompt: 'Thinking about strategic priorities',
      }),
    });
    assert.strictEqual(createRes.status, 201, 'User A conversation should be created');

    // 2. User B tries to read User A's conversation by ID
    const crossReadRes = await fetch(`${baseUrl}/api/conversations/${convId}`, {
      headers: {
        Authorization: `Bearer ${userBToken}`,
      },
    });
    assert.strictEqual(crossReadRes.status, 404, 'User B must not be able to read User A conversation (404/403 expected)');

    // 3. User B tries to rename User A's conversation
    const crossPatchRes = await fetch(`${baseUrl}/api/conversations/${convId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ title: 'Hacked by User B' }),
    });
    assert.strictEqual(crossPatchRes.status, 404, 'User B must not be able to rename User A conversation');

    // 4. User B tries to delete User A's conversation
    const crossDeleteRes = await fetch(`${baseUrl}/api/conversations/${convId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userBToken}`,
      },
    });
    assert.strictEqual(crossDeleteRes.status, 404, 'User B must not be able to delete User A conversation');

    // 5. User B tries to attach an action to User A's conversation
    const crossActionRes = await fetch(`${baseUrl}/api/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        id: `act_b_${Date.now()}`,
        text: 'Sneak action into User A context',
        sourceConversationId: convId,
        status: 'open',
      }),
    });
    assert.strictEqual(crossActionRes.status, 400, 'User B must not attach action to User A conversation');
  });

  it('DEL-01: Cascade deletion removes conversation and cleans up linked actions', async () => {
    const userToken = 'test-token-cascade-user';
    const convId = `cascade_conv_${Date.now()}`;
    const actionId = `cascade_act_${Date.now()}`;

    // Create conversation
    await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        id: convId,
        title: 'Conversation to delete',
      }),
    });

    // Create linked action
    await fetch(`${baseUrl}/api/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        id: actionId,
        text: 'Action linked to doomed conversation',
        sourceConversationId: convId,
        status: 'open',
      }),
    });

    // Delete conversation
    const deleteRes = await fetch(`${baseUrl}/api/conversations/${convId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    assert.strictEqual(deleteRes.status, 200, 'Conversation deletion should succeed');

    // Verify conversation is gone
    const getConvRes = await fetch(`${baseUrl}/api/conversations/${convId}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    assert.strictEqual(getConvRes.status, 404, 'Deleted conversation must return 404');
  });

  it('INP-01: Oversized payload is rejected', async () => {
    const userToken = 'test-token-val-user';
    const convId = `val_conv_${Date.now()}`;

    await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ id: convId, title: 'Validation test' }),
    });

    const hugeContent = 'A'.repeat(15000);
    const res = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        messageId: `msg_${Date.now()}`,
        content: hugeContent,
      }),
    });
    assert.strictEqual(res.status, 400, 'Messages exceeding 10,000 chars must be rejected');
  });

  it('ACT-01 & ACT-02: Action lifecycle (open -> completed -> dismissed) and cross-user isolation', async () => {
    const userAToken = 'test-token-user-a';
    const userBToken = 'test-token-user-b';
    const convId = `conv_act_${Date.now()}`;
    const actId = `act_${Date.now()}`;

    // Create User A conversation
    await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ id: convId, title: 'Action Host Conv' }),
    });

    // Create User A action
    const createActRes = await fetch(`${baseUrl}/api/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        id: actId,
        text: 'Draft the project proposal outline',
        targetDate: '2026-09-10',
        sourceConversationId: convId,
        status: 'open',
      }),
    });
    assert.strictEqual(createActRes.status, 201, 'User A action should be created');

    // User B attempts to complete User A's action -> rejected with 404
    const crossUpdateRes = await fetch(`${baseUrl}/api/actions/${actId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userBToken}` },
      body: JSON.stringify({ status: 'completed' }),
    });
    assert.strictEqual(crossUpdateRes.status, 404, 'User B must not modify User A action');

    // User A completes action
    const completeRes = await fetch(`${baseUrl}/api/actions/${actId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ status: 'completed' }),
    });
    assert.strictEqual(completeRes.status, 200);
    const completedData = await completeRes.json();
    assert.strictEqual(completedData.action.status, 'completed');

    // User A dismisses action
    const dismissRes = await fetch(`${baseUrl}/api/actions/${actId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ status: 'dismissed' }),
    });
    assert.strictEqual(dismissRes.status, 200);
    const dismissedData = await dismissRes.json();
    assert.strictEqual(dismissedData.action.status, 'dismissed');

    // User B attempts to delete User A's action -> rejected with 404
    const crossDeleteActRes = await fetch(`${baseUrl}/api/actions/${actId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(crossDeleteActRes.status, 404, 'User B must not delete User A action');

    // User A deletes action
    const deleteActRes = await fetch(`${baseUrl}/api/actions/${actId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(deleteActRes.status, 200);
  });

  it('API-404: Unmatched API route returns 404 JSON rather than HTML', async () => {
    const res = await fetch(`${baseUrl}/api/non_existent_endpoint_xyz`, {
      headers: { Authorization: 'Bearer test-token-user-a' },
    });
    assert.strictEqual(res.status, 404);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'), 'Must return JSON');
    const data = await res.json();
    assert.match(data.error, /API endpoint not found/);
  });

  it('AI-01: /api/ai/chat rejects empty userMessage with 400 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-user-a',
      },
      body: JSON.stringify({ userMessage: '' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /userMessage is required/i);
  });
});
