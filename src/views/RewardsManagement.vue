<script setup>
import { ref, onMounted } from 'vue';
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
const redemptions = ref([]);
const loading = ref(true);
const showModal = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);
const isUploading = ref(false);
const message = ref({ type: '', text: '' });
const fileInputRef = ref(null);
const activeView = ref('rewards'); // 'rewards' or 'redemptions'

const formData = ref({
  id: null,
  name: '',
  description: '',
  points_cost: 0,
  stock_quantity: null,
  category: 'general',
  is_active: true,
  reward_image_url: ''
});

const categories = ['general', 'food', 'merchandise', 'experience', 'discount'];

// Fetch all rewards
const fetchRewards = async () => {
  try {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    rewards.value = data || [];

  } catch (error) {
    console.error('Error fetching rewards:', error);
    message.value = { type: 'error', text: 'Failed to load rewards' };
  }
};

// Fetch all redemptions
const fetchRedemptions = async () => {
  try {
    const { data, error } = await supabase
      .from('redemptions')
      .select(`
        *,
        user:users!redemptions_user_id_fkey(name, email),
        reward:rewards(name, points_cost)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    redemptions.value = data || [];

  } catch (error) {
    console.error('Error fetching redemptions:', error);
    message.value = { type: 'error', text: 'Failed to load redemptions' };
  }
};

// Load data
const loadData = async () => {
  loading.value = true;
  await Promise.all([fetchRewards(), fetchRedemptions()]);
  loading.value = false;
};

// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Get status color
const getStatusColor = (status) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    claimed: 'bg-blue-100 text-blue-800',
    used: 'bg-gray-100 text-gray-800',
    expired: 'bg-red-100 text-red-800',
    cancelled: 'bg-red-100 text-red-800'
  };
  return colors[status] || colors.pending;
};

// Open create modal
const openCreateModal = () => {
  isEditing.value = false;
  formData.value = {
    id: null,
    name: '',
    description: '',
    points_cost: 0,
    stock_quantity: null,
    category: 'general',
    is_active: true,
    reward_image_url: ''
  };
  showModal.value = true;
  message.value = { type: '', text: '' };
};

// Open edit modal
const openEditModal = (reward) => {
  isEditing.value = true;
  formData.value = {
    id: reward.id,
    name: reward.name,
    description: reward.description,
    points_cost: reward.points_cost,
    stock_quantity: reward.stock_quantity,
    category: reward.category,
    is_active: reward.is_active,
    reward_image_url: reward.reward_image_url || ''
  };
  showModal.value = true;
  message.value = { type: '', text: '' };
};

// Close modal
const closeModal = () => {
  showModal.value = false;
  isEditing.value = false;
};

// Handle image upload
const handleImageUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    message.value = { type: 'error', text: 'Please upload an image file' };
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    message.value = { type: 'error', text: 'Image must be less than 5MB' };
    return;
  }

  isUploading.value = true;
  message.value = { type: '', text: '' };

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reward-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('reward-images')
      .getPublicUrl(fileName);

    formData.value.reward_image_url = urlData.publicUrl;
    message.value = { type: 'success', text: 'Image uploaded successfully!' };

  } catch (error) {
    console.error('Upload error:', error);
    message.value = { type: 'error', text: 'Failed to upload image' };
  } finally {
    isUploading.value = false;
  }
};

// Save reward
const saveReward = async () => {
  if (!formData.value.name.trim()) {
    message.value = { type: 'error', text: 'Name is required' };
    return;
  }
  if (!formData.value.description.trim()) {
    message.value = { type: 'error', text: 'Description is required' };
    return;
  }
  if (formData.value.points_cost <= 0) {
    message.value = { type: 'error', text: 'Points cost must be greater than 0' };
    return;
  }

  isSaving.value = true;
  message.value = { type: '', text: '' };

  try {
    const rewardData = {
      name: formData.value.name.trim(),
      description: formData.value.description.trim(),
      points_cost: formData.value.points_cost,
      stock_quantity: formData.value.stock_quantity || null,
      category: formData.value.category,
      is_active: formData.value.is_active,
      reward_image_url: formData.value.reward_image_url || null
    };

    if (isEditing.value) {
      const { error } = await supabase
        .from('rewards')
        .update(rewardData)
        .eq('id', formData.value.id);

      if (error) throw error;
      message.value = { type: 'success', text: 'Reward updated successfully!' };
    } else {
      const { error } = await supabase
        .from('rewards')
        .insert({
          ...rewardData,
          created_by: props.userProfile.id
        });

      if (error) throw error;
      message.value = { type: 'success', text: 'Reward created successfully!' };
    }

    await fetchRewards();
    setTimeout(() => {
      closeModal();
    }, 1500);

  } catch (error) {
    console.error('Save error:', error);
    message.value = { type: 'error', text: 'Failed to save reward' };
  } finally {
    isSaving.value = false;
  }
};

// Delete reward
const deleteReward = async (rewardId) => {
  if (!confirm('Are you sure you want to delete this reward? This action cannot be undone.')) return;

  try {
    const { error } = await supabase
      .from('rewards')
      .delete()
      .eq('id', rewardId);

    if (error) throw error;

    message.value = { type: 'success', text: 'Reward deleted successfully!' };
    await fetchRewards();

  } catch (error) {
    console.error('Delete error:', error);
    message.value = { type: 'error', text: 'Failed to delete reward' };
  }
};

// Update redemption status
const updateRedemptionStatus = async (redemptionId, newStatus) => {
  try {
    const updateData = {
      status: newStatus
    };

    if (newStatus === 'claimed') {
      updateData.claimed_at = new Date().toISOString();
      updateData.claimed_by = props.userProfile.id;
    }

    const { error } = await supabase
      .from('redemptions')
      .update(updateData)
      .eq('id', redemptionId);

    if (error) throw error;

    message.value = { type: 'success', text: 'Status updated successfully!' };
    await fetchRedemptions();

  } catch (error) {
    console.error('Update error:', error);
    message.value = { type: 'error', text: 'Failed to update status' };
  }
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="max-w-7xl mx-auto">
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
          <h1 class="text-3xl font-bold text-gray-900">Rewards Management</h1>
          <p class="text-gray-600 mt-1">Manage rewards and redemptions</p>
        </div>
        <button
          v-if="activeView === 'rewards'"
          @click="openCreateModal"
          class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition flex items-center"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Reward
        </button>
      </div>
    </div>

    <!-- Alert Message -->
    <div
      v-if="message.text && !showModal"
      class="mb-6 p-4 rounded-lg flex items-start"
      :class="{
        'bg-green-50 border border-green-200': message.type === 'success',
        'bg-red-50 border border-red-200': message.type === 'error'
      }"
    >
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

    <!-- View Tabs -->
    <div class="bg-white rounded-lg shadow mb-6">
      <div class="border-b border-gray-200">
        <nav class="flex -mb-px">
          <button
            @click="activeView = 'rewards'"
            class="py-4 px-6 text-sm font-medium border-b-2 transition"
            :class="activeView === 'rewards' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            🎁 Rewards ({{ rewards.length }})
          </button>
          <button
            @click="activeView = 'redemptions'"
            class="py-4 px-6 text-sm font-medium border-b-2 transition"
            :class="activeView === 'redemptions' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            🎫 Redemptions ({{ redemptions.length }})
          </button>
        </nav>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>

    <!-- Rewards View -->
    <div v-else-if="activeView === 'rewards'">
      <div v-if="rewards.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <div class="text-6xl mb-4">🎁</div>
        <h3 class="text-xl font-semibold text-gray-700 mb-2">No Rewards Yet</h3>
        <p class="text-gray-500 mb-4">Create your first reward to get started</p>
        <button
          @click="openCreateModal"
          class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
        >
          Create Reward
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="reward in rewards"
          :key="reward.id"
          class="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden"
        >
          <!-- Image -->
          <div v-if="reward.reward_image_url" class="h-48 overflow-hidden">
            <img :src="reward.reward_image_url" :alt="reward.name" class="w-full h-full object-cover" />
          </div>
          <div v-else class="h-48 bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
            <span class="text-6xl">🎁</span>
          </div>

          <!-- Details -->
          <div class="p-6">
            <div class="flex items-start justify-between mb-2">
              <h3 class="text-lg font-bold text-gray-900 flex-1">{{ reward.name }}</h3>
              <span
                class="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                :class="reward.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'"
              >
                {{ reward.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>

            <p class="text-gray-600 text-sm mb-4">{{ reward.description }}</p>

            <div class="space-y-2 mb-4 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Cost:</span>
                <span class="font-semibold text-orange-600">{{ reward.points_cost }} points</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Stock:</span>
                <span class="font-semibold">{{ reward.stock_quantity ?? 'Unlimited' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Category:</span>
                <span class="font-semibold capitalize">{{ reward.category }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <button
                @click="openEditModal(reward)"
                class="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Edit
              </button>
              <button
                @click="deleteReward(reward.id)"
                class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Redemptions View -->
    <div v-else>
      <div v-if="redemptions.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <div class="text-6xl mb-4">🎫</div>
        <h3 class="text-xl font-semibold text-gray-700 mb-2">No Redemptions Yet</h3>
        <p class="text-gray-500">Redemptions will appear here when users redeem rewards</p>
      </div>

      <div v-else class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voucher</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="redemption in redemptions" :key="redemption.id">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{{ redemption.user?.name || 'Unknown' }}</div>
                <div class="text-sm text-gray-500">{{ redemption.user?.email || 'N/A' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ redemption.reward?.name || 'Deleted Reward' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-mono text-gray-900">{{ redemption.voucher_code }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-semibold">
                {{ redemption.points_spent }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(redemption.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
                  :class="getStatusColor(redemption.status)"
                >
                  {{ redemption.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <select
                  :value="redemption.status"
                  @change="updateRedemptionStatus(redemption.id, $event.target.value)"
                  class="text-sm border-gray-300 rounded-md"
                >
                  <option value="pending">Pending</option>
                  <option value="claimed">Claimed</option>
                  <option value="used">Used</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-900">
              {{ isEditing ? 'Edit Reward' : 'Create New Reward' }}
            </h2>
            <button
              @click="closeModal"
              class="text-gray-400 hover:text-gray-600 transition"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Alert Message -->
          <div
            v-if="message.text"
            class="mb-6 p-4 rounded-lg"
            :class="{
              'bg-green-50 border border-green-200 text-green-800': message.type === 'success',
              'bg-red-50 border border-red-200 text-red-800': message.type === 'error'
            }"
          >
            <p class="text-sm font-medium">{{ message.text }}</p>
          </div>

          <!-- Form -->
          <form @submit.prevent="saveReward" class="space-y-6">
            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Reward Name *</label>
              <input
                v-model="formData.name"
                type="text"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Free Coffee Voucher"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea
                v-model="formData.description"
                required
                rows="3"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the reward..."
              ></textarea>
            </div>

            <!-- Image -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Reward Image</label>
              <div v-if="formData.reward_image_url" class="mb-3">
                <img :src="formData.reward_image_url" alt="Reward" class="w-full h-48 object-cover rounded-lg" />
              </div>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                @change="handleImageUpload"
                :disabled="isUploading"
                class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Points Cost -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Points Cost *</label>
                <input
                  v-model.number="formData.points_cost"
                  type="number"
                  required
                  min="1"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="100"
                />
              </div>

              <!-- Stock -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Stock Quantity</label>
                <input
                  v-model.number="formData.stock_quantity"
                  type="number"
                  min="0"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave empty for unlimited"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Category -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  v-model="formData.category"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option v-for="cat in categories" :key="cat" :value="cat" class="capitalize">
                    {{ cat }}
                  </option>
                </select>
              </div>

              <!-- Active Status -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <label class="flex items-center mt-2">
                  <input
                    v-model="formData.is_active"
                    type="checkbox"
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span class="ml-2 text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4">
              <button
                type="submit"
                :disabled="isSaving || isUploading"
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isSaving ? 'Saving...' : (isEditing ? 'Update Reward' : 'Create Reward') }}
              </button>
              <button
                type="button"
                @click="closeModal"
                :disabled="isSaving"
                class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>