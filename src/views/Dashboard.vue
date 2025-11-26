<script setup>
import { defineProps } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  userProfile: Object
});

const router = useRouter();
</script>

<template>
  <div>
    <!-- Welcome Card -->
    <div class="bg-gradient-to-r from-cyan-500 to-teal-500 rounded-2xl p-8 text-white mb-8 whitespace-nowrap">
      <h2 class="text-3xl font-bold mb-2">Welcome back, {{ userProfile?.name }}! 👋</h2>
      <!-- <p class="text-cyan-100 mb-4">You're logged in as a {{ userProfile?.role }}</p> -->
      <div class="flex items-center space-x-6">
        <div class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
          <p class="text-sm text-cyan-100">Eco Points</p>
         <p class="text-3xl font-bold flex items-center gap-1"> 
          {{ userProfile?.points || 0 }}

          <span class="flex items-center gap-1 text-cyan-100 pt-1">
            <svg 
              class="animate-pulse"
              width="30" 
              height="30" 
              viewBox="0 0 24 24" 
              fill="#0FA958" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2L14.8 8.2L21 11L14.8 13.8L12 20L9.2 13.8L3 11L9.2 8.2L12 2Z"/>
            </svg>
          </span>
        </p>



        </div>
      </div>
    </div>

    <!-- Role-based Dashboard -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      <!-- Admin Dashboard -->
      <template v-if="userProfile?.role === 'admin'">
        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="text-4xl mb-4">🏷️</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Create QR Codes</h3>
          <p class="text-gray-600 mb-4">Generate and manage QR codes for coral locations</p>
          <button 
            @click="router.push('/admin/qr-management')"
            class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg w-full">
            Manage QR Codes
          </button>
        </div>
        
        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="text-4xl mb-4">📊</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">View Dashboard</h3>
          <p class="text-gray-600 mb-4">Monitor all activities and submissions</p>
          <button class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg w-full">
            View Analytics
          </button>
        </div>

        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="text-4xl mb-4">👥</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">User Management</h3>
          <p class="text-gray-600 mb-4">Manage rangers and tourists</p>
          <button class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg w-full">
            Manage Users
          </button>
        </div>
      </template>

      <!-- Ranger Dashboard -->
      <template v-else-if="userProfile?.role === 'ranger'">
        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="text-4xl mb-4">📷</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Scan QR Code</h3>
          <p class="text-gray-600 mb-4">Update coral information and status</p>
          <button 
            @click="router.push('/ranger/scan')"
            class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg w-full">
            Scan & Update
          </button>
        </div>

        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="text-4xl mb-4">🪸</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Coral Monitoring</h3>
          <p class="text-gray-600 mb-4">View and manage coral data</p>
          <button class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg w-full">
            View Corals
          </button>
        </div>

        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="text-4xl mb-4">✅</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Verify Actions</h3>
          <p class="text-gray-600 mb-4">Review tourist eco-actions</p>
          <button class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg w-full">
            Review Submissions
          </button>
        </div>
      </template>

      <!-- Tourist Dashboard -->
      <template v-else>
        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="text-4xl mb-4">📱</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Scan QR Code</h3>
          <p class="text-gray-600 mb-4">Discover coral information at the beach</p>
          <button 
            @click="router.push('/tourist/scan')"
            class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg w-full">
            Scan QR
          </button>
        </div>

        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="text-4xl mb-4">🌿</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Do Eco-Actions</h3>
          <p class="text-gray-600 mb-4">Complete tasks and earn points</p>
          <button class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg w-full">
            View Actions
          </button>
        </div>

        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="text-4xl mb-4">🏆</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">My Achievements</h3>
          <p class="text-gray-600 mb-4">Track your eco-contributions</p>
          <button class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg w-full">
            View History
          </button>
        </div>
      </template>

    </div>

    <!-- Info Section -->
    <div class="mt-8 bg-white rounded-xl shadow-md p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4">🌊 About Panaraga Pulse</h3>
      <p class="text-gray-600 mb-2">
        Panaraga Pulse is a community-driven platform to protect and monitor coral reefs.
      </p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div class="bg-cyan-50 rounded-lg p-4">
          <p class="text-2xl font-bold text-cyan-600">{{ userProfile?.role === 'admin' ? '∞' : userProfile?.points || 0 }}</p>
          <p class="text-sm text-gray-600">Your Points</p>
        </div>
        <div class="bg-blue-50 rounded-lg p-4">
          <p class="text-2xl font-bold text-blue-600">Active</p>
          <p class="text-sm text-gray-600">Status</p>
        </div>
        <div class="bg-teal-50 rounded-lg p-4">
          <p class="text-2xl font-bold text-teal-600 capitalize">{{ userProfile?.role || 'tourist' }}</p>
          <p class="text-sm text-gray-600">Role</p>
        </div>
      </div>
    </div>
  </div>
</template>