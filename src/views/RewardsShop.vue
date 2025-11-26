<script setup>
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../js/supabase';

const props = defineProps({
  userProfile: {
    type: Object,
    required: true
  },
  navigateTo: {
    type: Function,
    required: true
  }
});

const rewards = ref([]);
const myRedemptions = ref([]);
const loading = ref(true);
const activeTab = ref('shop'); // 'shop' or 'my-vouchers'
const message = ref({ type: '', text: '' });
const showVoucherModal = ref(false);
const selectedVoucher = ref(null);
const redeeming = ref(false);

// Fetch available rewards
const fetchRewards = async () => {
  try {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('points_cost', { ascending: true });

    if (error) throw error;
    rewards.value = data || [];

  } catch (error) {
    console.error('Error fetching rewards:', error);
    message.value = { type: 'error', text: 'Failed to load rewards' };
  }
};

// Fetch user's redemptions
const fetchMyRedemptions = async () => {
  try {
    const { data, error } = await supabase
      .from('redemptions')
      .select(`
        *,
        reward:rewards(name, description, reward_image_url)
      `)
      .eq('user_id', props.userProfile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    myRedemptions.value = data || [];

  } catch (error) {
    console.error('Error fetching redemptions:', error);
    message.value = { type: 'error', text: 'Failed to load redemptions' };
  }
};

// Load data
const loadData = async () => {
  loading.value = true;
  await Promise.all([fetchRewards(), fetchMyRedemptions()]);
  loading.value = false;
};

// Check if user can afford reward
const canAfford = (cost) => {
  return (props.userProfile?.points || 0) >= cost;
};

// Get status color
const getStatusColor = (status) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    claimed: 'bg-blue-100 text-blue-800 border-blue-200',
    used: 'bg-gray-100 text-gray-800 border-gray-200',
    expired: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200'
  };
  return colors[status] || colors.pending;
};

// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Check if voucher is expired
const isExpired = (expiresAt) => {
  return new Date(expiresAt) < new Date();
};

// Redeem reward
const redeemReward = async (reward) => {
  if (!canAfford(reward.points_cost)) {
    message.value = { type: 'error', text: 'Insufficient points!' };
    return;
  }

  if (reward.stock_quantity !== null && reward.stock_quantity <= 0) {
    message.value = { type: 'error', text: 'This reward is out of stock!' };
    return;
  }

  if (!confirm(`Redeem "${reward.name}" for ${reward.points_cost} points?`)) return;

  redeeming.value = true;
  message.value = { type: '', text: '' };

  try {
    // Call the redemption function
    const { data, error } = await supabase.rpc('redeem_reward', {
      p_user_id: props.userProfile.id,
      p_reward_id: reward.id
    });

    if (error) throw error;

    const result = data;

    if (!result.success) {
      message.value = { type: 'error', text: result.message };
      return;
    }

    // Show success with voucher
    message.value = { 
      type: 'success', 
      text: `🎉 Reward redeemed! Check "My Vouchers" tab for your code.` 
    };

    // Refresh data
    await loadData();
    
    // Switch to vouchers tab to show the new voucher
    setTimeout(() => {
      activeTab.value = 'my-vouchers';
    }, 1500);

    // Reload user profile to update points display
    window.location.reload();

  } catch (error) {
    console.error('Redemption error:', error);
    message.value = { type: 'error', text: 'Failed to redeem reward. Please try again.' };
  } finally {
    redeeming.value = false;
  }
};

// Show voucher details
const showVoucher = (redemption) => {
  selectedVoucher.value = redemption;
  showVoucherModal.value = true;
};

// Close voucher modal
const closeVoucherModal = () => {
  showVoucherModal.value = false;
  selectedVoucher.value = null;
};

// Copy voucher code
const copyVoucherCode = (code) => {
  navigator.clipboard.writeText(code);
  message.value = { type: 'success', text: 'Voucher code copied to clipboard!' };
  setTimeout(() => {
    message.value = { type: '', text: '' };
  }, 2000);
};

// Filter redemptions
const activeVouchers = computed(() => {
  return myRedemptions.value.filter(r => 
    (r.status === 'pending' || r.status === 'claimed') && 
    !isExpired(r.expires_at)
  );
});

