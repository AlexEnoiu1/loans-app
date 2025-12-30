<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { useDevices } from '@/composables/useDevices'; // will create later

const { devices, loading, error, fetchDevices } = useDevices();
const { isAuthenticated } = useAuth0();

// initial load
onMounted(() => {
  fetchDevices();
});

// if auth state changes (e.g. user logs in), refresh if needed
watch(isAuthenticated, () => {
  fetchDevices(true);
});
</script>

<template>
  <main class="page page--catalogue">
    <header class="page__header">
      <h1>Campus Device Catalogue</h1>
      <p class="page__subtitle">
        Browse the devices available for loan on campus (brand, model, category,
        and description).
      </p>
    </header>

    <section class="page__body">
      <div v-if="loading" class="state state--loading">Loading devices…</div>

      <div v-else-if="error" class="state state--error">
        <p>There was a problem loading the catalogue: {{ error }}</p>
        <button type="button" @click="fetchDevices(true)">Retry</button>
      </div>

      <div v-else-if="devices.length === 0" class="state state--empty">
        <p>No devices are configured in the catalogue.</p>
      </div>

      <ul v-else class="device-grid">
        <li v-for="d in devices" :key="d.id" class="device-card">
          <header class="device-card__header">
            <h2 class="device-card__title">{{ d.brand }} {{ d.model }}</h2>
            <span class="device-card__category">
              {{ d.category }}
            </span>
          </header>

          <p class="device-card__description">
            {{ d.description }}
          </p>

          <!-- Only show availability messaging when signed in -->
          <template v-if="isAuthenticated">
            <p class="device-card__hint" v-if="(d.availableCount ?? 0) > 0">
              currently available: {{ d.availableCount }}
            </p>
            <p class="device-card__hint device-card__hint--none" v-else>
              currently available: 0
            </p>
          </template>

          <p v-else class="device-card__hint">
            Sign in to see how many are currently available.
          </p>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem;
}
.page__header {
  margin-bottom: 1.5rem;
}
.page__subtitle {
  margin-top: 0.25rem;
  opacity: 0.8;
}
.state {
  padding: 1rem;
  border-radius: 0.5rem;
}
.state--error {
  border: 1px solid #b00020;
}
.state--loading {
  opacity: 0.8;
}
.device-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;
}
.device-card {
  border-radius: 0.75rem;
  padding: 1rem;
  border: 1px solid #ddd;
}
.device-card__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}
.device-card__title {
  font-size: 1.1rem;
  margin: 0;
}
.device-card__category {
  font-size: 0.85rem;
  text-transform: uppercase;
  opacity: 0.7;
}
.device-card__description {
  margin: 0.75rem 0;
}
.device-card__hint {
  font-size: 0.85rem;
  opacity: 0.85;
}
.device-card__hint--none {
  opacity: 0.7;
}
</style>
