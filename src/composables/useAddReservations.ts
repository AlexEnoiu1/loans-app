// src/composables/useAddReservations.ts
import { ref } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { appConfig } from '@/config/appConfig';
import { useTelemetry } from '@/composables/useTelemetry';

export type AddReservationCommand = {
  deviceModelId: string;
};

export type ReservationStatus = 'reserved' | 'cancelled';

export type ReservationDto = {
  id: string;
  userId: string;
  deviceModelId: string;
  heldDeviceId: string | null;
  status: ReservationStatus;
  reservedAt: string; // ISO
};

type ApiFail = {
  success?: false;
  message?: string;
  errors?: string[];
};

const API_BASE = appConfig.reservationsApiBaseUrl;

export function useAddReservations() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { trackEvent, trackException, trackDependency } = useTelemetry();

  const loading = ref(false);
  const error = ref<string | null>(null);
  const success = ref(false);

  const addReservation = async (command: AddReservationCommand) => {
    loading.value = true;
    error.value = null;
    success.value = false;

    const startTime = Date.now();
    let ok = false;
    let statusCode: number | undefined;

    try {
      if (!isAuthenticated.value) {
        throw new Error('You must be signed in to reserve a device.');
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: appConfig.auth0.audience,
          scope: 'write:reservations',
        },
      });

      const url = new URL('reservations', API_BASE).toString();

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(command),
      });

      statusCode = res.status;

      const json = (await res.json().catch(() => null)) as
        | ReservationDto
        | ApiFail
        | null;

      if (!res.ok) {
        const msg =
          (json && (json as ApiFail).message) ||
          `Failed to add reservation (HTTP ${res.status})`;
        const errs = (json && (json as ApiFail).errors) || [];
        throw new Error(errs.length ? `${msg}: ${errs.join(', ')}` : msg);
      }

      // success => backend returns ReservationDto (per your current API)
      success.value = true;
      ok = true;

      trackEvent('AddReservationSuccess', { statusCode });
      return json as ReservationDto;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unexpected error';
      if (e instanceof Error) trackException(e, { context: 'addReservation' });
      trackEvent('AddReservationFail', { message: error.value ?? 'unknown' });
      return null;
    } finally {
      loading.value = false;
      trackDependency(
        'POST /reservations',
        API_BASE + 'reservations',
        Date.now() - startTime,
        ok,
        statusCode,
      );
    }
  };

  return { addReservation, loading, error, success };
}
