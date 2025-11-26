<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { supabase } from '../js/supabase';
import QrScanner from 'qr-scanner';

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
const qrScanner = ref(null);

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
    // First, get all participant records
    const { data: participantData, error: participantError } = await supabase
      .from('event_participants')
      .select('id, event_id, user_id, joined_at, attended, attendance_verified_by, attendance_verified_at, points_awarded')
      .eq('event_id', eventId)
      .order('joined_at', { ascending: true });

    if (participantError) throw participantError;

    if (!participantData || participantData.length === 0) {
      participants.value = [];
      return;
    }

    // Then fetch user details for each participant
    const userIds = participantData.map(p => p.user_id);
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, user_qr_code, avatar_url')
      .in('id', userIds);

    if (userError) {
      console.error('Error fetching users:', userError);
      // Still show participants even if user fetch fails
      participants.value = participantData.map(p => ({
        ...p,
        user: null
      }));
      return;
    }

    // Combine participant data with user data
    participants.value = participantData.map(participant => {
      const user = userData.find(u => u.id === participant.user_id);
      return {
        ...participant,
        user: user || null
      };
    });

    console.log('Participants loaded:', participants.value);

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

    if (!videoRef.value) {
      throw new Error('Video element not ready');
    }

    // Initialize QR Scanner
    qrScanner.value = new QrScanner(
      videoRef.value,
      result => {
        // QR code detected
        console.log('QR Code detected:', result.data);
        verifyAttendance(result.data);
        stopCamera();
      },
      {
        returnDetailedScanResult: true,
        highlightScanRegion: true,
        highlightCodeOutline: true,
      }
    );

    await qrScanner.value.start();

  } catch (error) {
    console.error('Camera error:', error);
    message.value = { type: 'error', text: 'Failed to access camera. Please check permissions or use manual input.' };
    scanning.value = false;
  }
};

// Stop camera
const stopCamera = () => {
  if (qrScanner.value) {
    qrScanner.value.stop();
    qrScanner.value.destroy();
    qrScanner.value = null;
  }
  scanning.value = false;
};

