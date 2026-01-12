// src/composables/useDevices.ts
import { ref, type Ref } from 'vue';
import { appConfig } from '@/config/appConfig';
import { useAuth0 } from '@auth0/auth0-vue';
import { useTelemetry } from '@/composables/useTelemetry';
import { createFetchWithRetry } from '@/infra/fetch-retry';

export type DeviceModel = {
  id: string;
  brand: string;
  model: string;
  category: string;
  price: number;
  description?: string;
  availableCount?: number; // only present for authenticated endpoint
};

const API_BASE = appConfig.apiBaseUrl;

export function useDevices() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const devices: Ref<DeviceModel[]> = ref([]);
  const loading = ref(false);
  const error: Ref<string | null> = ref(null);
  const { trackEvent, trackException, trackMetric, trackDependency } =
    useTelemetry();

  const fetchDevices = async (force = false) => {
    if (loading.value && !force) return;
    loading.value = true;
    error.value = null;
    const startTime = Date.now();
    let success = false;
    let statusCode: number | undefined;

    const route = isAuthenticated.value
      ? 'catalogue/availability'
      : 'catalogue';

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };

      trackEvent('FetchDevices', {
        force,
        authenticated: isAuthenticated.value,
        route,
      });

      if (isAuthenticated.value) {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: appConfig.auth0.audience,
            scope: 'read:devices',
          },
        });
        headers.Authorization = `Bearer ${token}`;
      }

      const fetchWithRetry = createFetchWithRetry(fetch, {
        maxRetries: 1, // 1 retry => 2 total attempts (credit-safe)
        initialDelayMs: 300,
        maxDelayMs: 1200,
        retryOnStatus: [408, 429, 500, 502, 503, 504],
        onRetry: (info) => {
          // Telemetry-friendly (no spammy console logs)
          trackEvent('HttpRetry', {
            route,
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

      const url = new URL(route, API_BASE).toString();
      const res = await fetchWithRetry(url, { headers });
      statusCode = res.status;

      if (!res.ok) {
        throw new Error(
          `Failed to fetch devices: ${res.status} ${res.statusText}`,
        );
      }

      const data: DeviceModel[] = await res.json();
      devices.value = Array.isArray(data) ? data : [];
      success = true;
      trackMetric('DevicesCount', devices.value.length, {
        authenticated: isAuthenticated.value,
        route,
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';

      if (e instanceof Error) {
        trackException(e, { context: 'fetchDevices', route });
      }
    } finally {
      const duration = Date.now() - startTime;
      loading.value = false;

      trackDependency(
        `GET /${route}`,
        API_BASE + route,
        duration,
        success,
        statusCode,
      );
    }
  };

  return { devices, loading, error, fetchDevices, isAuthenticated };
}
