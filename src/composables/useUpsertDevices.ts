// src/composables/useAddDevice.ts
import { ref } from 'vue';
import { appConfig } from '@/config/appConfig';
import { useAuth0 } from '@auth0/auth0-vue';
import { useTelemetry } from '@/composables/useTelemetry';

export type UpsertDevicesCommand = {
  id: string;
  brand: string;
  model: string;
  category: string;
  price: number;
  description: string;
  status: 'available' | 'reserved' | 'loaned' | 'retired';
};

const API_BASE = appConfig.apiBaseUrl;

export function useUpsertDevices() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { trackEvent, trackException, trackDependency } = useTelemetry();

  const loading = ref(false);
  const error = ref<string | null>(null);
  const success = ref(false);

  const upsertDevices = async (command: UpsertDevicesCommand) => {
    loading.value = true;
    error.value = null;
    success.value = false;

    const startTime = Date.now();
    let ok = false;
    let statusCode: number | undefined;

    try {
      // Construct correct POST URL
      const route = 'catalogue'; // keep your current route
      const url = new URL(route, API_BASE).toString();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      trackEvent('UpsertDeviceAttempt', {
        authenticated: isAuthenticated.value,
        hasId: !!command.id,
      });

      // If authenticated, attach Auth0 token
      if (isAuthenticated.value) {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: appConfig.auth0.audience,
            scope: 'write:devices',
          },
        });
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(command),
      });

      statusCode = response.status;

      if (!response.ok) {
        const json = await response.json().catch(() => null);

        // Handle domain validation errors
        if (json?.error?.code === 'VALIDATION_ERROR') {
          throw new Error(json.error.message);
        }

        // Fallback generic error
        throw new Error(
          json?.error?.message ??
            `Failed to add device (HTTP ${response.status})`,
        );
      }

      // If successful, backend returns created device
      await response.json().catch(() => null);
      ok = true;
      success.value = true;

      trackEvent('UpsertDeviceSuccess', { statusCode });
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unexpected error';

      if (e instanceof Error) {
        trackException(e, { context: 'upsertDevice' });
      }
    } finally {
      const duration = Date.now() - startTime;
      loading.value = false;

      trackDependency(
        'POST /catalogue',
        API_BASE + 'catalogue',
        duration,
        ok,
        statusCode,
      );
    }
  };

  return {
    upsertDevices,
    loading,
    error,
    success,
  };
}
