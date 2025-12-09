<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../js/supabase';
import QRCode from 'qrcode';

const router = useRouter();
const showCreateModal = ref(false);
const qrCodes = ref([]);
const loading = ref(false);
const error = ref('');
const success = ref('');

// Form fields
const locationName = ref('');
const latitude = ref('');
const longitude = ref('');

// QR Code preview
const qrCodePreview = ref('');
const selectedQR = ref(null);

// History view
const showHistoryModal = ref(false);
const selectedQRHistory = ref(null);
const historyData = ref([]);
const currentCoralInfo = ref(null);
const loadingHistory = ref(false);

// Fetch all QR codes
const fetchQRCodes = async () => {
  try {
    loading.value = true;
    const { data, error: fetchError } = await supabase
      .from('qr_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    qrCodes.value = data || [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Generate unique QR code string
const generateQRCode = () => {
  return `CORAL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

// Create new QR code
const createQRCode = async () => {
  try {
    loading.value = true;
    error.value = '';
    success.value = '';

    if (!locationName.value.trim()) {
      error.value = 'Location name is required';
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const code = generateQRCode();

    const { data, error: insertError } = await supabase
      .from('qr_codes')
      .insert({
        code: code,
        location_name: locationName.value,
        latitude: latitude.value ? parseFloat(latitude.value) : null,
        longitude: longitude.value ? parseFloat(longitude.value) : null,
        created_by: user.id
      })
      .select()
      .single();

    if (insertError) throw insertError;

    success.value = 'QR Code created successfully!';
    
    locationName.value = '';
    latitude.value = '';
    longitude.value = '';
    
    await fetchQRCodes();
    
    setTimeout(() => {
      showCreateModal.value = false;
      success.value = '';
    }, 1500);

  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// View QR code details and generate image
const viewQRCode = async (qr) => {
  selectedQR.value = qr;
  
  try {
    const qrDataURL = await QRCode.toDataURL(qr.code, {
      width: 300,
      margin: 2,
      color: {
        dark: '#0891b2',
        light: '#ffffff'
      }
    });
    qrCodePreview.value = qrDataURL;
  } catch (err) {
    console.error('Error generating QR code:', err);
  }
};

// Download QR code as PNG
const downloadQRCode = async (qr) => {
  try {
    const qrDataURL = await QRCode.toDataURL(qr.code, {
      width: 800,
      margin: 2,
      color: {
        dark: '#0891b2',
        light: '#ffffff'
      }
    });

    const link = document.createElement('a');
    link.href = qrDataURL;
    link.download = `QR-${qr.location_name.replace(/\s+/g, '-')}.png`;
    link.click();
  } catch (err) {
    error.value = 'Failed to download QR code';
  }
};

// View coral info history
const viewHistory = async (qr) => {
  try {
    loadingHistory.value = true;
    selectedQRHistory.value = qr;
    showHistoryModal.value = true;
    historyData.value = [];
    currentCoralInfo.value = null;

    // Fetch current coral info
    const { data: currentData, error: currentError } = await supabase
      .from('coral_info')
      .select(`
        *,
        ranger:users!coral_info_ranger_id_fkey(name, email)
      `)
      .eq('qr_id', qr.id)
      .single();

    if (currentData) {
      currentCoralInfo.value = currentData;
    }

    // Fetch history data
    const { data: history, error: historyError } = await supabase
      .from('coral_info_history')
      .select(`
        *,
        ranger:users!coral_info_history_ranger_id_fkey(name, email)
      `)
      .eq('qr_id', qr.id)
      .order('changed_at', { ascending: false });

    if (historyError) throw historyError;

    historyData.value = history || [];

  } catch (err) {
    error.value = err.message;
  } finally {
    loadingHistory.value = false;
  }
};

// Close history modal
const closeHistoryModal = () => {
  showHistoryModal.value = false;
  selectedQRHistory.value = null;
  historyData.value = [];
  currentCoralInfo.value = null;
};

// Get health status badge color
const getHealthBadgeColor = (health) => {
  const colors = {
    'healthy': 'bg-green-100 text-green-800',
    'bleached': 'bg-gray-100 text-gray-800',
    'damaged': 'bg-yellow-100 text-yellow-800',
    'threatened': 'bg-red-100 text-red-800'
  };
  return colors[health] || 'bg-gray-100 text-gray-800';
};

// Get health emoji
const getHealthEmoji = (health) => {
  const emojis = {
    'healthy': '🟢',
    'bleached': '⚪',
    'damaged': '🟡',
    'threatened': '🔴'
  };
  return emojis[health] || '⚪';
};

// Delete QR code
const deleteQRCode = async (id) => {
  if (!confirm('Are you sure you want to delete this QR code? This action cannot be undone.')) {
    return;
  }

  try {
    loading.value = true;
    const { error: deleteError } = await supabase
      .from('qr_codes')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    success.value = 'QR Code deleted successfully!';
    await fetchQRCodes();
    
    setTimeout(() => {
      success.value = '';
    }, 2000);

  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Close preview modal
const closePreview = () => {
  selectedQR.value = null;
  qrCodePreview.value = '';
};

onMounted(() => {
  fetchQRCodes();
});
</script>

<template>
  <div>
    <!-- Back to Dashboard -->
    <button
      @click="router.push('/dashboard')"
      class="mb-6 flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
    >
      <span class="text-xl mr-2">←</span> Back to Dashboard
    </button>

    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">QR Code Management</h2>
        <p class="text-gray-600 mt-1">Create and manage coral location QR codes</p>
      </div>
      <button
        @click="showCreateModal = true"
        class="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition flex items-center space-x-2"
      >
        <span class="text-xl">➕</span>
        <span>Create QR Code</span>
      </button>
    </div>

    <!-- Messages -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
      {{ error }}
    </div>
    <div v-if="success" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
      {{ success }}
    </div>

    <!-- Loading State -->
    <div v-if="loading && qrCodes.length === 0" class="text-center py-12">
      <div class="text-4xl mb-4">⏳</div>
      <p class="text-gray-600">Loading QR codes...</p>
    </div>

    <!-- QR Codes Grid -->
    <div v-else-if="qrCodes.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="qr in qrCodes"
        :key="qr.id"
        class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="text-4xl">🏷️</div>
          <span class="bg-cyan-100 text-cyan-800 text-xs font-medium px-2.5 py-1 rounded">
            {{ qr.code }}
          </span>
        </div>

        <h3 class="text-xl font-bold text-gray-800 mb-2">{{ qr.location_name }}</h3>
        
        <div class="space-y-2 mb-4 text-sm text-gray-600">
          <div v-if="qr.latitude && qr.longitude" class="flex items-center space-x-2">
            <span>📍</span>
            <span>{{ qr.latitude.toFixed(4) }}, {{ qr.longitude.toFixed(4) }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span>📅</span>
            <span>{{ new Date(qr.created_at).toLocaleDateString() }}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-2">
          <button
            @click="viewQRCode(qr)"
            class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            View QR
          </button>
          <button
            @click="downloadQRCode(qr)"
            class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Download
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            @click="viewHistory(qr)"
            class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            📋 History
          </button>
          <button
            @click="deleteQRCode(qr.id)"
            class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 bg-white rounded-xl shadow-md">
      <div class="text-6xl mb-4">📦</div>
      <h3 class="text-xl font-bold text-gray-800 mb-2">No QR Codes Yet</h3>
      <p class="text-gray-600 mb-6">Create your first QR code to get started</p>
      <button
        @click="showCreateModal = true"
        class="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition"
      >
        Create First QR Code
      </button>
    </div>

    <!-- Create QR Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      @click.self="showCreateModal = false"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-bold text-gray-800">Create New QR Code</h3>
          <button
            @click="showCreateModal = false"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <form @submit.prevent="createQRCode" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Location Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="locationName"
              type="text"
              required
              placeholder="e.g., Coral Spot #1, Samal Beach Point A"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Latitude (optional)</label>
              <input
                v-model="latitude"
                type="number"
                step="any"
                placeholder="7.0731"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Longitude (optional)</label>
              <input
                v-model="longitude"
                type="number"
                step="any"
                placeholder="125.6128"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div class="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <p class="text-sm text-cyan-800">
              <span class="font-semibold">💡 Tip:</span> Add GPS coordinates to help locate the exact spot on the beach!
            </p>
          </div>

          <div class="flex space-x-3 pt-4">
            <button
              type="button"
              @click="showCreateModal = false"
              class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="loading"
              class="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loading ? 'Creating...' : 'Create QR Code' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- QR Preview Modal -->
    <div
      v-if="selectedQR"
      class="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      @click.self="closePreview"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-bold text-gray-800">QR Code Preview</h3>
          <button
            @click="closePreview"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <div class="text-center mb-6">
          <div class="bg-gray-50 rounded-xl p-6 mb-4">
            <img
              v-if="qrCodePreview"
              :src="qrCodePreview"
              alt="QR Code"
              class="mx-auto"
            />
          </div>

          <h4 class="text-xl font-bold text-gray-800 mb-2">{{ selectedQR.location_name }}</h4>
          <p class="text-sm text-gray-600 mb-1">Code: {{ selectedQR.code }}</p>
          <p v-if="selectedQR.latitude && selectedQR.longitude" class="text-sm text-gray-600">
            📍 {{ selectedQR.latitude.toFixed(4) }}, {{ selectedQR.longitude.toFixed(4) }}
          </p>
        </div>

        <div class="space-y-3">
          <button
            @click="downloadQRCode(selectedQR)"
            class="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition"
          >
            📥 Download QR Code
          </button>
          <button
            @click="closePreview"
            class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- History Modal -->
    <div
      v-if="showHistoryModal"
      class="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      @click.self="closeHistoryModal"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between p-6 border-b">
          <div>
            <h3 class="text-2xl font-bold text-gray-800">📋 Coral Info History</h3>
            <p class="text-gray-600 text-sm mt-1">{{ selectedQRHistory?.location_name }}</p>
          </div>
          <button
            @click="closeHistoryModal"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <!-- Loading State -->
          <div v-if="loadingHistory" class="text-center py-12">
            <div class="text-4xl mb-4">⏳</div>
            <p class="text-gray-600">Loading history...</p>
          </div>

          <!-- Current Coral Info -->
          <div v-else-if="currentCoralInfo" class="mb-6">
            <div class="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl p-6 text-white mb-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-xl font-bold">Current Status</h4>
                <span class="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm">
                  Active
                </span>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-cyan-100 mb-1">Coral Name</p>
                  <p class="font-semibold">{{ currentCoralInfo.coral_name }}</p>
                </div>
                <div>
                  <p class="text-cyan-100 mb-1">Health Status</p>
                  <p class="font-semibold">{{ getHealthEmoji(currentCoralInfo.coral_health) }} {{ currentCoralInfo.coral_health }}</p>
                </div>
                <div>
                  <p class="text-cyan-100 mb-1">Seagrass Status</p>
                  <p class="font-semibold">{{ currentCoralInfo.seagrass_status }}</p>
                </div>
                <div>
                  <p class="text-cyan-100 mb-1">Threat Level</p>
                  <p class="font-semibold">{{ currentCoralInfo.threat_level }}</p>
                </div>
                <div class="md:col-span-2">
                  <p class="text-cyan-100 mb-1">Required Action</p>
                  <p class="font-semibold">{{ currentCoralInfo.required_action }}</p>
                </div>
                <div class="md:col-span-2">
                  <p class="text-cyan-100 mb-1">Last Updated By</p>
                  <p class="font-semibold">{{ currentCoralInfo.ranger?.name || 'Unknown' }} • {{ new Date(currentCoralInfo.updated_at).toLocaleString() }}</p>
                </div>
              </div>

              <div v-if="currentCoralInfo.coral_photo_url" class="mt-4">
                <img :src="currentCoralInfo.coral_photo_url" alt="Current coral photo" class="w-full max-w-xs rounded-lg shadow-lg" />
              </div>
            </div>
          </div>

          <!-- History Timeline -->
          <div v-if="historyData.length > 0">
            <h4 class="text-lg font-bold text-gray-800 mb-4">📅 Update History</h4>
            
            <div class="space-y-4">
              <div
                v-for="(record, index) in historyData"
                :key="record.id"
                class="bg-gray-50 rounded-xl p-5 border border-gray-200"
              >
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center space-x-2">
                    <span
                      :class="getHealthBadgeColor(record.coral_health)"
                      class="px-3 py-1 rounded-full text-xs font-medium"
                    >
                      {{ getHealthEmoji(record.coral_health) }} {{ record.coral_health }}
                    </span>
                    <span
                      v-if="record.change_type === 'created'"
                      class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium"
                    >
                      ✨ Created
                    </span>
                    <span
                      v-else
                      class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium"
                    >
                      📝 Updated
                    </span>
                  </div>
                  <span class="text-xs text-gray-500">
                    {{ new Date(record.changed_at).toLocaleString() }}
                  </span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p class="text-gray-600 mb-1">Coral Name</p>
                    <p class="font-medium text-gray-800">{{ record.coral_name }}</p>
                  </div>
                  <div>
                    <p class="text-gray-600 mb-1">Threat Level</p>
                    <p class="font-medium text-gray-800">{{ record.threat_level }}</p>
                  </div>
                  <div>
                    <p class="text-gray-600 mb-1">Seagrass Status</p>
                    <p class="font-medium text-gray-800">{{ record.seagrass_status }}</p>
                  </div>
                  <div>
                    <p class="text-gray-600 mb-1">Updated By</p>
                    <p class="font-medium text-gray-800">{{ record.ranger?.name || 'Unknown' }}</p>
                  </div>
                  <div class="md:col-span-2">
                    <p class="text-gray-600 mb-1">Required Action</p>
                    <p class="font-medium text-gray-800">{{ record.required_action }}</p>
                  </div>
                </div>

                <div v-if="record.coral_photo_url" class="mt-3">
                  <img :src="record.coral_photo_url" alt="Historical coral photo" class="w-full max-w-xs rounded-lg shadow" />
                </div>
              </div>
            </div>
          </div>

          <!-- No History -->
          <div v-else-if="!currentCoralInfo && !loadingHistory" class="text-center py-12">
            <div class="text-6xl mb-4">📭</div>
            <h4 class="text-xl font-bold text-gray-800 mb-2">No Data Yet</h4>
            <p class="text-gray-600">No coral information has been recorded for this location.</p>
          </div>

          <div v-else-if="currentCoralInfo && historyData.length === 0" class="text-center py-8 bg-gray-50 rounded-xl">
            <div class="text-4xl mb-3">📝</div>
            <p class="text-gray-600">No previous updates. This is the first entry.</p>
          </div>
        </div>

        <div class="p-6 border-t">
          <button
            @click="closeHistoryModal"
            class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>