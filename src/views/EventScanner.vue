<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
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
const selectedEvent = ref(null);
const participants = ref([]);
const loading = ref(true);
const scanning = ref(false);
const message = ref({ type: '', text: '' });
const manualCode = ref('');
const videoRef = ref(null);
const canvasRef = ref(null);
const stream = ref(null);
const scanInterval = ref(null);

// Fetch active events
const fetchEvents = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .in('status', ['upcoming', 'ongoing'])
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true });

    if (error) throw error;
    events.value = data || [];

  } catch (error) {
    console.error('Error fetching events:', error);
    message.value = { type: 'error', text: 'Failed to load events' };
  } finally {
    loading.value = false;
  }
};

// Fetch participants for selected event
const fetchParticipants = async (eventId) => {
  try {
    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        *,
        user:users(id, name, email, user_qr_code, avatar_url)
      `)
      .eq('event_id', eventId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    participants.value = data || [];

  } catch (error) {
    console.error('Error fetching participants:', error);
    message.value = { type: 'error', text: 'Failed to load participants' };
  }
};

// Select event
const selectEvent = async (event) => {
  selectedEvent.value = event;
  await fetchParticipants(event.id);
};

// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get user initials
const getUserInitials = (name) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Start camera scan
const startCamera = async () => {
  try {
    scanning.value = true;
    message.value = { type: '', text: '' };

    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    if (videoRef.value) {
      videoRef.value.srcObject = stream.value;
      videoRef.value.play();
      
      // Start scanning
      scanInterval.value = setInterval(() => {
        scanQRCode();
      }, 500);
    }

  } catch (error) {
    console.error('Camera error:', error);
    message.value = { type: 'error', text: 'Failed to access camera. Please check permissions.' };
    scanning.value = false;
  }
};

// Stop camera
const stopCamera = () => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
    stream.value = null;
  }
  if (scanInterval.value) {
    clearInterval(scanInterval.value);
    scanInterval.value = null;
  }
  scanning.value = false;
};

// Scan QR code from video
const scanQRCode = () => {
  if (!videoRef.value || !canvasRef.value) return;

  const canvas = canvasRef.value;
  const video = videoRef.value;
  const context = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  
  // Note: In a real implementation, you would use a QR code library like jsQR here
  // For now, we'll focus on the manual input method
  // const code = jsQR(imageData.data, imageData.width, imageData.height);
  // if (code) {
  //   verifyAttendance(code.data);
  //   stopCamera();
  // }
};

// Verify attendance by QR code
const verifyAttendance = async (qrCode) => {
  if (!selectedEvent.value) {
    message.value = { type: 'error', text: 'Please select an event first' };
    return;
  }

  try {
    // Find user by QR code
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, points')
      .eq('user_qr_code', qrCode.trim())
      .single();

    if (userError) throw new Error('User not found');

    // Check if user is registered for this event
    const { data: participantData, error: participantError } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', selectedEvent.value.id)
      .eq('user_id', userData.id)
      .single();

    if (participantError) throw new Error('User not registered for this event');

    if (participantData.attended) {
      message.value = { type: 'error', text: `${userData.name} has already been verified` };
      return;
    }

    // Update attendance
    const { error: updateError } = await supabase
      .from('event_participants')
      .update({
        attended: true,
        attendance_verified_by: props.userProfile.id,
        attendance_verified_at: new Date().toISOString(),
        points_awarded: true
      })
      .eq('id', participantData.id);

    if (updateError) throw updateError;

    // Award points to user
    const newPoints = (userData.points || 0) + selectedEvent.value.points_reward;
    const { error: pointsError } = await supabase
      .from('users')
      .update({ points: newPoints })
      .eq('id', userData.id);

    if (pointsError) throw pointsError;

    message.value = { 
      type: 'success', 
      text: `✅ ${userData.name} verified! +${selectedEvent.value.points_reward} points` 
    };
    
    // Refresh participants list
    await fetchParticipants(selectedEvent.value.id);
    
    // Clear manual input
    manualCode.value = '';

    // Clear message after 3 seconds
    setTimeout(() => {
      message.value = { type: '', text: '' };
    }, 3000);

  } catch (error) {
    console.error('Verification error:', error);
    message.value = { type: 'error', text: error.message || 'Failed to verify attendance' };
  }
};

// Manual verification
const verifyManually = () => {
  if (!manualCode.value.trim()) {
    message.value = { type: 'error', text: 'Please enter a QR code' };
    return;
  }
  verifyAttendance(manualCode.value);
};

// Get attendance stats
const getAttendanceStats = () => {
  const total = participants.value.length;
  const verified = participants.value.filter(p => p.attended).length;
  return { total, verified };
};

onMounted(() => {
  fetchEvents();
});

onBeforeUnmount(() => {
  stopCamera();
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
      <h1 class="text-3xl font-bold text-gray-900">Event Check-in Scanner</h1>
      <p class="text-gray-600 mt-1">Verify participant attendance and award points</p>
    </div>

    <!-- Alert Message -->
    <div
      v-if="message.text"
      class="mb-6 p-4 rounded-lg flex items-start animate-pulse"
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
      <!-- Events List -->
      <div class="lg:col-span-1">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Active Events</h2>

          <div v-if="loading" class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>

          <div v-else-if="events.length === 0" class="text-center py-8">
            <div class="text-4xl mb-2">📅</div>
            <p class="text-sm text-gray-500">No active events</p>
          </div>

          <div v-else class="space-y-3">
            <button
              v-for="event in events"
              :key="event.id"
              @click="selectEvent(event)"
              class="w-full text-left p-4 rounded-lg border-2 transition"
              :class="selectedEvent?.id === event.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'"
            >
              <h3 class="font-semibold text-gray-900 mb-1">{{ event.title }}</h3>
              <p class="text-xs text-gray-500">{{ formatDate(event.event_date) }}</p>
              <p class="text-xs text-gray-600 mt-1">📍 {{ event.location }}</p>
            </button>
          </div>
        </div>
      </div>

      <!-- Scanner Section -->
      <div class="lg:col-span-2">
        <div v-if="!selectedEvent" class="bg-white rounded-lg shadow p-12 text-center">
          <div class="text-6xl mb-4">📱</div>
          <h3 class="text-xl font-semibold text-gray-700 mb-2">Select an Event</h3>
          <p class="text-gray-500">Choose an event from the list to start scanning</p>
        </div>

        <div v-else class="space-y-6">
          <!-- Scanner Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-semibold text-gray-900">{{ selectedEvent.title }}</h2>
                <p class="text-sm text-gray-600">{{ formatDate(selectedEvent.event_date) }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600">Verified</p>
                <p class="text-2xl font-bold text-green-600">
                  {{ getAttendanceStats().verified }}/{{ getAttendanceStats().total }}
                </p>
              </div>
            </div>

            <!-- Camera Scanner (Placeholder) -->
            <div class="mb-6">
              <div class="relative bg-gray-900 rounded-lg overflow-hidden" style="aspect-ratio: 4/3;">
                <video
                  ref="videoRef"
                  class="w-full h-full object-cover"
                  :class="{ hidden: !scanning }"
                  autoplay
                  playsinline
                ></video>
                <canvas ref="canvasRef" class="hidden"></canvas>
                
                <div v-if="!scanning" class="absolute inset-0 flex items-center justify-center">
                  <div class="text-center">
                    <svg class="w-24 h-24 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <p class="text-white text-lg mb-4">Camera Scanner</p>
                    <button
                      @click="startCamera"
                      class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
                    >
                      Start Camera
                    </button>
                  </div>
                </div>

                <div v-if="scanning" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div class="w-64 h-64 border-4 border-blue-500 rounded-lg"></div>
                </div>
              </div>

              <div v-if="scanning" class="mt-4 text-center">
                <button
                  @click="stopCamera"
                  class="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition"
                >
                  Stop Camera
                </button>
              </div>
            </div>

            <!-- Manual Input -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Or Enter Code Manually</label>
              <div class="flex gap-3">
                <input
                  v-model="manualCode"
                  type="text"
                  placeholder="USER-xxxxx"
                  class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  @keyup.enter="verifyManually"
                />
                <button
                  @click="verifyManually"
                  class="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition"
                >
                  Verify
                </button>
              </div>
            </div>
          </div>

          <!-- Participants List -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Participants</h3>

            <div v-if="participants.length === 0" class="text-center py-8">
              <p class="text-gray-500">No participants registered</p>
            </div>

            <div v-else class="space-y-2 max-h-96 overflow-y-auto">
              <div
                v-for="participant in participants"
                :key="participant.id"
                class="flex items-center justify-between p-3 rounded-lg border"
                :class="participant.attended ? 'bg-green-50 border-green-200' : 'border-gray-200'"
              >
                <div class="flex items-center space-x-3">
                  <div
                    v-if="participant.user.avatar_url"
                    class="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200"
                  >
                    <img :src="participant.user.avatar_url" :alt="participant.user.name" class="w-full h-full object-cover" />
                  </div>
                  <div
                    v-else
                    class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm"
                  >
                    {{ getUserInitials(participant.user.name) }}
                  </div>

                  <div>
                    <p class="font-medium text-gray-900">{{ participant.user.name }}</p>
                    <p class="text-xs text-gray-500 font-mono">{{ participant.user.user_qr_code }}</p>
                  </div>
                </div>

                <div v-if="participant.attended" class="flex items-center text-green-600">
                  <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-sm font-medium">Verified</span>
                </div>
                <button
                  v-else
                  @click="verifyAttendance(participant.user.user_qr_code)"
                  class="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded font-medium transition"
                >
                  Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>