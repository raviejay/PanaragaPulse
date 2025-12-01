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

const contents = ref([]);
const loading = ref(true);
const showModal = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);
const isUploading = ref(false);
const message = ref({ type: '', text: '' });
const fileInputRef = ref(null);

const formData = ref({
  id: null,
  title: '',
  content: '',
  category: 'general',
  content_type: 'article',
  featured_image_url: '',
  video_url: '',
  is_featured: false,
  is_published: true
});

const categories = [
  { value: 'general', label: 'General Info', icon: 'ℹ️' },
  { value: 'coral-care', label: 'Coral Care', icon: '🪸' },
  { value: 'marine-life', label: 'Marine Life', icon: '🐠' },
  { value: 'conservation', label: 'Conservation', icon: '🌊' },
  { value: 'do-and-donts', label: 'Do & Don\'ts', icon: '⚠️' },
  { value: 'tips', label: 'Helpful Tips', icon: '💡' }
];

const contentTypes = [
  { value: 'article', label: 'Article', icon: '📄' },
  { value: 'infographic', label: 'Infographic', icon: '📊' },
  { value: 'video', label: 'Video', icon: '🎥' },
  { value: 'guide', label: 'Guide', icon: '📖' },
  { value: 'tip', label: 'Tip', icon: '💡' }
];

// Fetch content
const fetchContent = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase
      .from('iec_content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    contents.value = data || [];

  } catch (error) {
    console.error('Error fetching content:', error);
    message.value = { type: 'error', text: 'Failed to load content' };
  } finally {
    loading.value = false;
  }
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

// Get category info
const getCategoryInfo = (value) => {
  return categories.find(c => c.value === value) || categories[0];
};

// Get content type info
const getTypeInfo = (value) => {
  return contentTypes.find(c => c.value === value) || contentTypes[0];
};

// Open create modal
const openCreateModal = () => {
  isEditing.value = false;
  formData.value = {
    id: null,
    title: '',
    content: '',
    category: 'general',
    content_type: 'article',
    featured_image_url: '',
    video_url: '',
    is_featured: false,
    is_published: true
  };
  showModal.value = true;
  message.value = { type: '', text: '' };
};

// Open edit modal
const openEditModal = (content) => {
  isEditing.value = true;
  formData.value = {
    id: content.id,
    title: content.title,
    content: content.content,
    category: content.category,
    content_type: content.content_type,
    featured_image_url: content.featured_image_url || '',
    video_url: content.video_url || '',
    is_featured: content.is_featured,
    is_published: content.is_published
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
      .from('iec-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('iec-images')
      .getPublicUrl(fileName);

    formData.value.featured_image_url = urlData.publicUrl;
    message.value = { type: 'success', text: 'Image uploaded successfully!' };

  } catch (error) {
    console.error('Upload error:', error);
    message.value = { type: 'error', text: 'Failed to upload image' };
  } finally {
    isUploading.value = false;
  }
};

// Save content
const saveContent = async () => {
  if (!formData.value.title.trim()) {
    message.value = { type: 'error', text: 'Title is required' };
    return;
  }
  if (!formData.value.content.trim()) {
    message.value = { type: 'error', text: 'Content is required' };
    return;
  }

  isSaving.value = true;
  message.value = { type: '', text: '' };

  try {
    const contentData = {
      title: formData.value.title.trim(),
      content: formData.value.content.trim(),
      category: formData.value.category,
      content_type: formData.value.content_type,
      featured_image_url: formData.value.featured_image_url || null,
      video_url: formData.value.video_url || null,
      is_featured: formData.value.is_featured,
      is_published: formData.value.is_published
    };

    if (isEditing.value) {
      const { error } = await supabase
        .from('iec_content')
        .update(contentData)
        .eq('id', formData.value.id);

      if (error) throw error;
      message.value = { type: 'success', text: 'Content updated successfully!' };
    } else {
      const { error } = await supabase
        .from('iec_content')
        .insert({
          ...contentData,
          created_by: props.userProfile.id
        });

      if (error) throw error;
      message.value = { type: 'success', text: 'Content created successfully!' };
    }

    await fetchContent();
    setTimeout(() => {
      closeModal();
    }, 1500);

  } catch (error) {
    console.error('Save error:', error);
    message.value = { type: 'error', text: 'Failed to save content' };
  } finally {
    isSaving.value = false;
  }
};

// Delete content
const deleteContent = async (contentId) => {
  if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) return;

  try {
    const { error } = await supabase
      .from('iec_content')
      .delete()
      .eq('id', contentId);

    if (error) throw error;

    message.value = { type: 'success', text: 'Content deleted successfully!' };
    await fetchContent();

  } catch (error) {
    console.error('Delete error:', error);
    message.value = { type: 'error', text: 'Failed to delete content' };
  }
};

