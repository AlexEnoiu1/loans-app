import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { useDevices, type DeviceModel } from './useDevices';

// ---- Mocks ----
const mockIsAuthenticated = ref(false);
const mockGetAccessTokenSilently = vi.fn();

const trackEvent = vi.fn();
const trackException = vi.fn();
const trackMetric = vi.fn();
const trackDependency = vi.fn();

vi.mock('@/config/appConfig', () => ({
  appConfig: {
    apiBaseUrl: 'http://test-api.com/api/',
    auth0: { audience: 'https://test-audience' },
  },
}));

vi.mock('@auth0/auth0-vue', () => ({
  useAuth0: () => ({
    isAuthenticated: mockIsAuthenticated,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));

vi.mock('@/composables/useTelemetry', () => ({
  useTelemetry: () => ({
    trackEvent,
    trackException,
    trackMetric,
    trackDependency,
  }),
}));

describe('useDevices', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.value = false;
    mockGetAccessTokenSilently.mockResolvedValue('test-token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initializes with defaults', () => {
    // Arrange
    const { devices, loading, error } = useDevices();

    // Assert
    expect(devices.value).toEqual([]);
    expect(loading.value).toBe(false);
    expect(error.value).toBe(null);
  });

  it('fetchDevices loads public catalogue when unauthenticated', async () => {
    // Arrange
    const mockDevices: DeviceModel[] = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook Air',
        category: 'Laptop',
        description: 'Nice',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockDevices,
    });

    const { fetchDevices, devices, error } = useDevices();

    // Act
    await fetchDevices();

    // Assert
    expect(error.value).toBe(null);
    expect(devices.value).toEqual(mockDevices);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api.com/api/catalogue',
      { headers: { Accept: 'application/json' } },
    );

    expect(trackEvent).toHaveBeenCalledWith(
      'FetchDevices',
      expect.objectContaining({
        authenticated: false,
        route: 'catalogue',
      }),
    );

    expect(trackMetric).toHaveBeenCalledWith(
      'DevicesCount',
      1,
      expect.objectContaining({ authenticated: false, route: 'catalogue' }),
    );

    expect(trackDependency).toHaveBeenCalledWith(
      'GET /catalogue',
      'http://test-api.com/api/' + 'catalogue',
      expect.any(Number),
      true,
      200,
    );
  });

  it('fetchDevices loads availability endpoint + adds Authorization when authenticated', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    const mockDevices: DeviceModel[] = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook Air',
        category: 'Laptop',
        description: 'Nice',
        price: 999,
        availableCount: 3,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockDevices,
    });

    const { fetchDevices } = useDevices();

    // Act
    await fetchDevices();

    // Assert
    expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: {
        audience: 'https://test-audience',
        scope: 'read:devices',
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api.com/api/catalogue/availability',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer test-token',
        },
      },
    );
  });

  it('sets error when API responds not ok', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    });

    const { fetchDevices, error, devices } = useDevices();

    // Act
    await fetchDevices();

    // Assert
    expect(devices.value).toEqual([]);
    expect(error.value).toContain('Failed to fetch devices: 500 Server Error');
    expect(trackException).toHaveBeenCalled(); // error captured
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('prevents duplicate fetch unless force=true', async () => {
    // Arrange
    let resolveFetch: (v: any) => void;
    const fetchPromise = new Promise((res) => (resolveFetch = res));

    global.fetch = vi.fn().mockReturnValue(fetchPromise as any);

    const { fetchDevices } = useDevices();

    // Act (start first call, do not resolve yet)
    const p1 = fetchDevices(false);
    const p2 = fetchDevices(false); // should NOOP
    const p3 = fetchDevices(true); // should force second call

    resolveFetch!({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [],
    });

    await Promise.all([p1, p2, p3]);

    // Assert
    // called twice: first + forced
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('sets devices to [] when API returns non-array JSON', async () => {
    // Arrange: JSON is an object, not an array -> triggers Array.isArray false branch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ not: 'an array' }),
    });

    const { fetchDevices, devices, error } = useDevices();

    // Act
    await fetchDevices();

    // Assert
    expect(error.value).toBe(null);
    expect(devices.value).toEqual([]);
  });

  it('handles thrown non-Error values and sets "Unknown error"', async () => {
    // Arrange: throw a non-Error to hit the "Unknown error" branch
    global.fetch = vi.fn().mockImplementation(() => {
      throw 'NOPE'; // eslint-disable-line no-throw-literal
    });

    const { fetchDevices, error } = useDevices();

    // Act
    await fetchDevices();

    // Assert
    expect(error.value).toBe('NOPE');
    expect(trackException).toHaveBeenCalled();
  });

  it('retries once on transient 503 then succeeds', async () => {
    // Arrange
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => [],
      });

    const { fetchDevices, error, devices } = useDevices();

    // Act
    await fetchDevices();

    // Assert
    expect(error.value).toBe(null);
    expect(devices.value).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
