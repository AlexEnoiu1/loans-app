// src/composables/useCancelReservations.ts
import { ref } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { appConfig } from '@/config/appConfig';
import { useTelemetry } from '@/composables/useTelemetry';

type ApiOk = { success: true; message?: string };
type ApiFail = { success: false; message?: string; error?: string };

const API_BASE = appConfig.reservationsApiBaseUrl;

export function useCancelReservations() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { trackEvent, trackException, trackDependency } = useTelemetry();

  const loading = ref(false);
  const error = ref<string | null>(null);
  const success = ref(false);

  const cancelReservation = async (reservationId: string) => {
    loading.value = true;
    error.value = null;
    success.value = false;

    const startTime = Date.now();
    let ok = false;
    let statusCode: number | undefined;

    try {
      if (!isAuthenticated.value) {
        throw new Error('You must be signed in to cancel a reservation.');
      }
      if (!reservationId || reservationId.trim().length === 0) {
        throw new Error('reservationId is required.');
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: appConfig.auth0.audience,
          scope: 'write:reservations',
        },
      });

      const url = new URL(
        `reservations/${encodeURIComponent(reservationId)}`,
        API_BASE,
      ).toString();

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      statusCode = res.status;

      const json = (await res.json().catch(() => null)) as
        | ApiOk
        | ApiFail
        | null;

      if (!res.ok) {
        const msg =
          (json && (json as ApiFail).message) ||
          `Failed to cancel reservation (HTTP ${res.status})`;
        throw new Error(msg);
      }

      success.value = true;
      ok = true;
      trackEvent('CancelReservationSuccess', { statusCode });
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unexpected error';
      if (e instanceof Error)
        trackException(e, { context: 'cancelReservation' });
      trackEvent('CancelReservationFail', {
        message: error.value ?? 'unknown',
      });
      return false;
    } finally {
      loading.value = false;
      trackDependency(
        'DELETE /reservations/{id}',
        API_BASE + `reservations/${reservationId}`,
        Date.now() - startTime,
        ok,
        statusCode,
      );
    }
  };

  return { cancelReservation, loading, error, success };
}
