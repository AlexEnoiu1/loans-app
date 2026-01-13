import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { useReservations } from './useReservations';

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

// Keep composable unit tests focused on composable logic, not retry helper internals
vi.mock('@/infra/fetch-retry', () => ({
  createFetchWithRetry: (fetchFn: any) => fetchFn,
}));

describe('useReservations', () => {
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
    const { reservations, totalCount, loading, error } = useReservations();

    // Assert
    expect(reservations.value).toEqual([]);
    expect(totalCount.value).toBe(0);
    expect(loading.value).toBe(false);
    expect(error.value).toBe(null);
  });

  it('returns error when unauthenticated (and clears reservations)', async () => {
    // Arrange
    const { fetchMyReservations, reservations, totalCount, error } =
      useReservations();

    // Act
    await fetchMyReservations();

    // Assert
    expect(reservations.value).toEqual([]);
    expect(totalCount.value).toBe(0);
    expect(error.value).toContain('You must be signed in');
    expect(trackException).toHaveBeenCalled();
    expect(trackDependency).toHaveBeenCalledWith(
      'GET /reservations',
      'http://test-api.com/api/' + 'reservations',
      expect.any(Number),
      false,
      undefined,
    );
  });

  it('fetchMyReservations loads reservations when authenticated', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          reservations: [
            {
              id: 'r1',
              userId: 'u1',
              deviceModelId: 'm1',
              heldDeviceId: 'd1',
              status: 'reserved',
              reservedAt: '2026-01-01T00:00:00Z',
            },
          ],
          totalCount: 1,
        },
      }),
    } as any);

    const { fetchMyReservations, reservations, totalCount, error } =
      useReservations();

    // Act
    await fetchMyReservations();

    // Assert
    expect(error.value).toBe(null);
    expect(reservations.value).toHaveLength(1);
    expect(totalCount.value).toBe(1);

    expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: {
        audience: 'https://test-audience',
        scope: 'read:reservations',
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api.com/api/reservations',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer test-token',
        },
      },
    );

    expect(trackDependency).toHaveBeenCalledWith(
      'GET /reservations',
      'http://test-api.com/api/' + 'reservations',
      expect.any(Number),
      true,
      200,
    );
  });

  it('sets error when API responds not ok and message is present', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        message: 'Backend says nope',
      }),
    } as any);

    const { fetchMyReservations, error, reservations, totalCount } =
      useReservations();

    // Act
    await fetchMyReservations();

    // Assert
    expect(reservations.value).toEqual([]);
    expect(totalCount.value).toBe(0);
    expect(error.value).toBe('Backend says nope');
    expect(trackException).toHaveBeenCalled();
  });

  it('handles ok response but malformed JSON (reservations not array / totalCount missing)', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          reservations: 'not-an-array',
        },
      }),
    } as any);

    const { fetchMyReservations, reservations, totalCount, error } =
      useReservations();

    // Act
    await fetchMyReservations();

    // Assert
    expect(error.value).toBe(null);
    expect(reservations.value).toEqual([]);
    expect(totalCount.value).toBe(0);
  });

  it('prevents duplicate fetch unless force=true', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    let resolveFetch!: (v: any) => void;
    const fetchPromise = new Promise((res) => (resolveFetch = res));

    global.fetch = vi.fn().mockReturnValue(fetchPromise as any);

    const { fetchMyReservations } = useReservations();

    // Act
    const p1 = fetchMyReservations(false);
    const p2 = fetchMyReservations(false); // should NOOP
    const p3 = fetchMyReservations(true); // should force second call

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { reservations: [], totalCount: 0 },
      }),
    });

    await Promise.all([p1, p2, p3]);

    // Assert
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
