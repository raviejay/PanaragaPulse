<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from './js/supabase';
import { useRouter } from 'vue-router';

const router = useRouter();
const user = ref(null);
const userProfile = ref(null);
const loading = ref(true);

// Check if user is logged in
onMounted(async () => {
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    user.value = session.user;
    await fetchUserProfile();
  }
  
  loading.value = false;

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      user.value = session.user;
      await fetchUserProfile();
      router.push('/dashboard');
    } else {
      user.value = null;
      userProfile.value = null;
      router.push('/login');
    }
  });
});

// Fetch user profile from database
const fetchUserProfile = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.value.id)
      .single();
    
    if (error) throw error;
    userProfile.value = data;
  } catch (error) {
    console.error('Error fetching profile:', error);
  }
};

// Logout function
const handleLogout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    user.value = null;
    userProfile.value = null;
    router.push('/login');
  } catch (error) {
    console.error('Error logging out:', error);
  }
};
</script>

<template>
  <!-- Loading State -->
  <div v-if="loading" class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <div class="text-6xl mb-4">🌊</div>
      <p class="text-gray-600">Loading...</p>
    </div>
  </div>

  <!-- Main App with Header (when logged in) -->
  <div v-else-if="user" class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3 cursor-pointer" @click="router.push('/dashboard')">
            <span class="text-3xl">🌊</span>
            <h1 class="text-2xl font-bold text-gray-900">Panaraga Pulse</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <div class="text-right">
              <p class="text-sm font-medium text-gray-900">{{ userProfile?.name || 'User' }}</p>
              <p class="text-xs text-gray-500 capitalize">{{ userProfile?.role || 'tourist' }}</p>
            </div>
            <button
              @click="handleLogout"
              class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content (Router View) -->
    <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <router-view :userProfile="userProfile" />
    </main>
  </div>

  <!-- Router View for Login (no header) -->
  <router-view v-else />
</template>

<style scoped>
/* Additional custom styles if needed */
</style>