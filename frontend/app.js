const API_BASE = window.location.origin;
let sessionToken = localStorage.getItem("session_token") || "";
let currentUsername = localStorage.getItem("username") || "";

// Intercept fetch to handle 401 session expiration automatically
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const res = await originalFetch.apply(this, args);
    if (res.status === 401 && !args[0].includes("/api/login") && !args[0].includes("/api/register")) {
        localStorage.removeItem("session_token");
        localStorage.removeItem("username");
        sessionToken = "";
        currentUsername = "";
        showAuth();
    }
    return res;
};

// Active Tab state
let currentTab = "dashboard";

// Spreadsheet Grid default configuration
let currentGridCampaign = "finance";
let gridData = [];

// Templates cache
let templatesData = {};

// Kanban Tracker drag-and-drop state
let draggedCard = null;

// Initial setup on window load
window.addEventListener("load", () => {
    updateTime();
    setInterval(updateTime, 60000);
    
    if (sessionToken) {
        showApp();
    } else {
        showAuth();
    }
});

// Auto time update in header
function updateTime() {
    const timeBadge = document.getElementById("current-time-badge");
    if (timeBadge) {
        const now = new Date();
        const formatted = now.toISOString().replace("T", " ").substring(0, 16);
        timeBadge.textContent = formatted;
    }
}

// --- Navigation & UI Switchers ---

function switchAuthTab(type) {
    document.getElementById("tab-btn-login").classList.toggle("active", type === 'login');
    document.getElementById("tab-btn-register").classList.toggle("active", type === 'register');
    document.getElementById("auth-submit-btn").textContent = type === 'login' ? 'Sign In' : 'Register';
    
    // Clear alerts
    document.getElementById("auth-error").classList.add("hidden");
    document.getElementById("auth-success").classList.add("hidden");
}

function showAuth() {
    document.getElementById("auth-container").classList.remove("hidden");
    document.getElementById("app-container").classList.add("hidden");
}

function showApp() {
    document.getElementById("auth-container").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
    document.getElementById("display-username").textContent = currentUsername || "Varun Bhardwaj";
    
    // Load default tab
    switchTab("dashboard");
    
    // Periodically sync worker status if sending
    startStatusPolling();
}

function switchTab(tabId) {
    currentTab = tabId;
    
    // Update sidebar menus
    document.querySelectorAll(".menu-item").forEach(item => {
        item.classList.remove("active");
    });
    const menuEl = document.getElementById(`menu-${tabId}`);
    if (menuEl) menuEl.classList.add("active");
    
    // Update content headers
    const titles = {
        dashboard: "Dashboard & Outreach Status",
        tracker: "Application Tracker Kanban",
        leads: "Outreach Lead Manager",
        templates: "Personal Template Studio",
        settings: "Settings & Resumes"
    };
    document.getElementById("tab-title").textContent = titles[tabId] || "Dashboard";
    
    // Hide all panels, show active
    document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.classList.add("hidden");
    });
    document.getElementById(`tab-content-${tabId}`).classList.remove("hidden");
    
    // Load tab-specific API data
    if (tabId === "dashboard") {
        loadDashboardStats();
    } else if (tabId === "tracker") {
        loadKanbanCards();
    } else if (tabId === "leads") {
        loadLeadsGrid();
        refreshScheduleQueue();
    } else if (tabId === "templates") {
        loadTemplatesTab();
    } else if (tabId === "settings") {
        loadSettingsTab();
    }
}


// --- Auth & Session Logic ---

