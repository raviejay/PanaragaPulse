<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../js/supabase';
import QrScanner from 'qr-scanner';

const router = useRouter();
const qrCode = ref('');
const qrData = ref(null);
const coralInfo = ref(null);
const loading = ref(false);
const error = ref('');
const success = ref('');

// Eco-action submission
const showActionModal = ref(false);
const actionPhotoFile = ref(null);
const actionPhotoPreview = ref('');
const actionNote = ref('');
const userProfile = ref(null);

// Manual QR input
const manualQRCode = ref('');

// Camera QR scanning - UPDATED TO MATCH FIRST COMPONENT
const showCameraModal = ref(false);
const qrScanner = ref(null);
const cameraError = ref('');
const scanning = ref(false);
const processingQR = ref(false);

// Start camera for QR scanning with auto-detection - UPDATED TO MATCH FIRST COMPONENT
const startCamera = async () => {
  try {
    cameraError.value = '';
    showCameraModal.value = true;
    scanning.value = true;
    
    // Wait for next tick to ensure video element is rendered
    await new Promise(resolve => setTimeout(resolve, 100));
    const videoElement = document.getElementById('qr-video');
    
    if (!videoElement) {
      cameraError.value = 'Camera element not found';
      return;
    }

    // Initialize QR Scanner - USING SAME CONFIG AS FIRST COMPONENT
    qrScanner.value = new QrScanner(
      videoElement,
      async result => {
        // QR Code detected!
        if (processingQR.value) return; // Prevent multiple scans
        
        processingQR.value = true;
        scanning.value = false;
        manualQRCode.value = result.data;
        
        await scanQRCode();
        
        if (!error.value) {
          stopCamera();
        } else {
          processingQR.value = false;
          scanning.value = true;
        }
      },
      {
        returnDetailedScanResult: true,
        highlightScanRegion: true,
        highlightCodeOutline: true,
        preferredCamera: 'environment'
      }
    );

    await qrScanner.value.start();
    
  } catch (err) {
    cameraError.value = 'Camera access denied or not available. Please use manual input instead.';
    console.error('Camera error:', err);
    scanning.value = false;
  }
};

// Stop camera - UPDATED TO MATCH FIRST COMPONENT
const stopCamera = () => {
  if (qrScanner.value) {
    qrScanner.value.stop();
    qrScanner.value.destroy();
    qrScanner.value = null;
  }
  showCameraModal.value = false;
  cameraError.value = '';
  scanning.value = false;
  processingQR.value = false;
};

// Cleanup on component unmount
onUnmounted(() => {
  stopCamera();
});

// Fetch user profile
const fetchUserProfile = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();   
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    userProfile.value = data;
  } catch (err) {
    console.error('Error fetching profile:', err);
  }
};

// Scan QR Code - UPDATED processingQR handling
const scanQRCode = async () => {
  try {
    loading.value = true;
    error.value = '';
    
    if (!manualQRCode.value.trim()) {
      error.value = 'Please enter a QR code';
      processingQR.value = false;
      return;
    }

    // Fetch QR code data
    const { data: qrResult, error: qrError } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('code', manualQRCode.value.trim())
      .single();

    if (qrError || !qrResult) {
      error.value = 'QR Code not found. Please check the code and try again.';
      processingQR.value = false;
      return;
    }

    qrData.value = qrResult;

    // Fetch coral info for this QR
    const { data: coralResult, error: coralError } = await supabase
      .from('coral_info')
      .select('*')
      .eq('qr_id', qrResult.id)
      .single();

    if (coralError || !coralResult) {
      error.value = 'No coral information available for this location yet. Please contact a ranger.';
      qrData.value = null;
      processingQR.value = false;
      return;
    }

    coralInfo.value = coralResult;
    success.value = `Location found: ${qrResult.location_name}`;
    
    await fetchUserProfile();

  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
    processingQR.value = false;
  }
};

// Handle action photo upload
const handleActionPhotoUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    actionPhotoFile.value = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      actionPhotoPreview.value = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

