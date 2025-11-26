import { createRouter, createWebHistory } from "vue-router";
import { supabase } from "../js/supabase";

// Import components
import Login from "../components/Login.vue";
import Dashboard from "../views/Dashboard.vue";
import AdminQR from "../views/AdminQR.vue";
import RangerScan from "../views/RangerScan.vue";
import TouristScan from "../views/TouristScan.vue";
import UserProfile from "../views/UserProfile.vue";

const routes = [
  {
    path: "/",
    redirect: "/login",
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
    meta: { requiresAuth: false },
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/admin/qr-management",
    name: "AdminQR",
    component: AdminQR,
    meta: { requiresAuth: true, role: "admin" },
  },
  {
    path: "/ranger/scan",
    name: "RangerScan",
    component: RangerScan,
    meta: { requiresAuth: true, role: "ranger" },
  },
  {
    path: "/tourist/scan",
    name: "TouristScan",
    component: TouristScan,
    meta: { requiresAuth: true, role: "tourist" },
  },
  {
    path: "/profile",
    name: "Profile",
    component: UserProfile,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Simplified navigation guard - no async in the guard itself
router.beforeEach((to, from, next) => {
  console.log(`[Router] Navigation: ${from.path} -> ${to.path}`);

  // Just allow navigation - we'll handle auth in components
  next();
});

// Error handler
router.onError((error) => {
  console.error("[Router] Error:", error);
});

// Success handler
router.afterEach((to, from) => {
  console.log(`[Router] Completed: ${to.path}`);
});

export default router;