onMounted(() => {
  fetchContent();
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
          <h1 class="text-3xl font-bold text-gray-900">IEC Management</h1>
          <p class="text-gray-600 mt-1">Manage Information, Education, and Communication content</p>
        </div>
        <button
          @click="openCreateModal"
          class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition flex items-center"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Content
        </button>
      </div>
    </div>

    <!-- Alert Message -->
    <div
      v-if="message.text && !showModal"
      class="mb-6 p-4 rounded-lg"
      :class="{
        'bg-green-50 border border-green-200 text-green-800': message.type === 'success',
        'bg-red-50 border border-red-200 text-red-800': message.type === 'error'
      }"
    >
      <p class="text-sm font-medium">{{ message.text }}</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>

    <!-- Content List -->
    <div v-else-if="contents.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
      <div class="text-6xl mb-4">📚</div>
      <h3 class="text-xl font-semibold text-gray-700 mb-2">No Content Yet</h3>
      <p class="text-gray-500 mb-4">Create your first IEC content to get started</p>
      <button
        @click="openCreateModal"
        class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
      >
        Create Content
      </button>
    </div>

    <div v-else class="grid grid-cols-1 gap-6">
      <div
        v-for="content in contents"
        :key="content.id"
        class="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 flex items-start space-x-4">
            <!-- Thumbnail -->
            <div v-if="content.featured_image_url" class="flex-shrink-0">
              <img :src="content.featured_image_url" :alt="content.title" class="w-32 h-32 rounded-lg object-cover" />
            </div>
            <div v-else class="flex-shrink-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
              <span class="text-4xl">{{ getCategoryInfo(content.category).icon }}</span>
            </div>

            <!-- Details -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2 mb-2">
                <h3 class="text-xl font-bold text-gray-900">{{ content.title }}</h3>
                <span v-if="content.is_featured" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  ⭐ Featured
                </span>
                <span
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  :class="content.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'"
                >
                  {{ content.is_published ? '✓ Published' : '○ Draft' }}
                </span>
              </div>

              <p class="text-gray-600 text-sm mb-3 line-clamp-2">{{ content.content }}</p>

              <div class="flex items-center space-x-4 text-sm text-gray-500">
                <span class="inline-flex items-center">
                  {{ getCategoryInfo(content.category).icon }} {{ getCategoryInfo(content.category).label }}
                </span>
                <span class="inline-flex items-center">
                  {{ getTypeInfo(content.content_type).icon }} {{ getTypeInfo(content.content_type).label }}
                </span>
                <span class="inline-flex items-center">
                  <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                  </svg>
                  {{ content.view_count }} views
                </span>
                <span>{{ formatDate(content.created_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex-shrink-0 flex items-center space-x-2 ml-4">
            <button
              @click="openEditModal(content)"
              class="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Edit
            </button>
            <button
              @click="deleteContent(content.id)"
              class="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-900">
              {{ isEditing ? 'Edit Content' : 'Create New Content' }}
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
          <form @submit.prevent="saveContent" class="space-y-6">
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Title *</label>
              <input
                v-model="formData.title"
                type="text"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. How to Protect Coral Reefs"
              />
            </div>

            <!-- Content -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Content *</label>
              <textarea
                v-model="formData.content"
                required
                rows="8"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter the main content here..."
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Category -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <select
                  v-model="formData.category"
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option v-for="cat in categories" :key="cat.value" :value="cat.value">
                    {{ cat.icon }} {{ cat.label }}
                  </option>
                </select>
              </div>

              <!-- Content Type -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Content Type *</label>
                <select
                  v-model="formData.content_type"
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option v-for="type in contentTypes" :key="type.value" :value="type.value">
                    {{ type.icon }} {{ type.label }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Featured Image -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Featured Image</label>
              <div v-if="formData.featured_image_url" class="mb-3">
                <img :src="formData.featured_image_url" alt="Featured" class="w-full h-64 object-cover rounded-lg" />
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

            <!-- Video URL -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Video URL (YouTube)</label>
              <input
                v-model="formData.video_url"
                type="url"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p class="text-xs text-gray-500 mt-1">Enter YouTube video URL to embed</p>
            </div>

            <!-- Checkboxes -->
            <div class="flex items-center space-x-6">
              <label class="flex items-center">
                <input
                  v-model="formData.is_featured"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="ml-2 text-sm text-gray-700">⭐ Featured</span>
              </label>

              <label class="flex items-center">
                <input
                  v-model="formData.is_published"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="ml-2 text-sm text-gray-700">📢 Published</span>
              </label>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4">
              <button
                type="submit"
                :disabled="isSaving || isUploading"
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isSaving ? 'Saving...' : (isEditing ? 'Update Content' : 'Create Content') }}
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

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>