// Upload action photo
const uploadActionPhoto = async () => {
  if (!actionPhotoFile.value) return null;

  try {
    const fileExt = actionPhotoFile.value.name.split('.').pop();
    const fileName = `action-${Date.now()}.${fileExt}`;
    const filePath = `eco-actions/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('coral-images')
      .upload(filePath, actionPhotoFile.value);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('coral-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;

  } catch (err) {
    console.error('Error uploading photo:', err);
    return null;
  }
};

// Submit eco-action
const submitEcoAction = async () => {
  try {
    loading.value = true;
    error.value = '';
    success.value = '';

    if (!actionPhotoFile.value) {
      error.value = 'Please upload a photo as proof of your eco-action';
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if user already submitted for this QR
    const { data: existingSubmission } = await supabase
      .from('eco_action_submissions')
      .select('*')
      .eq('qr_id', qrData.value.id)
      .eq('user_id', user.id)
      .single();

    if (existingSubmission) {
      error.value = 'You have already completed the eco-action for this location!';
      return;
    }

    // Upload photo
    const photoUrl = await uploadActionPhoto();
    if (!photoUrl) {
      error.value = 'Failed to upload photo. Please try again.';
      return;
    }

    // Submit action
    const { error: submitError } = await supabase
      .from('eco_action_submissions')
      .insert({
        qr_id: qrData.value.id,
        user_id: user.id,
        action_type: coralInfo.value.required_action,
        photo_evidence: photoUrl,
        points_earned: 10,
        verified: false
      });

    if (submitError) throw submitError;

    // Update user points (add 10 points)
    const newPoints = (userProfile.value?.points || 0) + 10;
    const { error: pointsError } = await supabase
      .from('users')
      .update({ points: newPoints })
      .eq('id', user.id);

    if (pointsError) throw pointsError;

    success.value = '🎉 Eco-action completed! You earned 10 points!';
    
    // Close modal and refresh user profile
    setTimeout(() => {
      showActionModal.value = false;
      actionPhotoFile.value = null;
      actionPhotoPreview.value = '';
      actionNote.value = '';
      fetchUserProfile();
    }, 2000);

  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Get health status color and emoji
const getHealthInfo = computed(() => {
  if (!coralInfo.value) return { color: 'gray', emoji: '❓', text: 'Unknown' };
  
  const health = coralInfo.value.coral_health;
  const map = {
    healthy: { color: 'green', emoji: '🟢', text: 'Healthy' },
    bleached: { color: 'gray', emoji: '⚪', text: 'Bleached' },
    damaged: { color: 'yellow', emoji: '🟡', text: 'Damaged' },
    threatened: { color: 'red', emoji: '🔴', text: 'Threatened' }
  };
  
  return map[health] || { color: 'gray', emoji: '❓', text: 'Unknown' };
});

// Reset form
const resetForm = () => {
  qrData.value = null;
  coralInfo.value = null;
  manualQRCode.value = '';
  showActionModal.value = false;
  actionPhotoFile.value = null;
  actionPhotoPreview.value = '';
  actionNote.value = '';
  success.value = '';
  processingQR.value = false;
  stopCamera();
};
</script>

<template>
  <div>
    <button
      @click="router.push('/dashboard')"
      class="mb-6 flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
    >
      <span class="text-xl mr-2">←</span> Back to Dashboard
    </button>

    <h2 class="text-2xl font-bold text-gray-800 mb-6">Tourist: Discover Coral & Earn Points</h2>

    <!-- Messages -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
      {{ error }}
    </div>
    <div v-if="success" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
      {{ success }}
    </div>

    <!-- Scan QR Code Section -->
    <div v-if="!qrData" class="bg-white rounded-xl shadow-md p-8">
      <div class="text-center mb-6">
        <div class="text-6xl mb-4">📱</div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">Scan QR Code</h3>
        <p class="text-gray-600">Scan with camera or enter the code manually</p>
      </div>

      <div class="max-w-md mx-auto space-y-4">
        <!-- Camera Scan Button - UPDATED TO MATCH FIRST COMPONENT -->
        <button
          @click="startCamera"
          class="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-4 rounded-lg font-medium transition flex items-center justify-center space-x-2"
        >
          <span class="text-2xl">📸</span>
          <span>Scan with Camera</span>
        </button>
        
        <!-- Manual Input Option -->
        <div class="text-center text-gray-500">or</div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Enter QR Code Manually</label>
          <input
            v-model="manualQRCode"
            type="text"
            placeholder="e.g., CORAL-1234567890-ABC123"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            @keyup.enter="scanQRCode"
          />
        </div>
        
        <button
          @click="scanQRCode"
          :disabled="loading"
          class="w-full bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50"
        >
          {{ loading ? 'Searching...' : 'Find Location' }}
        </button>
      </div>
    </div>

    <!-- Coral Information Display -->
    <div v-else class="space-y-6">
      <!-- Location Header -->
      <div class="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl p-6 text-white">
        <h3 class="text-2xl font-bold mb-2">📍 {{ qrData.location_name }}</h3>
        <p class="text-cyan-100">Welcome to this coral monitoring station!</p>
      </div>

      <!-- Coral Photo -->
      <div v-if="coralInfo.coral_photo_url" class="bg-white rounded-xl shadow-md overflow-hidden">
        <img :src="coralInfo.coral_photo_url" alt="Coral" class="w-full h-64 object-cover" />
      </div>

      <!-- Coral Info Card -->
      <div class="bg-white rounded-xl shadow-md p-6">
        <h3 class="text-2xl font-bold text-gray-800 mb-4">🪸 {{ coralInfo.coral_name }}</h3>
        
        <div class="space-y-4">
          <!-- Health Status -->
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p class="text-sm text-gray-600">Health Status</p>
              <p class="text-lg font-bold" :class="`text-${getHealthInfo.color}-600`">
                {{ getHealthInfo.emoji }} {{ getHealthInfo.text }}
              </p>
            </div>
          </div>

          <!-- Seagrass Status -->
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p class="text-sm text-gray-600">Seagrass Status</p>
              <p class="text-lg font-bold text-gray-800">🌿 {{ coralInfo.seagrass_status }}</p>
            </div>
          </div>

          <!-- Threat Level -->
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p class="text-sm text-gray-600">Threat Level</p>
              <p class="text-lg font-bold text-gray-800">⚠️ {{ coralInfo.threat_level }}</p>
            </div>
          </div>

          <!-- Required Action -->
          <div class="p-4 bg-cyan-50 border-2 border-cyan-200 rounded-lg">
            <p class="text-sm text-cyan-700 font-semibold mb-2">🌿 Required Eco-Action:</p>
            <p class="text-gray-800">{{ coralInfo.required_action }}</p>
          </div>

          <!-- Last Updated -->
          <div class="text-sm text-gray-500 text-center pt-2">
            Last updated: {{ new Date(coralInfo.updated_at).toLocaleDateString() }}
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="grid grid-cols-2 gap-4">
        <button
          @click="showActionModal = true"
          class="bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-lg font-medium transition text-lg"
        >
          ✅ Complete Eco-Action
        </button>
        <button
          @click="resetForm"
          class="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-4 rounded-lg font-medium transition text-lg"
        >
          Scan Another
        </button>
      </div>

      <!-- User Points Display -->
      <div v-if="userProfile" class="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white text-center">
        <p class="text-sm text-purple-100 mb-1">Your Current Points</p>
        <p class="text-4xl font-bold">🏆 {{ userProfile.points || 0 }}</p>
      </div>
    </div>

    <!-- Eco-Action Submission Modal -->
    <div
      v-if="showActionModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="showActionModal = false"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-bold text-gray-800">Submit Eco-Action</h3>
          <button
            @click="showActionModal = false"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <div class="mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
          <p class="text-sm text-cyan-700 font-semibold mb-2">Required Action:</p>
          <p class="text-gray-800">{{ coralInfo.required_action }}</p>
        </div>

        <form @submit.prevent="submitEcoAction" class="space-y-4">
          <!-- Photo Upload -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Upload Photo Evidence <span class="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              required
              @change="handleActionPhotoUpload"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
            <div v-if="actionPhotoPreview" class="mt-4">
              <img :src="actionPhotoPreview" alt="Action preview" class="w-full rounded-lg" />
            </div>
          </div>

          <!-- Points Info -->
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p class="text-sm text-green-700">
              <span class="font-semibold">🎉 Reward:</span> Complete this action to earn <span class="font-bold">10 Eco-Points</span>!
            </p>
          </div>

          <!-- Buttons -->
          <div class="flex space-x-3 pt-4">
            <button
              type="button"
              @click="showActionModal = false"
              class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="loading"
              class="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              {{ loading ? 'Submitting...' : 'Submit & Earn Points' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Camera QR Scanner Modal - UPDATED TO MATCH FIRST COMPONENT -->
    <div
      v-if="showCameraModal"
      class="fixed inset-0 backdrop-blur-md bg-black/40 flex items-center justify-center p-4 z-50"
      @click.self="stopCamera"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-2xl font-bold text-gray-800">📸 Scan QR Code</h3>
          <button
            @click="stopCamera"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <div v-if="cameraError" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {{ cameraError }}
        </div>

        <div class="space-y-4">
          <!-- Camera Preview -->
          <div class="relative bg-gray-900 rounded-lg overflow-hidden" style="aspect-ratio: 4/3;">
            <video
              id="qr-video"
              class="w-full h-full object-cover"
            ></video>
            
            <!-- Scanning Indicator -->
            <div
              v-if="scanning"
              class="absolute top-2 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-2 whitespace-nowrap"
            >
              <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>Scanning for QR codes...</span>
            </div>
            
            <!-- Processing QR Code Indicator -->
            <div
              v-if="processingQR"
              class="absolute inset-0 bg-black/60 flex items-center justify-center"
            >
              <div class="bg-white rounded-lg p-6 text-center">
                <div class="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p class="text-gray-800 font-medium">Processing QR Code...</p>
                <p class="text-gray-600 text-sm mt-1">Fetching coral information</p>
              </div>
            </div>
          </div>

          <p class="text-center text-gray-600">
            Position the QR code within the frame - it will scan automatically!
          </p>

          <!-- Instructions -->
          <div class="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <p class="text-sm text-cyan-800">
              <span class="font-semibold">📌 Tips:</span> 
              <br>• Keep the QR code steady within the frame
              <br>• Make sure there's good lighting
              <br>• Hold your device about 6-12 inches away
            </p>
          </div>

          <!-- Manual Input (shown in modal) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Or Enter Code Manually</label>
            <div class="flex space-x-2">
              <input
                v-model="manualQRCode"
                type="text"
                placeholder="CORAL-1234567890-ABC123"
                :disabled="loading || processingQR"
                class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                @keyup.enter="async () => { await scanQRCode(); stopCamera(); }"
              />
              <button
                @click="async () => { await scanQRCode(); stopCamera(); }"
                :disabled="loading || processingQR"
                class="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
              >
                {{ loading || processingQR ? '...' : 'Go' }}
              </button>
            </div>
          </div>

          <button
            @click="stopCamera"
            class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-medium transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>