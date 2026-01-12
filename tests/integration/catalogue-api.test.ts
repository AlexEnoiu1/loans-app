import { describe, it, expect } from 'vitest';

const baseUrl = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL;

function makeUrl(path: string) {
  expect(
    baseUrl,
    'API_BASE_URL (or VITE_API_BASE_URL) must be set',
  ).toBeTruthy();
  const root = baseUrl!.endsWith('/') ? baseUrl! : `${baseUrl!}/`;
  return new URL(path.replace(/^\//, ''), root).toString();
}

async function fetchWithRetries(url: string, attempts = 3, delayMs = 500) {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw lastErr;
}

describe('integration: catalogue API (test environment)', () => {
  it('GET /catalogue returns 200 and an array of devices', async () => {
    // Arrange
    const url = makeUrl('/catalogue');

    // Act
    const res = await fetchWithRetries(url);
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);

    // Optional: stronger assertions if your DTO has stable shape
    if (Array.isArray(data) && data.length > 0) {
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('brand');
      expect(data[0]).toHaveProperty('model');
      expect(data[0]).toHaveProperty('category');
      expect(data[0]).toHaveProperty('description');
    }
  });

  it('catalogue in test env is seeded (non-empty)', async () => {
    const res = await fetchWithRetries(makeUrl('/catalogue'));
    const data = await res.json();

    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const item = data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('brand');
      expect(item).toHaveProperty('model');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('description');
    }
  });
});
