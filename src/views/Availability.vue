<script setup lang="ts">
import { onMounted, computed, watch } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { useDevices } from '@/composables/useDevices'; // same composable; we will use counts here

const { devices, loading, error, fetchDevices } = useDevices();
const { isAuthenticated, loginWithRedirect } = useAuth0();

const hasAnyDevices = computed(() => devices.value.length > 0);

// load when page mounts; if not authenticated, we still call so you can later
// change the API or logic without touching this page
onMounted(() => {
  fetchDevices();
});

// reload when auth state changes
watch(isAuthenticated, () => {
  fetchDevices(true);
});

const showLoginPrompt = computed(() => !isAuthenticated.value);
</script>

<template>
  <main class="page page--availability">
    <header class="page__header">
      <h1>Device Availability</h1>
      <p class="page__subtitle">
        Registered users can view how many devices of each model are currently
        available.
      </p>
    </header>

    <section v-if="showLoginPrompt" class="page__notice">
      <p>You need to sign in to view detailed availability information.</p>
      <button type="button" @click="loginWithRedirect()">Sign in</button>
    </section>

    <section class="page__body" v-else>
      <div v-if="loading" class="state state--loading">
        Loading availability…
      </div>

      <div v-else-if="error" class="state state--error">
        <p>There was a problem loading availability: {{ error }}</p>
        <button type="button" @click="fetchDevices(true)">Retry</button>
      </div>

      <div v-else-if="!hasAnyDevices" class="state state--empty">
        <p>No devices found in the system.</p>
      </div>

      <table v-else class="availability-table">
        <thead>
          <tr>
            <th>Brand &amp; Model</th>
            <th>Category</th>
            <th>Total Devices</th>
            <th>Available Now</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in devices" :key="d.id">
            <td>
              <strong>{{ d.brand }} {{ d.model }}</strong>
              <div class="availability-table__desc">
                {{ d.description }}
              </div>
            </td>
            <td>{{ d.category }}</td>
            <td>{{ d.availableCount }}</td>
            <td>
              <span v-if="(d.availableCount ?? 0) > 0" class="badge badge--ok">
                Available
              </span>
              <span v-else class="badge badge--none"> Fully allocated </span>
            </td>
          </tr>
        </tbody>
      </table>
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
.page__notice {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px dashed #999;
}
.state {
  padding: 1rem;
  border-radius: 0.5rem;
}
.state--error {
  border: 1px solid #b00020;
}
.availability-table {
  width: 100%;
  border-collapse: collapse;
}
.availability-table th,
.availability-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e0e0e0;
  text-align: left;
}
.availability-table__desc {
  font-size: 0.85rem;
  opacity: 0.8;
  margin-top: 0.25rem;
}
.badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.8rem;
}
.badge--ok {
  background-color: #e0f2f1;
}
.badge--none {
  background-color: #ffebee;
}
</style>
