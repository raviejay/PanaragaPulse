<script setup>
import { ref, onMounted, watch } from 'vue';
import { supabase } from './js/supabase';
import { useRouter, useRoute } from 'vue-router';
import UserProfileDropdown from './components/UserProfileDropdown.vue';

const router = useRouter();
const route = useRoute();
const user = ref(null);
const userProfile = ref(null);
const loading = ref(true);

// Initialize auth
onMounted(async () => {
  await checkAuth();
  loading.value = false;

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth] State changed:', event);
    await checkAuth();
  });
});

// Check authentication and handle routing
const checkAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      user.value = session.user;
      await fetchUserProfile();
      
      // If on login page, redirect to dashboard
      if (route.path === '/login') {
        window.location.href = '/dashboard';
      }
    } else {
      user.value = null;
      userProfile.value = null;
      
      // If not on login page, redirect to login
      if (route.path !== '/login') {
        window.location.href = '/login';
      }
    }
  } catch (error) {
    console.error('[Auth] Check failed:', error);
  }
};

// Fetch user profile
const fetchUserProfile = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.value.id)
      .single();
    
    if (error) throw error;
    userProfile.value = data;
    console.log('[Profile] Loaded:', data);
  } catch (error) {
    console.error('[Profile] Error:', error);
  }
};

// Check role access for current route
const hasRoleAccess = () => {
  if (!route.meta.role) return true;
  return userProfile.value?.role === route.meta.role;
};

// Watch route changes for role-based access
watch(() => route.path, () => {
  if (user.value && route.meta.role && !hasRoleAccess()) {
    console.log('[Access] Denied for route:', route.path);
    window.location.href = '/dashboard';
  }
});

// Simple navigation using window.location (most reliable)
const navigateTo = (path) => {
  console.log('[Nav] Going to:', path);
  window.location.href = path;
};

// Logout
const handleLogout = async () => {
  try {
    await supabase.auth.signOut();
    user.value = null;
    userProfile.value = null;
    window.location.href = '/login';
  } catch (error) {
    console.error('[Logout] Error:', error);
  }
};

// Check if header should show
const needsHeader = () => {
  return user.value && route.path !== '/login';
};
</script>

<template>
  <!-- Loading State -->
  <div v-if="loading" class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <img src="@/assets/logo.png" alt="Loading Icon" class="w-24 h-24 mx-auto mb-4" />
      <p class="text-gray-600">Loading...</p>
    </div>
  </div>


  <!-- Main App -->
  <div v-else class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header v-if="needsHeader()" class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-2 py-2 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
         <div 
            class="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition"
            @click="navigateTo('/dashboard')"
          >
            <img 
              src="@/assets/logo.png" 
              alt="Logo" 
              class="w-10 h-10 object-contain m-1"
            />
          <h1 class="text-xl font-bold" style="color: #0A3A47;">
          Panaraga <span style="color: #3CB371;">Pulse</span>
         </h1>

          </div>

          
          <!-- User Profile Dropdown -->
          <UserProfileDropdown
            :userProfile="userProfile"
            :onLogout="handleLogout"
            :navigateTo="navigateTo"
          />
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main :class="needsHeader() ? 'max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8' : ''">
      <router-view 
        v-if="user"
        :userProfile="userProfile" 
        :navigateTo="navigateTo"
        :key="route.fullPath" 
      />
      <router-view v-else />
    </main>
  </div>
</template>