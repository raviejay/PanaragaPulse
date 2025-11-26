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
  // Add catch-all route for 404 handling
  {
    path: "/:pathMatch(.*)*",
    redirect: "/login",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Enhanced navigation guard with proper auth handling
router.beforeEach(async (to, from, next) => {
  console.log(`[Router] Navigation: ${from.path} -> ${to.path}`);

  try {
    // Get current session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Auth session error:", error);
      next("/login");
      return;
    }

    const requiresAuth = to.meta.requiresAuth;
    const isAuthPage = to.path === "/login";

    // If route requires authentication but no session exists
    if (requiresAuth && !session) {
      console.log("[Router] Auth required but no session, redirecting to login");
      next("/login");
      return;
    }

    // If user is already authenticated and tries to access login page
    if (isAuthPage && session) {
      console.log("[Router] Session exists, redirecting from login to dashboard");
      next("/dashboard");
      return;
    }

    // If route requires specific role
    if (to.meta.role && session) {
      const userRole = session.user?.user_metadata?.role;
      console.log("[Router] User role:", userRole, "Required role:", to.meta.role);

      if (userRole !== to.meta.role) {
        console.log("[Router] Role mismatch, redirecting to dashboard");
        next("/dashboard");
        return;
      }
    }

    // Allow navigation
    next();
  } catch (error) {
    console.error("[Router] Navigation error:", error);
    next("/login");
  }
});

export default router;
