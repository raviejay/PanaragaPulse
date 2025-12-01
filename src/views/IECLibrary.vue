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

const contents = ref([]);
const loading = ref(true);
const selectedCategory = ref('all');
const selectedContent = ref(null);
const showContentModal = ref(false);
const message = ref({ type: '', text: '' });

const categories = [
  { value: 'all', label: 'All Content', icon: '📚' },
  { value: 'general', label: 'General Info', icon: 'ℹ️' },
  { value: 'coral-care', label: 'Coral Care', icon: '🪸' },
  { value: 'marine-life', label: 'Marine Life', icon: '🐠' },
  { value: 'conservation', label: 'Conservation', icon: '🌊' },
  { value: 'do-and-donts', label: 'Do & Don\'ts', icon: '⚠️' },
  { value: 'tips', label: 'Helpful Tips', icon: '💡' }
];

const contentTypes = {
  article: { icon: '📄', color: 'blue' },
  infographic: { icon: '📊', color: 'purple' },
  video: { icon: '🎥', color: 'red' },
  guide: { icon: '📖', color: 'green' },
  tip: { icon: '💡', color: 'yellow' }
};

// Fetch IEC content
const fetchContent = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase
      .from('iec_content')
      .select('*')
      .eq('is_published', true)
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

// Filter content by category
const filteredContent = computed(() => {
  if (selectedCategory.value === 'all') {
    return contents.value;
  }
  return contents.value.filter(c => c.category === selectedCategory.value);
});

// Get featured content
const featuredContent = computed(() => {
  return contents.value.filter(c => c.is_featured).slice(0, 3);
});

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
const getCategoryInfo = (category) => {
  return categories.find(c => c.value === category) || categories[0];
};

// Get content type info
const getTypeInfo = (type) => {
  return contentTypes[type] || contentTypes.article;
};

// View content
const viewContent = async (content) => {
  selectedContent.value = content;
  showContentModal.value = true;

  // Track view
  try {
    await supabase
      .from('iec_views')
      .insert({
        content_id: content.id,
        user_id: props.userProfile.id
      });
  } catch (error) {
    // Ignore error if already viewed (unique constraint)
    console.log('View already tracked or error:', error);
  }
};

// Close modal
const closeModal = () => {
  showContentModal.value = false;
  selectedContent.value = null;
};

// Get YouTube embed URL
const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  
  const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (videoIdMatch) {
    return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
  }
  return null;
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
      <div>
        <h1 class="text-3xl font-bold text-gray-900">IEC Library</h1>
        <p class="text-gray-600 mt-1">Learn about coral reef conservation and marine life protection</p>
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

    <!-- Featured Content -->
    <div v-if="featuredContent.length > 0" class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">📌 Featured Content</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="content in featuredContent"
          :key="content.id"
          @click="viewContent(content)"
          class="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition transform hover:scale-105"
        >
          <div v-if="content.featured_image_url" class="h-40 overflow-hidden">
            <img :src="content.featured_image_url" :alt="content.title" class="w-full h-full object-cover" />
          </div>
          <div class="p-6 text-white">
            <div class="flex items-center space-x-2 mb-2">
              <span class="text-2xl">{{ getTypeInfo(content.content_type).icon }}</span>
              <span class="text-xs uppercase font-semibold opacity-90">{{ content.content_type }}</span>
            </div>
            <h3 class="text-lg font-bold mb-2">{{ content.title }}</h3>
            <div class="flex items-center text-sm opacity-90">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
              </svg>
              {{ content.view_count }} views
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Filter -->
    <div class="mb-6 bg-white rounded-lg shadow p-4">
      <div class="flex items-center space-x-2 overflow-x-auto">
        <button
          v-for="category in categories"
          :key="category.value"
          @click="selectedCategory = category.value"
          class="px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition"
          :class="selectedCategory === category.value 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
        >
          {{ category.icon }} {{ category.label }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>

    <!-- Content Grid -->
    <div v-else-if="filteredContent.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
      <div class="text-6xl mb-4">📚</div>
      <h3 class="text-xl font-semibold text-gray-700 mb-2">No Content Available</h3>
      <p class="text-gray-500">Check back later for educational content</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="content in filteredContent"
        :key="content.id"
        @click="viewContent(content)"
        class="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer overflow-hidden"
      >
        <!-- Image -->
        <div v-if="content.featured_image_url" class="h-48 overflow-hidden">
          <img :src="content.featured_image_url" :alt="content.title" class="w-full h-full object-cover hover:scale-110 transition duration-300" />
        </div>
        <div v-else class="h-48 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
          <span class="text-6xl">{{ getCategoryInfo(content.category).icon }}</span>
        </div>

        <!-- Content -->
        <div class="p-6">
          <div class="flex items-center justify-between mb-3">
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="`bg-${getTypeInfo(content.content_type).color}-100 text-${getTypeInfo(content.content_type).color}-800`"
            >
              {{ getTypeInfo(content.content_type).icon }} {{ content.content_type }}
            </span>
            <span class="text-xs text-gray-500">{{ getCategoryInfo(content.category).icon }}</span>
          </div>

          <h3 class="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{{ content.title }}</h3>
          <p class="text-gray-600 text-sm mb-4 line-clamp-3">{{ content.content }}</p>

          <div class="flex items-center justify-between text-sm text-gray-500">
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
              </svg>
              {{ content.view_count }}
            </div>
            <span>{{ formatDate(content.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Detail Modal -->
    <div
      v-if="showContentModal && selectedContent"
      class="fixed inset-0 bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-sm shadow-xl max-w-2xl w-full h-full my-8">
        <div class="p-6">
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3">
              <span class="text-3xl">{{ getCategoryInfo(selectedContent.category).icon }}</span>
              <div>
                <h2 class="text-2xl font-bold text-gray-900">{{ selectedContent.title }}</h2>
                <p class="text-sm text-gray-500">{{ getCategoryInfo(selectedContent.category).label }}</p>
              </div>
            </div>
            <button
              @click="closeModal"
              class="text-gray-400 hover:text-gray-600 transition"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Featured Image -->
          <div v-if="selectedContent.featured_image_url" class="mb-6 rounded-lg overflow-hidden">
            <img :src="selectedContent.featured_image_url" :alt="selectedContent.title" class="w-full h-auto" />
          </div>

          <!-- Video (if available) -->
          <div v-if="selectedContent.video_url && getYouTubeEmbedUrl(selectedContent.video_url)" class="mb-6">
            <div class="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
              <iframe
                :src="getYouTubeEmbedUrl(selectedContent.video_url)"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                class="w-full h-96"
              ></iframe>
            </div>
          </div>

          <!-- Content -->
          <div class="prose max-w-none mb-6">
            <div class="text-gray-700 whitespace-pre-wrap">{{ selectedContent.content }}</div>
          </div>

          <!-- Meta Info -->
          <div class="border-t border-gray-200 pt-4 flex items-center justify-between text-sm text-gray-500">
            <div class="flex items-center space-x-4">
              <div class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                </svg>
                {{ selectedContent.view_count }} views
              </div>
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="`bg-${getTypeInfo(selectedContent.content_type).color}-100 text-${getTypeInfo(selectedContent.content_type).color}-800`"
              >
                {{ getTypeInfo(selectedContent.content_type).icon }} {{ selectedContent.content_type }}
              </span>
            </div>
            <span>Published {{ formatDate(selectedContent.created_at) }}</span>
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

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.prose {
  line-height: 1.75;
}
</style>