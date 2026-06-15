/* ============================================================
   NexTask — script.js
   Full Task Manager: CRUD · Streaks · Weekly · Due Dates ·
   Milestones · localStorage · Live Metrics · Progress Ring
   ============================================================ */
 
 
/* ──────────────────────────────────────
   STATE
────────────────────────────────────── */
 
let tasks            = [];   // Array of task objects
let allTimeCount     = 0;    // All-time completions
let globalStreak     = 0;    // Consecutive days all daily tasks completed
let lastStreakDate   = '';   // "YYYY-MM-DD" of last streak update
 
let activeNavFilter    = 'all';       // sidebar nav filter
let activeStatusFilter = 'all';       // All / Pending / Completed
let editingTaskId      = null;        // ID of task being edited
 
 
/* ──────────────────────────────────────
   LOCALSTORAGE KEYS
────────────────────────────────────── */
 
const LS_TASKS   = 'nextask_tasks';
const LS_COUNT   = 'nextask_alltime';
const LS_STREAK  = 'nextask_streak';
const LS_SDATE   = 'nextask_streakdate';
 
 
/* ──────────────────────────────────────
   HELPERS — Date Utilities
────────────────────────────────────── */
 
// Returns today as "YYYY-MM-DD"
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
 
// Returns the Monday of the current week as "YYYY-MM-DD"
function currentWeekStart() {
  const d = new Date();
  const day = d.getDay();                     // 0 = Sun, 1 = Mon…
  const diff = (day === 0) ? -6 : 1 - day;   // How far back to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
 
// Format "YYYY-MM-DD" to "Jun 7"
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
 
// Returns "due-today" | "due-tomorrow" | "due-overdue" | "" based on due date string
function getDueStatus(dueDateStr) {
  if (!dueDateStr) return '';
  const today    = todayStr();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
 
  if (dueDateStr < today)        return 'due-overdue';
  if (dueDateStr === today)      return 'due-today';
  if (dueDateStr === tomorrowStr) return 'due-tomorrow';
  return '';
}
 
// Human-readable due label
function getDueLabel(status) {
  const labels = {
    'due-today':    '📅 Due Today',
    'due-tomorrow': '⏰ Due Tomorrow',
    'due-overdue':  '⚠️ Overdue'
  };
  return labels[status] || '';
}
 
 
/* ──────────────────────────────────────
   LOAD FROM localStorage
────────────────────────────────────── */
 
function loadData() {
  try {
    const raw = localStorage.getItem(LS_TASKS);
    tasks = raw ? JSON.parse(raw) : [];
  } catch (e) {
    tasks = [];
  }
 
  allTimeCount   = parseInt(localStorage.getItem(LS_COUNT)  || '0');
  globalStreak   = parseInt(localStorage.getItem(LS_STREAK) || '0');
  lastStreakDate  = localStorage.getItem(LS_SDATE) || '';
 
  // Run resets on load (daily/weekly checks)
  checkDailyReset();
  checkWeeklyReset();
}
 
 
/* ──────────────────────────────────────
   SAVE TO localStorage
────────────────────────────────────── */
 
function saveData() {
  localStorage.setItem(LS_TASKS,  JSON.stringify(tasks));
  localStorage.setItem(LS_COUNT,  allTimeCount);
  localStorage.setItem(LS_STREAK, globalStreak);
  localStorage.setItem(LS_SDATE,  lastStreakDate);
}
 
 
/* ──────────────────────────────────────
   DAILY RESET
   At midnight, uncomplete all daily tasks
   and evaluate the streak for yesterday.
────────────────────────────────────── */
 
function checkDailyReset() {
  const today = todayStr();
 
  tasks.forEach(function(task) {
    if (task.type !== 'daily') return;
 
    // If this task was last touched before today, reset it
    if (task.lastCompletedDate && task.lastCompletedDate < today) {
      // Was it completed yesterday?
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
 
      if (task.lastCompletedDate !== yStr) {
        // Missed a day — reset streak
        task.streak = 0;
      }
      task.completed = false;
    }
  });
 
  saveData();
}
 
 
/* ──────────────────────────────────────
   WEEKLY RESET
   On new week start (Monday), reset all
   weekly task counts back to 0.
────────────────────────────────────── */
 
function checkWeeklyReset() {
  const weekStart = currentWeekStart();
 
  tasks.forEach(function(task) {
    if (task.type !== 'weekly') return;
 
    // If the stored weekStartDate is before the current week, reset
    if (!task.weekStartDate || task.weekStartDate < weekStart) {
      task.weeklyCount    = 0;
      task.completed      = false;
      task.weekStartDate  = weekStart;
    }
  });
 
  saveData();
}
 
 
/* ──────────────────────────────────────
   ADD TASK
────────────────────────────────────── */
 
function addTask() {
  const title = document.getElementById('inputTitle').value.trim();
  const type  = document.getElementById('inputType').value;
  const due   = document.getElementById('inputDue').value;
  const goal  = parseInt(document.getElementById('inputGoal').value) || 3;
 
  // Validation
  if (!title) {
    flashInput('inputTitle');
    return;
  }
 
  const task = {
    id:               Date.now(),
    title:            title,
    type:             type,
    completed:        false,
    dueDate:          due || null,
    createdAt:        todayStr(),
    completedAt:      null,
 
    // Daily fields
    streak:           0,
    lastCompletedDate: null,
 
    // Weekly fields
    weeklyTarget:     (type === 'weekly') ? goal : null,
    weeklyCount:      0,
    weekStartDate:    (type === 'weekly') ? currentWeekStart() : null
  };
 
  tasks.unshift(task);  // Add to top
  saveData();
 
  // Reset form
  document.getElementById('inputTitle').value = '';
  document.getElementById('inputDue').value   = '';
  document.getElementById('inputType').value  = 'onetime';
  document.getElementById('weeklyGoalGroup').style.display = 'none';
 
  renderAll();
}
 
// Flash red border on empty field
function flashInput(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#ef4444';
  el.focus();
  setTimeout(function() { el.style.borderColor = ''; }, 1500);
}
 
 
/* ──────────────────────────────────────
   TOGGLE COMPLETE
────────────────────────────────────── */
 
function toggleComplete(id) {
  const task = tasks.find(function(t) { return t.id === id; });
  if (!task) return;
 
  const today = todayStr();
 
  if (task.type === 'onetime') {
    // Toggle permanently
    task.completed = !task.completed;
    if (task.completed) {
      task.completedAt = today;
      allTimeCount++;
    } else {
      task.completedAt = null;
      if (allTimeCount > 0) allTimeCount--;
    }
 
  } else if (task.type === 'daily') {
    task.completed = !task.completed;
    if (task.completed) {
      // Increment streak if last completed was yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
 
      if (task.lastCompletedDate === yStr || task.lastCompletedDate === today) {
        task.streak++;
      } else {
        task.streak = 1;  // Start fresh
      }
      task.lastCompletedDate = today;
      task.completedAt       = today;
      allTimeCount++;
    } else {
      // Undo
      task.streak = Math.max(0, task.streak - 1);
      if (allTimeCount > 0) allTimeCount--;
      task.completedAt = null;
    }
 
  } else if (task.type === 'weekly') {
    if (!task.completed) {
      // Increment weekly count
      task.weeklyCount++;
      allTimeCount++;
      task.completedAt = today;
 
      // Mark fully complete if target reached
      if (task.weeklyCount >= task.weeklyTarget) {
        task.completed = true;
      }
    } else {
      // Uncheck — reduce count
      task.weeklyCount = Math.max(0, task.weeklyCount - 1);
      if (allTimeCount > 0) allTimeCount--;
      task.completed   = task.weeklyCount >= task.weeklyTarget;
      if (!task.completed) task.completedAt = null;
    }
  }
 
  saveData();
  renderAll();
}
 
 
/* ──────────────────────────────────────
   DELETE TASK
────────────────────────────────────── */
 
function deleteTask(id) {
  tasks = tasks.filter(function(t) { return t.id !== id; });
  saveData();
  renderAll();
}
 
 
/* ──────────────────────────────────────
   EDIT TASK — Open Modal
────────────────────────────────────── */
 
function openEdit(id) {
  const task = tasks.find(function(t) { return t.id === id; });
  if (!task) return;
 
  editingTaskId = id;
 
  document.getElementById('editTitle').value = task.title;
  document.getElementById('editType').value  = task.type;
  document.getElementById('editDue').value   = task.dueDate || '';
  document.getElementById('editGoal').value  = task.weeklyTarget || 3;
 
  // Show/hide weekly goal field
  document.getElementById('editWeeklyGoalGroup').style.display =
    task.type === 'weekly' ? 'flex' : 'none';
 
  document.getElementById('modalOverlay').classList.remove('hidden');
}
 
function closeModal(event) {
  // If clicking overlay background (not the modal itself), close
  if (event && event.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.add('hidden');
  editingTaskId = null;
}
 
function toggleEditWeeklyGoal() {
  const type = document.getElementById('editType').value;
  document.getElementById('editWeeklyGoalGroup').style.display =
    type === 'weekly' ? 'flex' : 'none';
}
 
function saveEdit() {
  const task = tasks.find(function(t) { return t.id === editingTaskId; });
  if (!task) return;
 
  task.title      = document.getElementById('editTitle').value.trim() || task.title;
  task.type       = document.getElementById('editType').value;
  task.dueDate    = document.getElementById('editDue').value || null;
 
  if (task.type === 'weekly') {
    task.weeklyTarget  = parseInt(document.getElementById('editGoal').value) || 3;
    task.weekStartDate = task.weekStartDate || currentWeekStart();
    task.weeklyCount   = task.weeklyCount   || 0;
  }
 
  saveData();
  document.getElementById('modalOverlay').classList.add('hidden');
  editingTaskId = null;
  renderAll();
}
 
 
/* ──────────────────────────────────────
   RENDER TASKS
────────────────────────────────────── */
 
function renderTasks() {
  const list        = document.getElementById('taskList');
  const searchVal   = document.getElementById('searchInput').value.toLowerCase().trim();
 
  // Start with all tasks
  let filtered = tasks.slice();
 
  // 1. Apply nav filter (type / due today / overdue)
  if (activeNavFilter === 'today') {
    filtered = filtered.filter(function(t) {
      return t.dueDate === todayStr();
    });
  } else if (activeNavFilter === 'daily') {
    filtered = filtered.filter(function(t) { return t.type === 'daily'; });
  } else if (activeNavFilter === 'weekly') {
    filtered = filtered.filter(function(t) { return t.type === 'weekly'; });
  } else if (activeNavFilter === 'overdue') {
    filtered = filtered.filter(function(t) {
      return getDueStatus(t.dueDate) === 'due-overdue';
    });
  }
 
  // 2. Apply status filter
  if (activeStatusFilter === 'pending') {
    filtered = filtered.filter(function(t) { return !t.completed; });
  } else if (activeStatusFilter === 'completed') {
    filtered = filtered.filter(function(t) { return t.completed; });
  }
 
  // 3. Apply search
  if (searchVal) {
    filtered = filtered.filter(function(t) {
      return t.title.toLowerCase().includes(searchVal);
    });
  }
 
  // Update task count badge
  document.getElementById('taskCount').textContent =
    filtered.length + (filtered.length === 1 ? ' task' : ' tasks');
 
  // Empty state
  if (filtered.length === 0) {
    list.innerHTML = buildEmptyState();
    return;
  }
 
  // Build card HTML
  list.innerHTML = filtered.map(function(task) {
    return buildTaskCard(task);
  }).join('');
}
 
 
/* ──────────────────────────────────────
   BUILD TASK CARD HTML
────────────────────────────────────── */
 
function buildTaskCard(task) {
  const dueStatus = getDueStatus(task.dueDate);
  const dueLabel  = getDueLabel(dueStatus);
 
  // Checkbox
  const checkClass = task.completed ? 'task-checkbox checked' : 'task-checkbox';
  const checkMark  = task.completed ? '✓' : '';
 
  // Type badge
  const typeBadgeLabels = { onetime: '🔵 One-Time', daily: '🟡 Daily', weekly: '🟣 Weekly' };
  const typeBadge =
    '<span class="type-badge ' + task.type + '">' + typeBadgeLabels[task.type] + '</span>';
 
  // Due badge
  const dueBadge = dueLabel
    ? '<span class="due-badge ' + dueStatus + '">' + dueLabel + '</span>'
    : '';
 
  // Meta items
  let metaItems = '';
 
  // Created date
  metaItems += '<span class="task-meta-item">📌 Added ' + formatDate(task.createdAt) + '</span>';
 
  // Due date (if set)
  if (task.dueDate) {
    metaItems += '<span class="task-meta-item">📆 Due ' + formatDate(task.dueDate) + '</span>';
  }
 
  // Daily streak
  if (task.type === 'daily' && task.streak > 0) {
    metaItems += '<span class="task-meta-item">🔥 ' + task.streak + ' day streak</span>';
  }
 
  // Weekly progress bar
  if (task.type === 'weekly') {
    const pct = Math.min(100, Math.round((task.weeklyCount / task.weeklyTarget) * 100));
    metaItems +=
      '<span class="task-meta-item weekly-progress">' +
        '<span class="weekly-bar-wrap">' +
          '<span class="weekly-bar-fill" style="width:' + pct + '%"></span>' +
        '</span>' +
        '<span class="weekly-count">' + task.weeklyCount + ' / ' + task.weeklyTarget + '</span>' +
      '</span>';
  }
 
  // Card classes
  let cardClasses = 'task-card type-' + task.type;
  if (task.completed) cardClasses += ' completed-card';
  if (dueStatus === 'due-overdue' && !task.completed) cardClasses += ' is-overdue';
 
  return (
    '<div class="' + cardClasses + '" id="card-' + task.id + '">' +
 
      // Checkbox
      '<button class="' + checkClass + '" onclick="toggleComplete(' + task.id + ')">' +
        checkMark +
      '</button>' +
 
      // Center
      '<div class="task-center">' +
        '<div class="task-title-row">' +
          '<span class="task-title">' + escapeHTML(task.title) + '</span>' +
          typeBadge +
          dueBadge +
        '</div>' +
        '<div class="task-meta">' + metaItems + '</div>' +
      '</div>' +
 
      // Actions
      '<div class="task-actions">' +
        '<button class="btn-action" onclick="openEdit(' + task.id + ')" title="Edit">✏️</button>' +
        '<button class="btn-action btn-delete" onclick="deleteTask(' + task.id + ')" title="Delete">🗑️</button>' +
      '</div>' +
 
    '</div>'
  );
}
 
// Escape HTML to prevent XSS in task titles
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
 
function buildEmptyState() {
  const msgs = {
    all:     'Create your first task to get started.',
    today:   'No tasks due today. Enjoy your day!',
    daily:   'No daily tasks yet. Add one above.',
    weekly:  'No weekly tasks yet. Add one above.',
    overdue: 'No overdue tasks. You\'re all caught up! 🎉'
  };
 
  return (
    '<div class="empty-state">' +
      '<div class="empty-icon">📝</div>' +
      '<p class="empty-title">No tasks yet.</p>' +
      '<p class="empty-sub">' + (msgs[activeNavFilter] || msgs.all) + '</p>' +
    '</div>'
  );
}
 
 
/* ──────────────────────────────────────
   UPDATE SIDEBAR METRICS
────────────────────────────────────── */
 
function updateMetrics() {
  const today = todayStr();
 
  // Tasks due today (all pending tasks with dueDate = today OR no due date dailys)
  const dueToday = tasks.filter(function(t) {
    return !t.completed && (t.dueDate === today || t.type === 'daily');
  });
 
  const dueTodayCount     = dueToday.length;
  const completedToday    = tasks.filter(function(t) {
    return t.completed && (t.dueDate === today || t.type === 'daily');
  }).length;
 
  const totalToday        = dueTodayCount + completedToday;
  const momentumPct       = totalToday > 0
    ? Math.round((completedToday / totalToday) * 100)
    : 0;
 
  // Update DOM
  document.getElementById('metricMomentum').textContent  = momentumPct + '%';
  document.getElementById('metricStreak').textContent    = globalStreak;
  document.getElementById('metricDueToday').textContent  = dueTodayCount;
 
  // Progress ring
  updateRing(momentumPct);
 
  // Milestone
  updateMilestone();
}
 
 
/* ──────────────────────────────────────
   PROGRESS RING
────────────────────────────────────── */
 
function updateRing(pct) {
  // Total completion across all tasks
  const total     = tasks.length;
  const completed = tasks.filter(function(t) { return t.completed; }).length;
  const overall   = total > 0 ? Math.round((completed / total) * 100) : 0;
 
  const circumference = 314; // 2 * PI * r (r=50)
  const offset        = circumference - (overall / 100) * circumference;
 
  document.getElementById('ringFill').style.strokeDashoffset = offset;
  document.getElementById('ringPct').textContent             = overall + '%';
}
 
 
/* ──────────────────────────────────────
   MILESTONE SYSTEM
────────────────────────────────────── */
 
function updateMilestone() {
  const tiers = [
    { min: 0,  max: 10,  icon: '🌱', name: 'Beginner',           next: 11 },
    { min: 11, max: 25,  icon: '🚀', name: 'Achiever',           next: 26 },
    { min: 26, max: 50,  icon: '🔥', name: 'Performer',          next: 51 },
    { min: 51, max: Infinity, icon: '👑', name: 'Productivity Master', next: null }
  ];
 
  let currentTier = tiers[0];
  for (let i = 0; i < tiers.length; i++) {
    if (allTimeCount >= tiers[i].min && allTimeCount <= tiers[i].max) {
      currentTier = tiers[i];
      break;
    }
  }
 
  document.getElementById('milestoneIcon').textContent = currentTier.icon;
  document.getElementById('milestoneName').textContent = currentTier.name;
  document.getElementById('allTimeCount').textContent  = allTimeCount;
 
  // Progress bar within current tier
  if (currentTier.next !== null) {
    const rangeSize = currentTier.max - currentTier.min + 1;
    const progress  = allTimeCount - currentTier.min;
    const pct       = Math.round((progress / rangeSize) * 100);
    document.getElementById('milestoneBar').style.width  = pct + '%';
    document.getElementById('milestoneNext').textContent =
      (currentTier.next - allTimeCount) + ' more to next rank';
  } else {
    document.getElementById('milestoneBar').style.width  = '100%';
    document.getElementById('milestoneNext').textContent = '🏆 Maximum rank achieved!';
  }
}
 
 
/* ──────────────────────────────────────
   GLOBAL STREAK — Update daily
   Checks if ALL daily tasks were done
   yesterday/today to maintain streak.
────────────────────────────────────── */
 
function updateGlobalStreak() {
  const today      = todayStr();
  const dailyTasks = tasks.filter(function(t) { return t.type === 'daily'; });
 
  if (dailyTasks.length === 0) return;
 
  const allDoneToday = dailyTasks.every(function(t) { return t.completed; });
 
  if (allDoneToday && lastStreakDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
 
    if (lastStreakDate === yStr || lastStreakDate === '') {
      globalStreak++;
    } else {
      globalStreak = 1;  // Reset streak — missed a day
    }
    lastStreakDate = today;
    saveData();
  }
}
 
 
/* ──────────────────────────────────────
   RENDER ALL — Master update function
   Call this after every state change.
────────────────────────────────────── */
 
function renderAll() {
  updateGlobalStreak();
  updateMetrics();
  renderTasks();
}
 
 
/* ──────────────────────────────────────
   FILTER CONTROLS
────────────────────────────────────── */
 
// Sidebar nav filter (type-based)
function setNavFilter(filter) {
  activeNavFilter = filter;
 
  // Update active button styling
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
 
  // Update page title
  const titles = {
    all:     'All Tasks',
    today:   'Due Today',
    daily:   'Daily Tasks',
    weekly:  'Weekly Tasks',
    overdue: 'Overdue Tasks'
  };
  document.getElementById('pageTitle').textContent = titles[filter] || 'All Tasks';
 
  renderTasks();
}
 
// Status filter tabs (All / Pending / Completed)
function setStatusFilter(status) {
  activeStatusFilter = status;
 
  document.querySelectorAll('.filter-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.status === status);
  });
 
  renderTasks();
}
 
 
/* ──────────────────────────────────────
   FORM HELPERS
────────────────────────────────────── */
 
// Show/hide weekly goal input based on type selection
function toggleWeeklyGoal() {
  const type = document.getElementById('inputType').value;
  document.getElementById('weeklyGoalGroup').style.display =
    type === 'weekly' ? 'flex' : 'none';
}
 
// Toggle add task form visibility
function toggleForm() {
  const body = document.getElementById('formBody');
  const btn  = document.getElementById('formToggleBtn');
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  btn.textContent    = isHidden ? '▲ Hide' : '▼ Show';
}
 
// Mobile sidebar toggle
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
 
// Allow Enter key in title field to add task
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('inputTitle').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') addTask();
  });
});
 
 
/* ──────────────────────────────────────
   MIDNIGHT RESET CHECK
   Every 60 seconds, check if the date
   has changed and run daily resets.
────────────────────────────────────── */
 
let lastCheckedDate = todayStr();
 
setInterval(function() {
  const currentDate = todayStr();
  if (currentDate !== lastCheckedDate) {
    lastCheckedDate = currentDate;
    checkDailyReset();
    checkWeeklyReset();
    renderAll();
  }
}, 60000); // Check every 60 seconds
 
 
/* ──────────────────────────────────────
   INIT — Run on page load
────────────────────────────────────── */
 
loadData();
renderAll();