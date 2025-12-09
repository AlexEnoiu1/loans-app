// src/composables/useAddDevice.ts
import { ref } from 'vue';
import { appConfig } from '@/config/appConfig';
import { useAuth0 } from '@auth0/auth0-vue';

export type AddDeviceCommand = {
  id: string;
  brand: string;
  model: string;
  category: string;
  price: number;
  description: string;
  status: 'available' | 'reserved' | 'loaned' | 'retired';
};

const API_BASE = appConfig.apiBaseUrl;

export function useAddDevice() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const loading = ref(false);
  const error = ref<string | null>(null);
  const success = ref(false);

  const addDevice = async (command: AddDeviceCommand) => {
    loading.value = true;
    error.value = null;
    success.value = false;

    try {
      // Construct correct POST URL
      const url = new URL('catalogue/add', API_BASE).toString();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      // If authenticated, attach Auth0 token
      if (isAuthenticated.value) {
        try {
          const token = await getAccessTokenSilently();
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {
          // If token failed, you may decide to block the request
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(command),
      });

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

      success.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unexpected error';
    } finally {
      loading.value = false;
    }
  };

  return {
    addDevice,
    loading,
    error,
    success,
  };
}
