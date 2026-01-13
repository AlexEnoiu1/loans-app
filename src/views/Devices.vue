<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { useDevices } from '@/composables/useDevices';
import { useReservations } from '@/composables/useReservations';
import { useAddReservations } from '@/composables/useAddReservations';
import { useCancelReservations } from '@/composables/useCancelReservations';
import { useTelemetry } from '@/composables/useTelemetry';

const { devices, loading, error, fetchDevices } = useDevices();
const { isAuthenticated } = useAuth0();

const {
  reservations,
  loading: reservationsLoading,
  error: reservationsError,
  fetchMyReservations,
} = useReservations();

const {
  addReservation,
  loading: reserving,
  error: reserveError,
} = useAddReservations();

const {
  cancelReservation,
  loading: cancelling,
  error: cancelError,
} = useCancelReservations();

const { trackPageView } = useTelemetry();

const DUE_DAYS = 2;
const DUE_MS = DUE_DAYS * 24 * 60 * 60 * 1000;

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function computeDueAt(reservedAtIso: string): string {
  const reservedAt = new Date(reservedAtIso);
  if (isNaN(reservedAt.getTime())) return 'Unknown';
  const dueAt = new Date(reservedAt.getTime() + DUE_MS);
  return formatDateTime(dueAt);
}

function formatReservedAt(reservedAtIso: string): string {
  const reservedAt = new Date(reservedAtIso);
  if (isNaN(reservedAt.getTime())) return 'Unknown';
  return formatDateTime(reservedAt);
}

// deviceModelId -> reservation (only active reserved ones)
const activeReservationByModelId = computed(() => {
  const map = new Map<string, (typeof reservations.value)[number]>();
  for (const r of reservations.value) {
    if (r.status === 'reserved') map.set(r.deviceModelId, r);
  }
  return map;
});

function myReservationForModel(modelId: string) {
  return activeReservationByModelId.value.get(modelId) ?? null;
}

async function onReserve(modelId: string) {
  const created = await addReservation({ deviceModelId: modelId });
  if (created) {
    await fetchDevices(true);
    await fetchMyReservations(true);
  }
}

async function onCancel(reservationId: string) {
  const ok = await cancelReservation(reservationId);
  if (ok) {
    await fetchDevices(true);
    await fetchMyReservations(true);
  }
}

onMounted(async () => {
  trackPageView('Devices', window.location.pathname);
  await fetchDevices();

  if (isAuthenticated.value) {
    await fetchMyReservations();
  }
});

watch(isAuthenticated, async () => {
  await fetchDevices(true);

  if (isAuthenticated.value) {
    await fetchMyReservations(true);
  } else {
    reservations.value = [];
  }
});
</script>

<template>
  <main class="page page--catalogue">
    <header class="page__header">
      <h1>Campus Device Catalogue Page</h1>
      <p class="page__subtitle">
        Feel free to browse any of our devices available for loan, right here on
        our campus page!
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
        <li v-for="d in devices" :key="d.modelId" class="device-card">
          <header class="device-card__header">
            <h2 class="device-card__title">{{ d.brand }} {{ d.model }}</h2>
            <span class="device-card__category">{{ d.category }}</span>
          </header>

          <p class="device-card__description">
            {{ d.description }}
          </p>

          <!-- Availability -->
          <template v-if="isAuthenticated">
            <p v-if="d.price != null" class="device-card__hint">
              Price: £{{ d.price }}
            </p>

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

          <!-- Reservations UI (authenticated only) -->
          <template v-if="isAuthenticated">
            <div class="device-card__actions">
              <p v-if="reservationsLoading" class="device-card__hint">
                Loading your reservations…
              </p>

              <p
                v-else-if="reservationsError"
                class="device-card__hint device-card__hint--none"
              >
                {{ reservationsError }}
              </p>

              <template v-else>
                <template v-if="myReservationForModel(d.modelId)">
                  <p class="device-card__hint">
                    You’ve reserved this device model.
                  </p>

                  <!-- ✅ NEW: Due date display (2 days after reservedAt) -->
                  <p class="device-card__hint">
                    Reserved at:
                    {{
                      formatReservedAt(
                        myReservationForModel(d.modelId)!.reservedAt,
                      )
                    }}
                  </p>
                  <p class="device-card__hint">
                    Due back:
                    {{
                      computeDueAt(myReservationForModel(d.modelId)!.reservedAt)
                    }}
                    ({{ DUE_DAYS }} days)
                  </p>

                  <button
                    type="button"
                    class="btn"
                    :disabled="cancelling || reserving"
                    @click="onCancel(myReservationForModel(d.modelId)!.id)"
                  >
                    {{ cancelling ? 'Cancelling…' : 'Cancel reservation' }}
                  </button>
                </template>

                <template v-else>
                  <button
                    type="button"
                    class="btn"
                    :disabled="
                      reserving || cancelling || (d.availableCount ?? 0) <= 0
                    "
                    @click="onReserve(d.modelId)"
                  >
                    {{ reserving ? 'Reserving…' : 'Reserve' }}
                  </button>
                </template>
              </template>

              <p
                v-if="reserveError"
                class="device-card__hint device-card__hint--none"
              >
                {{ reserveError }}
              </p>
              <p
                v-if="cancelError"
                class="device-card__hint device-card__hint--none"
              >
                {{ cancelError }}
              </p>
            </div>
          </template>
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
.device-card__actions {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.5rem;
}
.btn {
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #222;
  background: white;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
