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
    
    // Only run checkAuth for specific events to avoid conflicts
    if (event === 'SIGNED_IN') {
      await checkAuth();
    } else if (event === 'SIGNED_OUT') {
      user.value = null;
      userProfile.value = null;
      if (route.path !== '/login') {
        await router.push('/login');
      }
    }
  });
});

// Check authentication and handle routing
const checkAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      user.value = session.user;
      await fetchUserProfile();
      
      // If on login page, redirect to dashboard using Vue Router
      if (route.path === '/login') {
        router.push('/dashboard');
      }
    } else {
      user.value = null;
      userProfile.value = null;
      
      // If not on login page, redirect to login using Vue Router
      if (route.path !== '/login') {
        router.push('/login');
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
    router.push('/dashboard');
  }
});

// Use Vue Router for navigation (fixes the 404 issue)
const navigateTo = (path) => {
  console.log('[Nav] Going to:', path);
  router.push(path);
};

// Logout
const handleLogout = async () => {
  try {
    console.log('[Logout] Starting logout...');
    
    // Clear local state first
    user.value = null;
    userProfile.value = null;
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('[Logout] Supabase error:', error);
      throw error;
    }
    
    console.log('[Logout] Successfully signed out');
    
    // Navigate to login
    await router.push('/login');
  } catch (error) {
    console.error('[Logout] Error:', error);
    // Force navigation to login even if there's an error
    await router.push('/login');
  }
};

// Check if header should show
const needsHeader = () => {
  return user.value && route.path !== '/login';
};
</script>

<template>
  <!-- Loading State -->
<!-- Loading State -->
<div v-if="loading" class="min-h-screen flex flex-col items-center justify-center bg-gray-50">
  
  <img src="@/assets/logo.png" alt="Loading Icon" class="w-24 h-24 mx-auto mb-6" />

  <!-- Wave Loading Bar -->
  <div class="wave-loader">
    <div class="wave"></div>
    <div class="wave"></div>
    <div class="wave"></div>
    <div class="wave"></div>
    <div class="wave"></div>
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

<style scoped>
  .wave-loader {
  display: flex;
  gap: 6px;
  width: 120px;
  height: 20px;
  align-items: flex-end;
}

.wave {
  width: 20px;
  height: 100%;
  background: #3CB371;
  border-radius: 6px;
  animation: waveAnim 1s infinite ease-in-out;
}

.wave:nth-child(1) { animation-delay: 0s; }
.wave:nth-child(2) { animation-delay: 0.15s; }
.wave:nth-child(3) { animation-delay: 0.3s; }
.wave:nth-child(4) { animation-delay: 0.45s; }
.wave:nth-child(5) { animation-delay: 0.6s; }

@keyframes waveAnim {
  0%, 100% {
    height: 20%;
    opacity: 0.3;
  }
  50% {
    height: 100%;
    opacity: 1;
  }
}

</style>
