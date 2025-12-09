<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';

const { isAuthenticated, loginWithRedirect, logout, user, isLoading } =
  useAuth0();
const returnTo = window.location.origin;
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">Campus Device Loan App</div>
      <div class="spacer"></div>
      <div class="auth">
        <span v-if="!isLoading && isAuthenticated && user" class="user">
          Signed in as {{ user.name || user.email }}
        </span>
        <button v-if="!isAuthenticated" @click="loginWithRedirect()">
          Sign in
        </button>
        <button v-else @click="logout({ logoutParams: { returnTo } })">
          Sign out
        </button>
      </div>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: #f5f5f5;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #111827; /* gray-900 */
  color: #e5e7eb; /* gray-200 */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.brand {
  font-weight: 600;
}
.spacer {
  flex: 1;
}
.auth {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.auth button {
  background: #2563eb;
  color: white;
  border: none;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
}
.auth button:hover {
  background: #1d4ed8;
}
.user {
  margin-right: 0.5rem;
  font-size: 0.9rem;
  opacity: 0.9;
}
.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}
</style>
