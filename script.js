/**
 * ============================================================
 * CAMPUS FIX - APPLICATION LOGIC (MULTI-PAGE & AUTH ENABLED)
 * ============================================================
 */

// No pre-loaded complaints: the feed starts empty and fills with student submissions
const INITIAL_ISSUES = [];

// IDs of the old sample complaints; any saved copies are removed on load
const OLD_SAMPLE_IDS = ["CF-101", "CF-102", "CF-103", "CF-104", "CF-105", "CF-106"];

const CATEGORY_FALLBACK_IMAGES = {
  "HVAC / Electrical": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=700&q=80",
  "Plumbing": "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=700&q=80",
  "Classroom & IT": "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=700&q=80",
  "Furniture & Fixtures": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=700&q=80",
  "Cleanliness & Sanitation": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=700&q=80",
  "Safety & Security": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=700&q=80"
};

const PRIORITY_WEIGHTS = { Emergency: 4, High: 3, Medium: 2, Low: 1 };

// Global State
const STATE = {
  currentPage: "home",
  user: {
    isLoggedIn: false,
    userId: "",
    name: "Guest",
    email: "",
    role: "student" // 'student' or 'admin'
  },
  issues: [],
  searchQuery: "",
  categoryFilter: "ALL",
  statusFilter: "ALL",
  priorityFilter: "ALL",
  sortOrder: "newest",
  uploadedComplaintImageBase64: null
};

/**
 * Initialize
 */
function initApp() {
  loadDataFromStorage();
  bindGlobalEvents();
  startLoginAnimations();
  renderAuthHeader();
  updateStats();
  renderIssues();

  // Handle URL hash routing if present
  const hash = window.location.hash.replace("#", "");
  if (["home", "complaint", "feed", "track", "login"].includes(hash)) {
    navigateTo(hash);
  } else {
    navigateTo("home");
  }
}

/**
 * Local Storage Operations
 */
function loadDataFromStorage() {
  try {
    const savedIssues = localStorage.getItem("campus_fix_issues");
    if (savedIssues) {
      STATE.issues = JSON.parse(savedIssues).filter(i => !OLD_SAMPLE_IDS.includes(i.id));
      localStorage.setItem("campus_fix_issues", JSON.stringify(STATE.issues));
    } else {
      STATE.issues = [...INITIAL_ISSUES];
      localStorage.setItem("campus_fix_issues", JSON.stringify(STATE.issues));
    }

    const savedUser = localStorage.getItem("campus_fix_user");
    if (savedUser) {
      STATE.user = JSON.parse(savedUser);
    }
  } catch (err) {
    STATE.issues = [...INITIAL_ISSUES];
  }
}

function saveIssuesToStorage() {
  try {
    localStorage.setItem("campus_fix_issues", JSON.stringify(STATE.issues));
  } catch (err) {}
}

function saveUserToStorage() {
  try {
    localStorage.setItem("campus_fix_user", JSON.stringify(STATE.user));
  } catch (err) {}
}

/**
 * Page Navigation Router (SPA)
 */
window.navigateTo = function(pageName) {
  // Login first: signed-out visitors can only see the login page
  if (!STATE.user || !STATE.user.isLoggedIn) {
    pageName = "login";
  }

  STATE.currentPage = pageName;
  window.location.hash = pageName;

  // Toggle page view elements
  document.querySelectorAll(".page-view").forEach(view => {
    view.classList.remove("active");
  });

  const targetView = document.getElementById(`view-${pageName}`);
  if (targetView) {
    targetView.classList.add("active");
  }

  // Toggle active nav link
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.page === pageName);
  });

  // Pre-fill reporter information if navigating to complaint page
  if (pageName === "complaint" && STATE.user.isLoggedIn) {
    const nameField = document.getElementById("complaintReporterName");
    const emailField = document.getElementById("complaintReporterContact");
    if (nameField && !nameField.value) nameField.value = STATE.user.name;
    if (emailField && !emailField.value) emailField.value = STATE.user.email;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
};

/**
 * Open Complaint Form with Pre-selected Category
 */
window.openComplaintWithCategory = function(catName) {
  navigateTo("complaint");
  const catDropdown = document.getElementById("complaintCategory");
  if (catDropdown) {
    catDropdown.value = catName;
  }
};

/**
 * Authentication & Session Management
 */
