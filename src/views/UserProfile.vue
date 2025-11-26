<script setup>
import { ref, computed } from 'vue';
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

// State
const isEditing = ref(false);
const isUploading = ref(false);
const isSaving = ref(false);
const uploadProgress = ref(0);
const message = ref({ type: '', text: '' });

// Form data
const formData = ref({
  name: props.userProfile?.name || '',
  email: props.userProfile?.email || '',
  avatar_url: props.userProfile?.avatar_url || ''
});

// File input ref
const fileInputRef = ref(null);

// Get user initials for avatar fallback
const getUserInitials = () => {
  const name = formData.value.name || 'User';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Get role badge color
const getRoleColor = () => {
  const role = props.userProfile?.role || 'tourist';
  const colors = {
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    ranger: 'bg-green-100 text-green-800 border-green-200',
    tourist: 'bg-blue-100 text-blue-800 border-blue-200'
  };
  return colors[role] || colors.tourist;
};

// Format date
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Trigger file input
const triggerFileInput = () => {
  fileInputRef.value?.click();
};

// Handle file upload
const handleFileUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    message.value = { type: 'error', text: 'Please upload an image file' };
    return;
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    message.value = { type: 'error', text: 'Image must be less than 2MB' };
    return;
  }

  isUploading.value = true;
  uploadProgress.value = 0;
  message.value = { type: '', text: '' };

  try {
    const userId = props.userProfile.id;
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;

    // Delete old avatar if exists
    if (formData.value.avatar_url) {
      const oldPath = formData.value.avatar_url.split('/').slice(-2).join('/');
      await supabase.storage.from('avatars').remove([oldPath]);
    }

    // Upload new avatar
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    formData.value.avatar_url = urlData.publicUrl;

    // Update database
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', userId);

    if (updateError) throw updateError;

    message.value = { type: 'success', text: 'Profile picture updated successfully!' };
    
    // Reload page to update header avatar
    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (error) {
    console.error('Upload error:', error);
    message.value = { type: 'error', text: 'Failed to upload image. Please try again.' };
  } finally {
    isUploading.value = false;
    uploadProgress.value = 0;
  }
};

// Remove avatar
const removeAvatar = async () => {
  if (!confirm('Are you sure you want to remove your profile picture?')) return;

  isUploading.value = true;
  message.value = { type: '', text: '' };

  try {
    const userId = props.userProfile.id;

    // Delete from storage if exists
    if (formData.value.avatar_url) {
      const oldPath = formData.value.avatar_url.split('/').slice(-2).join('/');
      await supabase.storage.from('avatars').remove([oldPath]);
    }

    // Update database
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (error) throw error;

    formData.value.avatar_url = '';
    message.value = { type: 'success', text: 'Profile picture removed successfully!' };

    // Reload page to update header avatar
    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (error) {
    console.error('Remove error:', error);
    message.value = { type: 'error', text: 'Failed to remove image. Please try again.' };
  } finally {
    isUploading.value = false;
  }
};

// Toggle edit mode
const toggleEdit = () => {
  if (isEditing.value) {
    // Cancel editing - reset form
    formData.value.name = props.userProfile?.name || '';
    formData.value.email = props.userProfile?.email || '';
  }
  isEditing.value = !isEditing.value;
  message.value = { type: '', text: '' };
};

// Save profile changes
const saveProfile = async () => {
  if (!formData.value.name.trim()) {
    message.value = { type: 'error', text: 'Name is required' };
    return;
  }

  isSaving.value = true;
  message.value = { type: '', text: '' };

  try {
    const { error } = await supabase
      .from('users')
      .update({
        name: formData.value.name.trim()
      })
      .eq('id', props.userProfile.id);

    if (error) throw error;

    message.value = { type: 'success', text: 'Profile updated successfully!' };
    isEditing.value = false;

    // Reload page to update all profile instances
    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (error) {
    console.error('Save error:', error);
    message.value = { type: 'error', text: 'Failed to update profile. Please try again.' };
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
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
      <h1 class="text-3xl font-bold text-gray-900">My Profile</h1>
      <p class="text-gray-600 mt-1">Manage your account information and preferences</p>
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

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Profile Picture Card -->
      <div class="lg:col-span-1">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h2>
          
          <!-- Avatar Display -->
          <div class="flex flex-col items-center">
            <div class="relative group">
              <!-- Avatar Image or Initials -->
              <div
                v-if="formData.avatar_url"
                class="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200"
              >
                <img
                  :src="formData.avatar_url"
                  :alt="formData.name"
                  class="w-full h-full object-cover"
                />
              </div>
              <div
                v-else
                class="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-4xl border-4 border-gray-200"
              >
                {{ getUserInitials() }}
              </div>

              <!-- Upload Overlay -->
              <div
                v-if="!isUploading"
                class="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                @click="triggerFileInput"
              >
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>

              <!-- Loading Spinner -->
              <div
                v-if="isUploading"
                class="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center"
              >
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              </div>
            </div>

            <!-- File Input -->
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileUpload"
              :disabled="isUploading"
            />

            <!-- Action Buttons -->
            <div class="mt-4 flex flex-col gap-2 w-full">
              <button
                @click="triggerFileInput"
                :disabled="isUploading"
                class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ formData.avatar_url ? 'Change Picture' : 'Upload Picture' }}
              </button>
              
              <button
                v-if="formData.avatar_url"
                @click="removeAvatar"
                :disabled="isUploading"
                class="w-full bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove Picture
              </button>
            </div>

            <p class="text-xs text-gray-500 mt-3 text-center">
              JPG, PNG or GIF. Max 2MB
            </p>
          </div>
        </div>
      </div>

      <!-- Profile Information Card -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold text-gray-900">Profile Information</h2>
            <button
              v-if="!isEditing"
              @click="toggleEdit"
              class="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span class="text-sm font-medium">Edit</span>
            </button>
          </div>

          <!-- Edit Mode -->
          <div v-if="isEditing" class="space-y-6">
            <!-- Name Input -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                v-model="formData.name"
                type="text"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your name"
              />
            </div>

            <!-- Email Input (Read-only) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                v-model="formData.email"
                type="email"
                disabled
                class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p class="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-3">
              <button
                @click="saveProfile"
                :disabled="isSaving"
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isSaving ? 'Saving...' : 'Save Changes' }}
              </button>
              <button
                @click="toggleEdit"
                :disabled="isSaving"
                class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- View Mode -->
          <div v-else class="space-y-6">
            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
              <p class="text-lg text-gray-900">{{ userProfile?.name || 'N/A' }}</p>
            </div>

            <!-- Email -->
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Email</label>
              <p class="text-lg text-gray-900">{{ userProfile?.email || 'N/A' }}</p>
            </div>

            <!-- Role -->
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-2">Role</label>
              <span
                class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border capitalize"
                :class="getRoleColor()"
              >
                {{ userProfile?.role || 'tourist' }}
              </span>
            </div>

            <!-- Points (for tourists) -->
            <div v-if="userProfile?.role === 'tourist'">
              <label class="block text-sm font-medium text-gray-500 mb-2">Eco Points</label>
              <div class="flex items-center space-x-2">
                <span class="text-2xl">🏆</span>
                <span class="text-2xl font-bold text-orange-600">{{ userProfile?.points || 0 }}</span>
              </div>
            </div>

            <!-- Member Since -->
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">Member Since</label>
              <p class="text-lg text-gray-900">{{ formatDate(userProfile?.created_at) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>