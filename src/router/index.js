import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from '../js/supabase';

// Import components
import Login from '../components/Login.vue';
import Dashboard from '../views/Dashboard.vue';
import AdminQR from '../views/AdminQR.vue';
import RangerScan from '../views/RangerScan.vue';
import TouristScan from '../views/TouristScan.vue';

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/qr-management',
    name: 'AdminQR',
    component: AdminQR,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/ranger/scan',
    name: 'RangerScan',
    component: RangerScan,
    meta: { requiresAuth: true, role: 'ranger' }
  },
  {
    path: '/tourist/scan',
    name: 'TouristScan',
    component: TouristScan,
    meta: { requiresAuth: true, role: 'tourist' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation guard
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