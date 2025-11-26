import { createRouter, createWebHistory } from "vue-router";
import { supabase } from "../js/supabase";

// Import components
import Login from "../components/Login.vue";
import Dashboard from "../views/Dashboard.vue";
import AdminQR from "../views/AdminQR.vue";
import RangerScan from "../views/RangerScan.vue";
import TouristScan from "../views/TouristScan.vue";
import UserProfile from "../views/UserProfile.vue";
import EventList from "../views/EventList.vue";
import EventManagement from "../views/EventManagement.vue";
import EventScanner from "../views/EventScanner.vue";

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
  {
    path: "/tourist/events",
    name: "TouristEvents",
    component: EventList,
    meta: { requiresAuth: true, role: "tourist" },
  },
  {
    path: "/admin/events",
    name: "AdminEvents",
    component: EventManagement,
    meta: { requiresAuth: true, role: "admin" },
  },
  {
    path: "/ranger/event-scanner",
    name: "RangerEventScanner",
    component: EventScanner,
    meta: { requiresAuth: true, role: "ranger" },
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
router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  if (requiresAuth && !session) {
    // Not logged in, redirect to login
    next('/login');
  } else if (to.path === '/login' && session) {
    // Already logged in, redirect to dashboard
    next('/dashboard');
  } else if (to.meta.role && session) {
    // Check role-based access
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile && profile.role === to.meta.role) {
      next();
    } else {
      // Wrong role, redirect to dashboard
      next('/dashboard');
    }
  } else {
    next();
  }
});

export default router;
