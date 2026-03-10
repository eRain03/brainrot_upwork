import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import SettingsView from '../views/SettingsView.vue'
import ListingsView from '../views/ListingsView.vue'
import BatchUploadView from '../views/BatchUploadView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/batch',
      name: 'batch',
      component: BatchUploadView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/listings',
      name: 'listings',
      component: ListingsView,
    },
  ],
})

export default router
