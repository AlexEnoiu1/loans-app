// src/composables/useDevices.ts
import { ref, type Ref } from 'vue';
import { appConfig } from '@/config/appConfig';
import { useAuth0 } from '@auth0/auth0-vue';

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

  const fetchDevices = async (force = false) => {
    if (loading.value && !force) return;
    loading.value = true;
    error.value = null;

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };

      // Choose endpoint based on auth state
      let route = 'catalogue'; // public: brand/model/category(+description)
      if (isAuthenticated.value) {
        route = 'catalogue/availability'; // authenticated: includes availableCount
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: appConfig.auth0.audience, // <-- your API Identifier in Auth0
            scope: 'read:devices',
          },
        });

        headers.Authorization = `Bearer ${token}`;
      }

      const url = new URL(route, API_BASE).toString();
      const res = await fetch(url, { headers });

      if (!res.ok) {
        throw new Error(
          `Failed to fetch devices: ${res.status} ${res.statusText}`,
        );
      }

      const data: DeviceModel[] = await res.json();
      devices.value = Array.isArray(data) ? data : [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  };

  return { devices, loading, error, fetchDevices, isAuthenticated };
}
