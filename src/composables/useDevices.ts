// src/composables/useDevices.ts
import { ref, type Ref } from 'vue';
import { appConfig } from '@/config/appConfig';
import { useAuth0 } from '@auth0/auth0-vue';

export type Device = {
  id: string;
  brand: string;
  model: string;
  category: string;
  price: number;
  description?: string;
  totalCount?: number;
  availableCount?: number;
};

const API_BASE = appConfig.apiBaseUrl;

export function useDevices() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const devices: Ref<Device[]> = ref([]);
  const loading = ref(false);
  const error: Ref<string | null> = ref(null);

  const fetchDevices = async (force = false) => {
    if (loading.value && !force) return;
    loading.value = true;
    error.value = null;

    try {
      // Adjust "devices" to match your Catalogue route, e.g. "catalogue/devices"
      const url = new URL('devices', API_BASE).toString();
      const headers: Record<string, string> = { Accept: 'application/json' };

      if (isAuthenticated.value) {
        try {
          const token = await getAccessTokenSilently();
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {
          // proceed unauthenticated
        }
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(
          `Failed to fetch devices: ${res.status} ${res.statusText}`,
        );
      }

      const data: Device[] = await res.json();
      devices.value = Array.isArray(data) ? data : [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  };

  return { devices, loading, error, fetchDevices };
}