function isStaffUser(user) {
  return !!(user && user.isLoggedIn && (user.role === "staff" || user.role === "admin"));
}

function getRoleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return "Student";
}

let lastLoggedInState = null;

function renderAuthHeader() {
  const container = document.getElementById("headerAuthArea");
  if (!container) return;

  if (lastLoggedInState === false && STATE.user.isLoggedIn) launchConfetti();
  lastLoggedInState = !!STATE.user.isLoggedIn;

  if (STATE.user.isLoggedIn) {
    const isStaff = isStaffUser(STATE.user);
    container.innerHTML = `
      <div class="user-profile-pill">
        <div class="user-avatar" style="${isStaff ? 'background: linear-gradient(135deg, #f59e0b, #d97706);' : ''}">
          <i class="fa-solid ${isStaff ? 'fa-user-gear' : 'fa-graduation-cap'}"></i>
        </div>
        <div class="user-details">
          <span class="user-name">${escapeHtml(STATE.user.name)}</span>
          <span class="user-role-badge">${getRoleLabel(STATE.user.role)}${STATE.user.userId ? ' &bull; ' + escapeHtml(STATE.user.userId) : ''}</span>
        </div>
        <button type="button" class="logout-icon-btn" onclick="logoutUser()" title="Sign Out">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
        </button>
      </div>
    `;

    // Toggle staff notice banner on feed page
    const adminBanner = document.getElementById("adminNoticeBanner");
    if (adminBanner) {
      adminBanner.style.display = isStaff ? "flex" : "none";
    }
  } else {
    container.innerHTML = `
      <button type="button" class="btn btn-primary" onclick="navigateTo('login')">
        <i class="fa-solid fa-user"></i> <span>Sign In</span>
      </button>
    `;
    const adminBanner = document.getElementById("adminNoticeBanner");
    if (adminBanner) adminBanner.style.display = "none";
  }
}

const LOGIN_ROLE_INFO = {
  student: { icon: "fa-graduation-cap", title: "Welcome, Student", hint: "Sign in with your Student ID to file and track complaints." },
  staff: { icon: "fa-wrench", title: "Staff Console", hint: "Use your Staff ID and PIN to manage and update repairs." },
  admin: { icon: "fa-user-shield", title: "Admin Control Room", hint: "Use your Admin ID and security PIN for full oversight." }
};

window.switchLoginTab = function(type) {
  const tabs = {
    student: document.getElementById("tabStudentLogin"),
    staff: document.getElementById("tabStaffLogin"),
    admin: document.getElementById("tabAdminLogin")
  };
  const forms = {
    student: document.getElementById("studentLoginForm"),
    staff: document.getElementById("staffLoginForm"),
    admin: document.getElementById("adminLoginForm")
  };

  Object.keys(tabs).forEach(key => {
    if (tabs[key]) tabs[key].classList.toggle("active", key === type);
    if (forms[key]) forms[key].style.display = key === type ? "flex" : "none";
  });

  // Role colour theme + heading text
  const card = document.getElementById("loginCard");
  if (card) card.dataset.role = type;

  const info = LOGIN_ROLE_INFO[type];
  if (info) {
    const iconWrap = document.getElementById("authRoleIcon");
    const title = document.getElementById("authRoleTitle");
    const hint = document.getElementById("authRoleHint");
    if (iconWrap) {
      iconWrap.innerHTML = `<i class="fa-solid ${info.icon}"></i>`;
      iconWrap.classList.remove("pop");
      void iconWrap.offsetWidth;
      iconWrap.classList.add("pop");
    }
    if (title) title.textContent = info.title;
    if (hint) hint.textContent = info.hint;
  }
};

window.togglePassword = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  if (btn) btn.innerHTML = `<i class="fa-solid ${show ? "fa-eye-slash" : "fa-eye"}"></i>`;
};

window.quickLoginDemo = function(role) {
  if (role === "student") {
    STATE.user = {
      isLoggedIn: true,
      userId: "STU-2024-001",
      name: "Maya Lin",
      email: "maya.lin@college.edu",
      role: "student"
    };
    showToast("Signed in as Student (STU-2024-001)", "success");
  } else if (role === "staff") {
    STATE.user = {
      isLoggedIn: true,
      userId: "STF-8041",
      name: "Facilities Staff",
      email: "facilities.staff@college.edu",
      role: "staff"
    };
    showToast("Signed in as Staff (STF-8041)", "warning");
  } else {
    STATE.user = {
      isLoggedIn: true,
      userId: "ADM-1001",
      name: "Admin",
      email: "admin@college.edu",
      role: "admin"
    };
    showToast("Signed in as Admin (ADM-1001)", "warning");
  }
  saveUserToStorage();
  renderAuthHeader();
  renderIssues();
  navigateTo("home");
};

