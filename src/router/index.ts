import { createRouter, createWebHistory } from 'vue-router';
import Devices from '@/views/Devices.vue';
import Availability from '@/views/Availability.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'catalogue', component: Devices },
    { path: '/availability', name: 'availability', component: Availability },
  ],
});

export default router;
