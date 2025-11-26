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

const events = ref([]);
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
  description: '',
  event_date: '',
  location: '',
  max_participants: null,
  points_reward: 50,
  status: 'upcoming',
  event_image_url: ''
});

// Fetch all events
const fetchEvents = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        created_by_user:users!events_created_by_fkey(name),
        participants:event_participants(id, attended)
      `)
      .order('event_date', { ascending: false });

    if (error) throw error;
    events.value = data || [];

  } catch (error) {
    console.error('Error fetching events:', error);
    message.value = { type: 'error', text: 'Failed to load events' };
  } finally {
    loading.value = false;
  }
};

// Format date for display
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format date for input
const formatDateForInput = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Get status color
const getStatusColor = (status) => {
  const colors = {
    upcoming: 'bg-blue-100 text-blue-800 border-blue-200',
    ongoing: 'bg-green-100 text-green-800 border-green-200',
    completed: 'bg-gray-100 text-gray-800 border-gray-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200'
  };
  return colors[status] || colors.upcoming;
};

// Get participant stats
const getParticipantStats = (event) => {
  const total = event.participants?.length || 0;
  const attended = event.participants?.filter(p => p.attended).length || 0;
  return { total, attended };
};

// Open modal for new event
const openCreateModal = () => {
  isEditing.value = false;
  formData.value = {
    id: null,
    title: '',
    description: '',
    event_date: '',
    location: '',
    max_participants: null,
    points_reward: 50,
    status: 'upcoming',
    event_image_url: ''
  };
  showModal.value = true;
  message.value = { type: '', text: '' };
};

// Open modal for editing
const openEditModal = (event) => {
  isEditing.value = true;
  formData.value = {
    id: event.id,
    title: event.title,
    description: event.description,
    event_date: formatDateForInput(event.event_date),
    location: event.location,
    max_participants: event.max_participants,
    points_reward: event.points_reward,
    status: event.status,
    event_image_url: event.event_image_url || ''
  };
  showModal.value = true;
  message.value = { type: '', text: '' };
};

// Close modal
const closeModal = () => {
  showModal.value = false;
  isEditing.value = false;
  formData.value = {
    id: null,
    title: '',
    description: '',
    event_date: '',
    location: '',
    max_participants: null,
    points_reward: 50,
    status: 'upcoming',
    event_image_url: ''
  };
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
      .from('event-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(fileName);

    formData.value.event_image_url = urlData.publicUrl;
    message.value = { type: 'success', text: 'Image uploaded successfully!' };

  } catch (error) {
    console.error('Upload error:', error);
    message.value = { type: 'error', text: 'Failed to upload image' };
  } finally {
    isUploading.value = false;
  }
};

// Save event (create or update)
const saveEvent = async () => {
  // Validation
  if (!formData.value.title.trim()) {
    message.value = { type: 'error', text: 'Title is required' };
    return;
  }
  if (!formData.value.description.trim()) {
    message.value = { type: 'error', text: 'Description is required' };
    return;
  }
  if (!formData.value.event_date) {
    message.value = { type: 'error', text: 'Event date is required' };
    return;
  }
  if (!formData.value.location.trim()) {
    message.value = { type: 'error', text: 'Location is required' };
    return;
  }

  isSaving.value = true;
  message.value = { type: '', text: '' };

  try {
    const eventData = {
      title: formData.value.title.trim(),
      description: formData.value.description.trim(),
      event_date: formData.value.event_date,
      location: formData.value.location.trim(),
      max_participants: formData.value.max_participants || null,
      points_reward: formData.value.points_reward,
      status: formData.value.status,
      event_image_url: formData.value.event_image_url || null
    };

    if (isEditing.value) {
      // Update existing event
      const { error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', formData.value.id);

      if (error) throw error;
      message.value = { type: 'success', text: 'Event updated successfully!' };
    } else {
      // Create new event
      const { error } = await supabase
        .from('events')
        .insert({
          ...eventData,
          created_by: props.userProfile.id
        });

      if (error) throw error;
      message.value = { type: 'success', text: 'Event created successfully!' };
    }

    await fetchEvents();
    setTimeout(() => {
      closeModal();
    }, 1500);

  } catch (error) {
    console.error('Save error:', error);
    message.value = { type: 'error', text: 'Failed to save event' };
  } finally {
    isSaving.value = false;
  }
};

// Delete event
const deleteEvent = async (eventId) => {
  if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;

  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    message.value = { type: 'success', text: 'Event deleted successfully!' };
    await fetchEvents();

  } catch (error) {
    console.error('Delete error:', error);
    message.value = { type: 'error', text: 'Failed to delete event' };
  }
};

// View participants
const viewParticipants = (eventId) => {
  props.navigateTo(`/admin/event-participants/${eventId}`);
};

onMounted(() => {
  fetchEvents();
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
          <h1 class="text-3xl font-bold text-gray-900">Event Management</h1>
          <p class="text-gray-600 mt-1">Create and manage eco-events for the community</p>
        </div>
        <button
          @click="openCreateModal"
          class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition flex items-center"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Event
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

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>

    <!-- Events List -->
    <div v-else-if="events.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
      <div class="text-6xl mb-4">📅</div>
      <h3 class="text-xl font-semibold text-gray-700 mb-2">No Events Yet</h3>
      <p class="text-gray-500 mb-4">Create your first eco-event to get started</p>
      <button
        @click="openCreateModal"
        class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
      >
        Create Event
      </button>
    </div>

    <div v-else class="grid grid-cols-1 gap-6">
      <div
        v-for="event in events"
        :key="event.id"
        class="bg-white rounded-lg shadow hover:shadow-lg transition"
      >
        <div class="p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <div class="flex items-center space-x-3 mb-2">
                <h3 class="text-xl font-bold text-gray-900">{{ event.title }}</h3>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize"
                  :class="getStatusColor(event.status)"
                >
                  {{ event.status }}
                </span>
              </div>
              <p class="text-gray-600 mb-3">{{ event.description }}</p>
            </div>
            
            <!-- Event Image Thumbnail -->
            <div v-if="event.event_image_url" class="ml-4 flex-shrink-0">
              <img :src="event.event_image_url" alt="Event" class="w-24 h-24 rounded-lg object-cover" />
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div class="flex items-center text-sm text-gray-600">
              <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {{ formatDate(event.event_date) }}
            </div>

            <div class="flex items-center text-sm text-gray-600">
              <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {{ event.location }}
            </div>

            <div class="flex items-center text-sm text-gray-600">
              <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {{ getParticipantStats(event).total }}{{ event.max_participants ? `/${event.max_participants}` : '' }} participants
            </div>

            <div class="flex items-center text-sm font-medium text-orange-600">
              <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L14.8 8.2L21 11L14.8 13.8L12 20L9.2 13.8L3 11L9.2 8.2L12 2Z"/>
              </svg>
              {{ event.points_reward }} points
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-3">
            <button
              @click="viewParticipants(event.id)"
              class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              View Participants ({{ getParticipantStats(event).attended }}/{{ getParticipantStats(event).total }})
            </button>
            <button
              @click="openEditModal(event)"
              class="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Edit
            </button>
            <button
              @click="deleteEvent(event.id)"
              class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition"
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
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-900">
              {{ isEditing ? 'Edit Event' : 'Create New Event' }}
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

          <!-- Form -->
          <form @submit.prevent="saveEvent" class="space-y-6">
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
              <input
                v-model="formData.title"
                type="text"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Beach Cleanup Drive"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea
                v-model="formData.description"
                required
                rows="4"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Join us for a community beach cleanup..."
              ></textarea>
            </div>

            <!-- Event Image -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Event Image</label>
              <div v-if="formData.event_image_url" class="mb-3">
                <img :src="formData.event_image_url" alt="Event" class="w-full h-48 object-cover rounded-lg" />
              </div>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                @change="handleImageUpload"
                :disabled="isUploading"
                class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p class="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max 5MB</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Event Date -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Event Date & Time *</label>
                <input
                  v-model="formData.event_date"
                  type="datetime-local"
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <!-- Location -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                <input
                  v-model="formData.location"
                  type="text"
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Panaraga Beach"
                />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <!-- Max Participants -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Max Participants</label>
                <input
                  v-model.number="formData.max_participants"
                  type="number"
                  min="1"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="50"
                />
                <p class="text-xs text-gray-500 mt-1">Leave empty for unlimited</p>
              </div>

              <!-- Points Reward -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Points Reward *</label>
                <input
                  v-model.number="formData.points_reward"
                  type="number"
                  required
                  min="1"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="50"
                />
              </div>

              <!-- Status -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <select
                  v-model="formData.status"
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4">
              <button
                type="submit"
                :disabled="isSaving || isUploading"
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isSaving ? 'Saving...' : (isEditing ? 'Update Event' : 'Create Event') }}
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