window.logoutUser = function() {
  STATE.user = {
    isLoggedIn: false,
    userId: "",
    name: "Guest",
    email: "",
    role: "student"
  };
  saveUserToStorage();
  renderAuthHeader();
  renderIssues();
  showToast("Logged out successfully", "info");
  navigateTo("login");
};

/**
 * Event Bindings
 */
function bindGlobalEvents() {
  // Login Form Submissions
  const studentForm = document.getElementById("studentLoginForm");
  if (studentForm) {
    studentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const studentId = document.getElementById("studentId").value.trim();
      const email = document.getElementById("studentEmail").value.trim();
      const namePart = email.split("@")[0].replace(/[._]/g, " ");
      const formattedName = namePart.replace(/\b\w/g, c => c.toUpperCase());

      STATE.user = {
        isLoggedIn: true,
        userId: studentId,
        name: formattedName || "Student User",
        email: email,
        role: "student"
      };
      saveUserToStorage();
      renderAuthHeader();
      renderIssues();
      showToast(`Welcome back, ${STATE.user.name}!`, "success");
      navigateTo("home");
    });
  }

  const staffForm = document.getElementById("staffLoginForm");
  if (staffForm) {
    staffForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const staffId = document.getElementById("staffId").value.trim();

      STATE.user = {
        isLoggedIn: true,
        userId: staffId,
        name: "Staff " + staffId,
        email: staffId.toLowerCase() + "@college.edu",
        role: "staff"
      };
      saveUserToStorage();
      renderAuthHeader();
      renderIssues();
      showToast(`Signed in as Staff (${staffId})`, "warning");
      navigateTo("feed");
    });
  }

  const adminForm = document.getElementById("adminLoginForm");
  if (adminForm) {
    adminForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const adminId = document.getElementById("adminId").value.trim();

      STATE.user = {
        isLoggedIn: true,
        userId: adminId,
        name: "Admin " + adminId,
        email: adminId.toLowerCase() + "@college.edu",
        role: "admin"
      };
      saveUserToStorage();
      renderAuthHeader();
      renderIssues();
      showToast(`Signed in as Admin (${adminId})`, "warning");
      navigateTo("feed");
    });
  }

  // Complaint Page Form Submission
  const complaintForm = document.getElementById("pageComplaintForm");
  if (complaintForm) {
    complaintForm.addEventListener("submit", handlePageComplaintSubmit);
  }

  // Complaint Photo Upload Handling
  setupComplaintDropzone();

  // Feed Search & Filters
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      STATE.searchQuery = e.target.value.trim().toLowerCase();
      renderIssues();
    });
  }

  document.getElementById("categoryFilter").addEventListener("change", (e) => {
    STATE.categoryFilter = e.target.value; renderIssues();
  });
  document.getElementById("statusFilter").addEventListener("change", (e) => {
    STATE.statusFilter = e.target.value; renderIssues();
  });
  document.getElementById("priorityFilter").addEventListener("change", (e) => {
    STATE.priorityFilter = e.target.value; renderIssues();
  });
  document.getElementById("sortOrder").addEventListener("change", (e) => {
    STATE.sortOrder = e.target.value; renderIssues();
  });
  document.getElementById("resetFiltersBtn").addEventListener("click", resetFilters);

  // Dedicated Track Page Search
  const trackBtn = document.getElementById("trackPageBtn");
  const trackInput = document.getElementById("trackPageInput");
  if (trackBtn && trackInput) {
    trackBtn.addEventListener("click", () => executeTrackSearch(trackInput.value));
    trackInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeTrackSearch(trackInput.value);
      }
    });
  }

  // Admin Modal Close Events
  document.getElementById("closeAdminModalBtn").addEventListener("click", () => closeModal("adminUpdateModal"));
  document.getElementById("cancelAdminModalBtn").addEventListener("click", () => closeModal("adminUpdateModal"));
  document.getElementById("adminUpdateForm").addEventListener("submit", handleAdminUpdateSubmit);

  // Reset Demo Data
  document.getElementById("resetSampleDataBtn").addEventListener("click", () => {
    if (confirm("Delete all complaints? This cannot be undone.")) {
      STATE.issues = [...INITIAL_ISSUES];
      saveIssuesToStorage();
      resetFilters();
      updateStats();
      renderIssues();
      showToast("All complaints cleared", "info");
    }
  });

  // Global ESC Key to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal("adminUpdateModal");
    }
  });
}

