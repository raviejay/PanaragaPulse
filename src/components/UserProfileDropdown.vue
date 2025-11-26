<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  userProfile: {
    type: Object,
    required: true
  },
  onLogout: {
    type: Function,
    required: true
  },
  navigateTo: {
    type: Function,
    required: true
  }
});

const isOpen = ref(false);
const dropdownRef = ref(null);

// Toggle dropdown
const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    isOpen.value = false;
  }
};

// Get user initials for avatar fallback
const getUserInitials = () => {
  const name = props.userProfile?.name || 'User';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Get role color
const getRoleColor = () => {
  const role = props.userProfile?.role || 'tourist';
  const colors = {
    admin: 'bg-purple-100 text-purple-800',
    ranger: 'bg-green-100 text-green-800',
    tourist: 'bg-blue-100 text-blue-800'
  };
  return colors[role] || colors.tourist;
};

// Handle profile navigation
const goToProfile = () => {
  isOpen.value = false;
  props.navigateTo('/profile');
};

// Handle logout
const handleLogout = () => {
  isOpen.value = false;
  props.onLogout();
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="relative" ref="dropdownRef">
    <!-- Profile Button -->
    <button
      @click="toggleDropdown"
      class="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full transition"
    >
      <!-- Avatar -->
      <div class="relative">
        <div 
          v-if="userProfile?.avatar_url"
          class="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition"
        >
          <img 
            :src="userProfile.avatar_url" 
            :alt="userProfile.name"
            class="w-full h-full object-cover"
          />
        </div>
        <div 
          v-else
          class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm border-2 border-gray-200 hover:border-blue-400 transition"
        >
          {{ getUserInitials() }}
        </div>
        
        <!-- Online indicator -->
        <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
      </div>

      <!-- Chevron icon -->
      <svg 
        class="w-4 h-4 text-gray-500 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-show="isOpen"
        class="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
      >
        <!-- User Info Section -->
        <div class="px-4 py-3 border-b border-gray-100">
          <div class="flex items-center space-x-3">
            <!-- Large Avatar -->
            <div 
              v-if="userProfile?.avatar_url"
              class="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200"
            >
              <img 
                :src="userProfile.avatar_url" 
                :alt="userProfile.name"
                class="w-full h-full object-cover"
              />
            </div>
            <div 
              v-else
              class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg"
            >
              {{ getUserInitials() }}
            </div>

            <!-- User Details -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900 truncate">
                {{ userProfile?.name || 'User' }}
              </p>
              <p class="text-xs text-gray-500 truncate">
                {{ userProfile?.email || 'user@example.com' }}
              </p>
              <span 
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1"
                :class="getRoleColor()"
              >
                {{ userProfile?.role || 'tourist' }}
              </span>
            </div>
          </div>

          <!-- Points (for tourists) -->
          <div 
            v-if="userProfile?.role === 'tourist' && userProfile?.points !== undefined"
            class="mt-3 p-2 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="text-xl">🏆</span>
                <span class="text-sm font-medium text-gray-700">Eco Points</span>
              </div>
              <span class="text-lg font-bold text-orange-600">{{ userProfile.points }}</span>
            </div>
          </div>
        </div>

        <!-- Menu Items -->
        <div class="py-1">
          <button
            @click="goToProfile"
            class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition"
          >
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>View Profile</span>
          </button>

          <button
            @click="() => { isOpen = false; navigateTo('/dashboard'); }"
            class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition"
          >
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </button>
        </div>

        <!-- Logout Button -->
        <div class="border-t border-gray-100 pt-1">
          <button
            @click="handleLogout"
            class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 transition"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span class="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>