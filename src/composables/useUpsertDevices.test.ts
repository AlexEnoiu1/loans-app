import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import {
  useUpsertDevices,
  type UpsertDevicesCommand,
} from './useUpsertDevices';

// ---- Mocks ----
const mockIsAuthenticated = ref(false);
const mockGetAccessTokenSilently = vi.fn();

const trackEvent = vi.fn();
const trackException = vi.fn();
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
    trackDependency,
  }),
}));

describe('useUpsertDevices', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.value = false;
    mockGetAccessTokenSilently.mockResolvedValue('test-token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const command: UpsertDevicesCommand = {
    id: 'macbook-air-m1',
    brand: 'Apple',
    model: 'MacBook Air M1',
    category: 'Laptop',
    price: 999,
    description: 'A laptop',
    status: 'available',
  };

  it('initializes state', () => {
    // Arrange
    const { loading, error, success } = useUpsertDevices();

    // Assert
    expect(loading.value).toBe(false);
    expect(error.value).toBe(null);
    expect(success.value).toBe(false);
  });

  it('POSTs to /catalogue and sets success=true on ok response', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const { upsertDevices, success, error } = useUpsertDevices();

    // Act
    await upsertDevices(command);

    // Assert
    expect(error.value).toBe(null);
    expect(success.value).toBe(true);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api.com/api/catalogue',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(command),
      },
    );

    expect(trackDependency).toHaveBeenCalledWith(
      'POST /catalogue',
      'http://test-api.com/api/' + 'catalogue',
      expect.any(Number),
      true,
      200,
    );
  });

  it('adds Authorization header when authenticated', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const { upsertDevices } = useUpsertDevices();

    // Act
    await upsertDevices(command);

    // Assert
    expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: {
        audience: 'https://test-audience',
        scope: 'write:devices',
      },
    });

    expect((global.fetch as any).mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-token',
    );
  });

  it('handles validation error payload', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 'VALIDATION_ERROR', message: 'Bad input' },
      }),
    });

    const { upsertDevices, error, success } = useUpsertDevices();

    // Act
    await upsertDevices(command);

    // Assert
    expect(success.value).toBe(false);
    expect(error.value).toBe('Bad input');
    expect(trackException).toHaveBeenCalled();
    expect(trackDependency).toHaveBeenCalledWith(
      'POST /catalogue',
      'http://test-api.com/api/' + 'catalogue',
      expect.any(Number),
      false,
      400,
    );
  });

  it('uses fallback error message when response has no JSON error message', async () => {
    // Arrange: response.ok=false and json() returns null -> triggers fallback string
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => null,
    });

    const { upsertDevices, error, success } = useUpsertDevices();

    // Act
    await upsertDevices(command);

    // Assert
    expect(success.value).toBe(false);
    expect(error.value).toBe('Failed to add device (HTTP 500)');
    expect(trackException).toHaveBeenCalled(); // thrown Error(...) so it should log
  });

  it('handles thrown non-Error values and sets "Unexpected error"', async () => {
    // Arrange: fetch throws a non-Error to hit that branch
    global.fetch = vi.fn().mockImplementation(() => {
      throw 'BOOM'; // eslint-disable-line no-throw-literal
    });

    const { upsertDevices, error, success } = useUpsertDevices();

    // Act
    await upsertDevices(command);

    // Assert
    expect(success.value).toBe(false);
    expect(error.value).toBe('Unexpected error');
    expect(trackException).not.toHaveBeenCalled(); // not an Error instance
  });

  it('handles non-ok response with generic message', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server blew up' } }),
    });

    const { upsertDevices, error, success } = useUpsertDevices();

    // Act
    await upsertDevices(command);

    // Assert
    expect(success.value).toBe(false);
    expect(error.value).toBe('Server blew up');
  });
});
