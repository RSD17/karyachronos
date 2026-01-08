import { auth } from "/js/firebase.js";
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { db } from "/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

(() => {
  let STORAGE_KEY = null;

  let WEIGHTS = { urgency: 0.4, importance: 0.3, difficulty: 0.2, duration: 0.1 };
  let T_HIGH = 0.66;
  let T_MED = 0.33;

  const openBtn = document.getElementById('openAddTask');
  const modal = document.getElementById('task-modal');
  const modalCloseBtns = document.querySelectorAll('.modal-close');
  const taskForm = document.getElementById('task-form');
  const highList = document.getElementById('high-list');
  const mediumList = document.getElementById('medium-list');
  const lowList = document.getElementById('low-list');
  const completedList = document.getElementById('completed-list');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const progressSlider = document.getElementById('progress-slider');
  const toggleCompletedBtn = document.getElementById('toggleCompleted');

  const nameField = document.getElementById('task-name');
  const deadlineField = document.getElementById('task-deadline');
  const durationField = document.getElementById('task-duration');
  const difficultyField = document.getElementById('task-difficulty');
  const importanceField = document.getElementById('task-importance');
  const descField = document.getElementById('task-desc');

  let tasks = [];

  // Settings
  const SETTINGS_KEY = 'kacy_tasks_settings_v1';
  const DEFAULT_SETTINGS = {
    weights: { urgency: 0.45, importance: 0.30, difficulty: 0.15, duration: 0.10 },
    MAX_IMPORTANCE: 5,
    MAX_DIFFICULTY: 5,
    MAX_HOURS: 6,
    URGENCY_MIN_DAYS: 0.25,
    T_HIGH: 0.66,
    T_MED: 0.33
  };

  let SETTINGS = null;

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      SETTINGS = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
      if (!SETTINGS.weights) SETTINGS.weights = { ...DEFAULT_SETTINGS.weights };
    } catch {
      SETTINGS = { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS));
  }

  // Utilities
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  function clamp(v, a = 0, b = 1) { return Math.max(a, Math.min(b, v)); }  // Kept one definition

  function normalizeWeights(w) {
    const s = w.urgency + w.importance + w.difficulty + w.duration;
    if (!s) return DEFAULT_SETTINGS.weights;
    return {
      urgency: w.urgency / s,
      importance: w.importance / s,
      difficulty: w.difficulty / s,
      duration: w.duration / s
    };
  }

  async function loadTasks() {
  if (!STORAGE_KEY) return;
  try {
    const q = query(collection(db, "users", STORAGE_KEY.split('_')[2], "tasks"), orderBy("createdAt"));
    const querySnapshot = await getDocs(q);
    tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("Failed to load tasks from Firestore:", err);
    tasks = [];
  }
}

  async function saveTasks() {
    if (!STORAGE_KEY) return;

    try {
      const userTasksCol = collection(db, "users", STORAGE_KEY.split('_')[2], "tasks");
      for (const t of tasks) {
        const taskDocRef = doc(userTasksCol, t.id);
        await setDoc(taskDocRef, t);
      }
    } catch (err) {
      console.error("Failed to save tasks to Firestore:", err);
    }
  }

  const EPS = 1e-6;

  // Added missing function
  function formatShortDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString();
  }

  function computeScores() {
    // compute absolute normalized values for ACTIVE (non-completed) tasks
    const active = tasks.filter(t => !t.completed);
    if (!active.length) {
      tasks.forEach(t => t.priorityScore = 0);
      return;
    }

    active.forEach(t => {
      // urgency: inverse of days remaining, clamped to [0,1]
      const msRem = new Date(t.deadline).getTime() - Date.now();
      let daysRem = msRem / (1000 * 60 * 60 * 24);
      if (isNaN(daysRem)) daysRem = Infinity;
      const URGENCY_MIN = (SETTINGS && SETTINGS.URGENCY_MIN_DAYS) ? SETTINGS.URGENCY_MIN_DAYS : DEFAULT_SETTINGS.URGENCY_MIN_DAYS;
      const urgencyRaw = 1 / Math.max(daysRem, URGENCY_MIN);
      const urgency = clamp(urgencyRaw, 0, 1);

      // importance & difficulty: divide by known max (from settings)
      const MAX_IMP = SETTINGS && SETTINGS.MAX_IMPORTANCE ? SETTINGS.MAX_IMPORTANCE : DEFAULT_SETTINGS.MAX_IMPORTANCE;
      const MAX_DIFF = SETTINGS && SETTINGS.MAX_DIFFICULTY ? SETTINGS.MAX_DIFFICULTY : DEFAULT_SETTINGS.MAX_DIFFICULTY;
      const importanceNorm = clamp((Number(t.importance) || 0) / MAX_IMP, 0, 1);
      const difficultyNorm = clamp((Number(t.difficulty) || 0) / MAX_DIFF, 0, 1);

      // duration: inverse normalization with fixed MAX_HOURS
      const MAX_H = SETTINGS && SETTINGS.MAX_HOURS ? SETTINGS.MAX_HOURS : DEFAULT_SETTINGS.MAX_HOURS;
      const durationRaw = Number(t.duration) || 0;
      const durationNorm = clamp(1 - (durationRaw / MAX_H), 0, 1);

      // weights come from SETTINGS.weights but we normalize them to sum to 1
      const w = SETTINGS && SETTINGS.weights ? normalizeWeights(SETTINGS.weights) : normalizeWeights(DEFAULT_SETTINGS.weights);

      const score = w.urgency * urgency
                  + w.importance * importanceNorm
                  + w.difficulty * difficultyNorm
                  + w.duration * durationNorm;

      t.priorityScore = Number(score.toFixed(6));
    });

    // For completed tasks, set score to -1 so they sort last
    tasks.filter(t => t.completed).forEach(t => t.priorityScore = -1);
  }

  function categorizeAndSort() {
    // categorize based on priorityScore
    const active = tasks.filter(t => !t.completed).slice();
    active.sort((a,b) => b.priorityScore - a.priorityScore);
    const high = [], med = [], low = [];
    active.forEach(t => {
      if (t.priorityScore >= T_HIGH) high.push(t);
      else if (t.priorityScore >= T_MED) med.push(t);
      else low.push(t);
    });
    const completed = tasks.filter(t => t.completed);
    return { high, med, low, completed };
  }

  function render() {
    // clear lists
    highList.innerHTML = '';
    mediumList.innerHTML = '';
    lowList.innerHTML = '';
    completedList.innerHTML = '';

    const { high, med, low, completed } = categorizeAndSort();

     const makeCard = (t) => {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.id = t.id;

    // Determine priority class: use finalPriorityScore for completed tasks, priorityScore for active
    const scoreToUse = t.completed ? (t.finalPriorityScore || 0) : t.priorityScore;
    const priorityClass = (scoreToUse >= T_HIGH) ? 'priority-high' : (scoreToUse >= T_MED ? 'priority-medium' : 'priority-low');
    card.classList.add(priorityClass);

    // Add 'completed' class for additional visual cues (e.g., strikethrough)
    if (t.completed) {
      card.classList.add('completed');
    } else {
        card.classList.add(priorityClass);
      }

      const left = document.createElement('div'); left.className = 'task-left';
      // accessible custom circular checkbox: real input inside label with visual span
      const chkWrap = document.createElement('label'); chkWrap.className = 'checkwrap';
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'real-checkbox'; chk.checked = !!t.completed;
      chk.addEventListener('change', () => toggleComplete(t.id));
      const chkVisual = document.createElement('span'); chkVisual.className = 'custom-checkbox';
      chkWrap.appendChild(chk); chkWrap.appendChild(chkVisual);

      const info = document.createElement('div');
      const name = document.createElement('div'); name.className = 'task-name'; name.textContent = t.name;

      const meta = document.createElement('div'); meta.className = 'task-meta';
      const chips = document.createElement('div'); chips.className = 'meta-chips';

      const dueChip = document.createElement('span'); dueChip.className = 'chip chip-due'; dueChip.textContent = `Due ${formatShortDate(t.deadline)}`;
      const durChip = document.createElement('span'); durChip.className = 'chip chip-dur'; durChip.textContent = `${t.duration}h`;
      const diffChip = document.createElement('span'); diffChip.className = 'chip chip-diff'; diffChip.textContent = `Diff ${t.difficulty}`;
      const impChip = document.createElement('span'); impChip.className = 'chip chip-imp'; impChip.textContent = `Imp ${t.importance}`;

      // If task is overdue (deadline in past and not completed), add a red "Overdue" chip
      const dlMs = new Date(t.deadline).getTime();
      const isOverdue = !t.completed && !isNaN(dlMs) && (dlMs < Date.now());
      if (isOverdue) {
        const overdueChip = document.createElement('span'); overdueChip.className = 'chip chip-overdue'; overdueChip.textContent = 'Overdue';
        overdueChip.setAttribute('aria-label', 'Overdue task');
        chips.appendChild(overdueChip);
      }

      chips.appendChild(dueChip); chips.appendChild(durChip); chips.appendChild(diffChip); chips.appendChild(impChip);
      meta.appendChild(chips);
      info.appendChild(name); info.appendChild(meta);

      // description tooltip (hidden until hover)
      if (t.desc && t.desc.length) {
        const d = document.createElement('div'); d.className = 'task-desc'; d.textContent = t.desc; info.appendChild(d);
      }

      left.appendChild(chkWrap); left.appendChild(info);

      const actions = document.createElement('div'); actions.className = 'task-actions';
      const del = document.createElement('button'); del.className = 'btn-delete'; del.type = 'button'; del.setAttribute('aria-label', `Delete ${t.name}`); del.innerHTML = '<i class="fa-solid fa-trash"></i>'; del.addEventListener('click', () => deleteTask(t.id));
      actions.appendChild(del);

      card.appendChild(left); card.appendChild(actions);

      // animate-in for smoother appearance
      card.classList.add('animate-in');
      card.addEventListener('animationend', () => card.classList.remove('animate-in'));

      return card;
    };

    high.forEach(t => highList.appendChild(makeCard(t)));
    med.forEach(t => mediumList.appendChild(makeCard(t)));
    low.forEach(t => lowList.appendChild(makeCard(t)));
    completed.forEach(t => {
      const c = makeCard(t);
      c.querySelector('input[type="checkbox"]').checked = true;
      completedList.appendChild(c);
    });

    // progress
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const pct = total ? Math.round((done/total) * 100) : 0;
    progressFill.style.width = pct + '%';
    progressPercent.textContent = pct + '%';
    if (progressSlider) progressSlider.value = pct;

  }

  async function addTaskFromForm(e) {
    e.preventDefault();
    const name = nameField.value.trim();
    const deadline = deadlineField.value;
    const duration = Number(durationField.value);
    const difficulty = Number(difficultyField.value);
    const importance = Number(importanceField.value);
    const desc = descField.value.trim();

    if (!name || !deadline) return alert('Please enter task name and deadline');
    if (!difficultyField.value || !importanceField.value) {
      return alert('Please select Difficulty and Importance from the dropdowns.');
    }

    // validate deadline
    const dl = new Date(deadline);
    const dlDateOnly = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate());
    const todayDateOnly = new Date();
    todayDateOnly.setHours(0,0,0,0);
    if (dlDateOnly < todayDateOnly) return alert('Deadline must be today or a future date.');

    // create task object
    const newTask = {
      id: uid(),
      name,
      deadline,
      duration,
      difficulty,
      importance,
      desc,
      createdAt: new Date().toISOString(),
      completed: false,
      priorityScore: 0
    };

    tasks.push(newTask);
    computeScores();
    render();
    closeModal();
    taskForm.reset();

    // Save only this new task to Firestore
    try {
      const userTasksCol = collection(db, "users", STORAGE_KEY.split('_')[2], "tasks");
      const newTaskRef = doc(userTasksCol, newTask.id);
      await setDoc(newTaskRef, newTask);
    } catch (err) {
      console.error("Failed to save new task:", err);
    }
  }


  async function deleteTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const conf = window.confirm(`Delete task "${t.name}"? This action cannot be undone.`);
    if (!conf) return;

    tasks = tasks.filter(t => t.id !== id);
    computeScores();
    render();

    // Delete from Firestore
    try {
      const userTasksCol = collection(db, "users", STORAGE_KEY.split('_')[2], "tasks");
      const taskRef = doc(userTasksCol, id);
      await deleteDoc(taskRef);
    } catch (err) {
      console.error("Failed to delete task from Firestore:", err);
    }
  }


  async function toggleComplete(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;

    if (!t.completed) t.finalPriorityScore = t.priorityScore;
    t.completed = !t.completed;

    computeScores();
    render();

    // Update this task in Firestore
    try {
      const userTasksCol = collection(db, "users", STORAGE_KEY.split('_')[2], "tasks");
      const taskRef = doc(userTasksCol, t.id);
      await updateDoc(taskRef, { completed: t.completed, finalPriorityScore: t.finalPriorityScore || null });
    } catch (err) {
      console.error("Failed to update task completion:", err);
    }
  }



  // set minimum allowed deadline (today at 00:00) on the datetime input
  function setDeadlineMin() {
    if (!deadlineField) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    // min will allow any time today or later (00:00 of today)
    deadlineField.min = `${yyyy}-${mm}-${dd}T00:00`;
  }

  function openModal() {
    setDeadlineMin();
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => nameField.focus(), 50);
  }
  function closeModal() {
    modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
  }

  // Initialize settings and UI wiring
  loadSettings();
  // reflect settings in shorthand variables
  WEIGHTS = normalizeWeights(SETTINGS.weights || DEFAULT_SETTINGS.weights);
  T_HIGH = SETTINGS.T_HIGH;
  T_MED = SETTINGS.T_MED;

  // Settings UI helpers
  const openSettingsBtn = document.getElementById('openSettings');
  const settingsPanel = document.getElementById('settings-panel');
  const applyBtn = document.getElementById('applySettings');
  const resetBtn = document.getElementById('resetSettings');
  const closeSettingsBtn = document.getElementById('closeSettings');

  function populateSettingsUI() {
    if (!settingsPanel) return;
    document.getElementById('w-urgency').value = SETTINGS.weights.urgency;
    document.getElementById('w-importance').value = SETTINGS.weights.importance;
    document.getElementById('w-difficulty').value = SETTINGS.weights.difficulty;
    document.getElementById('w-duration').value = SETTINGS.weights.duration;
    document.getElementById('max-hours').value = SETTINGS.MAX_HOURS;
    document.getElementById('urgency-min-days').value = SETTINGS.URGENCY_MIN_DAYS;
    document.getElementById('t-high').value = SETTINGS.T_HIGH;
    document.getElementById('t-med').value = SETTINGS.T_MED;
  }

  function openSettings() {
    if (!settingsPanel) return;
    settingsPanel.style.display = 'block';
    settingsPanel.setAttribute('aria-hidden', 'false');
    openSettingsBtn.setAttribute('aria-expanded', 'true');
    populateSettingsUI();
  }
  function closeSettings() {
    if (!settingsPanel) return;
    settingsPanel.style.display = 'none';
    settingsPanel.setAttribute('aria-hidden', 'true');
    openSettingsBtn.setAttribute('aria-expanded', 'false');
  }

  function applySettings() {
    // read values
    const w = {
      urgency: parseFloat(document.getElementById('w-urgency').value) || 0,
      importance: parseFloat(document.getElementById('w-importance').value) || 0,
      difficulty: parseFloat(document.getElementById('w-difficulty').value) || 0,
      duration: parseFloat(document.getElementById('w-duration').value) || 0
    };
    const maxH = parseFloat(document.getElementById('max-hours').value) || DEFAULT_SETTINGS.MAX_HOURS;
    const urgMin = parseFloat(document.getElementById('urgency-min-days').value) || DEFAULT_SETTINGS.URGENCY_MIN_DAYS;
    const tHigh = parseFloat(document.getElementById('t-high').value);
    const tMed = parseFloat(document.getElementById('t-med').value);

    // validate thresholds
    if (isNaN(tHigh) || isNaN(tMed) || tHigh <= tMed) return alert('Thresholds invalid: ensure High > Medium and both are numbers.');

    SETTINGS.weights = normalizeWeights(w);
    SETTINGS.MAX_HOURS = Math.max(0.5, maxH);
    SETTINGS.URGENCY_MIN_DAYS = Math.max(0.01, urgMin);
    SETTINGS.T_HIGH = clamp(tHigh, 0, 1);
    SETTINGS.T_MED = clamp(tMed, 0, 1);

    saveSettings();
    // update immediate values
    WEIGHTS = normalizeWeights(SETTINGS.weights);
    T_HIGH = SETTINGS.T_HIGH;
    T_MED = SETTINGS.T_MED;

    computeAndRenderAll();
    closeSettings();
  }

  function resetSettings() {
    SETTINGS = { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_SETTINGS.weights } };
    saveSettings();
    populateSettingsUI();
    // apply defaults
    WEIGHTS = normalizeWeights(SETTINGS.weights);
    T_HIGH = SETTINGS.T_HIGH;
    T_MED = SETTINGS.T_MED;
    computeAndRenderAll();
  }

  openBtn.addEventListener('click', openModal);
  modalCloseBtns.forEach(b => b.addEventListener('click', closeModal));
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  taskForm.addEventListener('submit', addTaskFromForm);
  toggleCompletedBtn.addEventListener('click', () => {
    const list = document.getElementById('completed-list');
    if (list.style.display === 'none') { list.style.display = 'block'; toggleCompletedBtn.textContent = '▼'; }
    else { list.style.display = 'none'; toggleCompletedBtn.textContent = '▲'; }
  });

  if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => openSettings());
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => closeSettings());
  if (applyBtn) applyBtn.addEventListener('click', () => applySettings());
  if (resetBtn) resetBtn.addEventListener('click', () => resetSettings());

  function computeAndRenderAll() {
    if (SETTINGS) {
      WEIGHTS = normalizeWeights(SETTINGS.weights || DEFAULT_SETTINGS.weights);
      T_HIGH = SETTINGS.T_HIGH;
      T_MED = SETTINGS.T_MED;
    }
    computeScores(); render();
  }

  loadTasks(); computeAndRenderAll();


  onAuthStateChanged(auth, user => {
    if (!user) {
    window.location.href = "/html/loginsignup.html";
      return;
    }

    STORAGE_KEY = `kacy_tasks_${user.uid}`;

    loadSettings();
    const tasksCol = collection(db, "users", user.uid, "tasks");
      onSnapshot(tasksCol, snapshot => {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        computeAndRenderAll();
    });
    computeAndRenderAll();
  });
})();