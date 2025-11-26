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

const events = ref([]);
const myEvents = ref([]);
const loading = ref(true);
const activeTab = ref('available'); // 'available' or 'my-events'
const message = ref({ type: '', text: '' });

// Fetch all events
const fetchEvents = async () => {
  loading.value = true;
  try {
    // Fetch all events (no status filter)
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select(`
        *,
        created_by_user:users!events_created_by_fkey(name),
        participants:event_participants(user_id)
      `)
      .order('event_date', { ascending: false });

    if (eventsError) throw eventsError;

    // Fetch user's participated events
    const { data: myEventsData, error: myEventsError } = await supabase
      .from('event_participants')
      .select(`
        *,
        event:events(*)
      `)
      .eq('user_id', props.userProfile.id);

    if (myEventsError) throw myEventsError;

    events.value = eventsData || [];
    myEvents.value = myEventsData || [];

  } catch (error) {
    console.error('Error fetching events:', error);
    message.value = { type: 'error', text: 'Failed to load events' };
  } finally {
    loading.value = false;
  }
};

// Check if user already joined an event
const isJoined = (eventId) => {
  return myEvents.value.some(p => p.event_id === eventId);
};

// Get participant count
const getParticipantCount = (event) => {
  return event.participants?.length || 0;
};

// Check if event is full
const isEventFull = (event) => {
  if (!event.max_participants) return false;
  return getParticipantCount(event) >= event.max_participants;
};

// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Format time
const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get event status badge color
const getStatusColor = (status) => {
  const colors = {
    upcoming: 'bg-blue-100 text-blue-800 border-blue-200',
    ongoing: 'bg-green-100 text-green-800 border-green-200',
    completed: 'bg-gray-100 text-gray-800 border-gray-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200'
  };
  return colors[status] || colors.upcoming;
};

// Check if event is past
const isPastEvent = (dateString) => {
  return new Date(dateString) < new Date();
};

// Check if user can join event (only upcoming or ongoing, not past/cancelled/completed)
const canJoinEvent = (event) => {
  if (event.status === 'cancelled' || event.status === 'completed') {
    return false;
  }
  if (isPastEvent(event.event_date)) {
    return false;
  }
  if (isEventFull(event)) {
    return false;
  }
  if (isJoined(event.id)) {
    return false;
  }
  return event.status === 'upcoming' || event.status === 'ongoing';
};

// Join event
const joinEvent = async (eventId) => {
  try {
    const { error } = await supabase
      .from('event_participants')
      .insert({
        event_id: eventId,
        user_id: props.userProfile.id
      });

    if (error) throw error;

    message.value = { type: 'success', text: 'Successfully joined the event!' };
    await fetchEvents();

  } catch (error) {
    console.error('Error joining event:', error);
    if (error.code === '23505') {
      message.value = { type: 'error', text: 'You have already joined this event' };
    } else {
      message.value = { type: 'error', text: 'Failed to join event. Please try again.' };
    }
  }
};

// Leave event
const leaveEvent = async (eventId, eventDate, eventStatus) => {
  // Check if event has already started or ended
  if (isPastEvent(eventDate) || eventStatus === 'completed' || eventStatus === 'cancelled') {
    message.value = { type: 'error', text: 'Cannot leave an event that has already started or ended' };
    return;
  }

  if (!confirm('Are you sure you want to leave this event?')) return;

  try {
    const { error } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', props.userProfile.id);

    if (error) throw error;

    message.value = { type: 'success', text: 'Successfully left the event' };
    await fetchEvents();

  } catch (error) {
    console.error('Error leaving event:', error);
    message.value = { type: 'error', text: 'Failed to leave event. Please try again.' };
  }
};

// Filter events for available tab - show all events
const availableEvents = computed(() => {
  return events.value; // Show all events regardless of status
});

// Filter events for my events tab
const myUpcomingEvents = computed(() => {
  return myEvents.value.filter(p => 
    p.event && 
    p.event.status === 'upcoming' && 
    !isPastEvent(p.event.event_date)
  );
});

const myPastEvents = computed(() => {
  return myEvents.value.filter(p => 
    p.event && 
    (p.event.status === 'completed' || isPastEvent(p.event.event_date))
  );
});