/**
 * Setup Drag & Drop Zone for Complaints
 */
function setupComplaintDropzone() {
  const fileInput = document.getElementById("complaintImageInput");
  const removeBtn = document.getElementById("complaintRemoveImageBtn");

  if (!fileInput) return;

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        showToast("Please choose a valid image file", "warning");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be smaller than 5MB", "warning");
        fileInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        STATE.uploadedComplaintImageBase64 = evt.target.result;
        document.getElementById("complaintImagePreview").src = evt.target.result;
        document.getElementById("complaintDropzoneContent").style.display = "none";
        document.getElementById("complaintImagePreviewContainer").style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      STATE.uploadedComplaintImageBase64 = null;
      fileInput.value = "";
      document.getElementById("complaintImagePreviewContainer").style.display = "none";
      document.getElementById("complaintDropzoneContent").style.display = "block";
    });
  }

  const dropzone = document.getElementById("complaintDropzone");

  if (dropzone) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();

      const files = e.dataTransfer.files;

      if (files.length > 0) {
        fileInput.files = files;
        fileInput.dispatchEvent(new Event("change", {
          bubbles: true
        }));
      }
    });
  }
}

/**
 * Handle Full Page Complaint Submission
 */
function handlePageComplaintSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("complaintTitle").value.trim();
  const category = document.getElementById("complaintCategory").value;
  const priority = document.getElementById("complaintPriority").value;
  const building = document.getElementById("complaintBuilding").value.trim();
  const location = document.getElementById("complaintLocation").value.trim();
  const description = document.getElementById("complaintDesc").value.trim();
  const reporterName = document.getElementById("complaintReporterName").value.trim() || (STATE.user.isLoggedIn ? STATE.user.name : "Anonymous Student");
  const reporterContact = document.getElementById("complaintReporterContact").value.trim() || (STATE.user.isLoggedIn ? STATE.user.email : "");

  if (!title || !category || !priority || !building || !location || !description) {
    showToast("Please complete all required fields", "warning");
    return;
  }

  const newTicketId = `CF-${Date.now()}`;

  const newIssue = {
    id: newTicketId,
    title,
    category,
    priority,
    status: "Pending",
    building,
    specificLocation: location,
    description,
    imageUrl: STATE.uploadedComplaintImageBase64 || "",
    reporterName,
    reporterContact,
    reporterId: STATE.user.userId || "",
    createdAt: new Date().toISOString(),
    upvotes: 1,
    hasUpvoted: true,
    assignedTo: "Unassigned",
    updates: []
  };

  STATE.issues.unshift(newIssue);
  saveIssuesToStorage();

  // Reset form
  document.getElementById("pageComplaintForm").reset();
  STATE.uploadedComplaintImageBase64 = null;
  document.getElementById("complaintImagePreviewContainer").style.display = "none";
  document.getElementById("complaintDropzoneContent").style.display = "block";

  updateStats();
  renderIssues();

  showToast(`Ticket ${newTicketId} logged! Redirecting to tracker...`, "success");

  // Automatically take user to Track Page with their new ticket loaded
  setTimeout(() => {
    navigateTo("track");
    const trackInput = document.getElementById("trackPageInput");
    if (trackInput) {
      trackInput.value = newTicketId;
      executeTrackSearch(newTicketId);
    }
  }, 900);
}

/**
 * Execute Tracking Search
 */
