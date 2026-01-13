import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { useCancelReservations } from './useCancelReservations';

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

describe('useCancelReservations', () => {
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
    const { loading, error, success } = useCancelReservations();

    // Assert
    expect(loading.value).toBe(false);
    expect(error.value).toBe(null);
    expect(success.value).toBe(false);
  });

  it('returns false + error when unauthenticated', async () => {
    // Arrange
    const { cancelReservation, error, success } = useCancelReservations();

    // Act
    const result = await cancelReservation('r1');

    // Assert
    expect(result).toBe(false);
    expect(success.value).toBe(false);
    expect(error.value).toContain('You must be signed in');
    expect(trackException).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      'CancelReservationFail',
      expect.objectContaining({ message: expect.any(String) }),
    );
  });

  it('returns false + error when reservationId is blank', async () => {
    // Arrange
    mockIsAuthenticated.value = true;
    const { cancelReservation, error, success } = useCancelReservations();

    // Act
    const result = await cancelReservation('   ');

    // Assert
    expect(result).toBe(false);
    expect(success.value).toBe(false);
    expect(error.value).toBe('reservationId is required.');
  });

  it('cancels reservation when authenticated', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any);

    const { cancelReservation, success, error } = useCancelReservations();

    // Act
    const result = await cancelReservation('r1');

    // Assert
    expect(result).toBe(true);
    expect(success.value).toBe(true);
    expect(error.value).toBe(null);

    expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: {
        audience: 'https://test-audience',
        scope: 'write:reservations',
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api.com/api/reservations/r1',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer test-token',
        },
      }),
    );

    expect(trackEvent).toHaveBeenCalledWith(
      'CancelReservationSuccess',
      expect.objectContaining({ statusCode: 200 }),
    );
  });

  it('URL-encodes reservation id', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any);

    const { cancelReservation } = useCancelReservations();

    // Act
    await cancelReservation('r/1');

    // Assert
    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api.com/api/reservations/r%2F1',
      expect.any(Object),
    );
  });

  it('sets error when API responds not ok', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ success: false, message: 'Not found' }),
    } as any);

    const { cancelReservation, error, success } = useCancelReservations();

    // Act
    const result = await cancelReservation('missing');

    // Assert
    expect(result).toBe(false);
    expect(success.value).toBe(false);
    expect(error.value).toBe('Not found');
    expect(trackException).toHaveBeenCalled();
  });
});
