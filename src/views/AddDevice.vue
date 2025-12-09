<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { useAddDevice } from '@/composables/useAddDevice';

const { isAuthenticated, loginWithRedirect, user } = useAuth0();
const { addDevice, loading, error, success } = useAddDevice();

// Adjust this to match your Auth0 custom claim / roles configuration.
const isStaff = computed(() => {
  const u = user.value as any | null;
  const roles =
    u?.['https://example.com/roles'] ??
    u?.['https://schemas.teesside.ac.uk/roles'];
  return Array.isArray(roles) && roles.includes('staff');
});

const form = ref({
  id: '',
  brand: '',
  model: '',
  category: '',
  price: 0,
  description: '',
  status: 'available' as 'available' | 'reserved' | 'loaned' | 'retired',
});

const handleSubmit = async () => {
  await addDevice(form.value);
};
</script>

<template>
  <main class="page page--add-device">
    <header class="page__header">
      <h1>Add Device</h1>
      <p class="page__subtitle">
        Staff can register individual physical devices in the catalogue.
      </p>
    </header>

    <section v-if="!isAuthenticated" class="page__notice">
      <p>You need to sign in as a staff member to add devices.</p>
      <button type="button" @click="loginWithRedirect()">Sign in</button>
    </section>

    <section v-else-if="!isStaff" class="page__notice page__notice--forbidden">
      <p>You are signed in, but you do not have permission to add devices.</p>
    </section>

    <section v-else class="page__body">
      <form class="device-form" @submit.prevent="handleSubmit">
        <div class="device-form__row">
          <label>
            Model ID
            <input
              v-model="form.id"
              type="text"
              required
              placeholder="e.g. macbook-air-m1"
            />
          </label>
        </div>

        <div class="device-form__row">
          <label>
            Brand
            <input
              v-model="form.brand"
              type="text"
              required
              placeholder="e.g. Apple"
            />
          </label>
        </div>

        <div class="device-form__row">
          <label>
            Model
            <input
              v-model="form.model"
              type="text"
              required
              placeholder="e.g. MacBook Air M1"
            />
          </label>
        </div>

        <div class="device-form__row">
          <label>
            Category
            <input
              v-model="form.category"
              type="text"
              required
              placeholder="e.g. Laptop"
            />
          </label>
        </div>

        <div class="device-form__row">
          <label>
            Price (whole number, e.g. 999)
            <input
              v-model.number="form.price"
              type="number"
              min="0"
              step="1"
              required
            />
          </label>
        </div>

        <div class="device-form__row">
          <label>
            Description
            <textarea
              v-model="form.description"
              rows="3"
              required
              placeholder="Short description of the device and its typical use."
            />
          </label>
        </div>

        <div class="device-form__row">
          <label>
            Status
            <select v-model="form.status">
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="loaned">Loaned</option>
              <option value="retired">Retired</option>
            </select>
          </label>
        </div>

        <div class="device-form__actions">
          <button type="submit" :disabled="loading">
            <span v-if="loading">Adding…</span>
            <span v-else>Add device</span>
          </button>
        </div>

        <p v-if="error" class="device-form__error">
          {{ error }}
        </p>
        <p v-if="success" class="device-form__success">
          Device added successfully.
        </p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 640px;
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
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px dashed #999;
}
.page__notice--forbidden {
  border-color: #b00020;
}
.device-form__row {
  margin-bottom: 1rem;
}
.device-form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.95rem;
}
.device-form input,
.device-form textarea,
.device-form select {
  padding: 0.5rem;
  border-radius: 0.4rem;
  border: 1px solid #ccc;
}
.device-form__actions {
  margin-top: 1rem;
}
.device-form__error {
  margin-top: 0.75rem;
  color: #b00020;
}
.device-form__success {
  margin-top: 0.75rem;
  color: #2e7d32;
}
</style>