function executeTrackSearch(query) {
  const q = (query || "").trim().toLowerCase();
  const resultBox = document.getElementById("trackPageResult");
  const notFoundBox = document.getElementById("trackPageNotFound");

  if (!q) {
    showToast("Please enter a Ticket ID or email", "warning");
    return;
  }

  const issue = STATE.issues.find(i => 
    i.id.toLowerCase() === q || 
    (i.reporterContact && i.reporterContact.toLowerCase() === q)
  );

  if (!issue) {
    if (resultBox) resultBox.style.display = "none";
    if (notFoundBox) notFoundBox.style.display = "block";
    return;
  }

  if (notFoundBox) notFoundBox.style.display = "none";
  if (resultBox) resultBox.style.display = "block";

  // Header Details
  const ticketIdElement = document.getElementById("trackPageTicketId");
  const ticketTitleElement = document.getElementById("trackPageTicketTitle");
  const ticketMetaElement = document.getElementById("trackPageTicketMeta");

  if (ticketIdElement) ticketIdElement.textContent = issue.id;
  if (ticketTitleElement) ticketTitleElement.textContent = issue.title;

  if (ticketMetaElement) {
    ticketMetaElement.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${escapeHtml(issue.building)} &bull; ${escapeHtml(issue.category)}`;
  }
  
  const statusClass = getStatusBadgeClass(issue.status);
  const badgeElement = document.getElementById("trackPageBadge");

  if (badgeElement) {
    badgeElement.innerHTML = `<span class="badge ${statusClass}">${issue.status}</span>`;
  }

  // Stepper calculations
  const stepSubmitted = document.getElementById("page-step-submitted");
  const stepAssigned = document.getElementById("page-step-acknowledged");
  const stepProgress = document.getElementById("page-step-inprogress");
  const stepResolved = document.getElementById("page-step-resolved");
  const line1 = document.getElementById("page-line-1");
  const line2 = document.getElementById("page-line-2");
  const line3 = document.getElementById("page-line-3");

  if (stepSubmitted) {
    stepSubmitted.className = "stepper-step completed";
  }
  const submittedTime = document.getElementById("pageStepTimeSubmitted");

  if (submittedTime) {
    submittedTime.textContent = formatDate(issue.createdAt);
  }

  const isAssigned = issue.assignedTo && issue.assignedTo !== "Unassigned";
  const hasUpdates = issue.updates && issue.updates.length > 0;

  if (stepAssigned && line1) {
    if (isAssigned || hasUpdates || issue.status !== "Pending") {
      stepAssigned.className = "stepper-step completed";
      line1.className = "stepper-line completed";
    } else {
      stepAssigned.className = "stepper-step active";
      line1.className = "stepper-line";
    }
  }

  const assignedTime = document.getElementById("pageStepTimeAssigned");

  if (assignedTime) {
    assignedTime.textContent = isAssigned
      ? issue.assignedTo
      : (hasUpdates || issue.status !== "Pending" ? "Acknowledged" : "Under Review");
  }

  const progressTime = document.getElementById("pageStepTimeProgress");

  if (stepProgress && line2) {
    if (issue.status === "In Progress") {
      stepProgress.className = "stepper-step active";
      line2.className = "stepper-line completed";
    } else if (issue.status === "Resolved") {
      stepProgress.className = "stepper-step completed";
      line2.className = "stepper-line completed";
    } else {
      stepProgress.className = "stepper-step";
      line2.className = "stepper-line";
    }
  }

  if (progressTime) {
    progressTime.textContent =
      issue.status === "In Progress" ? "Work In Progress" :
      issue.status === "Resolved" ? "Repairs Done" : "Pending";
  }

  const resolvedTime = document.getElementById("pageStepTimeResolved");

  if (stepResolved && line3) {
    if (issue.status === "Resolved") {
      stepResolved.className = "stepper-step completed";
      line3.className = "stepper-line completed";
    } else {
      stepResolved.className = "stepper-step";
      line3.className = "stepper-line";
    }
  }

  if (resolvedTime) {
    resolvedTime.textContent =
      issue.status === "Resolved" ? "Verified Fixed" : "Open";
  }

  // Activity Log
  let logHtml = `
    <div class="history-item">
      <span class="history-time"><i class="fa-regular fa-clock"></i> ${formatDate(issue.createdAt)}</span>
      <span class="history-note">Complaint filed by ${escapeHtml(issue.reporterName || "Anonymous Student")}</span>
    </div>
  `;

  if (isAssigned) {
    logHtml += `
      <div class="history-item">
        <span class="history-time"><i class="fa-solid fa-wrench"></i> Dispatched</span>
        <span class="history-note">Assigned technician: <strong>${escapeHtml(issue.assignedTo)}</strong></span>
      </div>
    `;
  }

  if (issue.updates && issue.updates.length > 0) {
    issue.updates.forEach(u => {
      logHtml += `
        <div class="history-item">
          <span class="history-time"><i class="fa-regular fa-calendar-check"></i> ${formatDate(u.timestamp)}</span>
          <span class="history-note">"${escapeHtml(u.note)}" &bull; <em>${escapeHtml(u.author || "Staff")}</em></span>
        </div>
      `;
    });
  }

  const historyList = document.getElementById("trackPageHistoryList");

  if (historyList) {
    historyList.innerHTML = logHtml;
  }
}

window.trackComplaintDirectly = function(id) {
  navigateTo("track");
  const trackInput = document.getElementById("trackPageInput");
  if (trackInput) {
    trackInput.value = id;
    executeTrackSearch(id);
  }
};

/**
 * Filter and Stats Calculation
 */
function updateStats() {
  const total = STATE.issues.length;
  const pending = STATE.issues.filter(i => i.status === "Pending").length;
  const inProgress = STATE.issues.filter(i => i.status === "In Progress").length;
  const resolved = STATE.issues.filter(i => i.status === "Resolved").length;

  const elTotal = document.getElementById("statTotalIssues");
  const elPending = document.getElementById("statPendingIssues");
  const elProgress = document.getElementById("statInProgressIssues");
  const elResolved = document.getElementById("statResolvedIssues");

  if (elTotal) elTotal.textContent = total;
  if (elPending) elPending.textContent = pending;
  if (elProgress) elProgress.textContent = inProgress;
  if (elResolved) elResolved.textContent = resolved;
}

function resetFilters() {
  STATE.searchQuery = "";
  STATE.categoryFilter = "ALL";
  STATE.statusFilter = "ALL";
  STATE.priorityFilter = "ALL";
  STATE.sortOrder = "newest";

  document.getElementById("searchInput").value = "";
  document.getElementById("categoryFilter").value = "ALL";
  document.getElementById("statusFilter").value = "ALL";
  document.getElementById("priorityFilter").value = "ALL";
  document.getElementById("sortOrder").value = "newest";

  renderIssues();
}

function getFilteredAndSortedIssues() {
  return STATE.issues.filter(issue => {
    if (STATE.searchQuery) {
      const q = STATE.searchQuery;
      if (!issue.title.toLowerCase().includes(q) &&
          !issue.building.toLowerCase().includes(q) &&
          !issue.specificLocation.toLowerCase().includes(q) &&
          !issue.description.toLowerCase().includes(q) &&
          !issue.id.toLowerCase().includes(q)) return false;
    }

    if (STATE.categoryFilter !== "ALL" && issue.category !== STATE.categoryFilter) return false;
    if (STATE.statusFilter !== "ALL" && issue.status !== STATE.statusFilter) return false;
    if (STATE.priorityFilter !== "ALL" && issue.priority !== STATE.priorityFilter) return false;

    return true;
  }).sort((a, b) => {
    if (STATE.sortOrder === "upvotes") return b.upvotes - a.upvotes;
    if (STATE.sortOrder === "priority") return (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function getCategoryInfo(category) {
  switch (category) {
    case "HVAC / Electrical": return { cls: "cat-electrical", icon: "fa-bolt" };
    case "Plumbing": return { cls: "cat-plumbing", icon: "fa-droplet" };
    case "Classroom & IT": return { cls: "cat-it", icon: "fa-laptop-code" };
    case "Furniture & Fixtures": return { cls: "cat-furniture", icon: "fa-couch" };
    case "Cleanliness & Sanitation": return { cls: "cat-sanitation", icon: "fa-soap" };
    case "Safety & Security": return { cls: "cat-safety", icon: "fa-shield-halved" };
    default: return { cls: "cat-it", icon: "fa-tag" };
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "Recent"; }
}

function getStatusBadgeClass(status) {
  return status === "Resolved" ? "badge-resolved" : (status === "In Progress" ? "badge-in-progress" : "badge-pending");
}

function getPriorityBadgeClass(priority) {
  return "priority-" + priority.toLowerCase();
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render Feed Grid
 */
function renderIssues() {
  const grid = document.getElementById("issuesGrid");
  const emptyState = document.getElementById("emptyState");
  const countBadge = document.getElementById("resultsCount");

  if (!grid) return;

  const issues = getFilteredAndSortedIssues();
  if (countBadge) countBadge.textContent = `${issues.length} item${issues.length === 1 ? "" : "s"} found`;

  if (issues.length === 0) {
    grid.innerHTML = "";
    if (emptyState) {
      const noComplaintsYet = STATE.issues.length === 0;
      const heading = emptyState.querySelector("h3");
      const text = emptyState.querySelector("p");
      const resetBtn = emptyState.querySelector("button");
      if (heading) heading.textContent = noComplaintsYet ? "No complaints yet" : "No complaints match your filters";
      if (text) text.textContent = noComplaintsYet
        ? "Complaints filed by students will appear here."
        : "Adjust your search query or reset filters to view all campus complaints.";
      if (resetBtn) resetBtn.style.display = noComplaintsYet ? "none" : "";
      emptyState.style.display = "block";
    }
    return;
  }
  if (emptyState) emptyState.style.display = "none";

  const isStaff = isStaffUser(STATE.user);

  grid.innerHTML = issues.map(issue => {
    const displayImg = issue.imageUrl || CATEGORY_FALLBACK_IMAGES[issue.category] || "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=700&q=80";
    const statusClass = getStatusBadgeClass(issue.status);
    const priorityClass = getPriorityBadgeClass(issue.priority);
    const catInfo = getCategoryInfo(issue.category);
    const formattedDate = formatDate(issue.createdAt);

    let latestUpdateHtml = "";
    if (issue.updates && issue.updates.length > 0) {
      const latest = issue.updates[issue.updates.length - 1];
      latestUpdateHtml = `
        <div class="card-updates">
          <div class="updates-title"><i class="fa-solid fa-bell"></i> Latest Update (${formatDate(latest.timestamp)})</div>
          <p class="latest-update-note">"${escapeHtml(latest.note)}"</p>
          ${issue.assignedTo && issue.assignedTo !== "Unassigned" ? `<span class="assigned-tag"><i class="fa-solid fa-wrench"></i> ${escapeHtml(issue.assignedTo)}</span>` : ""}
        </div>
      `;
    } else if (issue.assignedTo && issue.assignedTo !== "Unassigned") {
      latestUpdateHtml = `
        <div class="card-updates">
          <span class="assigned-tag"><i class="fa-solid fa-wrench"></i> Assigned: ${escapeHtml(issue.assignedTo)}</span>
        </div>
      `;
    }

    const adminManageBtn = isStaff ? `
      <button type="button" class="btn-admin-manage" onclick="openAdminModal('${issue.id}')">
        <i class="fa-solid fa-pen-to-square"></i> Manage
      </button>
    ` : "";

    return `
      <article class="issue-card" id="card-${issue.id}">
        <div class="card-image-wrap">
          <img src="${displayImg}" alt="${escapeHtml(issue.title)}" loading="lazy">
          <div class="card-badges-overlay">
            <span class="badge ${statusClass}">${issue.status}</span>
            <span class="badge ${priorityClass}">${issue.priority}</span>
          </div>
        </div>

        <div class="card-body">
          <div class="card-meta">
            <span class="meta-id" onclick="trackComplaintDirectly('${issue.id}')" title="Click to track live timeline">
              <i class="fa-solid fa-magnifying-glass-location"></i> ${issue.id}
            </span>
            <span><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
          </div>

          <div>
            <span class="category-pill ${catInfo.cls}">
              <i class="fa-solid ${catInfo.icon}"></i> ${escapeHtml(issue.category)}
            </span>
          </div>

          <h3 class="card-title">${escapeHtml(issue.title)}</h3>

          <div class="card-location">
            <i class="fa-solid fa-location-dot"></i>
            <div>
              <strong>${escapeHtml(issue.building)}</strong>
              <div>${escapeHtml(issue.specificLocation)}</div>
            </div>
          </div>

          <p class="card-desc">${escapeHtml(issue.description)}</p>

          ${latestUpdateHtml}

          <div class="card-footer">
            <button
              type="button"
              class="upvote-btn ${issue.hasUpvoted ? 'upvoted' : ''}"
              onclick="toggleUpvote('${issue.id}')"
              title="${issue.hasUpvoted ? 'Remove upvote' : 'Upvote this complaint'}"
            >
              <i class="fa-solid fa-arrow-up"></i>
              <span>${issue.upvotes}</span>
            </button>

            ${adminManageBtn}

            <span class="reporter-tag">
              <i class="fa-regular fa-user"></i> ${escapeHtml(issue.reporterName || "Anonymous")}
            </span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function toggleUpvote(issueId) {
    if (!STATE.user || !STATE.user.isLoggedIn) {
        showToast("Please login to upvote", "warning");
        return;
    }

    const issue = STATE.issues.find(item => item.id === issueId);

    if (!issue) {
        showToast("Complaint not found", "error");
        return;
    }

    if (!issue.votedUsers) {
        issue.votedUsers = [];
    }

    const userEmail = STATE.user.email;

    if (issue.votedUsers.includes(userEmail)) {
        showToast("You have already upvoted this complaint", "warning");
        return;
    }

    issue.votedUsers.push(userEmail);
    issue.upvotes = (issue.upvotes || 0) + 1;

    saveIssuesToStorage();
    renderIssues();

    showToast("Upvote added successfully!", "success");
}
window.toggleUpvote = toggleUpvote;

/**
 * Admin Status Update Form
 */
window.openAdminModal = function(id) {
  const issue = STATE.issues.find(item => item.id === id);
  if (!issue) return;

  document.getElementById("adminTargetIssueId").value = issue.id;
  document.getElementById("adminModalIssueTitle").textContent = `${issue.id}: ${issue.title}`;
  document.getElementById("adminStatusSelect").value = issue.status;
  document.getElementById("adminAssignedTo").value = issue.assignedTo === "Unassigned" ? "" : (issue.assignedTo || "");
  document.getElementById("adminLogNote").value = "";

  openModal("adminUpdateModal");
};

function handleAdminUpdateSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("adminTargetIssueId").value;
  const issue = STATE.issues.find(item => item.id === id);
  if (!issue) return;

  issue.status = document.getElementById("adminStatusSelect").value;
  issue.assignedTo = document.getElementById("adminAssignedTo").value.trim() || "Unassigned";
  const note = document.getElementById("adminLogNote").value.trim();

  if (note) {
    if (!issue.updates) issue.updates = [];
    issue.updates.push({
      timestamp: new Date().toISOString(),
      note: note,
      author: STATE.user.name || "Facilities Admin"
    });
  }

  saveIssuesToStorage();
  updateStats();
  renderIssues();
  closeModal("adminUpdateModal");
  showToast(`Updated ${issue.id} to '${issue.status}'`, "success");
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("active");
    document.body.style.overflow = "";
  }
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  if (type === "warning") icon = "fa-triangle-exclamation";

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  document.getElementById("toastContainer").appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

/**
 * Sign-in portal extras: rotating headline, ticket tilt, login confetti
 */
function startLoginAnimations() {
  // Rotating headline word
  const word = document.getElementById("asideWord");
  if (word) {
    const phrases = ["Track it live.", "Fix it together.", "Report in a minute.", "Stay in the loop."];
    let idx = 0;
    setInterval(() => {
      word.classList.add("swap");
      setTimeout(() => {
        idx = (idx + 1) % phrases.length;
        word.textContent = phrases[idx];
        word.classList.remove("swap");
      }, 350);
    }, 2800);
  }

  // 3D tilt on the sample ticket
  const shell = document.getElementById("loginCard");
  const tilt = document.getElementById("asideTilt");
  if (shell && tilt) {
    shell.addEventListener("mousemove", (e) => {
      const r = shell.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty("--ry", (x * 14).toFixed(2) + "deg");
      tilt.style.setProperty("--rx", (-y * 14).toFixed(2) + "deg");
    });
    shell.addEventListener("mouseleave", () => {
      tilt.style.setProperty("--rx", "0deg");
      tilt.style.setProperty("--ry", "0deg");
    });
  }
}

let confettiRunning = false;
function launchConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas || confettiRunning) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  confettiRunning = true;

  const colors = ["#6366f1", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e"];
  const pieces = Array.from({ length: 140 }, () => ({
    x: canvas.width / 2,
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: Math.random() * -13 - 3,
    size: Math.random() * 7 + 4,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.vy += 0.38;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 2200);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });
    if (elapsed < 2200) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confettiRunning = false;
    }
  }
  requestAnimationFrame(frame);
}

document.addEventListener("DOMContentLoaded", initApp);
