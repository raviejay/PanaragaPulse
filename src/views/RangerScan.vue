<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../js/supabase';

const router = useRouter();
const showScanner = ref(false);
const qrCode = ref('');
const qrData = ref(null);
const coralInfo = ref(null);
const loading = ref(false);
const error = ref('');
const success = ref('');

// Form fields
const coralName = ref('');
const coralHealth = ref('healthy');
const seagrassStatus = ref('');
const threatLevel = ref('');
const requiredAction = ref('');
const coralPhotoFile = ref(null);
const coralPhotoPreview = ref('');

// Manual QR input
const manualQRCode = ref('');

// Scan QR Code (Manual Input for now)
const scanQRCode = async () => {
  try {
    loading.value = true;
    error.value = '';
    
    if (!manualQRCode.value.trim()) {
      error.value = 'Please enter a QR code';
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
      return;
    }

    qrData.value = qrResult;

    // Check if coral info already exists
    const { data: existingCoral, error: coralError } = await supabase
      .from('coral_info')
      .select('*')
      .eq('qr_id', qrResult.id)
      .single();

    if (existingCoral) {
      // Load existing data
      coralInfo.value = existingCoral;
      coralName.value = existingCoral.coral_name;
      coralHealth.value = existingCoral.coral_health;
      seagrassStatus.value = existingCoral.seagrass_status;
      threatLevel.value = existingCoral.threat_level;
      requiredAction.value = existingCoral.required_action;
      coralPhotoPreview.value = existingCoral.coral_photo_url || '';
    } else {
      // New entry
      coralInfo.value = null;
      coralName.value = '';
      coralHealth.value = 'healthy';
      seagrassStatus.value = '';
      threatLevel.value = '';
      requiredAction.value = '';
      coralPhotoPreview.value = '';
    }

    showScanner.value = false;
    success.value = `QR Code found: ${qrResult.location_name}`;

  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Handle photo upload
const handlePhotoUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    coralPhotoFile.value = file;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      coralPhotoPreview.value = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

// Upload photo to Supabase Storage
const uploadPhoto = async () => {
  if (!coralPhotoFile.value) return coralPhotoPreview.value;

  try {
    const fileExt = coralPhotoFile.value.name.split('.').pop();
    const fileName = `coral-${Date.now()}.${fileExt}`;
    const filePath = `coral-photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('coral-images')
      .upload(filePath, coralPhotoFile.value);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('coral-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;

  } catch (err) {
    console.error('Error uploading photo:', err);
    return coralPhotoPreview.value; // Return existing URL if upload fails
  }
};

// Save or Update Coral Info
const saveCoralInfo = async () => {
  try {
    loading.value = true;
    error.value = '';
    success.value = '';

    // Validate
    if (!coralName.value.trim() || !seagrassStatus.value.trim() || 
        !threatLevel.value.trim() || !requiredAction.value.trim()) {
      error.value = 'Please fill in all required fields';
      return;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Upload photo if new file selected
    const photoUrl = await uploadPhoto();

    const coralData = {
      qr_id: qrData.value.id,
      coral_name: coralName.value,
      coral_health: coralHealth.value,
      seagrass_status: seagrassStatus.value,
      threat_level: threatLevel.value,
      required_action: requiredAction.value,
      ranger_id: user.id,
      coral_photo_url: photoUrl,
      updated_at: new Date().toISOString()
    };

    if (coralInfo.value) {
      // Update existing
      const { error: updateError } = await supabase
        .from('coral_info')
        .update(coralData)
        .eq('id', coralInfo.value.id);

      if (updateError) throw updateError;
      success.value = 'Coral information updated successfully!';
    } else {
      // Create new
      const { error: insertError } = await supabase
        .from('coral_info')
        .insert(coralData);

      if (insertError) throw insertError;
      success.value = 'Coral information saved successfully!';
    }

    // Reset after 2 seconds
    setTimeout(() => {
      resetForm();
    }, 2000);

  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Reset form
const resetForm = () => {
  qrData.value = null;
  coralInfo.value = null;
  coralName.value = '';
  coralHealth.value = 'healthy';
  seagrassStatus.value = '';
  threatLevel.value = '';
  requiredAction.value = '';
  coralPhotoFile.value = null;
  coralPhotoPreview.value = '';
  manualQRCode.value = '';
  success.value = '';
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

    <h2 class="text-2xl font-bold text-gray-800 mb-6">Ranger: Update Coral Info</h2>

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
        <div class="text-6xl mb-4">📷</div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">Scan QR Code</h3>
        <p class="text-gray-600">Enter the QR code from the coral location</p>
      </div>

      <div class="max-w-md mx-auto space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">QR Code</label>
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

    <!-- Coral Info Form -->
    <div v-else class="space-y-6">
      <!-- Location Info Card -->
      <div class="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl p-6 text-white">
        <h3 class="text-xl font-bold mb-2">📍 {{ qrData.location_name }}</h3>
        <p class="text-cyan-100">QR Code: {{ qrData.code }}</p>
        <p v-if="qrData.latitude && qrData.longitude" class="text-cyan-100">
          Coordinates: {{ qrData.latitude.toFixed(4) }}, {{ qrData.longitude.toFixed(4) }}
        </p>
      </div>

      <!-- Form -->
      <div class="bg-white rounded-xl shadow-md p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-6">
          {{ coralInfo ? 'Update Coral Information' : 'Add Coral Information' }}
        </h3>

        <form @submit.prevent="saveCoralInfo" class="space-y-4">
          <!-- Coral Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Coral Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="coralName"
              type="text"
              required
              placeholder="e.g., Staghorn Coral, Brain Coral"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          <!-- Coral Health -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Coral Health Status <span class="text-red-500">*</span>
            </label>
            <select
              v-model="coralHealth"
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            >
              <option value="healthy">🟢 Healthy</option>
              <option value="bleached">⚪ Bleached</option>
              <option value="damaged">🟡 Damaged</option>
              <option value="threatened">🔴 Threatened</option>
            </select>
          </div>

          <!-- Seagrass Status -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Seagrass Status <span class="text-red-500">*</span>
            </label>
            <input
              v-model="seagrassStatus"
              type="text"
              required
              placeholder="e.g., Abundant, Moderate, Sparse"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          <!-- Threat Level -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Threat Level <span class="text-red-500">*</span>
            </label>
            <input
              v-model="threatLevel"
              type="text"
              required
              placeholder="e.g., Low, Medium, High, Critical"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          <!-- Required Eco Action -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Required Eco-Action <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="requiredAction"
              required
              rows="3"
              placeholder="e.g., Pick up 5 pieces of trash, Take a photo of healthy coral, Report any damage"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            ></textarea>
          </div>

          <!-- Photo Upload -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Coral Photo
            </label>
            <input
              type="file"
              accept="image/*"
              @change="handlePhotoUpload"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
            <div v-if="coralPhotoPreview" class="mt-4">
              <img :src="coralPhotoPreview" alt="Coral preview" class="w-full max-w-sm rounded-lg" />
            </div>
          </div>

          <!-- Buttons -->
          <div class="flex space-x-3 pt-4">
            <button
              type="button"
              @click="resetForm"
              class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="loading"
              class="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              {{ loading ? 'Saving...' : (coralInfo ? 'Update Info' : 'Save Info') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>