const usedExpiredVouchers = computed(() => {
  return myRedemptions.value.filter(r => 
    r.status === 'used' || 
    r.status === 'expired' || 
    r.status === 'cancelled' ||
    isExpired(r.expires_at)
  );
});

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <!-- Page Header -->
    <div class="mb-8">
      <button
        @click="navigateTo('/dashboard')"
        class="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Rewards Shop</h1>
          <p class="text-gray-600 mt-1">Redeem your eco-points for amazing rewards</p>
        </div>
        <div class="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-4 rounded-lg shadow-lg">
          <p class="text-sm opacity-90">Your Points</p>
          <p class="text-3xl font-bold flex items-center">
            {{ userProfile?.points || 0 }}
            <svg class="w-6 h-6 ml-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L14.8 8.2L21 11L14.8 13.8L12 20L9.2 13.8L3 11L9.2 8.2L12 2Z"/>
            </svg>
          </p>
        </div>
      </div>
    </div>

    <!-- Alert Message -->
    <div
      v-if="message.text"
      class="mb-6 p-4 rounded-lg flex items-start"
      :class="{
        'bg-green-50 border border-green-200': message.type === 'success',
        'bg-red-50 border border-red-200': message.type === 'error'
      }"
    >
      <svg
        class="w-5 h-5 mr-3 flex-shrink-0"
        :class="{
          'text-green-600': message.type === 'success',
          'text-red-600': message.type === 'error'
        }"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          v-if="message.type === 'success'"
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clip-rule="evenodd"
        />
        <path
          v-else
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
      <p
        class="text-sm font-medium"
        :class="{
          'text-green-800': message.type === 'success',
          'text-red-800': message.type === 'error'
        }"
      >
        {{ message.text }}
      </p>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-lg shadow mb-6">
      <div class="border-b border-gray-200">
        <nav class="flex -mb-px">
          <button
            @click="activeTab = 'shop'"
            class="py-4 px-6 text-sm font-medium border-b-2 transition"
            :class="activeTab === 'shop' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            🛍️ Rewards Shop ({{ rewards.length }})
          </button>
          <button
            @click="activeTab = 'my-vouchers'"
            class="py-4 px-6 text-sm font-medium border-b-2 transition"
            :class="activeTab === 'my-vouchers' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            🎫 My Vouchers ({{ activeVouchers.length }})
          </button>
        </nav>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>

    <!-- Rewards Shop Tab -->
    <div v-else-if="activeTab === 'shop'">
      <div v-if="rewards.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <div class="text-6xl mb-4">🎁</div>
        <h3 class="text-xl font-semibold text-gray-700 mb-2">No Rewards Available</h3>
        <p class="text-gray-500">Check back later for new rewards!</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="reward in rewards"
          :key="reward.id"
          class="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden"
        >
          <!-- Reward Image -->
          <div v-if="reward.reward_image_url" class="h-48 overflow-hidden">
            <img :src="reward.reward_image_url" :alt="reward.name" class="w-full h-full object-cover" />
          </div>
          <div v-else class="h-48 bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
            <span class="text-6xl">🎁</span>
          </div>

          <!-- Reward Details -->
          <div class="p-6">
            <h3 class="text-xl font-bold text-gray-900 mb-2">{{ reward.name }}</h3>
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">{{ reward.description }}</p>

            <!-- Stock Info -->
            <div v-if="reward.stock_quantity !== null" class="mb-3">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Stock:</span>
                <span :class="reward.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'" class="font-medium">
                  {{ reward.stock_quantity > 0 ? `${reward.stock_quantity} left` : 'Out of stock' }}
                </span>
              </div>
            </div>

            <!-- Points Cost -->
            <div class="flex items-center justify-between py-3 px-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200 mb-4">
              <span class="text-sm font-medium text-gray-700">Cost</span>
              <div class="flex items-center space-x-1">
                <span class="text-xl font-bold text-orange-600">{{ reward.points_cost }}</span>
                <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L14.8 8.2L21 11L14.8 13.8L12 20L9.2 13.8L3 11L9.2 8.2L12 2Z"/>
                </svg>
              </div>
            </div>

            <!-- Action Button -->
            <button
              v-if="reward.stock_quantity === 0"
              disabled
              class="w-full bg-gray-100 text-gray-500 px-4 py-3 rounded-lg font-medium cursor-not-allowed"
            >
              Out of Stock
            </button>
            <button
              v-else-if="!canAfford(reward.points_cost)"
              disabled
              class="w-full bg-gray-100 text-gray-500 px-4 py-3 rounded-lg font-medium cursor-not-allowed"
            >
              Need {{ reward.points_cost - (userProfile?.points || 0) }} more points
            </button>
            <button
              v-else
              @click="redeemReward(reward)"
              :disabled="redeeming"
              class="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              {{ redeeming ? 'Redeeming...' : 'Redeem Now' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- My Vouchers Tab -->
    <div v-else>
      <!-- Active Vouchers -->
      <div class="mb-8">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Active Vouchers</h2>
        
        <div v-if="activeVouchers.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
          <div class="text-6xl mb-4">🎫</div>
          <h3 class="text-xl font-semibold text-gray-700 mb-2">No Active Vouchers</h3>
          <p class="text-gray-500 mb-4">Redeem rewards to get vouchers</p>
          <button
            @click="activeTab = 'shop'"
            class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            Browse Rewards
          </button>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="redemption in activeVouchers"
            :key="redemption.id"
            class="bg-white rounded-lg shadow hover:shadow-lg transition p-6 cursor-pointer"
            @click="showVoucher(redemption)"
          >
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <h3 class="text-lg font-bold text-gray-900 mb-1">{{ redemption.reward.name }}</h3>
                <p class="text-sm text-gray-600 mb-2">{{ redemption.reward.description }}</p>
              </div>
              <span
                class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize"
                :class="getStatusColor(redemption.status)"
              >
                {{ redemption.status }}
              </span>
            </div>

            <!-- Voucher Code Preview -->
            <div class="bg-gray-900 text-white p-4 rounded-lg mb-4 font-mono text-center">
              <p class="text-xs opacity-75 mb-1">Voucher Code</p>
              <p class="text-2xl font-bold tracking-wider">{{ redemption.voucher_code }}</p>
            </div>

            <div class="flex items-center justify-between text-sm text-gray-600">
              <div>
                <p class="text-xs text-gray-500">Expires</p>
                <p class="font-medium">{{ formatDate(redemption.expires_at) }}</p>
              </div>
              <div class="text-right">
                <p class="text-xs text-gray-500">Points Spent</p>
                <p class="font-medium text-orange-600">{{ redemption.points_spent }}</p>
              </div>
            </div>

            <button
              @click.stop="copyVoucherCode(redemption.voucher_code)"
              class="w-full mt-4 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Copy Code
            </button>
          </div>
        </div>
      </div>

      <!-- Used/Expired Vouchers -->
      <div v-if="usedExpiredVouchers.length > 0">
        <h2 class="text-xl font-bold text-gray-900 mb-4">History</h2>
        <div class="space-y-3">
          <div
            v-for="redemption in usedExpiredVouchers"
            :key="redemption.id"
            class="bg-white rounded-lg shadow p-4 opacity-60"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900">{{ redemption.reward.name }}</h4>
                <p class="text-sm text-gray-600">{{ redemption.voucher_code }}</p>
              </div>
              <span
                class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize"
                :class="getStatusColor(isExpired(redemption.expires_at) ? 'expired' : redemption.status)"
              >
                {{ isExpired(redemption.expires_at) ? 'expired' : redemption.status }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Voucher Detail Modal -->
    <div
      v-if="showVoucherModal && selectedVoucher"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeVoucherModal"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Voucher Details</h2>
            <button
              @click="closeVoucherModal"
              class="text-gray-400 hover:text-gray-600 transition"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Reward Image -->
          <div v-if="selectedVoucher.reward.reward_image_url" class="mb-6 rounded-lg overflow-hidden">
            <img :src="selectedVoucher.reward.reward_image_url" :alt="selectedVoucher.reward.name" class="w-full h-48 object-cover" />
          </div>

          <h3 class="text-xl font-bold text-gray-900 mb-2">{{ selectedVoucher.reward.name }}</h3>
          <p class="text-gray-600 mb-6">{{ selectedVoucher.reward.description }}</p>

          <!-- Large Voucher Code -->
          <div class="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 rounded-lg mb-6 text-center">
            <p class="text-sm opacity-75 mb-2">Your Voucher Code</p>
            <p class="text-3xl font-bold tracking-wider mb-4 font-mono">{{ selectedVoucher.voucher_code }}</p>
            <button
              @click="copyVoucherCode(selectedVoucher.voucher_code)"
              class="bg-white text-gray-900 px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition"
            >
              Copy Code
            </button>
          </div>

          <!-- Details -->
          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Points Spent:</span>
              <span class="font-semibold text-orange-600">{{ selectedVoucher.points_spent }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Redeemed On:</span>
              <span class="font-semibold">{{ formatDate(selectedVoucher.created_at) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Expires On:</span>
              <span class="font-semibold">{{ formatDate(selectedVoucher.expires_at) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Status:</span>
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize"
                :class="getStatusColor(selectedVoucher.status)"
              >
                {{ selectedVoucher.status }}
              </span>
            </div>
          </div>

          <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-900">
              <strong>How to use:</strong> Show this voucher code to staff to claim your reward. Make sure to use it before the expiration date!
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>