async function handleAuth(e) {
    e.preventDefault();
    const user = document.getElementById("auth-username").value.trim();
    const pass = document.getElementById("auth-password").value.trim();
    const submitBtn = document.getElementById("auth-submit-btn");
    const isLogin = submitBtn.textContent === "Sign In";
    
    const errEl = document.getElementById("auth-error");
    const succEl = document.getElementById("auth-success");
    errEl.classList.add("hidden");
    succEl.classList.add("hidden");
    
    const url = isLogin ? "/api/login" : "/api/register";
    
    try {
        const response = await fetch(API_BASE + url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        let data;
        try {
            data = await response.json();
        } catch (jsonErr) {
            throw new Error(`Server Error (${response.status}): ${response.statusText || "Request failed"}`);
        }
        
        if (!response.ok) {
            throw new Error(data.detail || "Authentication request failed.");
        }
        
        if (isLogin) {
            sessionToken = data.token;
            currentUsername = data.username;
            localStorage.setItem("session_token", sessionToken);
            localStorage.setItem("username", currentUsername);
            showApp();
        } else {
            succEl.textContent = "Registration successful! You can sign in now.";
            succEl.classList.remove("hidden");
            switchAuthTab("login");
        }
        
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
    }
}

async function handleLogout() {
    try {
        await fetch(API_BASE + "/api/logout", {
            method: "POST",
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
    } catch (e) {}
    
    sessionToken = "";
    currentUsername = "";
    localStorage.removeItem("session_token");
    localStorage.removeItem("username");
    showAuth();
}

function getAuthHeaders() {
    return {
        "Authorization": `Bearer ${sessionToken}`,
        "Content-Type": "application/json"
    };
}


// --- Settings & SMTP & Attachments Locker ---

async function loadSettingsTab() {
    const form = document.getElementById("settings-form");
    
    try {
        const response = await fetch(API_BASE + "/api/settings", {
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById("settings-sender-name").value = data.sender_name || "";
            document.getElementById("settings-sender-phone").value = data.sender_phone || "";
            document.getElementById("settings-gmail-user").value = data.gmail_user || "";
            document.getElementById("settings-gmail-password").value = data.gmail_app_password || "";
            document.getElementById("settings-public-url").value = data.public_url || "http://127.0.0.1:8001";
            
            updateEmergencyButton(data.emergency_stop);
            
            // Check SMTP visual state
            const smtpDot = document.getElementById("smtp-status-dot");
            const smtpText = document.getElementById("smtp-status-text");
            if (data.gmail_user && data.gmail_app_password) {
                smtpDot.classList.add("active");
                smtpText.textContent = `Configured for ${data.gmail_user}`;
            } else {
                smtpDot.classList.remove("active");
                smtpText.textContent = "Not Verified - Configure settings to test connection";
            }
        }
    } catch (err) {
        console.error("Failed to load settings", err);
    }
    
    loadAttachmentsList();
}

async function saveSettings(e) {
    e.preventDefault();
    const payload = {
        sender_name: document.getElementById("settings-sender-name").value.trim(),
        sender_phone: document.getElementById("settings-sender-phone").value.trim(),
        gmail_user: document.getElementById("settings-gmail-user").value.trim(),
        gmail_app_password: document.getElementById("settings-gmail-password").value.trim(),
        public_url: document.getElementById("settings-public-url").value.trim()
    };
    
    try {
        const res = await fetch(API_BASE + "/api/settings", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            alert("Settings updated successfully!");
            loadSettingsTab();
        } else {
            alert("Error: " + data.detail);
        }
    } catch (err) {
        alert("Failed to save settings: " + err.message);
    }
}

async function runSmtpTest() {
    const emailInput = document.getElementById("test-smtp-email").value.trim();
    const resultEl = document.getElementById("smtp-test-result");
    
    if (!emailInput) {
        alert("Enter a recipient email first.");
        return;
    }
    
    resultEl.textContent = "Sending test email, please wait...";
    resultEl.className = "alert alert-info";
    resultEl.classList.remove("hidden");
    
    try {
        const res = await fetch(API_BASE + "/api/settings/test-smtp", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ recipient_email: emailInput })
        });
        const data = await res.json();
        if (res.ok) {
            resultEl.textContent = "SMTP Test passed! Check your inbox.";
            resultEl.className = "alert alert-success";
        } else {
            resultEl.textContent = "SMTP Test failed: " + data.detail;
            resultEl.className = "alert alert-danger";
        }
    } catch (e) {
        resultEl.textContent = "Connection Error: " + e.message;
        resultEl.className = "alert alert-danger";
    }
}

// Emergency stop controls
async function toggleEmergencyStop() {
    try {
        const res = await fetch(API_BASE + "/api/settings/toggle-stop", {
            method: "POST",
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        const data = await res.json();
        if (res.ok) {
            updateEmergencyButton(data.emergency_stop);
        }
    } catch (e) {
        console.error("Failed to toggle emergency stop", e);
    }
}

function updateEmergencyButton(active) {
    const btn = document.getElementById("emergency-btn");
    const banner = document.getElementById("stop-banner");
    
    if (active) {
        btn.textContent = "🔓 DEACTIVATE EMERGENCY LOCKDOWN";
        btn.className = "btn btn-success btn-block";
        if (banner) banner.classList.remove("hidden");
    } else {
        btn.textContent = "🚨 ACTIVATE EMERGENCY LOCKDOWN";
        btn.className = "btn btn-danger btn-block";
        if (banner) banner.classList.add("hidden");
    }
}

// CV Files Lockers
async function loadAttachmentsList() {
    const listEl = document.getElementById("uploaded-files-list");
    listEl.innerHTML = "<li>Loading files...</li>";
    
    try {
        const res = await fetch(API_BASE + "/api/attachments", {
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        const files = await res.json();
        
        listEl.innerHTML = "";
        
        const labels = {
            finance: "Finance CV",
            consulting: "Consulting CV",
            marketing: "Marketing CV",
            tech: "Tech Resume",
            all_purpose: "All-Purpose CV"
        };
        
        if (files.length === 0) {
            listEl.innerHTML = "<li>No resumes uploaded yet. Choose a stream and select a file to upload.</li>";
            return;
        }
        
        files.forEach(f => {
            const li = document.createElement("li");
            const dateStr = f.uploaded_at.substring(0, 16).replace("T", " ");
            li.innerHTML = `
                <div class="file-details">
                    <span class="file-name">${labels[f.campaign_id] || f.campaign_id}</span>
                    <span class="file-meta">${f.file_name} • Uploaded at: ${dateStr}</span>
                </div>
                <button class="delete-file-btn" onclick="deleteAttachment('${f.campaign_id}')" title="Delete Resume">🗑️</button>
            `;
            listEl.appendChild(li);
        });
    } catch (err) {
        listEl.innerHTML = "<li>Failed to load attachments list.</li>";
    }
}

async function handleFileSelected(e) {
    const campaignId = document.getElementById("attachment-campaign-select").value;
    const file = e.target.files[0];
    const statusEl = document.getElementById("upload-status");
    
    if (!file) return;
    
    statusEl.textContent = "Uploading resume, please wait...";
    statusEl.className = "alert alert-info";
    statusEl.classList.remove("hidden");
    
    const formData = new FormData();
    formData.append("campaign_id", campaignId);
    formData.append("file", file);
    
    try {
        const res = await fetch(API_BASE + "/api/attachments/upload", {
            method: "POST",
            headers: { "Authorization": `Bearer ${sessionToken}` },
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            statusEl.textContent = `Successfully uploaded resume for ${campaignId}!`;
            statusEl.className = "alert alert-success";
            loadAttachmentsList();
        } else {
            statusEl.textContent = "Upload failed: " + data.detail;
            statusEl.className = "alert alert-danger";
        }
    } catch (err) {
        statusEl.textContent = "Network Error: " + err.message;
        statusEl.className = "alert alert-danger";
    }
    
    // Clear input
    e.target.value = "";
    setTimeout(() => { statusEl.classList.add("hidden"); }, 4000);
}

async function deleteAttachment(campaignId) {
    if (!confirm(`Are you sure you want to delete the CV for the ${campaignId} campaign?`)) return;
    try {
        const res = await fetch(`${API_BASE}/api/attachments/${campaignId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        if (res.ok) {
            loadAttachmentsList();
        }
    } catch (e) {
        alert("Failed to delete attachment: " + e.message);
    }
}


// --- Lead Manager Spreadsheet Grid ---

const CAMPAIGN_HEADERS = {
    finance: ["Recipient Email *", "First Name", "Company Name *", "Role Type (Job / Internship) *", "Target Division *", "Custom Experience Detail"],
    consulting: ["Recipient Email *", "First Name", "Company Name *", "Role Type (Job / Internship) *", "Target Division *", "Target Client Focus"],
    marketing: ["Recipient Email *", "First Name", "Company Name *", "Role Type (Job / Internship) *", "Target Division *", "Campaign/Product Highlight"],
    tech: ["Recipient Email *", "First Name", "Company Name *", "Role Type (Job / Internship) *", "Target Division *", "Preferred Tech Stack Highlight"],
    all_purpose: ["Recipient Email *", "First Name", "Company Name *", "Role Type (Job / Internship) *", "Target Division *", "Custom Note Placeholder"]
};

function loadLeadsGrid() {
    const campaignId = document.getElementById("lead-campaign-select").value;
    currentGridCampaign = campaignId;
    
    // Reset date to today's date if not set
    const dateInput = document.getElementById("lead-start-date");
    if (!dateInput.value) {
        dateInput.value = new Date().toISOString().substring(0, 10);
    }
    
    // Set headers
    const headerRow = document.getElementById("spreadsheet-header");
    headerRow.innerHTML = "<th>#</th>";
    CAMPAIGN_HEADERS[campaignId].forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        headerRow.appendChild(th);
    });
    headerRow.innerHTML += "<th>Start Step</th><th>Action</th>";
    
    // Empty spreadsheet data and draw blank rows
    gridData = [];
    clearGrid();
}

function clearGrid() {
    const tbody = document.getElementById("spreadsheet-tbody");
    tbody.innerHTML = "";
    gridData = [];
    // Spawn 5 default empty rows
    for (let i = 0; i < 5; i++) {
        addGridRow();
    }
}

function addGridRow() {
    const tbody = document.getElementById("spreadsheet-tbody");
    const index = gridData.length + 1;
    
    const rowObj = {
        email: "",
        first_name: "",
        company: "",
        role: "Internship",
        custom_field_1: "",
        custom_field_2: "",
        start_from: "initial"
    };
    gridData.push(rowObj);
    
    const tr = document.createElement("tr");
    tr.id = `grid-row-${index}`;
    
    // Index number
    tr.innerHTML = `<td>${index}</td>`;
    
    // Email cell
    tr.appendChild(createEditableCell(index, "email", "e.g. hr@ey.com"));
    // First Name
    tr.appendChild(createEditableCell(index, "first_name", "e.g. John"));
    // Company Name
    tr.appendChild(createEditableCell(index, "company", "e.g. EY"));
    // Role Type (Job/Internship)
    tr.appendChild(createDropdownCell(index, "role", ["Internship", "Job"]));
    // Target Division
    tr.appendChild(createEditableCell(index, "custom_field_1", "e.g. Valuations Division"));
    // Custom experience/note field
    tr.appendChild(createEditableCell(index, "custom_field_2", "e.g. highlights"));
    
    // Start step key
    tr.appendChild(createDropdownCell(index, "start_from", ["initial", "f1", "f2", "f3", "f4"]));
    
    // Action delete button
    const deleteTd = document.createElement("td");
    deleteTd.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="removeGridRow(${index})" style="padding: 2px 6px;">✕</button>`;
    tr.appendChild(deleteTd);
    
    tbody.appendChild(tr);
}

function removeGridRow(index) {
    const tr = document.getElementById(`grid-row-${index}`);
    if (tr) tr.remove();
}

function createEditableCell(rowIndex, fieldKey, placeholder = "") {
    const td = document.createElement("td");
    const div = document.createElement("div");
    div.contentEditable = "true";
    div.setAttribute("placeholder", placeholder);
    div.style.minWidth = "120px";
    div.addEventListener("input", (e) => {
        gridData[rowIndex - 1][fieldKey] = e.target.innerText.trim();
    });
    td.appendChild(div);
    return td;
}

function createDropdownCell(rowIndex, fieldKey, options) {
    const td = document.createElement("td");
    const select = document.createElement("select");
    select.style.padding = "4px";
    select.style.background = "rgba(10, 13, 22, 0.8)";
    select.style.border = "1px solid var(--border-color)";
    select.style.color = "white";
    select.style.borderRadius = "6px";
    
    options.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
    
    select.value = gridData[rowIndex - 1][fieldKey];
    select.addEventListener("change", (e) => {
        gridData[rowIndex - 1][fieldKey] = e.target.value;
    });
    td.appendChild(select);
    return td;
}

async function bulkSaveLeads() {
    const startDate = document.getElementById("lead-start-date").value;
    if (!startDate) {
        alert("Please select a Campaign Start Date.");
        return;
    }
    
    const leadsToSend = [];
    const rows = document.querySelectorAll("#spreadsheet-tbody tr");
    
    rows.forEach(row => {
        const inputs = row.querySelectorAll("div[contenteditable='true']");
        const selects = row.querySelectorAll("select");
        
        if (inputs.length >= 4 && selects.length >= 2) {
            const email = inputs[0].innerText.trim();
            const first_name = inputs[1].innerText.trim();
            const company = inputs[2].innerText.trim();
            const role = selects[0].value;
            const custom_field_1 = inputs[3].innerText.trim();
            const custom_field_2 = inputs[4].innerText.trim();
            const start_from = selects[1].value;
            
            if (email) {
                leadsToSend.push({
                    email,
                    first_name,
                    company,
                    role,
                    custom_field_1,
                    custom_field_2,
                    start_from
                });
            }
        }
    });
    
    if (leadsToSend.length === 0) {
        alert("Enter at least one lead with a valid email address.");
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let errors = [];
    let warnings = [];
    
    leadsToSend.forEach((lead, idx) => {
        const rowNum = idx + 1;
        if (!emailRegex.test(lead.email.trim())) {
            errors.push(`Row ${rowNum}: '${lead.email}' is not a valid email address.`);
        }
        if (!lead.first_name || lead.first_name.trim() === "") {
            warnings.push(`Row ${rowNum}: First Name is missing.`);
        }
        if (!lead.company || lead.company.trim() === "") {
            warnings.push(`Row ${rowNum}: Company Name is missing.`);
        }
    });

    if (errors.length > 0) {
        alert("Please fix the following validation errors before saving:\n\n" + errors.join("\n"));
        return;
    }

    if (warnings.length > 0) {
        const proceed = confirm("Warnings found in your leads list:\n\n" + warnings.join("\n") + "\n\nDo you still want to save and generate schedules?");
        if (!proceed) return;
    }
    
    const payload = {
        campaign_id: currentGridCampaign,
        leads: leadsToSend,
        start_date: startDate,
        offsets: { initial: 0, f1: 3, f2: 7, f3: 11, f4: 15 },
        replace_mode: false
    };
    
    try {
        const res = await fetch(API_BASE + "/api/schedule/bulk", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            alert(`Schedule generated successfully: ${data.message}`);
            clearGrid();
            refreshScheduleQueue();
            loadDashboardStats();
        } else {
            alert("Error scheduling leads: " + data.detail);
        }
    } catch (err) {
        alert("Failed to save: " + err.message);
    }
}

// Queue rendering & monitoring
let activeQueueData = [];

async function refreshScheduleQueue() {
    const tbody = document.getElementById("leads-queue-tbody");
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">Loading scheduled campaigns outbox...</td></tr>`;
    
    try {
        const res = await fetch(`${API_BASE}/api/schedule?campaign_id=${currentGridCampaign}`, {
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        const data = await res.json();
        
        activeQueueData = data;
        renderQueueTable(activeQueueData);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Failed to fetch outbox details: ${err.message}</td></tr>`;
    }
}

function renderQueueTable(items) {
    const tbody = document.getElementById("leads-queue-tbody");
    tbody.innerHTML = "";
    
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">No active schedule found for this campaign stream. Add leads above to generate it.</td></tr>`;
        return;
    }
    
    items.forEach(item => {
        const tr = document.createElement("tr");
        
        const badgeClasses = {
            Pending: "badge-info",
            Sent: "badge-success",
            Replied: "badge-warning",
            "Call Booked": "badge-success",
            Closed: "badge-muted",
            Failed: "badge-danger"
        };
        
        const statusBadge = `<span class="badge ${badgeClasses[item.status] || 'badge-muted'}">${item.status}</span>`;
        
        let actions = "";
        if (item.status === "Pending") {
            actions = `<button class="btn btn-secondary btn-sm" onclick="forceUpdateStatus('${item.email}', 'Closed')" style="padding: 2px 6px;">Close Out</button>`;
        } else if (item.status === "Sent") {
            actions = `
                <button class="btn btn-secondary btn-sm" onclick="forceUpdateStatus('${item.email}', 'Replied')" style="padding: 2px 6px;">Replied</button>
                <button class="btn btn-secondary btn-sm" onclick="forceUpdateStatus('${item.email}', 'Call Booked')" style="padding: 2px 6px; background: rgba(16,185,129,0.2); color:#10b981;">Booked</button>
            `;
        }
        
        const opens = item.open_count || 0;
        const clicks = item.click_count || 0;
        const trackingText = `<span style="color:#60a5fa;">👁️ ${opens}</span> &nbsp;&nbsp; <span style="color:#a855f7;">🔗 ${clicks}</span>`;
        
        tr.innerHTML = `
            <td>
                <strong>${item.first_name || 'HR Recruiter'}</strong><br>
                <span class="help-text">${item.email}</span>
            </td>
            <td>
                <strong>${item.company}</strong><br>
                <span class="help-text">${item.role} • ${item.custom_field_1 || ''}</span>
            </td>
            <td><code>${item.stage_step}</code></td>
            <td>${item.scheduled_date}</td>
            <td>${statusBadge}</td>
            <td>${trackingText}</td>
            <td style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.notes || ''}">
                ${item.notes || ''}
            </td>
            <td>${actions}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterQueueTable() {
    const q = document.getElementById("queue-search-input").value.toLowerCase().trim();
    if (!q) {
        renderQueueTable(activeQueueData);
        return;
    }
    const filtered = activeQueueData.filter(item => {
        return item.email.toLowerCase().includes(q) || 
               (item.first_name && item.first_name.toLowerCase().includes(q)) || 
               item.company.toLowerCase().includes(q) || 
               item.status.toLowerCase().includes(q);
    });
    renderQueueTable(filtered);
}

async function forceUpdateStatus(email, nextStatus) {
    const payload = {
        email,
        campaign_id: currentGridCampaign,
        status: nextStatus,
        notes: `Manually updated status to ${nextStatus}`
    };
    try {
        const res = await fetch(API_BASE + "/api/schedule/update-status", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            refreshScheduleQueue();
            loadDashboardStats();
        }
    } catch (e) {
        alert("Failed to update status: " + e.message);
    }
}

async function clearRemoteSchedule() {
    if (!confirm(`Are you absolutely sure you want to clear the entire outreach schedule database for ${currentGridCampaign}? This cannot be undone.`)) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/schedule/clear?campaign_id=${currentGridCampaign}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        if (res.ok) {
            refreshScheduleQueue();
            loadDashboardStats();
        }
    } catch (e) {
        alert("Error clearing queue: " + e.message);
    }
}

async function syncGmailReplies() {
    const btn = document.getElementById("sync-replies-btn");
    if (!btn) return;
    
    btn.disabled = true;
    btn.textContent = "⌛ Syncing Inbox...";
    
    try {
        const res = await fetch(API_BASE + "/api/schedule/sync-replies", {
            method: "POST",
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            refreshScheduleQueue();
            loadDashboardStats();
        } else {
            alert(`Sync failed: ${data.detail}`);
        }
    } catch (e) {
        alert("Failed to sync replies: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "📥 Sync Replies via Gmail";
    }
}


// --- Email Campaign Sending Engine Trigger ---

async function triggerManualSend() {
    const statusBox = document.getElementById("dashboard-send-status");
    const queueStatusBox = document.getElementById("queue-send-status");
    
    [statusBox, queueStatusBox].forEach(box => {
        if (box) {
            box.textContent = "Starting mailing worker thread...";
            box.className = "alert alert-info";
            box.classList.remove("hidden");
        }
    });
    
    try {
        const res = await fetch(API_BASE + "/api/schedule/send", {
            method: "POST",
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        const data = await res.json();
        
        if (res.ok) {
            [statusBox, queueStatusBox].forEach(box => {
                if (box) box.textContent = data.message;
            });
            startStatusPolling();
        } else {
            [statusBox, queueStatusBox].forEach(box => {
                if (box) {
                    box.textContent = "Engine Fail: " + data.detail;
                    box.className = "alert alert-danger";
                }
            });
        }
    } catch (e) {
        [statusBox, queueStatusBox].forEach(box => {
            if (box) {
                box.textContent = "Worker Error: " + e.message;
                box.className = "alert alert-danger";
            }
        });
    }
}

let statusPollInterval = null;

function startStatusPolling() {
    if (statusPollInterval) clearInterval(statusPollInterval);
    
    statusPollInterval = setInterval(async () => {
        if (!sessionToken) {
            clearInterval(statusPollInterval);
            return;
        }
        
        try {
            const res = await fetch(API_BASE + "/api/schedule/send-status", {
                headers: { "Authorization": `Bearer ${sessionToken}` }
            });
            const status = await res.json();
            
            const dot = document.getElementById("engine-status-dot");
            const text = document.getElementById("engine-status-text");
            const btn = document.getElementById("dashboard-send-btn");
            const statusBox = document.getElementById("dashboard-send-status");
            const queueStatusBox = document.getElementById("queue-send-status");
            
            if (status.is_sending) {
                if (dot) dot.classList.add("active");
                if (text) text.textContent = `Sending in progress: ${status.sent_count} / ${status.total_to_send} mails...`;
                if (btn) btn.disabled = true;
                
                [statusBox, queueStatusBox].forEach(box => {
                    if (box) {
                        box.className = "alert alert-info";
                        box.classList.remove("hidden");
                        box.textContent = `Running: ${status.current_log}`;
                    }
                });
            } else {
                if (dot) dot.classList.remove("active");
                if (text) text.textContent = "Manual Send Trigger (Engine Idle)";
                if (btn) btn.disabled = false;
                
                if (statusPollInterval) {
                    clearInterval(statusPollInterval);
                    statusPollInterval = null;
                }
                
                setTimeout(() => {
                    [statusBox, queueStatusBox].forEach(box => {
                        if (box) box.classList.add("hidden");
                    });
                }, 6000);
                
                loadDashboardStats();
                if (currentTab === "leads") refreshScheduleQueue();
            }
        } catch (e) {
            console.error("Worker polling failed", e);
        }
    }, 1500);
}


// --- Template Studio Studio Panel ---

async function loadTemplatesTab() {
    const campaignId = document.getElementById("template-campaign-select").value;
    const stepSelect = document.getElementById("template-step-select");
    
    stepSelect.innerHTML = `
        <option value="initial">Initial Outreach Mail</option>
        <option value="f1">Follow Up 1 (F1)</option>
        <option value="f2">Follow Up 2 (F2)</option>
        <option value="f3">Follow Up 3 (F3)</option>
        <option value="f4">Follow Up 4 (F4)</option>
    `;
    
    try {
        const res = await fetch(API_BASE + "/api/templates", {
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        const data = await res.json();
        
        templatesData = data;
        loadTemplateView();
    } catch (err) {
        console.error("Failed to load templates", err);
    }
}

function formatDoc(cmd) {
    if (cmd === 'createLink') {
        const url = prompt("Enter URL (e.g. https://calendly.com/varun-bhardwaj):");
        if (url) {
            document.execCommand(cmd, false, url);
        }
    } else {
        document.execCommand(cmd, false, null);
    }
    renderTemplatePreview();
}

function loadTemplateView() {
    const campaignId = document.getElementById("template-campaign-select").value;
    const stepKey = document.getElementById("template-step-select").value;
    
    const subjectInput = document.getElementById("template-subject");
    const editor = document.getElementById("template-body-editor");
    const offsetInput = document.getElementById("template-offset");
    
    subjectInput.value = "";
    editor.innerHTML = "";
    offsetInput.value = 0;
    
    if (templatesData[campaignId] && templatesData[campaignId][stepKey]) {
        const t = templatesData[campaignId][stepKey];
        subjectInput.value = t.subject || "";
        let bodyHtml = t.body || "";
        const isHtml = bodyHtml.trim().startsWith("<") || bodyHtml.includes("</div>") || bodyHtml.includes("</p>") || bodyHtml.includes("<br");
        if (!isHtml) {
            bodyHtml = bodyHtml.replace(/\n/g, "<br>");
        }
        editor.innerHTML = bodyHtml;
        offsetInput.value = t.day_offset || 0;
    }
    
    renderTemplatePreview();
    
    subjectInput.oninput = renderTemplatePreview;
    editor.oninput = renderTemplatePreview;
}

function renderTemplatePreview() {
    const subTpl = document.getElementById("template-subject").value;
    const editor = document.getElementById("template-body-editor");
    const bodyTpl = editor ? editor.innerHTML : "";
    
    const subText = document.getElementById("preview-subject-text");
    const bodyText = document.getElementById("preview-body-text");
    
    const mockData = {
        FirstName: "Aman",
        Company: "EY India",
        RoleType: "Summer Internship",
        Division: "Valuations/Investments Division",
        SenderName: document.getElementById("settings-sender-name")?.value || "Varun Bhardwaj",
        SenderPhone: document.getElementById("settings-sender-phone")?.value || "+91 95991 25723"
    };
    
    let renderedSub = subTpl;
    let renderedBody = bodyTpl;
    
    for (const [k, v] of Object.entries(mockData)) {
        renderedSub = renderedSub.replaceAll(`{{${k}}}`, v);
        renderedBody = renderedBody.replaceAll(`{{${k}}}`, v);
    }
    
    subText.textContent = renderedSub;
    bodyText.innerHTML = renderedBody;
}

async function saveTemplate() {
    const campaignId = document.getElementById("template-campaign-select").value;
    const stepKey = document.getElementById("template-step-select").value;
    const editor = document.getElementById("template-body-editor");
    
    const payload = {
        campaign_id: campaignId,
        step_key: stepKey,
        subject: document.getElementById("template-subject").value.trim(),
        body: editor ? editor.innerHTML : "",
        day_offset: parseInt(document.getElementById("template-offset").value || "0")
    };
    
    if (!payload.subject || !payload.body) {
        alert("Subject and body are required.");
        return;
    }
    
    try {
        const res = await fetch(API_BASE + "/api/templates/save", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            alert("Template saved successfully!");
            loadTemplatesTab();
        } else {
            alert("Error: " + data.detail);
        }
    } catch (e) {
        alert("Failed to save template: " + e.message);
    }
}

async function sendTestEmail() {
    const campaignId = document.getElementById("template-campaign-select").value;
    const stepKey = document.getElementById("template-step-select").value;
    const subject = document.getElementById("template-subject").value.trim();
    const editor = document.getElementById("template-body-editor");
    const body = editor ? editor.innerHTML : "";
    const btn = document.getElementById("send-test-btn");
    
    if (!subject || !body) {
        alert("Enter a subject and body first.");
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.textContent = "✉️ Sending Test...";
    }
    
    try {
        const res = await fetch(API_BASE + "/api/templates/send-test", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ campaign_id: campaignId, step_key: stepKey, subject, body })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
        } else {
            alert("Failed: " + data.detail);
        }
    } catch (e) {
        alert("Error sending test email: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "✉️ Send Test Email to Self";
        }
    }
}


// --- Kanban Tracker Dashboard & Analytics Sync ---

async function loadDashboardStats() {
    try {
        const res = await fetch(API_BASE + "/api/schedule/stats", {
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        const data = await res.json();
        
        const kb = data.kanban || { Wishlist: 0, Applied: 0, "OA / Test": 0, Interviewing: 0, Offer: 0, Rejected: 0 };
        const totalTracked = kb.Wishlist + kb.Applied;
        const totalInterviews = kb.Interviewing + kb["OA / Test"];
        const totalOffers = kb.Offer;
        
        document.getElementById("stat-applied").textContent = totalTracked;
        document.getElementById("stat-interviews").textContent = totalInterviews;
        document.getElementById("stat-offers").textContent = totalOffers;
        
        let totalPending = 0;
        let totalSent = 0;
        
        const campaignsBody = document.getElementById("dashboard-campaigns-tbody");
        campaignsBody.innerHTML = "";
        
        const campaignDisplayNames = {
            finance: "Finance Campaign",
            consulting: "Consulting Campaign",
            marketing: "Marketing Campaign",
            tech: "Tech Campaign",
            all_purpose: "All-Purpose Mailer"
        };
        
        const streamIds = ["finance", "consulting", "marketing", "tech", "all_purpose"];
        
        streamIds.forEach(id => {
            const stats = data.campaigns[id] || { Pending: 0, Sent: 0, Replied: 0, "Call Booked": 0, Closed: 0, Failed: 0 };
            
            totalPending += stats.Pending;
            totalSent += stats.Sent;
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${campaignDisplayNames[id]}</strong></td>
                <td><span class="badge badge-info">${stats.Pending}</span></td>
                <td><span class="badge badge-success">${stats.Sent}</span></td>
                <td><span class="badge badge-warning">${stats.Replied}</span></td>
                <td><span class="badge badge-success" style="background:rgba(16,185,129,0.2); color:#10b981;">${stats["Call Booked"]}</span></td>
                <td><span class="badge badge-danger">${stats.Failed + stats.Closed}</span></td>
            `;
            campaignsBody.appendChild(tr);
        });
        
        document.getElementById("stat-pending").textContent = totalPending;
    } catch (err) {
        console.error("Dashboard statistics loading failed", err);
    }
}


// --- Kanban Board Interaction & Drag and Drop ---

let allTrackerApplications = [];

async function loadKanbanCards() {
    try {
        const res = await fetch(API_BASE + "/api/applications", {
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        allTrackerApplications = await res.json();
        
        const colIds = ["Wishlist", "Applied", "OA / Test", "Interviewing", "Offer", "Rejected"];
        const containers = {
            Wishlist: document.getElementById("cards-wishlist"),
            Applied: document.getElementById("cards-applied"),
            "OA / Test": document.getElementById("cards-oa"),
            Interviewing: document.getElementById("cards-interviewing"),
            Offer: document.getElementById("cards-offer"),
            Rejected: document.getElementById("cards-rejected")
        };
        
        colIds.forEach(c => {
            if (containers[c]) containers[c].innerHTML = "";
            const countEl = document.getElementById(`count-${getColumnCountId(c)}`);
            if (countEl) countEl.textContent = 0;
        });
        
        const counts = { Wishlist: 0, Applied: 0, "OA / Test": 0, Interviewing: 0, Offer: 0, Rejected: 0 };
        
        allTrackerApplications.forEach(app => {
            const status = app.status;
            counts[status] = (counts[status] || 0) + 1;
            
            const card = document.createElement("div");
            card.className = "kanban-card";
            card.draggable = true;
            card.setAttribute("data-id", app.id);
            
            card.addEventListener("dragstart", handleDragStart);
            card.addEventListener("dragend", handleDragEnd);
            card.addEventListener("click", () => openEditAppModal(app));
            
            const badgeClass = app.role_type === "Job" ? "job" : "internship";
            const dateStr = app.last_updated.substring(0, 10);
            
            card.innerHTML = `
                <div class="card-title">${app.company}</div>
                <div class="card-subtitle">${app.role}</div>
                <span class="card-badge ${badgeClass}">${app.role_type}</span>
                <div class="card-meta">
                    <span>${app.division || ''}</span>
                    <span>${dateStr}</span>
                </div>
            `;
            
            if (containers[status]) {
                containers[status].appendChild(card);
            }
        });
        
        colIds.forEach(c => {
            const countEl = document.getElementById(`count-${getColumnCountId(c)}`);
            if (countEl) countEl.textContent = counts[c];
        });
        
    } catch (e) {
        console.error("Failed to load Kanban tracker cards", e);
    }
}

function getColumnCountId(status) {
    if (status === "OA / Test") return "oa";
    return status.toLowerCase().replace(" / ", "-");
}

function handleDragStart(e) {
    draggedCard = e.currentTarget;
    draggedCard.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
}

function handleDragEnd(e) {
    if (draggedCard) draggedCard.classList.remove("dragging");
    draggedCard = null;
}

function allowDrop(e) {
    e.preventDefault();
}

async function handleDrop(e) {
    e.preventDefault();
    const column = e.currentTarget;
    const newStatus = column.getAttribute("data-status");
    
    if (draggedCard && newStatus) {
        const appId = parseInt(draggedCard.getAttribute("data-id"));
        const matchedApp = allTrackerApplications.find(a => a.id === appId);
        
        if (matchedApp && matchedApp.status !== newStatus) {
            column.querySelector(".column-cards").appendChild(draggedCard);
            
            matchedApp.status = newStatus;
            try {
                const res = await fetch(`${API_BASE}/api/applications/${appId}`, {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify(matchedApp)
                });
                if (res.ok) {
                    loadKanbanCards();
                    loadDashboardStats();
                } else {
                    alert("Failed to update status in database.");
                }
            } catch (err) {
                console.error("Kanban drop sync failed", err);
            }
        }
    }
}


// --- Kanban Applications Card Edit/Add Modal ---

function openAddAppModal() {
    document.getElementById("modal-title").textContent = "Track New Application";
    document.getElementById("modal-app-id").value = "";
    document.getElementById("app-modal-form").reset();
    
    document.getElementById("modal-delete-btn").classList.add("hidden");
    document.getElementById("app-modal").classList.remove("hidden");
}

function openEditAppModal(app) {
    document.getElementById("modal-title").textContent = "Update Application Details";
    document.getElementById("modal-app-id").value = app.id;
    
    document.getElementById("modal-company").value = app.company;
    document.getElementById("modal-role").value = app.role;
    document.getElementById("modal-role-type").value = app.role_type;
    document.getElementById("modal-division").value = app.division || "";
    document.getElementById("modal-contact-name").value = app.contact_name || "";
    document.getElementById("modal-contact-email").value = app.contact_email || "";
    document.getElementById("modal-status").value = app.status;
    document.getElementById("modal-notes").value = app.notes || "";
    
    document.getElementById("modal-delete-btn").classList.remove("hidden");
    document.getElementById("app-modal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("app-modal").classList.add("hidden");
}

async function saveApplication(e) {
    e.preventDefault();
    const appId = document.getElementById("modal-app-id").value;
    
    const payload = {
        company: document.getElementById("modal-company").value.trim(),
        role: document.getElementById("modal-role").value.trim(),
        role_type: document.getElementById("modal-role-type").value,
        division: document.getElementById("modal-division").value.trim(),
        contact_name: document.getElementById("modal-contact-name").value.trim(),
        contact_email: document.getElementById("modal-contact-email").value.trim(),
        status: document.getElementById("modal-status").value,
        notes: document.getElementById("modal-notes").value.trim()
    };
    
    const url = appId ? `/api/applications/${appId}` : "/api/applications";
    const method = appId ? "PUT" : "POST";
    
    try {
        const res = await fetch(API_BASE + url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal();
            loadKanbanCards();
            loadDashboardStats();
        } else {
            const data = await res.json();
            alert("Error: " + data.detail);
        }
    } catch (err) {
        alert("Failed to save: " + err.message);
    }
}

async function deleteApplicationClick() {
    const appId = document.getElementById("modal-app-id").value;
    if (!appId || !confirm("Are you sure you want to delete this tracked application card?")) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/applications/${appId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        if (res.ok) {
            closeModal();
            loadKanbanCards();
            loadDashboardStats();
        }
    } catch (e) {
        alert("Failed to delete card: " + e.message);
    }
}
