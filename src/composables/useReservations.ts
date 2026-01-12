// src/composables/useReservations.ts
import { ref, type Ref } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { appConfig } from '@/config/appConfig';
import { useTelemetry } from '@/composables/useTelemetry';
import { createFetchWithRetry } from '@/infra/fetch-retry';

export type ReservationStatus = 'reserved' | 'cancelled';

export type ReservationDto = {
  id: string;
  userId: string;
  deviceModelId: string;
  heldDeviceId: string | null;
  status: ReservationStatus;
  reservedAt: string; // ISO string (from API)
};

type ListReservationsSuccess = {
  success: true;
  data: {
    reservations: ReservationDto[];
    totalCount: number;
  };
};

type ListReservationsFail = {
  success: false;
  message?: string;
  errors?: string[];
};

const API_BASE = appConfig.reservationsApiBaseUrl;

export function useReservations() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { trackEvent, trackException, trackDependency } = useTelemetry();

  const reservations: Ref<ReservationDto[]> = ref([]);
  const totalCount = ref(0);
  const loading = ref(false);
  const error: Ref<string | null> = ref(null);

  const fetchMyReservations = async (force = false) => {
    if (loading.value && !force) return;
    loading.value = true;
    error.value = null;

    const startTime = Date.now();
    let ok = false;
    let statusCode: number | undefined;

    try {
      if (!isAuthenticated.value) {
        // With Week 7 security, this endpoint should require a token
        reservations.value = [];
        totalCount.value = 0;
        throw new Error('You must be signed in to view your reservations.');
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: appConfig.auth0.audience,
          scope: 'read:reservations',
        },
      });

      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const fetchWithRetry = createFetchWithRetry(fetch, {
        maxRetries: 1,
        initialDelayMs: 300,
        maxDelayMs: 1200,
        retryOnStatus: [408, 429, 500, 502, 503, 504],
        onRetry: (info) => {
          trackEvent('HttpRetry', {
            route: 'reservations',
            method: info.method,
            url: info.url,
            attempt: info.attempt,
            maxRetries: info.maxRetries,
            delayMs: info.delayMs,
            status: info.status,
            errorMessage: info.errorMessage,
          });
        },
      });

      const url = new URL('reservations', API_BASE).toString();
      const res = await fetchWithRetry(url, { headers });
      statusCode = res.status;

      const json = (await res.json().catch(() => null)) as
        | ListReservationsSuccess
        | ListReservationsFail
        | null;

      if (!res.ok) {
        const msg =
          (json && 'message' in json && json.message) ||
          `Failed to fetch reservations (HTTP ${res.status})`;
        throw new Error(msg);
      }

      const data = (json as ListReservationsSuccess)?.data;
      reservations.value = Array.isArray(data?.reservations)
        ? data!.reservations
        : [];
      totalCount.value =
        typeof data?.totalCount === 'number' ? data.totalCount : 0;

      ok = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      if (e instanceof Error)
        trackException(e, { context: 'fetchMyReservations' });
    } finally {
      loading.value = false;
      trackDependency(
        'GET /reservations',
        API_BASE + 'reservations',
        Date.now() - startTime,
        ok,
        statusCode,
      );
    }
  };

  return { reservations, totalCount, loading, error, fetchMyReservations };
}
