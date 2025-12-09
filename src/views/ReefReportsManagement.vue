<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../js/supabase';

const router = useRouter();
const showCreateModal = ref(false);
const reports = ref([]);
const qrCodes = ref([]);
const loading = ref(false);
const error = ref('');
const success = ref('');

// Form fields
const reportName = ref('');
const reportType = ref('weekly');
const startDate = ref('');
const endDate = ref('');
const selectedLocations = ref([]);
const recommendedActions = ref('');

// View report modal
const showViewModal = ref(false);
const selectedReport = ref(null);

// Fetch all reports
const fetchReports = async () => {
  try {
    loading.value = true;
    const { data, error: fetchError } = await supabase
      .from('reef_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    reports.value = data || [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Fetch all QR codes for location selection
const fetchQRCodes = async () => {
  try {
    const { data, error: fetchError } = await supabase
      .from('qr_codes')
      .select('id, code, location_name')
      .order('location_name', { ascending: true });

    if (fetchError) throw fetchError;
    qrCodes.value = data || [];
  } catch (err) {
    console.error('Error fetching QR codes:', err);
  }
};

// Toggle location selection
const toggleLocation = (qrId) => {
  const index = selectedLocations.value.indexOf(qrId);
  if (index > -1) {
    selectedLocations.value.splice(index, 1);
  } else {
    selectedLocations.value.push(qrId);
  }
};

// Generate report data
const generateReportData = async () => {
  try {
    const locationIds = selectedLocations.value.length > 0 
      ? selectedLocations.value 
      : qrCodes.value.map(qr => qr.id);

    let query = supabase
      .from('coral_info')
      .select('*')
      .in('qr_id', locationIds);

    if (startDate.value) {
      query = query.gte('updated_at', new Date(startDate.value).toISOString());
    }
    if (endDate.value) {
      query = query.lte('updated_at', new Date(endDate.value).toISOString());
    }

    const { data: coralData, error: coralError } = await query;
    if (coralError) throw coralError;

    const healthCounts = {
      healthy: 0,
      bleached: 0,
      damaged: 0,
      threatened: 0
    };

    const threats = {};
    const photos = [];

    coralData.forEach(coral => {
      healthCounts[coral.coral_health]++;
      
      if (coral.threat_level) {
        threats[coral.threat_level] = (threats[coral.threat_level] || 0) + 1;
      }
      
      if (coral.coral_photo_url) {
        photos.push({
          url: coral.coral_photo_url,
          location: coral.coral_name,
          health: coral.coral_health
        });
      }
    });

    const totalCorals = coralData.length;
    const coral_condition_summary = {
      total_sites: totalCorals,
      healthy_percent: totalCorals > 0 ? ((healthCounts.healthy / totalCorals) * 100).toFixed(1) : 0,
      bleached_percent: totalCorals > 0 ? ((healthCounts.bleached / totalCorals) * 100).toFixed(1) : 0,
      damaged_percent: totalCorals > 0 ? ((healthCounts.damaged / totalCorals) * 100).toFixed(1) : 0,
      threatened_percent: totalCorals > 0 ? ((healthCounts.threatened / totalCorals) * 100).toFixed(1) : 0,
      counts: healthCounts
    };

    const threat_indicators = threats;

    const trends = {
      health_trend: 'stable',
      threat_trend: 'stable'
    };

    return {
      coral_condition_summary,
      threat_indicators,
      photos: photos.slice(0, 10),
      trends
    };

  } catch (err) {
    console.error('Error generating report data:', err);
    return null;
  }
};

// Create report
const createReport = async () => {
  try {
    loading.value = true;
    error.value = '';
    success.value = '';

    if (!reportName.value.trim()) {
      error.value = 'Report name is required';
      return;
    }
    if (!startDate.value || !endDate.value) {
      error.value = 'Start and end dates are required';
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const reportData = await generateReportData();
    if (!reportData) {
      error.value = 'Failed to generate report data';
      return;
    }

    const { data, error: insertError } = await supabase
      .from('reef_reports')
      .insert({
        report_name: reportName.value,
        report_type: reportType.value,
        start_date: new Date(startDate.value).toISOString(),
        end_date: new Date(endDate.value).toISOString(),
        qr_locations: selectedLocations.value.length > 0 
          ? selectedLocations.value 
          : qrCodes.value.map(qr => qr.id),
        coral_condition_summary: reportData.coral_condition_summary,
        threat_indicators: reportData.threat_indicators,
        photos: reportData.photos,
        trends: reportData.trends,
        recommended_actions: recommendedActions.value,
        generated_by: user.id,
        is_published: false
      })
      .select()
      .single();

    if (insertError) throw insertError;

    success.value = 'Report generated successfully!';
    
    reportName.value = '';
    reportType.value = 'weekly';
    startDate.value = '';
    endDate.value = '';
    selectedLocations.value = [];
    recommendedActions.value = '';
    
    await fetchReports();
    
    setTimeout(() => {
      showCreateModal.value = false;
      success.value = '';
    }, 1500);

  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// View report
const viewReport = async (report) => {
  selectedReport.value = report;
  showViewModal.value = true;
};

// Publish/unpublish report
const togglePublish = async (report) => {
  try {
    loading.value = true;
    const { error: updateError } = await supabase
      .from('reef_reports')
      .update({ is_published: !report.is_published })
      .eq('id', report.id);

    if (updateError) throw updateError;

    success.value = report.is_published ? 'Report unpublished' : 'Report published!';
    await fetchReports();
    
    setTimeout(() => {
      success.value = '';
    }, 2000);

  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Delete report
const deleteReport = async (id) => {
  if (!confirm('Are you sure you want to delete this report?')) return;

  try {
    loading.value = true;
    const { error: deleteError } = await supabase
      .from('reef_reports')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    success.value = 'Report deleted successfully!';
    await fetchReports();
    
    setTimeout(() => {
      success.value = '';
    }, 2000);

  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Download report as PDF (Philippine government format)
const downloadReportPDF = async (report) => {
  try {
    loading.value = true;
    
    // Dynamically load jsPDF
    if (!window.jspdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;
    
    // Header - Republic of the Philippines format
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Republic of the Philippines', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('Department of Environment and Natural Resources', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('Marine Protected Area Division', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // Report Title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('REEF STATUS MONITORING REPORT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    
    // Report Details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Report Name: ${report.report_name}`, 20, yPos);
    yPos += 7;
    doc.text(`Report Type: ${report.report_type.toUpperCase()}`, 20, yPos);
    yPos += 7;
    doc.text(`Period Covered: ${new Date(report.start_date).toLocaleDateString('en-PH')} - ${new Date(report.end_date).toLocaleDateString('en-PH')}`, 20, yPos);
    yPos += 7;
    doc.text(`Number of Locations: ${report.qr_locations?.length || 0}`, 20, yPos);
    yPos += 7;
    doc.text(`Date Generated: ${new Date(report.created_at).toLocaleDateString('en-PH')}`, 20, yPos);
    yPos += 7;
    doc.text(`Status: ${report.is_published ? 'PUBLISHED' : 'DRAFT'}`, 20, yPos);
    yPos += 12;
    
    // Section I: Coral Condition Summary
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('I. CORAL CONDITION SUMMARY', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    if (report.coral_condition_summary) {
      doc.text(`Total Sites Monitored: ${report.coral_condition_summary.total_sites}`, 25, yPos);
      yPos += 7;
      doc.text(`Healthy: ${report.coral_condition_summary.healthy_percent}% (${report.coral_condition_summary.counts.healthy} sites)`, 25, yPos);
      yPos += 6;
      doc.text(`Bleached: ${report.coral_condition_summary.bleached_percent}% (${report.coral_condition_summary.counts.bleached} sites)`, 25, yPos);
      yPos += 6;
      doc.text(`Damaged: ${report.coral_condition_summary.damaged_percent}% (${report.coral_condition_summary.counts.damaged} sites)`, 25, yPos);
      yPos += 6;
      doc.text(`Threatened: ${report.coral_condition_summary.threatened_percent}% (${report.coral_condition_summary.counts.threatened} sites)`, 25, yPos);
      yPos += 10;
    }
    
    // Section II: Threat Indicators
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('II. THREAT INDICATORS', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    if (report.threat_indicators && Object.keys(report.threat_indicators).length > 0) {
      for (const [threat, count] of Object.entries(report.threat_indicators)) {
        doc.text(`${threat.toUpperCase()} Threat Level: ${count} incidents`, 25, yPos);
        yPos += 6;
      }
      yPos += 4;
    } else {
      doc.text('No significant threats recorded during this period.', 25, yPos);
      yPos += 10;
    }
    
    // Section III: Recommended Conservation Actions
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('III. RECOMMENDED CONSERVATION ACTIONS', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    if (report.recommended_actions) {
      const splitText = doc.splitTextToSize(report.recommended_actions, pageWidth - 50);
      doc.text(splitText, 25, yPos);
      yPos += (splitText.length * 6) + 10;
    } else {
      doc.text('No specific actions recommended at this time.', 25, yPos);
      yPos += 10;
    }
    
    // Check if we need a new page
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }
    
    // Section IV: Trends Analysis
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('IV. TRENDS ANALYSIS', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    if (report.trends) {
      doc.text(`Health Trend: ${report.trends.health_trend.toUpperCase()}`, 25, yPos);
      yPos += 6;
      doc.text(`Threat Trend: ${report.trends.threat_trend.toUpperCase()}`, 25, yPos);
      yPos += 12;
    }
    
    // Footer - Certification
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos = pageHeight - 50;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Prepared by:', 20, yPos);
    yPos += 15;
    doc.text('_________________________', 20, yPos);
    yPos += 5;
    doc.text('Marine Ranger / Monitoring Officer', 20, yPos);
    yPos += 3;
    doc.text('Date: _______________', 20, yPos);
    
    yPos = pageHeight - 50;
    doc.text('Reviewed by:', pageWidth - 80, yPos);
    yPos += 15;
    doc.text('_________________________', pageWidth - 80, yPos);
    yPos += 5;
    doc.text('MPA Supervisor', pageWidth - 80, yPos);
    yPos += 3;
    doc.text('Date: _______________', pageWidth - 80, yPos);
    
    // Save PDF
    const filename = `Reef-Status-Report-${report.report_type}-${new Date(report.start_date).toLocaleDateString('en-PH').replace(/\//g, '-')}.pdf`;
    doc.save(filename);
    
    success.value = 'PDF downloaded successfully!';
    setTimeout(() => {
      success.value = '';
    }, 2000);
    
  } catch (err) {
    console.error('PDF generation error:', err);
    error.value = 'Failed to generate PDF: ' + err.message;
  } finally {
    loading.value = false;
  }
};

// Get health status color
const getHealthColor = (health) => {
  const colors = {
    healthy: 'green',
    bleached: 'gray',
    damaged: 'yellow',
    threatened: 'red'
  };
  return colors[health] || 'gray';
};

// Set default dates (last 7 days)
const setDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  
  endDate.value = end.toISOString().split('T')[0];
  startDate.value = start.toISOString().split('T')[0];
};

onMounted(() => {
  fetchReports();
  fetchQRCodes();
});
</script>

<template>
  <div>
    <!-- Back Button -->
    <button
      @click="router.push('/dashboard')"
      class="mb-6 flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
    >
      <span class="text-xl mr-2">←</span> Back to Dashboard
    </button>

    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">📊 Reef Status Reports</h2>
        <p class="text-gray-600 mt-1">Generate and manage automated reef condition reports</p>
      </div>
      <button
        @click="showCreateModal = true; setDefaultDates();"
        class="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition flex items-center space-x-2"
      >
        <span class="text-xl">➕</span>
        <span>Generate Report</span>
      </button>
    </div>

    <!-- Messages -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
      {{ error }}
    </div>
    <div v-if="success" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
      {{ success }}
    </div>

    <!-- Reports Grid -->
    <div v-if="reports.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="report in reports"
        :key="report.id"
        class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="text-4xl">📋</div>
          <span 
            :class="report.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
            class="text-xs font-medium px-2.5 py-1 rounded"
          >
            {{ report.is_published ? '✓ Published' : 'Draft' }}
          </span>
        </div>

        <h3 class="text-xl font-bold text-gray-800 mb-2">{{ report.report_name }}</h3>
        
        <div class="space-y-2 mb-4 text-sm text-gray-600">
          <div class="flex items-center space-x-2">
            <span>📅</span>
            <span>{{ new Date(report.start_date).toLocaleDateString() }} - {{ new Date(report.end_date).toLocaleDateString() }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span>🏷️</span>
            <span class="capitalize">{{ report.report_type }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span>📍</span>
            <span>{{ report.qr_locations?.length || 0 }} locations</span>
          </div>
        </div>

        <div class="flex space-x-2">
          <button
            @click="viewReport(report)"
            class="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            View
          </button>
          <button
            @click="togglePublish(report)"
            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {{ report.is_published ? 'Unpublish' : 'Publish' }}
          </button>
          <button
            @click="downloadReportPDF(report)"
            :disabled="loading"
            class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            title="Download PDF"
          >
            📄
          </button>
          <button
            @click="deleteReport(report.id)"
            class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 bg-white rounded-xl shadow-md">
      <div class="text-6xl mb-4">📊</div>
      <h3 class="text-xl font-bold text-gray-800 mb-2">No Reports Yet</h3>
      <p class="text-gray-600 mb-6">Generate your first reef status report</p>
      <button
        @click="showCreateModal = true; setDefaultDates();"
        class="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition"
      >
        Generate First Report
      </button>
    </div>

    <!-- Create Report Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 backdrop-blur-md bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto"
      @click.self="showCreateModal = false"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-8">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-bold text-gray-800">Generate Reef Status Report</h3>
          <button
            @click="showCreateModal = false"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <form @submit.prevent="createReport" class="space-y-4">
          <!-- Report Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Report Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="reportName"
              type="text"
              required
              placeholder="e.g., Weekly Reef Status - January 2025"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          <!-- Report Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select
              v-model="reportType"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <!-- Date Range -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span class="text-red-500">*</span>
              </label>
              <input
                v-model="startDate"
                type="date"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                End Date <span class="text-red-500">*</span>
              </label>
              <input
                v-model="endDate"
                type="date"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <!-- Location Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Select Locations (leave empty for all)
            </label>
            <div class="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
              <label
                v-for="qr in qrCodes"
                :key="qr.id"
                class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
              >
                <input
                  type="checkbox"
                  :value="qr.id"
                  :checked="selectedLocations.includes(qr.id)"
                  @change="toggleLocation(qr.id)"
                  class="rounded text-cyan-500 focus:ring-cyan-500"
                />
                <span class="text-sm text-gray-700">{{ qr.location_name }}</span>
              </label>
            </div>
          </div>

          <!-- Recommended Actions -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Recommended Conservation Actions
            </label>
            <textarea
              v-model="recommendedActions"
              rows="3"
              placeholder="e.g., Increase monitoring frequency, Reduce tourist traffic in damaged areas"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            ></textarea>
          </div>

          <!-- Info Box -->
          <div class="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <p class="text-sm text-cyan-800">
              <span class="font-semibold">ℹ️ Note:</span> Report will be generated in DENR-compliant PDF format for official submission.
            </p>
          </div>

          <!-- Buttons -->
          <div class="flex space-x-3 pt-4">
            <button
              type="button"
              @click="showCreateModal = false"
              class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="loading"
              class="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              {{ loading ? 'Generating...' : 'Generate Report' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- View Report Modal -->
    <div
      v-if="showViewModal && selectedReport"
      class="fixed inset-0 backdrop-blur-md bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto"
      @click.self="showViewModal = false"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 my-8">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-bold text-gray-800">{{ selectedReport.report_name }}</h3>
          <button
            @click="showViewModal = false"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <div class="space-y-6">
          <!-- Report Info -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-gray-50 p-4 rounded-lg">
              <p class="text-sm text-gray-600 mb-1">Report Period</p>
              <p class="font-semibold text-gray-800">
                {{ new Date(selectedReport.start_date).toLocaleDateString() }} - 
                {{ new Date(selectedReport.end_date).toLocaleDateString() }}
              </p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <p class="text-sm text-gray-600 mb-1">Report Type</p>
              <p class="font-semibold text-gray-800 capitalize">{{ selectedReport.report_type }}</p>
            </div>
          </div>

          <!-- Coral Condition Summary -->
          <div v-if="selectedReport.coral_condition_summary" class="bg-white border border-gray-200 rounded-lg p-6">
            <h4 class="text-lg font-bold text-gray-800 mb-4">🪸 Coral Condition Summary</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div class="text-center p-4 bg-green-50 rounded-lg">
                <div class="text-3xl mb-2">🟢</div>
                <p class="text-2xl font-bold text-green-600">{{ selectedReport.coral_condition_summary.healthy_percent }}%</p>
                <p class="text-sm text-gray-600">Healthy</p>
              </div>
              <div class="text-center p-4 bg-gray-50 rounded-lg">
                <div class="text-3xl mb-2">⚪</div>
                <p class="text-2xl font-bold text-gray-600">{{ selectedReport.coral_condition_summary.bleached_percent }}%</p>
                <p class="text-sm text-gray-600">Bleached</p>
              </div>
              <div class="text-center p-4 bg-yellow-50 rounded-lg">
                <div class="text-3xl mb-2">🟡</div>
                <p class="text-2xl font-bold text-yellow-600">{{ selectedReport.coral_condition_summary.damaged_percent }}%</p>
                <p class="text-sm text-gray-600">Damaged</p>
              </div>
              <div class="text-center p-4 bg-red-50 rounded-lg">
                <div class="text-3xl mb-2">🔴</div>
                <p class="text-2xl font-bold text-red-600">{{ selectedReport.coral_condition_summary.threatened_percent }}%</p>
                <p class="text-sm text-gray-600">Threatened</p>
              </div>
            </div>
            <p class="text-sm text-gray-600 text-center">
              Total Sites Monitored: <span class="font-semibold">{{ selectedReport.coral_condition_summary.total_sites }}</span>
            </p>
          </div>

          <!-- Threat Indicators -->
          <div v-if="selectedReport.threat_indicators && Object.keys(selectedReport.threat_indicators).length > 0" class="bg-white border border-gray-200 rounded-lg p-6">
            <h4 class="text-lg font-bold text-gray-800 mb-4">⚠️ Threat Indicators</h4>
            <div class="space-y-2">
              <div
                v-for="(count, threat) in selectedReport.threat_indicators"
                :key="threat"
                class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span class="font-medium text-gray-700 capitalize">{{ threat }}</span>
                <span class="text-cyan-600 font-bold">{{ count }} sites</span>
              </div>
            </div>
          </div>

          <!-- Photos -->
          <div v-if="selectedReport.photos && selectedReport.photos.length > 0" class="bg-white border border-gray-200 rounded-lg p-6">
            <h4 class="text-lg font-bold text-gray-800 mb-4">📸 Documented Photos</h4>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div
                v-for="(photo, index) in selectedReport.photos"
                :key="index"
                class="relative"
              >
                <img :src="photo.url" :alt="photo.location" class="w-full h-32 object-cover rounded-lg" />
                <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-2 text-xs rounded-b-lg">
                  {{ photo.location }}
                </div>
              </div>
            </div>
          </div>

          <!-- Recommended Actions -->
          <div v-if="selectedReport.recommended_actions" class="bg-cyan-50 border border-cyan-200 rounded-lg p-6">
            <h4 class="text-lg font-bold text-cyan-800 mb-2">💡 Recommended Conservation Actions</h4>
            <p class="text-gray-700">{{ selectedReport.recommended_actions }}</p>
          </div>

          <!-- Actions -->
          <div class="flex space-x-3 pt-4">
            <button
              @click="downloadReportPDF(selectedReport)"
              :disabled="loading"
              class="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              📄 Download PDF
            </button>
            <button
              @click="showViewModal = false"
              class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>