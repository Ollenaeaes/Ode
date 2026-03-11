import type Database from 'better-sqlite3';

export interface WebhookEvent {
  event: string;
  data: unknown;
  timestamp: string;
}

export interface WebhookRegistration {
  WebhookId: string;
  Url: string;
  Event: string;
  Aktiv: number;
  OpprettetDato: string;
}

/**
 * Dispatch webhook events with retry logic.
 * Retry: 3 times with exponential backoff (1s, 5s, 25s).
 */
export async function dispatchWebhook(
  db: Database.Database,
  event: string,
  data: unknown,
): Promise<{ dispatched: number; failed: number }> {
  const webhooks = db.prepare(
    'SELECT * FROM webhook WHERE Event = ? AND Aktiv = 1'
  ).all(event) as WebhookRegistration[];

  let dispatched = 0;
  let failed = 0;

  const payload: WebhookEvent = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  for (const webhook of webhooks) {
    const success = await deliverWithRetry(webhook.Url, payload);
    if (success) {
      dispatched++;
    } else {
      failed++;
    }
  }

  return { dispatched, failed };
}

async function deliverWithRetry(url: string, payload: WebhookEvent, maxRetries: number = 3): Promise<boolean> {
  const backoffDelays = [1000, 5000, 25000];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) return true;

      // Non-retryable status codes
      if (response.status >= 400 && response.status < 500) return false;
    } catch {
      // Network error — retry
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, backoffDelays[attempt]));
    }
  }

  return false;
}

export function registerWebhook(db: Database.Database, url: string, event: string): WebhookRegistration {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO webhook (WebhookId, Url, Event, Aktiv, OpprettetDato) VALUES (?, ?, ?, 1, ?)'
  ).run(id, url, event, now);

  return { WebhookId: id, Url: url, Event: event, Aktiv: 1, OpprettetDato: now };
}

export function getWebhooks(db: Database.Database): WebhookRegistration[] {
  return db.prepare('SELECT * FROM webhook WHERE Aktiv = 1').all() as WebhookRegistration[];
}

export function deleteWebhook(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM webhook WHERE WebhookId = ?').run(id);
  return result.changes > 0;
}
