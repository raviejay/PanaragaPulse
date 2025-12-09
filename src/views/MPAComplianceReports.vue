<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../js/supabase';

const router = useRouter();
const showCreateModal = ref(false);
const reports = ref([]);
const loading = ref(false);
const error = ref('');
const success = ref('');

// Form fields
const reportName = ref('');
const reportPeriod = ref('');
const startDate = ref('');
const endDate = ref('');
const submittedTo = ref('DENR');

// View report modal
const showViewModal = ref(false);
const selectedReport = ref(null);

// Fetch all MPA reports
const fetchReports = async () => {
  try {
    loading.value = true;
    const { data, error: fetchError } = await supabase
      .from('mpa_reports')
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

// Generate MPA report data
const generateMPAReportData = async () => {
  try {
    const startDateTime = new Date(startDate.value).toISOString();
    const endDateTime = new Date(endDate.value).toISOString();

    const { data: coralUpdates, error: coralError } = await supabase
      .from('coral_info')
      .select('ranger_id, updated_at, threat_level, coral_health, qr_id')
      .gte('updated_at', startDateTime)
      .lte('updated_at', endDateTime);

    if (coralError) throw coralError;

    const patrol_activity_count = coralUpdates?.length || 0;

    const threats = {};
    coralUpdates?.forEach(update => {
      if (update.threat_level) {
        threats[update.threat_level] = (threats[update.threat_level] || 0) + 1;
      }
    });

    const { data: ecoActions, error: ecoError } = await supabase
      .from('eco_action_submissions')
      .select('verified')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    if (ecoError) throw ecoError;

    const totalActions = ecoActions?.length || 0;
    const verifiedActions = ecoActions?.filter(action => action.verified).length || 0;
    const complianceRate = totalActions > 0 ? ((verifiedActions / totalActions) * 100).toFixed(1) : 0;

    const uniqueRangers = [...new Set(coralUpdates?.map(u => u.ranger_id))];

    const ranger_logs_summary = {
      total_updates: patrol_activity_count,
      unique_rangers: uniqueRangers.length,
      active_sites: [...new Set(coralUpdates?.map(u => u.qr_id))].length
    };

    const violations_count = 0;
    const violations_details = [];

    const eco_action_compliance = {
      total_actions: totalActions,
      verified_actions: verifiedActions,
      compliance_rate: complianceRate + '%',
      pending_verification: totalActions - verifiedActions
    };

    return {
      ranger_logs_summary,
      patrol_activity_count,
      threat_observations: threats,
      violations_count,
      violations_details,
      eco_action_compliance
    };

  } catch (err) {
    console.error('Error generating MPA report data:', err);
    return null;
  }
};

// Create MPA report
const createReport = async () => {
  try {
    loading.value = true;
    error.value = '';
    success.value = '';

    if (!reportName.value.trim() || !reportPeriod.value.trim()) {
      error.value = 'Report name and period are required';
      return;
    }
    if (!startDate.value || !endDate.value) {
      error.value = 'Start and end dates are required';
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const reportData = await generateMPAReportData();
    if (!reportData) {
      error.value = 'Failed to generate report data';
      return;
    }

    const { data, error: insertError } = await supabase
      .from('mpa_reports')
      .insert({
        report_name: reportName.value,
        report_period: reportPeriod.value,
        start_date: new Date(startDate.value).toISOString(),
        end_date: new Date(endDate.value).toISOString(),
        ranger_logs_summary: reportData.ranger_logs_summary,
        patrol_activity_count: reportData.patrol_activity_count,
        threat_observations: reportData.threat_observations,
        violations_count: reportData.violations_count,
        violations_details: reportData.violations_details,
        eco_action_compliance: reportData.eco_action_compliance,
        generated_by: user.id,
        submitted_to: submittedTo.value,
        status: 'draft'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    success.value = 'MPA Compliance Report generated successfully!';
    
    reportName.value = '';
    reportPeriod.value = '';
    startDate.value = '';
    endDate.value = '';
    submittedTo.value = 'DENR';
    
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
const viewReport = (report) => {
  selectedReport.value = report;
  showViewModal.value = true;
};

// Update report status
const updateStatus = async (report, newStatus) => {
  try {
    loading.value = true;
    const { error: updateError } = await supabase
      .from('mpa_reports')
      .update({ status: newStatus })
      .eq('id', report.id);

    if (updateError) throw updateError;

    success.value = `Report status updated to: ${newStatus}`;
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
  if (!confirm('Are you sure you want to delete this MPA report?')) return;

  try {
    loading.value = true;
    const { error: deleteError } = await supabase
      .from('mpa_reports')
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

// Download report as PDF (DENR/BFAR format)
const downloadReportPDF = async (report) => {
  try {
    loading.value = true;
    
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
    
    // Official Header - Philippine Government Format
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Republic of the Philippines', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    
    // Agency name based on submission
    let agencyName = '';
    if (report.submitted_to === 'DENR') {
      agencyName = 'Department of Environment and Natural Resources';
    } else if (report.submitted_to === 'BFAR') {
      agencyName = 'Bureau of Fisheries and Aquatic Resources';
    } else if (report.submitted_to === 'LGU') {
      agencyName = 'Local Government Unit';
    } else {
      agencyName = 'Marine Protected Area Management';
    }
    
    doc.text(agencyName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('Coastal and Marine Management Office', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // Document Title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('MARINE PROTECTED AREA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    doc.text('COMPLIANCE AND MONITORING REPORT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;
    
    // Document Details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Report No.: MPA-${report.id}`, 20, yPos);
    yPos += 7;
    doc.text(`Report Period: ${report.report_period}`, 20, yPos);
    yPos += 7;
    doc.text(`Covering: ${new Date(report.start_date).toLocaleDateString('en-PH')} to ${new Date(report.end_date).toLocaleDateString('en-PH')}`, 20, yPos);
    yPos += 7;
    doc.text(`Date Generated: ${new Date(report.created_at).toLocaleDateString('en-PH')}`, 20, yPos);
    yPos += 7;
    doc.text(`Status: ${report.status.toUpperCase()}`, 20, yPos);
    yPos += 7;
    doc.text(`Submitted to: ${report.submitted_to}`, 20, yPos);
    yPos += 12;
    
    // PART I: RANGER PATROL ACTIVITIES
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('PART I: RANGER PATROL ACTIVITIES', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    if (report.ranger_logs_summary) {
      doc.text(`A. Summary of Patrol Activities`, 25, yPos);
      yPos += 6;
      doc.text(`   Total Patrol Updates Recorded: ${report.patrol_activity_count}`, 30, yPos);
      yPos += 6;
      doc.text(`   Number of Active Rangers: ${report.ranger_logs_summary.unique_rangers}`, 30, yPos);
      yPos += 6;
      doc.text(`   Monitoring Sites Covered: ${report.ranger_logs_summary.active_sites}`, 30, yPos);
      yPos += 10;
    }
    
    // PART II: THREAT OBSERVATIONS AND ENVIRONMENTAL CONDITIONS
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('PART II: THREAT OBSERVATIONS AND ENVIRONMENTAL CONDITIONS', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    if (report.threat_observations && Object.keys(report.threat_observations).length > 0) {
      doc.text(`A. Documented Threats by Level:`, 25, yPos);
      yPos += 6;
      
      for (const [threat, count] of Object.entries(report.threat_observations)) {
        doc.text(`   • ${threat.toUpperCase()} Threat Level: ${count} recorded incidents`, 30, yPos);
        yPos += 6;
      }
      yPos += 4;
    } else {
      doc.text(`A. Threat Observations:`, 25, yPos);
      yPos += 6;
      doc.text(`   No significant threats were observed during the reporting period.`, 30, yPos);
      yPos += 10;
    }
    
    // PART III: VIOLATIONS AND ENFORCEMENT ACTIONS
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('PART III: VIOLATIONS AND ENFORCEMENT ACTIONS', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`A. Total Violations Recorded: ${report.violations_count}`, 25, yPos);
    yPos += 6;
    
    if (report.violations_count === 0) {
      doc.text(`   No violations were reported during this period.`, 30, yPos);
      yPos += 10;
    } else if (report.violations_details && report.violations_details.length > 0) {
      doc.text(`B. Violation Details:`, 25, yPos);
      yPos += 6;
      // Add violation details if available
      yPos += 4;
    }
    
    // Check if new page needed
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = 20;
    }
    
    // PART IV: ECO-ACTION COMPLIANCE
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('PART IV: ECO-ACTION COMPLIANCE AND COMMUNITY ENGAGEMENT', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    if (report.eco_action_compliance) {
      doc.text(`A. Eco-Action Program Summary:`, 25, yPos);
      yPos += 6;
      doc.text(`   Total Eco-Actions Submitted: ${report.eco_action_compliance.total_actions}`, 30, yPos);
      yPos += 6;
      doc.text(`   Verified Actions: ${report.eco_action_compliance.verified_actions}`, 30, yPos);
      yPos += 6;
      doc.text(`   Pending Verification: ${report.eco_action_compliance.pending_verification}`, 30, yPos);
      yPos += 6;
      doc.text(`   Compliance Rate: ${report.eco_action_compliance.compliance_rate}`, 30, yPos);
      yPos += 10;
    }
    
    // PART V: ASSESSMENT AND RECOMMENDATIONS
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('PART V: ASSESSMENT AND RECOMMENDATIONS', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`A. Overall Assessment:`, 25, yPos);
    yPos += 6;
    
    // Generate assessment based on data
    let assessment = '';
    if (report.patrol_activity_count > 50) {
      assessment = 'High level of monitoring activity with consistent ranger presence.';
    } else if (report.patrol_activity_count > 20) {
      assessment = 'Moderate monitoring activity maintained throughout the period.';
    } else {
      assessment = 'Limited monitoring activity; increased patrol frequency recommended.';
    }
    
    const assessmentLines = doc.splitTextToSize(assessment, pageWidth - 60);
    doc.text(assessmentLines, 30, yPos);
    yPos += (assessmentLines.length * 6) + 6;
    
    doc.text(`B. Recommendations:`, 25, yPos);
    yPos += 6;
    doc.text(`   • Continue regular patrol monitoring activities`, 30, yPos);
    yPos += 6;
    doc.text(`   • Enhance community engagement through eco-action programs`, 30, yPos);
    yPos += 6;
    doc.text(`   • Maintain documentation and reporting compliance`, 30, yPos);
    yPos += 12;
    
    // Check if new page needed for signatures
    if (yPos > pageHeight - 70) {
      doc.addPage();
      yPos = 20;
    }
    
    // CERTIFICATION AND SIGNATURES
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('CERTIFICATION', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const certText = 'This is to certify that the information contained in this report is true and correct based on available records and monitoring data.';
    const certLines = doc.splitTextToSize(certText, pageWidth - 40);
    doc.text(certLines, 20, yPos);
    yPos += (certLines.length * 6) + 15;
    
    // Signatures Section
    const sigYPos = pageHeight - 50;
    
    // Prepared by
    doc.setFontSize(10);
    doc.text('Prepared by:', 20, sigYPos);
    doc.line(20, sigYPos + 15, 80, sigYPos + 15);
    doc.text('MPA Coordinator/Ranger', 25, sigYPos + 20);
    doc.text('Date: _______________', 20, sigYPos + 26);
    
    // Reviewed by
    doc.text('Reviewed by:', pageWidth / 2 + 10, sigYPos);
    doc.line(pageWidth / 2 + 10, sigYPos + 15, pageWidth / 2 + 70, sigYPos + 15);
    doc.text('MPA Manager/Supervisor', pageWidth / 2 + 15, sigYPos + 20);
    doc.text('Date: _______________', pageWidth / 2 + 10, sigYPos + 26);
    
    // Footer with document control number
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.text(`Document Control No.: MPA-${report.submitted_to}-${new Date(report.created_at).getFullYear()}-${String(report.id).padStart(4, '0')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Save PDF
    const filename = `MPA-Compliance-Report-${report.report_period.replace(/\s+/g, '-')}-${report.submitted_to}.pdf`;
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

// Get status badge color
const getStatusColor = (status) => {
  const colors = {
    draft: 'gray',
    submitted: 'blue',
    approved: 'green'
  };
  return colors[status] || 'gray';
};

// Set default dates (last quarter)
const setDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  
  endDate.value = end.toISOString().split('T')[0];
  startDate.value = start.toISOString().split('T')[0];
  
  const quarter = Math.floor((end.getMonth() + 3) / 3);
  const year = end.getFullYear();
  reportPeriod.value = `Q${quarter} ${year}`;
};

onMounted(() => {
  fetchReports();
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
        <h2 class="text-2xl font-bold text-gray-800">📋 MPA Compliance Reports</h2>
        <p class="text-gray-600 mt-1">Generate official reports for DENR, BFAR, and LGU compliance</p>
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
          <div class="text-4xl">📄</div>
          <span 
            :class="`bg-${getStatusColor(report.status)}-100 text-${getStatusColor(report.status)}-800`"
            class="text-xs font-medium px-2.5 py-1 rounded capitalize"
          >
            {{ report.status }}
          </span>
        </div>

        <h3 class="text-xl font-bold text-gray-800 mb-2">{{ report.report_name }}</h3>
        
        <div class="space-y-2 mb-4 text-sm text-gray-600">
          <div class="flex items-center space-x-2">
            <span>📅</span>
            <span>{{ report.report_period }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span>📍</span>
            <span>{{ report.submitted_to }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span>🚨</span>
            <span>{{ report.patrol_activity_count }} activities</span>
          </div>
        </div>

        <div class="space-y-2">
          <button
            @click="viewReport(report)"
            class="w-full bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            View Report
          </button>
          
          <div class="flex space-x-2">
            <button
              v-if="report.status === 'draft'"
              @click="updateStatus(report, 'submitted')"
              class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Submit
            </button>
            <button
              v-if="report.status === 'submitted'"
              @click="updateStatus(report, 'approved')"
              class="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Approve
            </button>
            <button
              @click="downloadReportPDF(report)"
              :disabled="loading"
              class="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              title="Download PDF"
            >
              📄 PDF
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
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 bg-white rounded-xl shadow-md">
      <div class="text-6xl mb-4">📋</div>
      <h3 class="text-xl font-bold text-gray-800 mb-2">No MPA Reports Yet</h3>
      <p class="text-gray-600 mb-6">Generate your first compliance report for DENR/BFAR</p>
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
          <h3 class="text-2xl font-bold text-gray-800">Generate MPA Compliance Report</h3>
          <button
            @click="showCreateModal = false"
            class="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <div class="space-y-4">
          <!-- Report Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Report Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="reportName"
              type="text"
              required
              placeholder="e.g., Q1 2025 MPA Compliance Report"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          <!-- Report Period -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Report Period <span class="text-red-500">*</span>
            </label>
            <input
              v-model="reportPeriod"
              type="text"
              required
              placeholder="e.g., Q1 2025, January-March 2025"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
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

          <!-- Submitted To -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Submitted To</label>
            <select
              v-model="submittedTo"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            >
              <option value="DENR">DENR (Department of Environment and Natural Resources)</option>
              <option value="BFAR">BFAR (Bureau of Fisheries and Aquatic Resources)</option>
              <option value="LGU">LGU (Local Government Unit)</option>
              <option value="Multiple">Multiple Agencies</option>
            </select>
          </div>

          <!-- Info Box -->
          <div class="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <p class="text-sm text-cyan-800">
              <span class="font-semibold">ℹ️ Official Format:</span>
              <br>Reports will be generated in official Philippine government format with proper headers, certification sections, and document control numbers suitable for DENR/BFAR submission.
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
              @click="createReport"
              :disabled="loading"
              class="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              {{ loading ? 'Generating...' : 'Generate Report' }}
            </button>
          </div>
        </div>
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
          <!-- Report Header -->
          <div class="grid grid-cols-3 gap-4">
            <div class="bg-gray-50 p-4 rounded-lg">
              <p class="text-sm text-gray-600 mb-1">Report Period</p>
              <p class="font-semibold text-gray-800">{{ selectedReport.report_period }}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <p class="text-sm text-gray-600 mb-1">Submitted To</p>
              <p class="font-semibold text-gray-800">{{ selectedReport.submitted_to }}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <p class="text-sm text-gray-600 mb-1">Status</p>
              <p :class="`font-semibold text-${getStatusColor(selectedReport.status)}-600 capitalize`">
                {{ selectedReport.status }}
              </p>
            </div>
          </div>

          <!-- Ranger Activity Summary -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h4 class="text-lg font-bold text-gray-800 mb-4">🚨 Ranger Activity Summary</h4>
            <div class="grid grid-cols-3 gap-4">
              <div class="text-center p-4 bg-cyan-50 rounded-lg">
                <p class="text-3xl font-bold text-cyan-600">{{ selectedReport.patrol_activity_count }}</p>
                <p class="text-sm text-gray-600 mt-1">Total Patrol Activities</p>
              </div>
              <div class="text-center p-4 bg-blue-50 rounded-lg">
                <p class="text-3xl font-bold text-blue-600">
                  {{ selectedReport.ranger_logs_summary?.unique_rangers || 0 }}
                </p>
                <p class="text-sm text-gray-600 mt-1">Active Rangers</p>
              </div>
              <div class="text-center p-4 bg-purple-50 rounded-lg">
                <p class="text-3xl font-bold text-purple-600">
                  {{ selectedReport.ranger_logs_summary?.active_sites || 0 }}
                </p>
                <p class="text-sm text-gray-600 mt-1">Monitored Sites</p>
              </div>
            </div>
          </div>

          <!-- Threat Observations -->
          <div v-if="selectedReport.threat_observations && Object.keys(selectedReport.threat_observations).length > 0" 
               class="bg-white border border-gray-200 rounded-lg p-6">
            <h4 class="text-lg font-bold text-gray-800 mb-4">⚠️ Threat Observations</h4>
            <div class="space-y-2">
              <div
                v-for="(count, threat) in selectedReport.threat_observations"
                :key="threat"
                class="flex items-center justify-between p-3 bg-yellow-50 rounded-lg"
              >
                <span class="font-medium text-gray-700 capitalize">{{ threat }} Threat Level</span>
                <span class="text-yellow-600 font-bold">{{ count }} incidents</span>
              </div>
            </div>
          </div>

          <!-- Eco-Action Compliance -->
          <div v-if="selectedReport.eco_action_compliance" class="bg-white border border-gray-200 rounded-lg p-6">
            <h4 class="text-lg font-bold text-gray-800 mb-4">✅ Eco-Action Compliance</h4>
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-green-50 p-4 rounded-lg">
                <p class="text-sm text-gray-600 mb-1">Compliance Rate</p>
                <p class="text-3xl font-bold text-green-600">
                  {{ selectedReport.eco_action_compliance.compliance_rate }}
                </p>
              </div>
              <div class="bg-gray-50 p-4 rounded-lg">
                <p class="text-sm text-gray-600 mb-1">Total Actions</p>
                <p class="text-2xl font-bold text-gray-800">
                  {{ selectedReport.eco_action_compliance.total_actions }}
                </p>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-4">
              <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span class="text-sm text-gray-600">Verified Actions</span>
                <span class="font-bold text-green-600">
                  {{ selectedReport.eco_action_compliance.verified_actions }}
                </span>
              </div>
              <div class="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <span class="text-sm text-gray-600">Pending Verification</span>
                <span class="font-bold text-yellow-600">
                  {{ selectedReport.eco_action_compliance.pending_verification }}
                </span>
              </div>
            </div>
          </div>

          <!-- Violations -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h4 class="text-lg font-bold text-gray-800 mb-4">🚫 Violations Tracking</h4>
            <div class="text-center p-6 bg-red-50 rounded-lg">
              <p class="text-4xl font-bold text-red-600">{{ selectedReport.violations_count }}</p>
              <p class="text-sm text-gray-600 mt-2">Total Violations Reported</p>
            </div>
          </div>

          <!-- Date Range -->
          <div class="bg-gray-50 p-4 rounded-lg text-center">
            <p class="text-sm text-gray-600">
              Report Period: 
              <span class="font-semibold">
                {{ new Date(selectedReport.start_date).toLocaleDateString() }} - 
                {{ new Date(selectedReport.end_date).toLocaleDateString() }}
              </span>
            </p>
          </div>

          <!-- Actions -->
          <div class="flex space-x-3 pt-4">
            <button
              v-if="selectedReport.status === 'draft'"
              @click="updateStatus(selectedReport, 'submitted'); showViewModal = false;"
              class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-medium transition"
            >
              Submit Report
            </button>
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