import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { useAddReservations } from './useAddReservations';

// ---- Mocks ----
const mockIsAuthenticated = ref(false);
const mockGetAccessTokenSilently = vi.fn();

const trackEvent = vi.fn();
const trackException = vi.fn();
const trackDependency = vi.fn();

vi.mock('@/config/appConfig', () => ({
  appConfig: {
    reservationsApiBaseUrl: 'http://test-api.com/api/',
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

describe('useAddReservations', () => {
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
    const { loading, error, success } = useAddReservations();

    // Assert
    expect(loading.value).toBe(false);
    expect(error.value).toBe(null);
    expect(success.value).toBe(false);
  });

  it('returns null + error when unauthenticated', async () => {
    // Arrange
    const { addReservation, error, success } = useAddReservations();

    // Act
    const result = await addReservation({ deviceModelId: 'm1' });

    // Assert
    expect(result).toBeNull();
    expect(success.value).toBe(false);
    expect(error.value).toContain('You must be signed in');
    expect(trackException).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      'AddReservationFail',
      expect.objectContaining({ message: expect.any(String) }),
    );
  });

  it('adds reservation when authenticated', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'r1',
        userId: 'u1',
        deviceModelId: 'm1',
        heldDeviceId: 'd1',
        status: 'reserved',
        reservedAt: '2026-01-01T00:00:00Z',
      }),
    } as any);

    const { addReservation, success, error } = useAddReservations();

    // Act
    const result = await addReservation({ deviceModelId: 'm1' });

    // Assert
    expect(result).not.toBeNull();
    expect(success.value).toBe(true);
    expect(error.value).toBe(null);

    expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: {
        audience: 'https://test-audience',
        scope: 'write:reservations',
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api.com/api/reservations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer test-token',
        }),
        body: JSON.stringify({ deviceModelId: 'm1' }),
      }),
    );

    expect(trackEvent).toHaveBeenCalledWith(
      'AddReservationSuccess',
      expect.objectContaining({ statusCode: 201 }),
    );
  });

  it('sets error when API responds not ok (message + errors)', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        message: 'No availability',
        errors: ['NO_AVAILABLE_DEVICE'],
      }),
    } as any);

    const { addReservation, success, error } = useAddReservations();

    // Act
    const result = await addReservation({ deviceModelId: 'm1' });

    // Assert
    expect(result).toBeNull();
    expect(success.value).toBe(false);
    expect(error.value).toContain('No availability: NO_AVAILABLE_DEVICE');
    expect(trackException).toHaveBeenCalled();
  });

  it('uses fallback message when JSON parsing fails', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('bad json');
      },
    } as any);

    const { addReservation, error } = useAddReservations();

    // Act
    const result = await addReservation({ deviceModelId: 'm1' });

    // Assert
    expect(result).toBeNull();
    expect(error.value).toContain('Failed to add reservation (HTTP 500)');
  });
});
