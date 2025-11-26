<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../js/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const props = defineProps({
  eventId: {
    type: String,
    required: false,
    default: null
  },
  navigateTo: {
    type: Function,
    required: true
  }
});

// Get eventId from props, sessionStorage, or URL
const getEventId = () => {
  // First, try props
  if (props.eventId) return props.eventId;
  
  // Second, try sessionStorage
  const storedId = sessionStorage.getItem('currentEventId');
  if (storedId) return storedId;
  
  // Third, try to get from URL hash
  const hash = window.location.hash;
  const match = hash.match(/\/admin\/event-participants\/([^\/]+)/);
  return match ? match[1] : null;
};

const currentEventId = getEventId();

const event = ref(null);
const participants = ref([]);
const loading = ref(true);
const message = ref({ type: '', text: '' });
const isExporting = ref(false);

// Fetch event and participants
const fetchEventParticipants = async () => {
  if (!currentEventId) {
    message.value = { type: 'error', text: 'No event ID provided' };
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    // Fetch event details
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', currentEventId)
      .single();

    if (eventError) throw eventError;
    event.value = eventData;

    // Fetch participants
    const { data: participantsData, error: participantsError } = await supabase
      .from('event_participants')
      .select(`
        id,
        attended,
        joined_at,
        user_id,
        users!event_participants_user_id_fkey(
          id,
          name,
          email
        )
      `)
      .eq('event_id', currentEventId)
      .order('joined_at', { ascending: true });

    if (participantsError) throw participantsError;
    participants.value = participantsData || [];

  } catch (error) {
    console.error('Error fetching participants:', error);
    message.value = { type: 'error', text: 'Failed to load participants' };
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

// Toggle attendance status
const toggleAttendance = async (participantId, currentStatus) => {
  try {
    const { error } = await supabase
      .from('event_participants')
      .update({ attended: !currentStatus })
      .eq('id', participantId);

    if (error) throw error;

    // Update local state
    const participant = participants.value.find(p => p.id === participantId);
    if (participant) {
      participant.attended = !currentStatus;
    }

    message.value = { type: 'success', text: 'Attendance updated successfully!' };
    setTimeout(() => {
      message.value = { type: '', text: '' };
    }, 3000);

  } catch (error) {
    console.error('Error updating attendance:', error);
    message.value = { type: 'error', text: 'Failed to update attendance' };
  }
};

// Export to CSV (alternative to PDF)
const exportToCSV = () => {
  if (!event.value || participants.value.length === 0) {
    message.value = { type: 'error', text: 'No participants to export' };
    return;
  }

  try {
    // Create CSV header
    let csv = 'Event Attendance Sheet\n';
    csv += `Event: ${event.value.title}\n`;
    csv += `Date: ${formatDate(event.value.event_date)}\n`;
    csv += `Location: ${event.value.location}\n`;
    csv += `Total Participants: ${participants.value.length}\n`;
    csv += `Attended: ${participants.value.filter(p => p.attended).length}\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    // Add table headers
    csv += '#,Name,Email,Status,Registered On\n';
    
    // Add participant data
    participants.value.forEach((participant, index) => {
      const name = (participant.users?.name || 'N/A').replace(/,/g, ';');
      const email = participant.users?.email || 'N/A';
      const status = participant.attended ? 'Present' : 'Absent';
      const registeredOn = formatDate(participant.joined_at);
      
      csv += `${index + 1},${name},${email},${status},${registeredOn}\n`;
    });
    
    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${event.value.title.replace(/[^a-z0-9]/gi, '_')}_Attendance_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.value = { type: 'success', text: 'CSV exported successfully!' };
    setTimeout(() => {
      message.value = { type: '', text: '' };
    }, 3000);
    
  } catch (error) {
    console.error('CSV Export error:', error);
    message.value = { type: 'error', text: 'Failed to export CSV' };
  }
};

// Export to PDF
const exportToPDF = () => {
  if (!event.value || participants.value.length === 0) {
    message.value = { type: 'error', text: 'No participants to export' };
    return;
  }

  isExporting.value = true;

  try {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Event Attendance Sheet', 14, 20);
    
    // Event details
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Event: ${event.value.title}`, 14, 32);
    doc.text(`Date: ${formatDate(event.value.event_date)}`, 14, 40);
    doc.text(`Location: ${event.value.location}`, 14, 48);
    doc.text(`Total Participants: ${participants.value.length}`, 14, 56);
    doc.text(`Attended: ${participants.value.filter(p => p.attended).length}`, 14, 64);
    
    // Generate timestamp
    const exportDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated: ${exportDate}`, 14, 72);
    
    // Table data
    const tableData = participants.value.map((participant, index) => [
      index + 1,
      participant.users?.name || 'N/A',
      participant.users?.email || 'N/A',
      participant.attended ? 'Present' : 'Absent',
      formatDate(participant.joined_at)
    ]);
    
    // Add table using autoTable
    autoTable(doc, {
      startY: 80,
      head: [['#', 'Name', 'Email', 'Status', 'Registered On']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { cellWidth: 45 },
        2: { cellWidth: 55 },
        3: { halign: 'center', cellWidth: 25 },
        4: { cellWidth: 45 }
      },
      styles: {
        fontSize: 10,
        cellPadding: 5
      },
      didParseCell: function(data) {
        // Color code the status column
        if (data.column.index === 3 && data.section === 'body') {
          if (data.cell.raw === 'Present') {
            data.cell.styles.textColor = [22, 163, 74]; // green
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [220, 38, 38]; // red
          }
        }
      }
    });
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
    
    // Save the PDF
    const fileName = `${event.value.title.replace(/[^a-z0-9]/gi, '_')}_Attendance_${new Date().getTime()}.pdf`;
    doc.save(fileName);
    
    message.value = { type: 'success', text: 'PDF exported successfully!' };
    setTimeout(() => {
      message.value = { type: '', text: '' };
    }, 3000);

  } catch (error) {
    console.error('Export error:', error);
    message.value = { type: 'error', text: `Failed to export PDF: ${error.message}` };
  } finally {
    isExporting.value = false;
  }
};

// Get attendance statistics
const getStats = () => {
  const total = participants.value.length;
  const attended = participants.value.filter(p => p.attended).length;
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
  return { total, attended, percentage };
};

onMounted(() => {
  fetchEventParticipants();
});
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <!-- Page Header -->
    <div class="mb-8">
      <button
        @click="navigateTo('/admin/events')"
        class="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Events
      </button>
      
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Event Participants</h1>
          <div v-if="event" class="space-y-1">
            <p class="text-xl text-gray-700 font-medium">{{ event.title }}</p>
            <div class="flex items-center text-gray-600 space-x-4 text-sm">
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ formatDate(event.event_date) }}
              </span>
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ event.location }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="flex gap-3">
          <button
            @click="exportToPDF"
            :disabled="isExporting || participants.length === 0"
            class="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {{ isExporting ? 'Exporting...' : 'Export PDF' }}
          </button>
          
          <button
            @click="exportToCSV"
            :disabled="participants.length === 0"
            class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
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

    <!-- Statistics Cards -->
    <div v-if="!loading" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0 bg-blue-100 rounded-lg p-3">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Total Participants</p>
            <p class="text-2xl font-bold text-gray-900">{{ getStats().total }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0 bg-green-100 rounded-lg p-3">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Attended</p>
            <p class="text-2xl font-bold text-gray-900">{{ getStats().attended }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0 bg-purple-100 rounded-lg p-3">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Attendance Rate</p>
            <p class="text-2xl font-bold text-gray-900">{{ getStats().percentage }}%</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>

    <!-- No Participants -->
    <div v-else-if="participants.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
      <div class="text-6xl mb-4">👥</div>
      <h3 class="text-xl font-semibold text-gray-700 mb-2">No Participants Yet</h3>
      <p class="text-gray-500">No one has registered for this event yet.</p>
    </div>

    <!-- Participants Table -->
    <div v-else class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                #
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registered On
              </th>
              <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Attendance
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="(participant, index) in participants"
              :key="participant.id"
              class="hover:bg-gray-50 transition"
            >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ index + 1 }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span class="text-blue-600 font-medium text-sm">
                      {{ participant.users?.name?.charAt(0).toUpperCase() || 'U' }}
                    </span>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">
                      {{ participant.users?.name || 'Unknown User' }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {{ participant.users?.email || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {{ formatDate(participant.joined_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <button
                  @click="toggleAttendance(participant.id, participant.attended)"
                  class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition"
                  :class="{
                    'bg-green-100 text-green-800 hover:bg-green-200': participant.attended,
                    'bg-red-100 text-red-800 hover:bg-red-200': !participant.attended
                  }"
                >
                  <svg
                    class="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      v-if="participant.attended"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                    <path
                      v-else
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {{ participant.attended ? 'Present' : 'Absent' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>