onMounted(() => {
  fetchEvents();
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
      <h1 class="text-3xl font-bold text-gray-900">Eco Events</h1>
      <p class="text-gray-600 mt-1">Join community events and earn points while protecting our coral reefs</p>
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
            @click="activeTab = 'available'"
            class="py-4 px-6 text-sm font-medium border-b-2 transition"
            :class="activeTab === 'available' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            Available Events ({{ availableEvents.length }})
          </button>
          <button
            @click="activeTab = 'my-events'"
            class="py-4 px-6 text-sm font-medium border-b-2 transition"
            :class="activeTab === 'my-events' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            My Events ({{ myEvents.length }})
          </button>
        </nav>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>

    <!-- Available Events Tab -->
    <div v-else-if="activeTab === 'available'">
      <div v-if="availableEvents.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <div class="text-6xl mb-4">📅</div>
        <h3 class="text-xl font-semibold text-gray-700 mb-2">No Events Available</h3>
        <p class="text-gray-500">Check back later for upcoming eco-events</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          v-for="event in availableEvents"
          :key="event.id"
          class="bg-white rounded-lg shadow hover:shadow-lg transition"
        >
          <!-- Event Image -->
          <div v-if="event.event_image_url" class="h-48 overflow-hidden rounded-t-lg">
            <img :src="event.event_image_url" :alt="event.title" class="w-full h-full object-cover" />
          </div>
          <div v-else class="h-48 bg-gradient-to-br from-blue-400 to-teal-500 rounded-t-lg flex items-center justify-center">
            <span class="text-6xl">🌊</span>
          </div>

          <!-- Event Details -->
          <div class="p-6">
            <div class="flex items-start justify-between mb-3">
              <h3 class="text-xl font-bold text-gray-900 flex-1">{{ event.title }}</h3>
              <span
                class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize"
                :class="getStatusColor(event.status)"
              >
                {{ event.status }}
              </span>
            </div>

            <p class="text-gray-600 text-sm mb-4 line-clamp-2">{{ event.description }}</p>

            <div class="space-y-2 mb-4">
              <div class="flex items-center text-sm text-gray-600">
                <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ formatDate(event.event_date) }}
              </div>

              <div class="flex items-center text-sm text-gray-600">
                <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ formatTime(event.event_date) }}
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
                {{ getParticipantCount(event) }}{{ event.max_participants ? `/${event.max_participants}` : '' }} participants
              </div>
            </div>

            <!-- Points Reward -->
            <div class="flex items-center justify-between py-3 px-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200 mb-4">
              <span class="text-sm font-medium text-gray-700">Points Reward</span>
              <div class="flex items-center space-x-1">
                <span class="text-lg font-bold text-orange-600">{{ event.points_reward }}</span>
                <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L14.8 8.2L21 11L14.8 13.8L12 20L9.2 13.8L3 11L9.2 8.2L12 2Z"/>
                </svg>
              </div>
            </div>

            <!-- Action Button -->
            <button
              v-if="isJoined(event.id)"
              disabled
              class="w-full bg-green-100 text-green-700 px-4 py-2 rounded-lg font-medium cursor-not-allowed flex items-center justify-center"
            >
              <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              Already Joined
            </button>
            <button
              v-else-if="event.status === 'cancelled'"
              disabled
              class="w-full bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium cursor-not-allowed"
            >
              Event Cancelled
            </button>
            <button
              v-else-if="event.status === 'completed' || isPastEvent(event.event_date)"
              disabled
              class="w-full bg-gray-100 text-gray-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed"
            >
              Event Ended
            </button>
            <button
              v-else-if="isEventFull(event)"
              disabled
              class="w-full bg-gray-100 text-gray-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed"
            >
              Event Full
            </button>
            <button
              v-else-if="canJoinEvent(event)"
              @click="joinEvent(event.id)"
              class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              Join Event
            </button>
            <button
              v-else
              disabled
              class="w-full bg-gray-100 text-gray-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed"
            >
              Cannot Join
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- My Events Tab -->
    <div v-else>
      <!-- Upcoming Events -->
      <div class="mb-8">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
        
        <div v-if="myUpcomingEvents.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
          <div class="text-6xl mb-4">📅</div>
          <h3 class="text-xl font-semibold text-gray-700 mb-2">No Upcoming Events</h3>
          <p class="text-gray-500 mb-4">You haven't joined any events yet</p>
          <button
            @click="activeTab = 'available'"
            class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            Browse Events
          </button>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="participant in myUpcomingEvents"
            :key="participant.id"
            class="bg-white rounded-lg shadow hover:shadow-lg transition"
          >
            <!-- Event Image -->
            <div v-if="participant.event.event_image_url" class="h-48 overflow-hidden rounded-t-lg">
              <img :src="participant.event.event_image_url" :alt="participant.event.title" class="w-full h-full object-cover" />
            </div>
            <div v-else class="h-48 bg-gradient-to-br from-blue-400 to-teal-500 rounded-t-lg flex items-center justify-center">
              <span class="text-6xl">🌊</span>
            </div>

            <!-- Event Details -->
            <div class="p-6">
              <h3 class="text-xl font-bold text-gray-900 mb-3">{{ participant.event.title }}</h3>
              <p class="text-gray-600 text-sm mb-4 line-clamp-2">{{ participant.event.description }}</p>

              <div class="space-y-2 mb-4">
                <div class="flex items-center text-sm text-gray-600">
                  <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {{ formatDate(participant.event.event_date) }}
                </div>

                <div class="flex items-center text-sm text-gray-600">
                  <svg class="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {{ participant.event.location }}
                </div>
              </div>

              <!-- Attendance Status -->
              <div v-if="participant.attended" class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div class="flex items-center text-green-800">
                  <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-sm font-medium">Attendance Verified</span>
                </div>
              </div>

              <!-- Leave Button (only if event hasn't started) -->
              <button
                v-if="!isPastEvent(participant.event.event_date) && participant.event.status !== 'completed' && participant.event.status !== 'cancelled'"
                @click="leaveEvent(participant.event.id, participant.event.event_date, participant.event.status)"
                class="w-full bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium transition"
              >
                Leave Event
              </button>
              <div
                v-else
                class="w-full bg-gray-100 text-gray-500 px-4 py-2 rounded-lg text-center text-sm font-medium"
              >
                {{ participant.attended ? 'Event Completed' : 'Cannot leave past events' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Past Events -->
      <div v-if="myPastEvents.length > 0">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Past Events</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="participant in myPastEvents"
            :key="participant.id"
            class="bg-white rounded-lg shadow opacity-75"
          >
            <div class="p-6">
              <h3 class="text-lg font-bold text-gray-900 mb-2">{{ participant.event.title }}</h3>
              <p class="text-sm text-gray-600 mb-3">{{ formatDate(participant.event.event_date) }}</p>
              
              <div v-if="participant.attended" class="flex items-center text-green-600">
                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                <span class="text-sm font-medium">Attended - {{ participant.event.points_reward }} points earned</span>
              </div>
              <div v-else class="text-sm text-gray-500">
                Not attended
              </div>
            </div>
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