// Verify attendance by QR code
const verifyAttendance = async (qrCode) => {
  if (!selectedEvent.value) {
    message.value = { type: 'error', text: 'Please select an event first' };
    return;
  }

  // Show loading state
  const loadingMessage = message.value.text;
  message.value = { type: 'info', text: 'Verifying attendance...' };

  try {
    console.log('=== Starting Verification ===');
    console.log('QR Code:', qrCode);
    console.log('Event ID:', selectedEvent.value.id);
    console.log('Ranger ID:', props.userProfile.id);

    // Find user by QR code
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, points, role')
      .eq('user_qr_code', qrCode.trim())
      .single();

    console.log('Step 1 - User lookup:', { userData, userError });

    if (userError || !userData) {
      console.error('User not found:', userError);
      message.value = { type: 'error', text: `User not found with QR code: ${qrCode}` };
      return;
    }

    console.log(`Found user: ${userData.name} (${userData.id})`);

    // Check if user is registered for this event
    const { data: participantData, error: participantError } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', selectedEvent.value.id)
      .eq('user_id', userData.id)
      .maybeSingle();

    console.log('Step 2 - Participant lookup:', { participantData, participantError });

    if (participantError) {
      console.error('Participant query error:', participantError);
      message.value = { type: 'error', text: 'Error checking registration' };
      return;
    }

    if (!participantData) {
      console.error('User not registered for event');
      message.value = { type: 'error', text: `${userData.name} is not registered for this event` };
      return;
    }

    if (participantData.attended) {
      console.warn('User already verified');
      message.value = { type: 'error', text: `${userData.name} has already been verified` };
      return;
    }

    console.log('Step 3 - Updating attendance...');

    // Update attendance
    const { data: updateData, error: updateError } = await supabase
      .from('event_participants')
      .update({
        attended: true,
        attendance_verified_by: props.userProfile.id,
        attendance_verified_at: new Date().toISOString(),
        points_awarded: true
      })
      .eq('id', participantData.id)
      .select();

    console.log('Attendance update result:', { updateData, updateError });

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error(`Failed to update attendance: ${updateError.message}`);
    }

    console.log('Step 4 - Awarding points...');
    console.log(`Current points: ${userData.points}, Adding: ${selectedEvent.value.points_reward}`);

    // Award points to user
    const newPoints = (userData.points || 0) + selectedEvent.value.points_reward;
    const { data: pointsData, error: pointsError } = await supabase
      .from('users')
      .update({ points: newPoints })
      .eq('id', userData.id)
      .select();

    console.log('Points update result:', { pointsData, pointsError, newPoints });

    if (pointsError) {
      console.error('Points error:', pointsError);
      throw new Error(`Failed to award points: ${pointsError.message}`);
    }

    console.log('=== Verification Successful ===');

    message.value = { 
      type: 'success', 
      text: `✅ ${userData.name} verified! +${selectedEvent.value.points_reward} points (Total: ${newPoints} points)` 
    };
    
    // Refresh participants list
    console.log('Refreshing participant list...');
    await fetchParticipants(selectedEvent.value.id);
    
    // Clear manual input
    manualCode.value = '';

    // Clear message after 5 seconds
    setTimeout(() => {
      if (message.value.type === 'success') {
        message.value = { type: '', text: '' };
      }
    }, 5000);

  } catch (error) {
    console.error('=== Verification Failed ===');
    console.error('Error details:', error);
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
        'bg-red-50 border border-red-200': message.type === 'error',
        'bg-blue-50 border border-blue-200': message.type === 'info'
      }"
    >
      <svg
        class="w-5 h-5 mr-3 flex-shrink-0"
        :class="{
          'text-green-600': message.type === 'success',
          'text-red-600': message.type === 'error',
          'text-blue-600': message.type === 'info'
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
          v-else-if="message.type === 'error'"
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
        <path
          v-else
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clip-rule="evenodd"
        />
      </svg>
      <p
        class="text-sm font-medium"
        :class="{
          'text-green-800': message.type === 'success',
          'text-red-800': message.type === 'error',
          'text-blue-800': message.type === 'info'
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

            <!-- Camera Scanner -->
            <div class="mb-6">
              <div class="relative bg-gray-900 rounded-lg overflow-hidden" style="aspect-ratio: 4/3;">
                <video
                  ref="videoRef"
                  class="w-full h-full object-cover"
                  :class="{ hidden: !scanning }"
                ></video>
                <canvas ref="canvasRef" class="hidden"></canvas>
                
                <div v-if="!scanning" class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <div class="text-center">
                    <div class="w-24 h-24 mx-auto mb-4 relative">
                      <svg class="w-full h-full text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-16 h-16 border-2 border-blue-400 rounded-lg animate-pulse"></div>
                      </div>
                    </div>
                    <p class="text-white text-lg font-semibold mb-2">QR Code Scanner</p>
                    <p class="text-gray-400 text-sm mb-4">Scan user QR codes for check-in</p>
                    <button
                      @click="startCamera"
                      class="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium transition shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Start Camera
                    </button>
                  </div>
                </div>

                <!-- Scanning Active Overlay -->
                <div v-if="scanning" class="absolute inset-0 pointer-events-none">
                  <div class="absolute inset-0 flex items-center justify-center">
                    <!-- Scanning Frame -->
                    <div class="relative w-64 h-64">
                      <!-- Corner brackets -->
                      <div class="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-500"></div>
                      <div class="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-500"></div>
                      <div class="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-500"></div>
                      <div class="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-500"></div>
                      
                      <!-- Scanning line animation -->
                      <div class="absolute inset-0 overflow-hidden">
                        <div class="absolute w-full h-1 bg-blue-500 shadow-lg shadow-blue-500/50" style="animation: scan 2s ease-in-out infinite;"></div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Instruction Text -->
                  <div class="absolute bottom-4 left-0 right-0 text-center">
                    <div class="bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-lg inline-block">
                      <p class="font-medium">Position QR code within frame</p>
                      <p class="text-sm text-gray-300 mt-1">Scanning automatically...</p>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="scanning" class="mt-4 text-center">
                <button
                  @click="stopCamera"
                  class="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition inline-flex items-center"
                >
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                <div v-if="participant.user" class="flex items-center space-x-3">
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
                    {{ getUserInitials(participant.user.name || 'User') }}
                  </div>

                  <div>
                    <p class="font-medium text-gray-900">{{ participant.user.name || 'Unknown User' }}</p>
                    <p class="text-xs text-gray-500 font-mono">{{ participant.user.user_qr_code || 'N/A' }}</p>
                  </div>
                </div>
                <div v-else class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold text-sm">
                    ?
                  </div>
                  <div>
                    <p class="font-medium text-gray-600">User Data Unavailable</p>
                    <p class="text-xs text-gray-500">Error loading user</p>
                  </div>
                </div>

                <div v-if="participant.attended" class="flex items-center text-green-600">
                  <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-sm font-medium">Verified</span>
                </div>
                <button
                  v-else-if="participant.user && participant.user.user_qr_code"
                  @click="verifyAttendance(participant.user.user_qr_code)"
                  class="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded font-medium transition"
                >
                  Verify
                </button>
                <button
                  v-else
                  disabled
                  class="text-sm bg-gray-300 text-gray-500 px-3 py-1 rounded font-medium cursor-not-allowed"
                >
                  Error
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes scan {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(256px);
  }
  100% {
    transform: translateY(0);
  }
}
</style>