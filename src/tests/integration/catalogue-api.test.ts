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

async function fetchWithRetries(url: string, attempts = 2, delayMs = 500) {
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

// Helper: assert the shape of a catalogue "device model" DTO
function expectCatalogueModelShape(item: any) {
  expect(item).toHaveProperty('modelId');
  expect(typeof item.modelId).toBe('string');
  expect(item.modelId.length).toBeGreaterThan(0);
  expect(item).toHaveProperty('brand');
  expect(typeof item.brand).toBe('string');
  expect(item).toHaveProperty('model');
  expect(typeof item.model).toBe('string');
  expect(item).toHaveProperty('category');
  expect(typeof item.category).toBe('string');
  expect(item).toHaveProperty('description');
  expect(typeof item.description).toBe('string');
  // price might exist; if present, make sure it’s a number
  if ('price' in item && item.price != null) {
    expect(typeof item.price).toBe('number');
  }
}

describe('integration: catalogue API (test environment)', () => {
  it('GET /catalogue returns 200 and an array of device models', async () => {
    // Arrange
    const url = makeUrl('/catalogue');

    // Act
    const res = await fetchWithRetries(url);
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);

    if (Array.isArray(data) && data.length > 0) {
      expectCatalogueModelShape(data[0]);
    }
  });

  it('catalogue in test env is seeded (non-empty)', async () => {
    // Act
    const res = await fetchWithRetries(makeUrl('/catalogue'));
    const data = await res.json();

    // Assert
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    expectCatalogueModelShape(data[0]);
  });
});
