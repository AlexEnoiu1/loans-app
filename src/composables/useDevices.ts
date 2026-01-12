// src/composables/useDevices.ts
import { ref, type Ref } from 'vue';
import { appConfig } from '@/config/appConfig';
import { useAuth0 } from '@auth0/auth0-vue';
import { useTelemetry } from '@/composables/useTelemetry';
import { createFetchWithRetry } from '@/infra/fetch-retry';

type CataloguePublicItem = {
  modelId: string;
  brand: string;
  model: string;
  category: string;
  description?: string;
};

type CatalogueAvailabilityItem = {
  modelId: string;
  brand: string;
  model: string;
  category: string;
  price?: number;
  description?: string;
  count: number; // API returns `count`
  availableCount?: number;
};

export type DeviceModel = {
  modelId: string;
  brand: string;
  model: string;
  category: string;
  description?: string;
  price?: number; // only on authenticated availability endpoint
  availableCount?: number; // normalised from `count`
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
    let ok = false;
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
        maxRetries: 1,
        initialDelayMs: 300,
        maxDelayMs: 1200,
        retryOnStatus: [408, 429, 500, 502, 503, 504],
        onRetry: (info) => {
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

      const raw = (await res.json()) as unknown;

      if (!Array.isArray(raw)) {
        devices.value = [];
        ok = true;
        return;
      }

      // Both endpoints normalised to the same UI shape
      if (isAuthenticated.value) {
        const items = raw as CatalogueAvailabilityItem[];
        devices.value = items.map((d) => ({
          modelId: d.modelId,
          brand: d.brand,
          model: d.model,
          category: d.category,
          description: d.description,
          price: (d as any).price,
          availableCount:
            typeof d.availableCount === 'number'
              ? d.availableCount
              : typeof d.count === 'number'
                ? d.count
                : 0,
        }));
      } else {
        const items = raw as CataloguePublicItem[];
        devices.value = items.map((d) => ({
          modelId: d.modelId,
          brand: d.brand,
          model: d.model,
          category: d.category,
          description: d.description,
        }));
      }

      ok = true;

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
      loading.value = false;
      trackDependency(
        `GET /${route}`,
        API_BASE + route,
        Date.now() - startTime,
        ok,
        statusCode,
      );
    }
  };

  return { devices, loading, error, fetchDevices, isAuthenticated };
}
