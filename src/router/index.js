import { createRouter, createWebHashHistory  } from "vue-router";
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
import RewardsShop from "../views/RewardsShop.vue";
import AdminRewardsManagement from "../views/RewardsManagement.vue";
import EventParticipants from "@/views/EventParticipants.vue";
import UserManagement from "../views/UserManagement.vue";

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
 
  {
    path: "/tourist/rewards",
    name: "TouristRewards",
    component: RewardsShop,
    meta: { requiresAuth: true, role: "tourist" },
  },


  {
    path: "/admin/rewards",
    name: "AdminRewards",
    component: AdminRewardsManagement,
    meta: { requiresAuth: true, role: "admin" },
  },
  {
    path: "/admin/event-participants",
    name: "EventParticipants",
    component: EventParticipants,
    meta: { requiresAuth: true, role: "admin" },
  },
  {
    path: "/admin/user-management",
    name: "UserManagement",
    component: UserManagement,
    meta: { requiresAuth: true, role: "admin" },
  }

];

const router = createRouter({
  history: createWebHashHistory(),
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
