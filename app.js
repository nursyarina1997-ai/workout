/* =========================================================
   ASCEND — Personal Development & Workout Tracker
   Single-file vanilla JS app. Data persisted in localStorage.
   ========================================================= */

const STORE_KEY = "ascend_db_v1";

/* ---------------- GLOBAL ERROR HANDLING ----------------
   Keeps the app alive & shows a friendly toast instead of a
   blank/broken screen whenever something throws. */
window.addEventListener("error", function (e) {
  console.error("App error:", e.error || e.message);
  try { toast("Ralat berlaku, tetapi data anda selamat.", "⚠️"); } catch (_) {}
  return true;
});
window.addEventListener("unhandledrejection", function (e) {
  console.error("Unhandled promise rejection:", e.reason);
  try { toast("Ralat berlaku semasa memproses fail.", "⚠️"); } catch (_) {}
});
function safe(fn, fallbackMsg) {
  return function (...args) {
    try { return fn.apply(this, args); }
    catch (err) {
      console.error(err);
      try { toast(fallbackMsg || "Sesuatu tidak kena, sila cuba lagi.", "⚠️"); } catch (_) {}
    }
  };
}

const QUOTES = [
  ["Disiplin adalah jambatan antara matlamat dan pencapaian.", "Jim Rohn"],
  ["Badan mencapai apa yang minda percaya.", "Anon"],
  ["Bukan sekali hebat yang penting, tapi konsisten setiap hari.", "Anon"],
  ["Kesakitan hari ini adalah kekuatan hari esok.", "Anon"],
  ["Jangan berhenti apabila penat, berhenti apabila selesai.", "Anon"],
  ["Setiap hari adalah peluang baru untuk jadi lebih baik daripada semalam.", "Anon"],
  ["Streak dibina satu hari pada satu masa. Jangan putuskan rantai.", "Anon"],
  ["Kau tidak perlu hebat untuk mula, tapi kau perlu mula untuk jadi hebat.", "Zig Ziglar"],
  ["Rehat itu bahagian dari proses, bukan lawan kepada proses.", "Anon"],
  ["Small steps every day beat big leaps once in a while.", "Anon"],
];

const ICONS = ["💪","🏋️","🕌","📖","💻","📈","💧","😴","🚫","🧘","🏃","🎯","🔥","⭐","📚","🥗","🚴","🧗","🏆","✅"];
const COLORS = ["#00D4AA","#4A90D9","#A78BFA","#FFB84D","#FF4757","#FF9AD5","#FFD700","#6BA8E8"];

function todayISO(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function esc(s) { return (s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const days = ["Ahad","Isnin","Selasa","Rabu","Khamis","Jumaat","Sabtu"];
  const months = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogo","Sep","Okt","Nov","Dis"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/* ---------------- DEFAULT DB ---------------- */
function defaultDB() {
  return {
    profile: { name: "Pengguna", since: todayISO() },
    settings: {
      scores: { workout: 25, belajar: 20, coding: 20, solat: 10, quran: 15, air: 10, tidur: 15 },
      waterTarget: 3000,
      nutritionTarget: { protein: 150, carbs: 250, fat: 70, calories: 2000 },
    },
    days: {},          // iso -> {workoutName,duration,mood,energy,weight,calories,water,exercises:[],notes,sleepStart,sleepEnd,sleepQuality,rest:boolean,done:boolean}
    nutrition: {},         // iso -> {protein,carbs,fat,calories} — separate from Calendar/day data
    tasks: [],          // {id,title,desc,due,dueTime,priority,category,done,createdAt}
    habits: [],          // {id,name,icon,color,createdAt}
    habitLogs: {},        // "habitId|iso" -> true
    goals: [],          // {id,name,category,start,target,cur,tgt,color,icon,note,completed,completedAt}
    achievements: [],       // {id,name,desc,start,target,cur,color,icon,completed,completedAt}
    notes: [],          // {id,title,body,tags,createdAt,updatedAt}
    gallery: [],          // {id,dataUrl,type,date,weight,note,tags}
    records: {},          // exerciseName -> {value,date}
    sidebarCollapsed: false,
  };
}

let DB = loadDB();

function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultDB();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultDB(), parsed);
  } catch (e) { return defaultDB(); }
}
function saveDB() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(DB));
    return true;
  } catch (err) {
    console.error("saveDB failed:", err);
    if (err && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014)) {
      toast("Storan pelayar penuh! Padam sebahagian gambar/video lama (Progress Gallery) untuk simpan data baharu.", "⚠️");
    } else {
      toast("Gagal menyimpan data. Sila cuba lagi.", "⚠️");
    }
    return false;
  }
}
function getDay(iso) {
  if (!DB.days[iso]) DB.days[iso] = { exercises: [] };
  return DB.days[iso];
}
function getNutrition(iso) {
  if (!DB.nutrition[iso]) DB.nutrition[iso] = { protein: "", carbs: "", fat: "", calories: "" };
  return DB.nutrition[iso];
}

/* ---------------- MEDIA (shared between Calendar & Gallery) ----------------
   DB.gallery is the single source of truth. Every item:
   { id, dataUrl, type:'image'|'video', mime, date, weight, note, tags:[] , createdAt } */
function mediaForDate(iso) { return DB.gallery.filter(g => g.date === iso); }
function fileKind(file) {
  if (file.type && file.type.startsWith("video")) return "video";
  if (file.type && file.type.startsWith("image")) return "image";
  const ext = (file.name || "").split(".").pop().toLowerCase();
  if (["mp4","mov","webm","m4v","avi","mkv"].includes(ext)) return "video";
  return "image";
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.onerror = () => reject(new Error("Gagal membaca fail: " + file.name));
    reader.readAsDataURL(file);
  });
}
/* Compress images client-side (resize + JPEG quality) to reduce localStorage usage.
   Videos are passed through unchanged (can't be safely re-encoded in-browser). */
function compressImageFile(file, maxDim = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith("image")) {
      readFileAsDataUrl(file).then(resolve).catch(reject);
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = ev => { img.src = ev.target.result; };
    reader.onerror = () => reject(new Error("Gagal membaca imej"));
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) { reject(err); }
    };
    img.onerror = () => reject(new Error("Gagal memproses imej"));
    reader.readAsDataURL(file);
  });
}

/* ---------------- TOAST ---------------- */
function toast(msg, icon = "✓") {
  const t = document.getElementById("toast");
  t.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------------- CONFETTI ---------------- */
function confetti() {
  const colors = ["#00D4AA", "#FFD700", "#4A90D9", "#A78BFA", "#FF6B7A"];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(p);
    const dur = 1800 + Math.random() * 1400;
    p.animate([
      { transform: `translateY(0) rotate(0deg)`, opacity: 1 },
      { transform: `translateY(${window.innerHeight + 50}px) rotate(${360 + Math.random() * 360}deg)`, opacity: 0.9 }
    ], { duration: dur, easing: "cubic-bezier(.22,.61,.36,1)" });
    setTimeout(() => p.remove(), dur);
  }
}

/* ---------------- SCORE ENGINE ---------------- */
function dailyScore(iso) {
  const day = DB.days[iso];
  let score = 0;
  if (day) {
    if (day.done && !day.rest) score += DB.settings.scores.workout;
  }
  // habits contribute based on name keyword matching to score table (soft heuristic) + flat 5 each
  DB.habits.forEach(h => {
    if (DB.habitLogs[h.id + "|" + iso]) {
      const nm = h.name.toLowerCase();
      let pts = 8;
      if (nm.includes("solat")) pts = DB.settings.scores.solat;
      else if (nm.includes("quran")) pts = DB.settings.scores.quran;
      else if (nm.includes("air")) pts = DB.settings.scores.air;
      else if (nm.includes("tidur")) pts = DB.settings.scores.tidur;
      else if (nm.includes("coding")) pts = DB.settings.scores.coding;
      else if (nm.includes("belajar") || nm.includes("forex")) pts = DB.settings.scores.belajar;
      score += pts;
    }
  });
  // tasks done today contribute small points
  const doneTasks = DB.tasks.filter(t => t.done && t.due === iso).length;
  score += doneTasks * 4;
  return Math.min(120, score);
}
function rankOf(score) {
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 50) return "B";
  return "C";
}
function rankColorClass(r) { return "rank-" + r; }

/* ---------------- STREAK ---------------- */
function currentStreak() {
  let streak = 0;
  let d = new Date();
  for (let i = 0; i < 400; i++) {
    const iso = todayISO(d);
    const day = DB.days[iso];
    const habitsToday = DB.habits.length;
    let allHabitsDone = habitsToday === 0 ? true : DB.habits.every(h => DB.habitLogs[h.id + "|" + iso]);
    const wOk = day && (day.done || day.rest);
    if (iso === todayISO() && !wOk && !allHabitsDone) {
      // today may still be in progress; don't break streak yet, just skip counting today if nothing done
      if (!day && DB.habits.every(h => !DB.habitLogs[h.id + "|" + iso])) { d.setDate(d.getDate() - 1); continue; }
    }
    if (wOk || allHabitsDone) { if (wOk && allHabitsDone) streak++; else if (wOk || allHabitsDone) streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

/* ---------------- NAVIGATION ---------------- */
const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "workout", label: "Workout", icon: "🏋️" },
  { id: "gallery", label: "Progress Gallery", icon: "📸" },
  { id: "tasks", label: "Task Manager", icon: "✅" },
  { id: "habits", label: "Habit Tracker", icon: "🔁" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "goals", label: "Goal", icon: "🎯" },
  { id: "achievements", label: "Achievement", icon: "🏆" },
  { id: "notes", label: "Notes", icon: "📝" },
  { id: "records", label: "Personal Record", icon: "🥇" },
  { id: "mood", label: "Mood Tracker", icon: "😀" },
  { id: "water", label: "Water Tracker", icon: "💧" },
  { id: "sleep", label: "Sleep Tracker", icon: "🌙" },
  { id: "nutrition", label: "Nutrition", icon: "🥗" },
];

let currentPage = "dashboard";

function renderNav() {
  const nav = document.getElementById("navScroll");
  nav.innerHTML = PAGES.map(p => {
    let badge = "";
    if (p.id === "tasks" && DB.tasks.some(t => !t.done)) badge = '<span class="badge-dot"></span>';
    if (p.id === "goals" && DB.goals.some(g => !g.completed && daysBetween(todayISO(), g.target) <= 3 && daysBetween(todayISO(), g.target) >= 0)) badge = '<span class="badge-dot"></span>';
    return `<a href="#" class="nav-item ${p.id === currentPage ? "active" : ""}" data-page="${p.id}">
      <span class="nav-icon">${p.icon}</span><span class="nav-label">${p.label}</span>${badge}
      <span class="tooltip">${p.label}</span>
    </a>`;
  }).join("");
  nav.querySelectorAll(".nav-item").forEach(el => {
    el.addEventListener("click", e => {
      e.preventDefault();
      goTo(el.dataset.page);
    });
  });
}

function goTo(page) {
  currentPage = page;
  renderNav();
  renderPage();
}

document.getElementById("collapseBtn").addEventListener("click", () => {
  DB.sidebarCollapsed = !DB.sidebarCollapsed;
  document.getElementById("sidebar").classList.toggle("collapsed", DB.sidebarCollapsed);
  saveDB();
});

/* ---------------- PAGE RENDER DISPATCH ---------------- */
function renderPage() {
  const main = document.getElementById("mainArea");
  const renderers = {
    dashboard: renderDashboard,
    calendar: renderCalendarPage,
    workout: renderWorkoutPage,
    gallery: renderGalleryPage,
    tasks: renderTasksPage,
    habits: renderHabitsPage,
    analytics: renderAnalyticsPage,
    goals: renderGoalsPage,
    achievements: renderAchievementsPage,
    notes: renderNotesPage,
    records: renderRecordsPage,
    mood: renderMoodPage,
    water: renderWaterPage,
    sleep: renderSleepPage,
    nutrition: renderNutritionPage,
  };
  main.innerHTML = `<div class="page active" id="pageWrap"></div>`;
  (renderers[currentPage] || renderDashboard)(document.getElementById("pageWrap"));
}

/* ---------------- INIT PROFILE ---------------- */
function initProfileUI() {
  document.getElementById("avatarInitial").textContent = (DB.profile.name || "U").charAt(0).toUpperCase();
  document.getElementById("profileName").textContent = DB.profile.name;
  document.getElementById("profileSince").textContent = "Ahli sejak " + fmtDate(DB.profile.since).split(", ")[1];
  document.getElementById("sidebar").classList.toggle("collapsed", DB.sidebarCollapsed);
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard(el) {
  const iso = todayISO();
  const day = DB.days[iso];
  const score = dailyScore(iso);
  const rank = rankOf(score);
  const streak = currentStreak();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Selamat Pagi" : hour < 15 ? "Selamat Tengah Hari" : hour < 19 ? "Selamat Petang" : "Selamat Malam";

  const wStatus = !day ? "pending" : day.rest ? "rest" : day.done ? "done" : "pending";
  const wStatusLabel = { done: "Selesai", pending: "Belum Selesai", rest: "Hari Rehat" }[wStatus];
  const wStatusClass = { done: "status-done", pending: "status-pending", rest: "status-rest" }[wStatus];

  const qIdx = new Date().getDate() % QUOTES.length;
  const [qText, qAuthor] = QUOTES[qIdx];

  const todayTasks = DB.tasks.filter(t => t.due === iso || !t.due).slice(0, 6);
  const todayHabits = DB.habits.slice(0, 6);
  const activeGoals = DB.goals.filter(g => !g.completed).slice(0, 4);
  const recentAch = DB.achievements.filter(a => a.completed).sort((a,b)=> (b.completedAt||"").localeCompare(a.completedAt||"")).slice(0,3);

  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const di = todayISO(d);
    const dday = DB.days[di];
    let val = 0, color = "#2A2E38";
    if (dday) {
      val = dailyScore(di);
      color = dday.rest ? "#FFB84D" : (dday.done ? "#00D4AA" : "#FF4757");
    }
    last7.push({ label: d.toLocaleDateString("ms-MY", { weekday: "short" }), val, color, iso: di });
  }

  el.innerHTML = `
    <div class="topbar">
      <div class="greeting">
        <h1>${greet}, ${esc(DB.profile.name)} 👋</h1>
        <p>Mari jadikan hari ini lebih baik dari semalam.</p>
      </div>
      <div class="topbar-right">
        <div class="date">${fmtDate(iso)}</div>
        <div class="clock" id="liveClock"></div>
      </div>
    </div>

    <div class="grid grid-4">
      <div class="card hoverable">
        <div class="card-label">📊 Daily Score</div>
        <div class="card-value">${score}<span class="rank-badge ${rankColorClass(rank)}">${rank} Rank</span></div>
        <div class="card-sub">Markah harian anda</div>
      </div>
      <div class="card hoverable">
        <div class="card-label">🔥 Current Streak</div>
        <div class="card-value">${streak} <span style="font-size:14px;color:var(--text-mute);font-weight:600;">hari</span></div>
        <div class="card-sub">Jangan putuskan rantai!</div>
      </div>
      <div class="card hoverable">
        <div class="card-label">🏋️ Workout Hari Ini</div>
        <div class="card-value" style="font-size:16px;"><span class="status-pill ${wStatusClass}">${wStatusLabel}</span></div>
        <div class="card-sub">${day && day.workoutName ? esc(day.workoutName) : "Belum direkod"}</div>
      </div>
      <div class="card hoverable">
        <div class="card-label">⚖️ Ringkasan Fizikal</div>
        <div class="card-value">${day && day.weight ? day.weight + " kg" : "—"}</div>
        <div class="card-sub">${day && day.calories ? day.calories + " kcal hari ini" : "Belum ada data kalori"}</div>
      </div>
    </div>

    <div class="motivate-card">
      <div class="q">"${esc(qText)}"</div>
      <div class="a">— ${esc(qAuthor)}</div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="section-title">Tugasan Harian <a class="see-all" data-nav="tasks">Lihat semua →</a></div>
        <div id="dashTasks">
          ${todayTasks.length ? todayTasks.map(t => taskMiniRow(t)).join("") : emptyMini("Tiada tugasan buat masa ini")}
        </div>
        ${miniProgress(todayTasks)}
      </div>
      <div class="card">
        <div class="section-title">Habit Harian <a class="see-all" data-nav="habits">Lihat semua →</a></div>
        <div id="dashHabits">
          ${todayHabits.length ? todayHabits.map(h => habitMiniRow(h, iso)).join("") : emptyMini("Belum ada habit ditambah")}
        </div>
      </div>
    </div>

    <div class="section-title" style="margin-top:20px;">Goal Aktif <a class="see-all" data-nav="goals">Lihat semua →</a></div>
    <div class="grid grid-4" style="margin-bottom:20px;">
      ${activeGoals.length ? activeGoals.map(g => goalMiniCard(g)).join("") : emptyMini("Belum ada goal aktif")}
    </div>

    <div class="section-title">Achievement Terbaru <a class="see-all" data-nav="achievements">Lihat semua →</a></div>
    <div class="grid grid-3" style="margin-bottom:20px;">
      ${recentAch.length ? recentAch.map(a => achMiniCard(a)).join("") : emptyMini("Belum ada pencapaian direkod")}
    </div>

    <div class="chart-box">
      <h4>Markah Harian — 7 Hari Terakhir</h4>
      <canvas id="last7Chart" height="90"></canvas>
    </div>
  `;

  el.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => goTo(b.dataset.nav)));
  el.querySelectorAll("[data-toggle-task]").forEach(b => b.addEventListener("click", () => {
    toggleTask(b.dataset.toggleTask); renderDashboard(el);
  }));
  el.querySelectorAll("[data-toggle-habit]").forEach(b => b.addEventListener("click", () => {
    toggleHabit(b.dataset.toggleHabit, iso); renderDashboard(el);
  }));

  const clockEl = document.getElementById("liveClock");
  function tick() { clockEl.textContent = new Date().toLocaleTimeString("ms-MY"); }
  tick(); clearInterval(window._clockTimer); window._clockTimer = setInterval(tick, 1000);

  new Chart(document.getElementById("last7Chart"), {
    type: "bar",
    data: {
      labels: last7.map(d => d.label),
      datasets: [{ data: last7.map(d => d.val), backgroundColor: last7.map(d => d.color), borderRadius: 6, barThickness: 28 }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "#2A2E38" }, ticks: { color: "#7A7F8A" } },
        y: { grid: { color: "#2A2E38" }, ticks: { color: "#7A7F8A" }, beginAtZero: true, max: 120 }
      }
    }
  });
}

function emptyMini(msg) { return `<div class="empty-state" style="padding:20px;"><div class="ic">🌱</div><div style="font-size:12.5px;">${esc(msg)}</div></div>`; }
function taskMiniRow(t) {
  return `<div class="list-item ${t.done ? "done" : ""}">
    <div class="checkbox ${t.done ? "checked" : ""}" data-toggle-task="${t.id}"></div>
    <div class="item-title" style="font-size:13px;">${esc(t.title)}</div>
  </div>`;
}
function habitMiniRow(h, iso) {
  const on = !!DB.habitLogs[h.id + "|" + iso];
  return `<div class="list-item ${on ? "done" : ""}">
    <div class="checkbox round ${on ? "checked" : ""}" data-toggle-habit="${h.id}"></div>
    <div class="item-title" style="font-size:13px;display:flex;align-items:center;gap:6px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${h.color};display:inline-block;"></span>${esc(h.name)}
    </div>
  </div>`;
}
function miniProgress(tasks) {
  if (!tasks.length) return "";
  const done = tasks.filter(t => t.done).length;
  const pct = Math.round((done / tasks.length) * 100);
  return `<div style="margin-top:10px;"><div class="progressbar"><div style="width:${pct}%;background:var(--green);"></div></div>
    <div class="card-sub" style="margin-top:5px;">${done}/${tasks.length} selesai (${pct}%)</div></div>`;
}
function goalMiniCard(g) {
  const pct = Math.min(100, Math.round(((g.cur - g.startVal) / (g.tgt - g.startVal || 1)) * 100));
  const daysLeft = daysBetween(todayISO(), g.target);
  const warn = daysLeft <= 7 && daysLeft >= 0 ? "warn" : daysLeft < 0 ? "danger" : "";
  return `<div class="goal-card ${warn}">
    <div style="font-size:22px;">${g.icon}</div>
    <div style="font-weight:700;font-size:13px;margin:6px 0 8px;">${esc(g.name)}</div>
    <div class="progressbar"><div style="width:${Math.max(0,Math.min(100,pct))}%;background:${g.color};"></div></div>
    <div class="goal-meta"><span>${Math.max(0,Math.min(100,pct))}%</span><span>${daysLeft >= 0 ? daysLeft + " hari lagi" : "Tamat tempoh"}</span></div>
  </div>`;
}
function achMiniCard(a) {
  return `<div class="card" style="border-color:var(--purple);background:rgba(167,139,250,.06);">
    <div style="font-size:22px;">${a.icon}</div>
    <div style="font-weight:700;font-size:13px;margin-top:8px;">${esc(a.name)}</div>
    <div class="card-sub">${a.completedAt ? fmtDate(a.completedAt) : ""}</div>
  </div>`;
}

/* =========================================================
   CALENDAR PAGE
   ========================================================= */
let calCursor = new Date();

function renderCalendarPage(el) {
  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  const monthNames = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = todayISO();

  let cells = "";
  for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const day = DB.days[iso];
    let statusClass = "";
    let dots = "";
    if (day) {
      if (day.rest) { statusClass = "status-yellow"; dots += `<span class="cal-dot" style="background:var(--yellow);"></span>`; }
      else if (day.done) { statusClass = "status-green"; dots += `<span class="cal-dot" style="background:var(--green);"></span>`; }
      else if (day.workoutName || day.marked) { statusClass = "status-red"; dots += `<span class="cal-dot" style="background:var(--red);"></span>`; }
      if (day.notes) dots += `<span class="cal-dot" style="background:var(--blue);"></span>`;
    }
    const mCount = mediaForDate(iso).length;
    if (mCount) dots += `<span class="cal-dot" style="background:var(--purple);"></span>`;
    const isToday = iso === todayIso ? "today" : "";
    cells += `<div class="cal-cell ${statusClass} ${isToday}" data-date="${iso}">
      <div class="dnum">${d}</div>
      <div class="cal-dots">${dots}</div>
    </div>`;
  }

  el.innerHTML = `
    <div class="page-title">Calendar</div>
    <div class="page-sub">Klik tarikh untuk rekod workout, mood, dan data harian.</div>
    <div class="cal-header">
      <div class="cal-nav">
        <button class="icon-btn" id="calPrev">◀</button>
        <div class="cal-title">${monthNames[month]} ${year}</div>
        <button class="icon-btn" id="calNext">▶</button>
      </div>
      <button class="btn btn-outline" id="calToday">Hari Ini</button>
    </div>
    <div class="cal-grid">
      <div class="cal-dow">Ahad</div><div class="cal-dow">Isnin</div><div class="cal-dow">Selasa</div>
      <div class="cal-dow">Rabu</div><div class="cal-dow">Khamis</div><div class="cal-dow">Jumaat</div><div class="cal-dow">Sabtu</div>
      ${cells}
    </div>
    <div style="display:flex;gap:18px;margin-top:16px;flex-wrap:wrap;">
      <span class="card-sub"><span class="cal-dot" style="background:var(--green);display:inline-block;"></span> Selesai</span>
      <span class="card-sub"><span class="cal-dot" style="background:var(--red);display:inline-block;"></span> Gagal / belum</span>
      <span class="card-sub"><span class="cal-dot" style="background:var(--yellow);display:inline-block;"></span> Hari Rehat</span>
      <span class="card-sub"><span class="cal-dot" style="background:var(--blue);display:inline-block;"></span> Ada Nota</span>
      <span class="card-sub"><span class="cal-dot" style="background:var(--purple);display:inline-block;"></span> Ada Media</span>
    </div>
  `;

  document.getElementById("calPrev").onclick = () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendarPage(el); };
  document.getElementById("calNext").onclick = () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendarPage(el); };
  document.getElementById("calToday").onclick = () => { calCursor = new Date(); renderCalendarPage(el); };
  el.querySelectorAll(".cal-cell[data-date]").forEach(c => c.addEventListener("click", () => openWorkoutModal(c.dataset.date)));
}

/* =========================================================
   WORKOUT MODAL — View (read-only) + Edit modes
   ========================================================= */
function openWorkoutModal(iso) {
  const day = getDay(iso);
  if (day.marked) renderWorkoutView(iso);
  else renderWorkoutEdit(iso);
}

function renderWorkoutView(iso) {
  const day = getDay(iso);
  const items = mediaForDate(iso);
  const statusLabel = day.rest ? "Hari Rehat" : day.done ? "Selesai" : "Belum Selesai";
  const statusClass = day.rest ? "status-rest" : day.done ? "status-done" : "status-pending";

  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-overlay open" id="workoutOverlay">
    <div class="modal wide">
      <div class="modal-head">
        <div>
          <h3>${fmtDate(iso)}</h3>
          <span class="status-pill ${statusClass}" style="margin-top:6px;">${statusLabel}</span>
        </div>
        <button class="modal-close" id="closeWorkout">✕</button>
      </div>
      <div class="modal-body">
        ${day.rest ? `<div class="empty-state" style="padding:20px;"><div class="ic">🛌</div>Hari rehat — tiada rekod workout.</div>` : `
        <div class="grid grid-4" style="margin-bottom:18px;">
          <div class="card"><div class="card-label">Workout</div><div class="card-sub" style="color:var(--text);font-size:13.5px;">${esc(day.workoutName||"—")}</div></div>
          <div class="card"><div class="card-label">Tempoh</div><div class="card-sub" style="color:var(--text);font-size:13.5px;">${day.duration?day.duration+" min":"—"}</div></div>
          <div class="card"><div class="card-label">Mood</div><div class="card-sub" style="color:var(--text);font-size:18px;">${day.mood||"—"}</div></div>
          <div class="card"><div class="card-label">Berat Badan</div><div class="card-sub" style="color:var(--text);font-size:13.5px;">${day.weight?day.weight+" kg":"—"}</div></div>
          <div class="card"><div class="card-label">Kalori</div><div class="card-sub" style="color:var(--text);font-size:13.5px;">${day.calories||"—"}</div></div>
          <div class="card"><div class="card-label">Energy</div><div class="card-sub" style="color:var(--text);font-size:13.5px;">${day.energy||"—"}/5</div></div>
          <div class="card"><div class="card-label">Air</div><div class="card-sub" style="color:var(--text);font-size:13.5px;">${day.waterL?day.waterL+" L":"—"}</div></div>
        </div>
        <div class="section-title">Exercise</div>
        ${day.exercises && day.exercises.length ? day.exercises.map(ex => `
          <div class="list-item" style="align-items:flex-start;">
            <div style="flex:1;">
              <div class="item-title">${esc(ex.name||"(tiada nama)")}</div>
              <div class="card-sub" style="margin-top:4px;">
                ${(ex.sets||[]).map((s,si) => `<span style="display:inline-block;margin-right:10px;">Set ${si+1}: ${s.weight?s.weight+"kg · ":""}${s.reps||0} rep ${s.done?"✅":"⬜"}</span>`).join("") || "Tiada set direkod"}
              </div>
            </div>
          </div>`).join("") : emptyMini("Tiada exercise direkod")}
        `}
        <div class="section-title" style="margin-top:16px;">Media (Photo &amp; Video)</div>
        ${items.length ? `<div class="media-thumb-grid">
          ${items.map(m => `<div class="media-thumb" data-mview="${m.id}">
            ${m.type === "video" ? `<video src="${m.dataUrl}" muted></video><span class="vbadge">🎥</span>` : `<img src="${m.dataUrl}">`}
          </div>`).join("")}
        </div>` : emptyMini("Tiada media direkod")}
        ${day.notes ? `<div class="section-title" style="margin-top:16px;">Catatan</div><div class="card"><div class="card-sub" style="color:var(--text);white-space:pre-wrap;font-size:13px;">${esc(day.notes)}</div></div>` : ""}
      </div>
      <div class="modal-foot">
        <button class="btn btn-gray" id="closeWorkout2">Tutup</button>
        <button class="btn btn-green" id="editWorkoutBtn">✎ Ubah</button>
      </div>
    </div>
  </div>`;

  document.getElementById("closeWorkout").onclick = closeWorkoutModal;
  document.getElementById("closeWorkout2").onclick = closeWorkoutModal;
  document.getElementById("workoutOverlay").addEventListener("click", e => { if (e.target.id === "workoutOverlay") closeWorkoutModal(); });
  document.getElementById("editWorkoutBtn").onclick = () => renderWorkoutEdit(iso);
  document.querySelectorAll("[data-mview]").forEach(t => t.addEventListener("click", () => {
    const item = items.find(x => x.id === t.dataset.mview);
    if (item) openMediaLightbox(item, items);
  }));
}

function renderWorkoutEdit(iso) {
  const day = getDay(iso);
  if (!day.exercises) day.exercises = [];
  const moodOpts = ["😀","😄","😐","😞","😢","😡"];

  const modalHtml = `
  <div class="modal-overlay open" id="workoutOverlay">
    <div class="modal wide">
      <div class="modal-head">
        <div>
          <h3>${fmtDate(iso)}</h3>
          <div class="card-sub" id="wStatusLabel">${day.rest ? "Hari Rehat" : day.done ? "Selesai" : "Belum Selesai"}</div>
        </div>
        <button class="modal-close" id="closeWorkout">✕</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Nama Workout</label>
          <input type="text" id="wName" placeholder="Push Day, Pull Day, Leg Day, Cardio..." value="${esc(day.workoutName||"")}">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Tempoh (minit)</label>
            <input type="number" id="wDuration" placeholder="60" value="${day.duration||""}">
          </div>
          <div class="field">
            <label>Mood</label>
            <div class="emoji-row" id="wMoodRow">
              ${moodOpts.map(m => `<div class="emoji-opt ${day.mood===m?"sel":""}" data-mood="${m}">${m}</div>`).join("")}
            </div>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Berat Badan (kg)</label>
            <input type="number" id="wWeight" step="0.1" value="${day.weight||""}">
          </div>
          <div class="field">
            <label>Kalori Dibakar</label>
            <input type="number" id="wCalories" value="${day.calories||""}">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Energy (1-5)</label>
            <input type="number" min="1" max="5" id="wEnergy" value="${day.energy||3}">
          </div>
          <div class="field">
            <label>Air (liter)</label>
            <input type="number" step="0.1" id="wWater" value="${day.waterL||""}">
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer;">
          <div class="checkbox ${day.rest?"checked":""}" id="wRestToggle"></div>
          <span style="font-size:13px;color:var(--text-dim);">Tandakan sebagai hari rehat</span>
        </label>

        <div class="section-title">Exercise <button class="btn btn-green btn-sm" id="addExRow">+ Tambah Exercise</button></div>
        <div id="exerciseList"></div>

        <div class="section-title" style="margin-top:16px;">
          Media (Photo &amp; Video)
          <div style="display:flex;gap:8px;">
            <button class="btn btn-green btn-sm" id="addPhotoBtn">+ Tambah Gambar</button>
            <button class="btn btn-outline btn-sm" id="openGalleryUploadBtn">Muat Naik Terperinci →</button>
          </div>
        </div>
        <div class="media-thumb-grid" id="wMediaGrid"></div>
        <input type="file" id="wMediaInput" accept="image/*,video/*" multiple style="display:none;">

        <div class="field" style="margin-top:16px;">
          <label>Catatan</label>
          <textarea id="wNotes" rows="3" placeholder="Perasaan semasa workout, teknik, pemerhatian...">${esc(day.notes||"")}</textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-gray" id="cancelWorkout">Batal</button>
        <button class="btn btn-green" id="saveWorkout">Simpan</button>
      </div>
    </div>
  </div>`;
  document.getElementById("modalRoot").innerHTML = modalHtml;

  function renderWMedia() {
    const grid = document.getElementById("wMediaGrid");
    if (!grid) return;
    const items = mediaForDate(iso);
    grid.innerHTML = items.map(m => `
      <div class="media-thumb" data-mview="${m.id}">
        ${m.type === "video" ? `<video src="${m.dataUrl}" muted></video><span class="vbadge">🎥</span>` : `<img src="${m.dataUrl}">`}
        <div class="mdel" data-mdel="${m.id}">✕</div>
      </div>
    `).join("") + `<div class="media-thumb media-thumb-add" id="wMediaAddBtn">+</div>`;
    grid.querySelectorAll("[data-mview]").forEach(t => t.addEventListener("click", (e) => {
      if (e.target.closest("[data-mdel]")) return;
      openMediaLightbox(items.find(x => x.id === t.dataset.mview), items);
    }));
    grid.querySelectorAll("[data-mdel]").forEach(b => b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirm("Padam media ini?")) {
        DB.gallery = DB.gallery.filter(x => x.id !== b.dataset.mdel);
        saveDB(); renderWMedia();
        toast("Media dipadam");
      }
    }));
    document.getElementById("wMediaAddBtn").addEventListener("click", () => document.getElementById("wMediaInput").click());
  }
  renderWMedia();

  document.getElementById("wMediaInput").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    try {
      for (const f of files) {
        const dataUrl = await compressImageFile(f);
        DB.gallery.push({
          id: uid(), dataUrl, type: fileKind(f), mime: f.type || "",
          date: iso, weight: day.weight || "", note: "", tags: [],
          createdAt: new Date().toISOString()
        });
      }
      saveDB();
      renderWMedia();
      toast(`${files.length} media dimuat naik & disegerak dengan Progress Gallery!`);
    } catch (err) {
      console.error(err);
      toast("Gagal memuat naik sebahagian fail", "⚠️");
    }
  });

  document.getElementById("openGalleryUploadBtn").addEventListener("click", () => {
    openUploadModal(iso, () => renderWMedia());
  });
  document.getElementById("addPhotoBtn").addEventListener("click", () => document.getElementById("wMediaInput").click());

  let selectedMood = day.mood || null;
  document.querySelectorAll("#wMoodRow .emoji-opt").forEach(o => o.addEventListener("click", () => {
    selectedMood = o.dataset.mood;
    document.querySelectorAll("#wMoodRow .emoji-opt").forEach(x => x.classList.remove("sel"));
    o.classList.add("sel");
  }));

  let isRest = !!day.rest;
  document.getElementById("wRestToggle").addEventListener("click", function () {
    isRest = !isRest;
    this.classList.toggle("checked", isRest);
  });

  function migrateEx(ex) {
    if (!ex.sets) ex.sets = [{ weight: ex.weight || "", reps: ex.reps || "", done: false }];
    return ex;
  }

  function renderExRows() {
    const wrap = document.getElementById("exerciseList");
    if (!day.exercises.length) { wrap.innerHTML = `<div class="empty-state" style="padding:16px;">Belum ada exercise. Tekan "+ Tambah Exercise".</div>`; return; }
    wrap.innerHTML = day.exercises.map((ex0, ei) => {
      const ex = migrateEx(ex0);
      return `
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
          <input type="text" placeholder="Nama Aktiviti / Senaman (cth: Push Up, Bench Press)" value="${esc(ex.name||"")}" data-exname="${ei}" style="flex:1;">
          <button class="icon-btn danger" data-delex="${ei}">🗑</button>
        </div>
        <div class="set-list">
          ${ex.sets.map((s, si) => `
            <div class="set-row" data-ex="${ei}" data-set="${si}">
              <span class="set-num">Set ${si+1}</span>
              <input type="number" placeholder="Beban(kg)" value="${s.weight||""}" data-sf="weight">
              <input type="number" placeholder="Reps" value="${s.reps||""}" data-sf="reps">
              <div class="checkbox round ${s.done?"checked":""}" data-sf="done" title="Tandakan selesai"></div>
              <button class="icon-btn danger" data-delset="${si}">✕</button>
            </div>
          `).join("")}
        </div>
        <button class="btn btn-outline btn-sm" data-addset="${ei}" style="margin-top:8px;">+ Tambah Set</button>
      </div>`;
    }).join("");

    wrap.querySelectorAll("[data-exname]").forEach(inp => inp.addEventListener("input", () => {
      day.exercises[inp.dataset.exname].name = inp.value;
    }));
    wrap.querySelectorAll(".set-row input").forEach(inp => inp.addEventListener("input", () => {
      const row = inp.closest(".set-row");
      day.exercises[row.dataset.ex].sets[row.dataset.set][inp.dataset.sf] = inp.value;
    }));
    wrap.querySelectorAll(".set-row [data-sf='done']").forEach(cb => cb.addEventListener("click", () => {
      const row = cb.closest(".set-row");
      const s = day.exercises[row.dataset.ex].sets[row.dataset.set];
      s.done = !s.done;
      cb.classList.toggle("checked", s.done);
    }));
    wrap.querySelectorAll("[data-delset]").forEach(b => b.addEventListener("click", () => {
      const row = b.closest(".set-row");
      const ex = day.exercises[row.dataset.ex];
      ex.sets.splice(Number(b.dataset.delset), 1);
      if (!ex.sets.length) ex.sets.push({ weight: "", reps: "", done: false });
      renderExRows();
    }));
    wrap.querySelectorAll("[data-addset]").forEach(b => b.addEventListener("click", () => {
      day.exercises[b.dataset.addset].sets.push({ weight: "", reps: "", done: false });
      renderExRows();
    }));
    wrap.querySelectorAll("[data-delex]").forEach(b => b.addEventListener("click", () => {
      day.exercises.splice(Number(b.dataset.delex), 1); renderExRows();
    }));
  }
  renderExRows();

  document.getElementById("addExRow").addEventListener("click", () => {
    day.exercises.push({ name: "", sets: [{ weight: "", reps: "", done: false }] });
    renderExRows();
  });

  document.getElementById("closeWorkout").onclick = closeWorkoutModal;
  document.getElementById("cancelWorkout").onclick = closeWorkoutModal;
  document.getElementById("workoutOverlay").addEventListener("click", e => { if (e.target.id === "workoutOverlay") closeWorkoutModal(); });

  document.getElementById("saveWorkout").onclick = () => {
    day.workoutName = document.getElementById("wName").value.trim();
    day.duration = document.getElementById("wDuration").value;
    day.mood = selectedMood;
    day.weight = document.getElementById("wWeight").value;
    day.calories = document.getElementById("wCalories").value;
    day.energy = document.getElementById("wEnergy").value;
    day.waterL = document.getElementById("wWater").value;
    day.notes = document.getElementById("wNotes").value.trim();
    day.rest = isRest;
    day.done = !isRest && (!!day.workoutName || day.exercises.some(x => x.name));
    day.marked = true;

    checkPersonalRecords(day.exercises, iso);
    saveDB();
    closeWorkoutModal();
    if (currentPage === "calendar") renderCalendarPage(document.getElementById("pageWrap"));
    if (currentPage === "dashboard") renderDashboard(document.getElementById("pageWrap"));
    toast("Workout disimpan!");
  };
}
function closeWorkoutModal() {
  document.getElementById("modalRoot").innerHTML = "";
  refreshCurrentPage();
}

function checkPersonalRecords(exercises, iso) {
  let newRecord = null;
  exercises.forEach(ex => {
    if (!ex.name || !ex.sets) return;
    ex.sets.forEach(s => {
      if (!s.weight) return;
      const w = parseFloat(s.weight);
      if (isNaN(w)) return;
      const key = ex.name.trim().toLowerCase();
      const existing = DB.records[key];
      if (!existing || w > existing.value) {
        DB.records[key] = { name: ex.name.trim(), value: w, date: iso };
        newRecord = DB.records[key];
      }
    });
  });
  if (newRecord) {
    setTimeout(() => {
      confetti();
      toast(`🏆 New Personal Record! ${newRecord.name}: ${newRecord.value}kg`, "🏆");
    }, 300);
  }
}

/* WORKOUT PAGE (list view / quick log for today) */
function renderWorkoutPage(el) {
  const iso = todayISO();
  const sortedDays = Object.keys(DB.days).filter(k => DB.days[k].marked).sort().reverse().slice(0, 30);
  el.innerHTML = `
    <div class="page-title">Workout</div>
    <div class="page-sub">Rekod workout harian anda. Untuk rekod terperinci, gunakan Calendar.</div>
    <button class="btn btn-green" id="logTodayBtn" style="margin-bottom:18px;">+ Log Workout Hari Ini</button>
    <div class="section-title">Sejarah Workout</div>
    <div id="woHistory">
      ${sortedDays.length ? sortedDays.map(d => {
        const day = DB.days[d];
        const cls = day.rest ? "status-rest" : day.done ? "status-done" : "status-pending";
        const label = day.rest ? "Rehat" : day.done ? "Selesai" : "Belum Selesai";
        return `<div class="list-item" data-open="${d}" style="cursor:pointer;">
          <div style="flex:1;">
            <div class="item-title" style="font-size:13.5px;font-weight:600;">${esc(day.workoutName || "(Tiada nama)")}</div>
            <div class="card-sub">${fmtDate(d)} ${day.exercises && day.exercises.length ? "· " + day.exercises.length + " exercise" : ""}</div>
          </div>
          <span class="status-pill ${cls}">${label}</span>
        </div>`;
      }).join("") : emptyMini("Belum ada rekod workout")}
    </div>
  `;
  document.getElementById("logTodayBtn").onclick = () => openWorkoutModal(iso);
  el.querySelectorAll("[data-open]").forEach(r => r.addEventListener("click", () => openWorkoutModal(r.dataset.open)));
}

/* =========================================================
   TASK MANAGER
   ========================================================= */
let taskFilter = "all";
let taskCategoryFilter = "all";

function toggleTask(id) {
  const t = DB.tasks.find(x => x.id === id);
  if (t) { t.done = !t.done; saveDB(); }
}

function renderTasksPage(el) {
  const iso = todayISO();
  const catList = ["Workout","Belajar","Kerja","Peribadi","Lain-lain"];
  el.innerHTML = `
    <div class="page-title">Task Manager</div>
    <div class="page-sub">Susun dan urus tugasan harian anda.</div>

    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <input type="text" id="quickAddInput" placeholder="Tambah tugasan baru...">
      <button class="btn btn-green" id="quickAddBtn">+ Tambah</button>
      <button class="btn btn-outline" id="detailedAddBtn">Terperinci</button>
    </div>

    <div class="pill-row" id="statusFilters">
      ${["all","today","week","upcoming","done","pending"].map(f => {
        const labels = { all:"Semua", today:"Hari Ini", week:"Minggu Ini", upcoming:"Akan Datang", done:"Selesai", pending:"Belum Selesai" };
        return `<div class="pill ${taskFilter===f?"active":""}" data-filter="${f}">${labels[f]}</div>`;
      }).join("")}
    </div>
    <div class="pill-row" id="catFilters">
      <div class="pill ${taskCategoryFilter==="all"?"active":""}" data-cat="all">Semua Kategori</div>
      ${catList.map(c => `<div class="pill ${taskCategoryFilter===c?"active":""}" data-cat="${c}">${c}</div>`).join("")}
    </div>

    <div id="taskList"></div>
  `;

  function getFiltered() {
    let arr = [...DB.tasks];
    if (taskFilter === "today") arr = arr.filter(t => t.due === iso || !t.due);
    if (taskFilter === "week") arr = arr.filter(t => t.due && daysBetween(iso, t.due) >= 0 && daysBetween(iso, t.due) <= 7);
    if (taskFilter === "upcoming") arr = arr.filter(t => t.due && t.due > iso);
    if (taskFilter === "done") arr = arr.filter(t => t.done);
    if (taskFilter === "pending") arr = arr.filter(t => !t.done);
    if (taskCategoryFilter !== "all") arr = arr.filter(t => t.category === taskCategoryFilter);
    arr.sort((a, b) => (a.done - b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
    return arr;
  }

  function draw() {
    const arr = getFiltered();
    const list = document.getElementById("taskList");
    list.innerHTML = arr.length ? arr.map(t => {
      const overdue = t.due && t.due < iso && !t.done;
      const soon = t.due && daysBetween(iso, t.due) === 0 && !t.done;
      const prioColor = { Rendah: "var(--blue)", Sederhana: "var(--yellow)", Tinggi: "#ff9a4d", Kritikal: "var(--red)" }[t.priority] || "var(--text-mute)";
      return `<div class="task-card ${t.done?"done":""} ${overdue?"overdue":""} ${soon?"due-soon":""}">
        <div class="checkbox" data-tg="${t.id}" style="margin-top:2px;">${t.done?'<span></span>':''}</div>
        <div style="flex:1;">
          <div class="item-title">${t.priority==="Kritikal" && !t.done ? "❗ " : ""}${esc(t.title)}</div>
          ${t.desc ? `<div class="card-sub" style="margin-top:3px;">${esc(t.desc)}</div>` : ""}
          <div class="meta">
            ${t.due ? `<span class="tag-chip" style="${overdue?'color:var(--red);':''}">${t.due}${t.dueTime?" "+t.dueTime:""}</span>` : ""}
            ${t.category ? `<span class="tag-chip">${esc(t.category)}</span>` : ""}
            ${t.priority ? `<span class="tag-chip" style="color:${prioColor};">${t.priority}</span>` : ""}
          </div>
        </div>
        <button class="icon-btn" data-edit="${t.id}">✎</button>
        <button class="icon-btn danger" data-del="${t.id}">🗑</button>
      </div>`;
    }).join("") : emptyMini("Tiada tugasan dalam penapis ini");

    list.querySelectorAll("[data-tg]").forEach(c => c.addEventListener("click", () => {
      const t = DB.tasks.find(x => x.id === c.dataset.tg);
      t.done = !t.done; saveDB(); draw(); renderNav();
      if (t.done) toast("Tugasan selesai!");
    }));
    list.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
      if (confirm("Padam tugasan ini?")) { DB.tasks = DB.tasks.filter(x => x.id !== b.dataset.del); saveDB(); draw(); renderNav(); }
    }));
    list.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openTaskModal(DB.tasks.find(x => x.id === b.dataset.edit), () => renderTasksPage(el))));
  }
  draw();

  el.querySelectorAll("#statusFilters .pill").forEach(p => p.addEventListener("click", () => { taskFilter = p.dataset.filter; renderTasksPage(el); }));
  el.querySelectorAll("#catFilters .pill").forEach(p => p.addEventListener("click", () => { taskCategoryFilter = p.dataset.cat; renderTasksPage(el); }));

  document.getElementById("quickAddBtn").onclick = () => {
    const inp = document.getElementById("quickAddInput");
    if (!inp.value.trim()) return;
    DB.tasks.unshift({ id: uid(), title: inp.value.trim(), desc: "", due: "", dueTime: "", priority: "Sederhana", category: "Peribadi", done: false, createdAt: iso });
    inp.value = "";
    taskFilter = "all"; taskCategoryFilter = "all";
    saveDB(); renderTasksPage(el); renderNav();
  };
  document.getElementById("quickAddInput").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("quickAddBtn").click(); });
  document.getElementById("detailedAddBtn").onclick = () => openTaskModal(null, () => renderTasksPage(el));
}

function openTaskModal(task, onDone) {
  const editing = !!task;
  const t = task || { id: uid(), title: "", desc: "", due: "", dueTime: "", priority: "Sederhana", category: "Peribadi", done: false, createdAt: todayISO() };
  const prios = ["Rendah","Sederhana","Tinggi","Kritikal"];
  const prioClass = { Rendah:"sel-low", Sederhana:"sel-med", Tinggi:"sel-high", Kritikal:"sel-crit" };
  const cats = ["Workout","Belajar","Kerja","Peribadi","Lain-lain"];

  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-overlay open" id="taskOverlay">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"Edit Tugasan":"Tugasan Terperinci"}</h3><button class="modal-close" id="closeTaskModal">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Nama Tugasan</label><input type="text" id="tTitle" value="${esc(t.title)}" placeholder="cth: Habiskan bab 3 buku"></div>
        <div class="field"><label>Penerangan</label><textarea id="tDesc" rows="2" placeholder="Nota tambahan (pilihan)">${esc(t.desc||"")}</textarea></div>
        <div class="field-row">
          <div class="field"><label>Tarikh Akhir</label><input type="date" id="tDue" value="${t.due||""}"></div>
          <div class="field"><label>Masa</label><input type="time" id="tTime" value="${t.dueTime||""}"></div>
        </div>
        <div class="field">
          <label>Priority</label>
          <div class="priority-row" id="prioRow">
            ${prios.map(p => `<div class="prio-opt ${t.priority===p?prioClass[p]:""}" data-p="${p}">${p}</div>`).join("")}
          </div>
        </div>
        <div class="field">
          <label>Kategori</label>
          <select id="tCat">${cats.map(c => `<option ${t.category===c?"selected":""}>${c}</option>`).join("")}</select>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-gray" id="cancelTask">Batal</button>
        <button class="btn btn-green" id="saveTask">Simpan</button>
      </div>
    </div>
  </div>`;
  let selP = t.priority;
  document.querySelectorAll("#prioRow .prio-opt").forEach(o => o.addEventListener("click", () => {
    selP = o.dataset.p;
    document.querySelectorAll("#prioRow .prio-opt").forEach(x => x.className = "prio-opt");
    o.classList.add(prioClass[selP]);
  }));
  const close = () => document.getElementById("modalRoot").innerHTML = "";
  document.getElementById("closeTaskModal").onclick = close;
  document.getElementById("cancelTask").onclick = close;
  document.getElementById("taskOverlay").addEventListener("click", e => { if (e.target.id === "taskOverlay") close(); });
  document.getElementById("saveTask").onclick = () => {
    const title = document.getElementById("tTitle").value.trim();
    if (!title) { toast("Sila isi nama tugasan"); return; }
    t.title = title;
    t.desc = document.getElementById("tDesc").value.trim();
    t.due = document.getElementById("tDue").value;
    t.dueTime = document.getElementById("tTime").value;
    t.priority = selP;
    t.category = document.getElementById("tCat").value;
    if (!editing) { DB.tasks.unshift(t); taskFilter = "all"; taskCategoryFilter = "all"; }
    saveDB(); close(); onDone && onDone(); renderNav();
    toast("Tugasan disimpan!");
  };
}

/* =========================================================
   HABIT TRACKER
   ========================================================= */
function toggleHabit(id, iso) {
  const key = id + "|" + iso;
  if (DB.habitLogs[key]) delete DB.habitLogs[key]; else DB.habitLogs[key] = true;
  saveDB();
}
function habitStreak(id) {
  let s = 0, d = new Date();
  for (let i = 0; i < 400; i++) {
    const iso = todayISO(d);
    if (DB.habitLogs[id + "|" + iso]) { s++; d.setDate(d.getDate() - 1); }
    else if (iso === todayISO()) { d.setDate(d.getDate() - 1); continue; }
    else break;
  }
  return s;
}
function weekDates() {
  const now = new Date();
  const dow = now.getDay();
  const sun = new Date(now); sun.setDate(now.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(sun); d.setDate(sun.getDate() + i); return todayISO(d); });
}

function renderHabitsPage(el) {
  const week = weekDates();
  const dowLabels = ["Ahad","Isnin","Selasa","Rabu","Khamis","Jumaat","Sabtu"];
  el.innerHTML = `
    <div class="page-title">Habit Tracker</div>
    <div class="page-sub">Jejak habit harian anda secara fleksibel.</div>
    <button class="btn btn-green" id="addHabitBtn" style="margin-bottom:18px;">+ Tambah Habit</button>

    <div class="card" style="overflow-x:auto;margin-bottom:22px;">
      ${DB.habits.length ? `<table class="habit-table"><thead><tr>
        <th>Habit</th>${dowLabels.map(d => `<th>${d}</th>`).join("")}
      </tr></thead><tbody>
        ${DB.habits.map(h => `<tr>
          <td><div class="habit-name-cell"><span class="habit-dot" style="background:${h.color};"></span>${esc(h.name)}</div></td>
          ${week.map(iso => `<td><div class="hcheck ${DB.habitLogs[h.id+"|"+iso]?"on":""}" data-h="${h.id}" data-d="${iso}"></div></td>`).join("")}
        </tr>`).join("")}
      </tbody></table>` : emptyMini("Belum ada habit. Tambah habit pertama anda!")}
    </div>

    <div class="section-title">Senarai Habit</div>
    <div id="habitCards">
      ${DB.habits.length ? DB.habits.map(h => {
        const streak = habitStreak(h.id);
        const weekDone = week.filter(iso => DB.habitLogs[h.id+"|"+iso]).length;
        const total = Object.keys(DB.habitLogs).filter(k => k.startsWith(h.id+"|")).length;
        return `<div class="habit-card">
          <div class="habit-icon" style="background:${h.color}22;color:${h.color};">${h.icon}</div>
          <div style="flex:1;">
            <div class="item-title" style="font-weight:700;">${esc(h.name)}</div>
            <div class="habit-stats">
              <span>🔥 ${streak} hari streak</span>
              <span>📅 ${weekDone}/7 minggu ini</span>
              <span>✅ ${total} total</span>
            </div>
          </div>
          <button class="icon-btn" data-eh="${h.id}">✎</button>
          <button class="icon-btn danger" data-dh="${h.id}">🗑</button>
        </div>`;
      }).join("") : ""}
    </div>
  `;
  el.querySelectorAll(".hcheck").forEach(c => c.addEventListener("click", () => { toggleHabit(c.dataset.h, c.dataset.d); renderHabitsPage(el); }));
  el.querySelectorAll("[data-dh]").forEach(b => b.addEventListener("click", () => {
    if (confirm("Padam habit ini dan semua sejarahnya?")) {
      DB.habits = DB.habits.filter(h => h.id !== b.dataset.dh);
      Object.keys(DB.habitLogs).forEach(k => { if (k.startsWith(b.dataset.dh + "|")) delete DB.habitLogs[k]; });
      saveDB(); renderHabitsPage(el);
    }
  }));
  el.querySelectorAll("[data-eh]").forEach(b => b.addEventListener("click", () => openHabitModal(DB.habits.find(h => h.id === b.dataset.eh), el)));
  document.getElementById("addHabitBtn").onclick = () => openHabitModal(null, el);
}

function openHabitModal(habit, pageEl) {
  const editing = !!habit;
  const h = habit || { id: uid(), name: "", icon: ICONS[0], color: COLORS[0] };
  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-overlay open" id="habitOverlay">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"Edit Habit":"Tambah Habit"}</h3><button class="modal-close" id="closeHabitModal">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Nama Habit</label><input type="text" id="hName" value="${esc(h.name)}" placeholder="cth: Solat, Baca Al-Quran, Belajar Coding"></div>
        <div class="field"><label>Ikon</label><div class="emoji-row" id="hIconRow" style="flex-wrap:wrap;">
          ${ICONS.map(i => `<div class="emoji-opt ${h.icon===i?"sel":""}" data-icon="${i}">${i}</div>`).join("")}
        </div></div>
        <div class="field"><label>Warna</label><div class="color-swatches" id="hColorRow">
          ${COLORS.map(c => `<div class="swatch ${h.color===c?"sel":""}" style="background:${c};" data-color="${c}"></div>`).join("")}
        </div></div>
      </div>
      <div class="modal-foot"><button class="btn btn-gray" id="cancelHabit">Batal</button><button class="btn btn-green" id="saveHabit">Simpan</button></div>
    </div>
  </div>`;
  let selIcon = h.icon, selColor = h.color;
  document.querySelectorAll("#hIconRow .emoji-opt").forEach(o => o.addEventListener("click", () => { selIcon = o.dataset.icon; document.querySelectorAll("#hIconRow .emoji-opt").forEach(x=>x.classList.remove("sel")); o.classList.add("sel"); }));
  document.querySelectorAll("#hColorRow .swatch").forEach(o => o.addEventListener("click", () => { selColor = o.dataset.color; document.querySelectorAll("#hColorRow .swatch").forEach(x=>x.classList.remove("sel")); o.classList.add("sel"); }));
  const close = () => document.getElementById("modalRoot").innerHTML = "";
  document.getElementById("closeHabitModal").onclick = close;
  document.getElementById("cancelHabit").onclick = close;
  document.getElementById("habitOverlay").addEventListener("click", e => { if (e.target.id === "habitOverlay") close(); });
  document.getElementById("saveHabit").onclick = () => {
    const name = document.getElementById("hName").value.trim();
    if (!name) { toast("Sila isi nama habit"); return; }
    h.name = name; h.icon = selIcon; h.color = selColor;
    if (!editing) DB.habits.push(h);
    saveDB(); close(); renderHabitsPage(pageEl);
    toast("Habit disimpan!");
  };
}

/* =========================================================
   GOALS
   ========================================================= */
function renderGoalsPage(el) {
  const active = DB.goals.filter(g => !g.completed);
  const completed = DB.goals.filter(g => g.completed);
  el.innerHTML = `
    <div class="page-title">Goal</div>
    <div class="page-sub">Tetapkan dan jejak matlamat jangka pendek dan panjang anda.</div>
    <button class="btn btn-green" id="addGoalBtn" style="margin-bottom:18px;">+ Tambah Goal</button>
    <div class="grid grid-2" id="activeGoals">
      ${active.length ? active.map(g => goalFullCard(g)).join("") : emptyMini("Belum ada goal aktif. Tambah goal pertama anda!")}
    </div>
    ${completed.length ? `<div class="section-title" style="margin-top:26px;">Completed Goals</div>
    <div class="grid grid-2">${completed.map(g => goalFullCard(g, true)).join("")}</div>` : ""}
  `;
  bindGoalEvents(el);
  document.getElementById("addGoalBtn").onclick = () => openGoalModal(null, el);
}
function goalFullCard(g, done) {
  const pct = Math.max(0, Math.min(100, Math.round(((g.cur - g.startVal) / (g.tgt - g.startVal || 1)) * 100)));
  const daysLeft = daysBetween(todayISO(), g.target);
  const warn = !done && daysLeft <= 7 && daysLeft >= 0 ? "warn" : (!done && daysLeft < 0 ? "danger" : (done ? "complete" : ""));
  return `<div class="goal-card ${warn}">
    <div class="goal-top">
      <div class="goal-icon" style="background:${g.color}22;color:${g.color};">${g.icon}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:14px;">${esc(g.name)}</div>
        <div class="card-sub">${esc(g.category)} · ${g.cur} → ${g.tgt}</div>
      </div>
      ${done ? `<span class="tag-chip" style="color:var(--green);">Selesai</span>` : `<button class="btn btn-outline btn-sm" data-update="${g.id}">Kemas Kini</button>`}
    </div>
    <div class="progressbar"><div style="width:${pct}%;background:${g.color};"></div></div>
    <div class="goal-meta"><span>${pct}% (${g.cur}/${g.tgt})</span><span>${done ? "Selesai " + fmtDate(g.completedAt) : (daysLeft>=0 ? daysLeft+" hari lagi" : "Tamat tempoh")}</span></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
      <button class="icon-btn" data-eg="${g.id}">✎</button>
      <button class="icon-btn danger" data-dg="${g.id}">🗑</button>
    </div>
  </div>`;
}
function bindGoalEvents(el) {
  el.querySelectorAll("[data-dg]").forEach(b => b.addEventListener("click", () => {
    if (confirm("Padam goal ini?")) { DB.goals = DB.goals.filter(g => g.id !== b.dataset.dg); saveDB(); renderGoalsPage(el); }
  }));
  el.querySelectorAll("[data-eg]").forEach(b => b.addEventListener("click", () => openGoalModal(DB.goals.find(g => g.id === b.dataset.eg), el)));
  el.querySelectorAll("[data-update]").forEach(b => b.addEventListener("click", () => {
    const g = DB.goals.find(x => x.id === b.dataset.update);
    const val = prompt(`Kemas kini progress untuk "${g.name}" (semasa: ${g.cur}):`, g.cur);
    if (val === null || isNaN(parseFloat(val))) return;
    g.cur = parseFloat(val);
    if ((g.tgt >= g.startVal && g.cur >= g.tgt) || (g.tgt < g.startVal && g.cur <= g.tgt)) {
      g.completed = true; g.completedAt = todayISO();
      confetti(); toast("🎉 Goal selesai! Tahniah!", "🎉");
    }
    saveDB(); renderGoalsPage(el); renderNav();
  }));
}
function openGoalModal(goal, pageEl) {
  const editing = !!goal;
  const g = goal || { id: uid(), name: "", category: "Fizikal", start: todayISO(), target: todayISO(), note: "", color: COLORS[0], icon: "🎯", startVal: 0, cur: 0, tgt: 100, completed: false };
  const cats = ["Fizikal","Pembelajaran","Kewangan","Spiritual","Kustom"];
  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-overlay open" id="goalOverlay">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"Edit Goal":"Tambah Goal"}</h3><button class="modal-close" id="closeGoalModal">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Nama Goal</label><input type="text" id="gName" value="${esc(g.name)}" placeholder="cth: Berat Badan 59kg → 70kg"></div>
        <div class="field"><label>Kategori</label><select id="gCat">${cats.map(c => `<option ${g.category===c?"selected":""}>${c}</option>`).join("")}</select></div>
        <div class="field-row">
          <div class="field"><label>Tarikh Mula</label><input type="date" id="gStart" value="${g.start}"></div>
          <div class="field"><label>Tarikh Sasaran</label><input type="date" id="gTarget" value="${g.target}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Current Progress</label><input type="number" id="gCur" value="${g.cur}"></div>
          <div class="field"><label>Target</label><input type="number" id="gTgt" value="${g.tgt}"></div>
        </div>
        <div class="field"><label>Ikon</label><div class="emoji-row" id="gIconRow" style="flex-wrap:wrap;">${ICONS.map(i => `<div class="emoji-opt ${g.icon===i?"sel":""}" data-icon="${i}">${i}</div>`).join("")}</div></div>
        <div class="field"><label>Warna</label><div class="color-swatches" id="gColorRow">${COLORS.map(c => `<div class="swatch ${g.color===c?"sel":""}" style="background:${c};" data-color="${c}"></div>`).join("")}</div></div>
        <div class="field"><label>Nota</label><textarea id="gNote" rows="2">${esc(g.note||"")}</textarea></div>
      </div>
      <div class="modal-foot"><button class="btn btn-gray" id="cancelGoal">Batal</button><button class="btn btn-green" id="saveGoal">Simpan</button></div>
    </div>
  </div>`;
  let selIcon = g.icon, selColor = g.color;
  document.querySelectorAll("#gIconRow .emoji-opt").forEach(o => o.addEventListener("click", () => { selIcon = o.dataset.icon; document.querySelectorAll("#gIconRow .emoji-opt").forEach(x=>x.classList.remove("sel")); o.classList.add("sel"); }));
  document.querySelectorAll("#gColorRow .swatch").forEach(o => o.addEventListener("click", () => { selColor = o.dataset.color; document.querySelectorAll("#gColorRow .swatch").forEach(x=>x.classList.remove("sel")); o.classList.add("sel"); }));
  const close = () => document.getElementById("modalRoot").innerHTML = "";
  document.getElementById("closeGoalModal").onclick = close;
  document.getElementById("cancelGoal").onclick = close;
  document.getElementById("goalOverlay").addEventListener("click", e => { if (e.target.id === "goalOverlay") close(); });
  document.getElementById("saveGoal").onclick = () => {
    const name = document.getElementById("gName").value.trim();
    if (!name) { toast("Sila isi nama goal"); return; }
    g.name = name; g.category = document.getElementById("gCat").value;
    g.start = document.getElementById("gStart").value; g.target = document.getElementById("gTarget").value;
    g.cur = parseFloat(document.getElementById("gCur").value) || 0;
    g.tgt = parseFloat(document.getElementById("gTgt").value) || 0;
    if (!editing) g.startVal = g.cur;
    g.icon = selIcon; g.color = selColor; g.note = document.getElementById("gNote").value.trim();
    if (!editing) DB.goals.push(g);
    saveDB(); close(); renderGoalsPage(pageEl); renderNav();
    toast("Goal disimpan!");
  };
}

/* =========================================================
   ACHIEVEMENTS
   ========================================================= */
function renderAchievementsPage(el) {
  const active = DB.achievements.filter(a => !a.completed);
  const completed = DB.achievements.filter(a => a.completed);
  el.innerHTML = `
    <div class="page-title">Achievement</div>
    <div class="page-sub">Cipta dan jejak pencapaian peribadi anda sepenuhnya mengikut cara anda.</div>
    <button class="btn btn-purple" id="addAchBtn" style="margin-bottom:18px;">+ Tambah Achievement</button>
    <div class="grid grid-3" id="activeAch">
      ${active.length ? active.map(a => achFullCard(a)).join("") : emptyMini("Belum ada achievement. Cipta yang pertama!")}
    </div>
    ${completed.length ? `<div class="section-title" style="margin-top:26px;">Achievement Tercapai</div>
    <div class="grid grid-3">${completed.map(a => achFullCard(a, true)).join("")}</div>` : ""}
  `;
  el.querySelectorAll("[data-da]").forEach(b => b.addEventListener("click", () => {
    if (confirm("Padam achievement ini?")) { DB.achievements = DB.achievements.filter(a => a.id !== b.dataset.da); saveDB(); renderAchievementsPage(el); }
  }));
  el.querySelectorAll("[data-ea]").forEach(b => b.addEventListener("click", () => openAchModal(DB.achievements.find(a => a.id === b.dataset.ea), el)));
  el.querySelectorAll("[data-ua]").forEach(b => b.addEventListener("click", () => {
    const a = DB.achievements.find(x => x.id === b.dataset.ua);
    const val = prompt(`Kemas kini progress untuk "${a.name}" (semasa: ${a.cur}, target: ${a.target}):`, a.cur);
    if (val === null || isNaN(parseFloat(val))) return;
    a.cur = parseFloat(val);
    if (a.cur >= a.target) { a.completed = true; a.completedAt = todayISO(); confetti(); toast("🏆 Achievement Tercapai!", "🏆"); }
    saveDB(); renderAchievementsPage(el); renderDashboard;
  }));
  document.getElementById("addAchBtn").onclick = () => openAchModal(null, el);
}
function achFullCard(a, done) {
  const pct = Math.max(0, Math.min(100, Math.round((a.cur / a.target) * 100) || 0));
  return `<div class="card" style="border-color:${a.color};${done?"background:linear-gradient(135deg,"+a.color+"11,var(--card));":""}">
    <div class="goal-icon" style="background:${a.color}22;color:${a.color};margin-bottom:10px;">${a.icon}</div>
    <div style="font-weight:700;font-size:14px;">${esc(a.name)}</div>
    ${a.desc ? `<div class="card-sub" style="margin:4px 0;">${esc(a.desc)}</div>` : ""}
    <div class="progressbar" style="margin-top:10px;"><div style="width:${pct}%;background:${a.color};"></div></div>
    <div class="goal-meta"><span>${a.cur}/${a.target}</span><span>${done ? "Selesai" : pct+"%"}</span></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
      ${!done ? `<button class="btn btn-outline btn-sm" data-ua="${a.id}">Kemas Kini</button>` : ""}
      <button class="icon-btn" data-ea="${a.id}">✎</button>
      <button class="icon-btn danger" data-da="${a.id}">🗑</button>
    </div>
  </div>`;
}
function openAchModal(ach, pageEl) {
  const editing = !!ach;
  const a = ach || { id: uid(), name: "", desc: "", start: todayISO(), target: 100, cur: 0, color: COLORS[2], icon: "🏆", completed: false };
  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-overlay open" id="achOverlay">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"Edit Achievement":"Tambah Achievement"}</h3><button class="modal-close" id="closeAchModal">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Nama Achievement</label><input type="text" id="aName" value="${esc(a.name)}" placeholder="cth: Workout 100 Hari"></div>
        <div class="field"><label>Penerangan</label><textarea id="aDesc" rows="2">${esc(a.desc||"")}</textarea></div>
        <div class="field-row">
          <div class="field"><label>Progress Semasa</label><input type="number" id="aCur" value="${a.cur}"></div>
          <div class="field"><label>Target</label><input type="number" id="aTarget" value="${a.target}"></div>
        </div>
        <div class="field"><label>Ikon</label><div class="emoji-row" id="aIconRow" style="flex-wrap:wrap;">${ICONS.map(i => `<div class="emoji-opt ${a.icon===i?"sel":""}" data-icon="${i}">${i}</div>`).join("")}</div></div>
        <div class="field"><label>Warna</label><div class="color-swatches" id="aColorRow">${COLORS.map(c => `<div class="swatch ${a.color===c?"sel":""}" style="background:${c};" data-color="${c}"></div>`).join("")}</div></div>
      </div>
      <div class="modal-foot"><button class="btn btn-gray" id="cancelAch">Batal</button><button class="btn btn-purple" id="saveAch">Simpan</button></div>
    </div>
  </div>`;
  let selIcon = a.icon, selColor = a.color;
  document.querySelectorAll("#aIconRow .emoji-opt").forEach(o => o.addEventListener("click", () => { selIcon = o.dataset.icon; document.querySelectorAll("#aIconRow .emoji-opt").forEach(x=>x.classList.remove("sel")); o.classList.add("sel"); }));
  document.querySelectorAll("#aColorRow .swatch").forEach(o => o.addEventListener("click", () => { selColor = o.dataset.color; document.querySelectorAll("#aColorRow .swatch").forEach(x=>x.classList.remove("sel")); o.classList.add("sel"); }));
  const close = () => document.getElementById("modalRoot").innerHTML = "";
  document.getElementById("closeAchModal").onclick = close;
  document.getElementById("cancelAch").onclick = close;
  document.getElementById("achOverlay").addEventListener("click", e => { if (e.target.id === "achOverlay") close(); });
  document.getElementById("saveAch").onclick = () => {
    const name = document.getElementById("aName").value.trim();
    if (!name) { toast("Sila isi nama achievement"); return; }
    a.name = name; a.desc = document.getElementById("aDesc").value.trim();
    a.cur = parseFloat(document.getElementById("aCur").value) || 0;
    a.target = parseFloat(document.getElementById("aTarget").value) || 1;
    a.icon = selIcon; a.color = selColor;
    if (a.cur >= a.target) { a.completed = true; a.completedAt = a.completedAt || todayISO(); }
    if (!editing) DB.achievements.push(a);
    saveDB(); close(); renderAchievementsPage(pageEl); renderNav();
    toast("Achievement disimpan!");
  };
}

/* =========================================================
   NOTES
   ========================================================= */
let noteSearch = "";
let noteTagFilter = "all";
function renderNotesPage(el) {
  const allTags = [...new Set(DB.notes.flatMap(n => n.tags || []))];
  const filtered = DB.notes.filter(n => {
    const matchSearch = !noteSearch || (n.title + n.body).toLowerCase().includes(noteSearch.toLowerCase());
    const matchTag = noteTagFilter === "all" || (n.tags || []).includes(noteTagFilter);
    return matchSearch && matchTag;
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  el.innerHTML = `
    <div class="page-title">Notes</div>
    <div class="page-sub">Tulis pembelajaran, idea, kesilapan, dan perancangan anda.</div>
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <input type="text" id="noteSearchInput" placeholder="Cari nota..." value="${esc(noteSearch)}">
      <button class="btn btn-green" id="newNoteBtn">+ Nota Baru</button>
    </div>
    <div class="pill-row">
      <div class="pill ${noteTagFilter==="all"?"active":""}" data-tag="all">Semua</div>
      ${allTags.map(t => `<div class="pill ${noteTagFilter===t?"active":""}" data-tag="${t}">${t}</div>`).join("")}
    </div>
    <div class="grid grid-3" id="noteGrid">
      ${filtered.length ? filtered.map(n => `
        <div class="note-card" data-open="${n.id}">
          <h4>${esc(n.title || "(Tiada Tajuk)")}</h4>
          <p>${esc((n.body || "").slice(0, 100))}${n.body && n.body.length > 100 ? "…" : ""}</p>
          <div class="meta">
            <span>${n.updatedAt}</span>
            <span>${(n.tags||[]).map(t => `<span class="tag-chip">${t}</span>`).join(" ")}</span>
          </div>
        </div>`).join("") : emptyMini("Tiada nota dijumpai")}
    </div>
  `;
  document.getElementById("noteSearchInput").addEventListener("input", e => { noteSearch = e.target.value; renderNotesPage(el); });
  el.querySelectorAll("[data-tag]").forEach(p => p.addEventListener("click", () => { noteTagFilter = p.dataset.tag; renderNotesPage(el); }));
  document.getElementById("newNoteBtn").onclick = () => openNoteModal(null, el);
  el.querySelectorAll("[data-open]").forEach(c => c.addEventListener("click", () => openNoteModal(DB.notes.find(n => n.id === c.dataset.open), el)));
}
function openNoteModal(note, pageEl) {
  const editing = !!note;
  const n = note || { id: uid(), title: "", body: "", tags: [], createdAt: todayISO(), updatedAt: todayISO() };
  const tagOptions = ["Pembelajaran","Idea","Kesilapan","Perancangan"];
  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-overlay open" id="noteOverlay">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"Edit Nota":"Nota Baru"}</h3><button class="modal-close" id="closeNoteModal">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Tajuk</label><input type="text" id="nTitle" value="${esc(n.title)}" placeholder="Tajuk nota"></div>
        <div class="field"><label>Kandungan</label><textarea id="nBody" rows="8" placeholder="Tulis di sini...">${esc(n.body)}</textarea></div>
        <div class="field"><label>Tag</label><div class="pill-row" id="nTagRow">
          ${tagOptions.map(t => `<div class="pill ${((n.tags||[]).includes(t))?"active":""}" data-tagopt="${t}">${t}</div>`).join("")}
        </div></div>
      </div>
      <div class="modal-foot">
        ${editing ? `<button class="btn btn-red" id="deleteNote" style="margin-right:auto;">Padam</button>` : ""}
        <button class="btn btn-gray" id="cancelNote">Batal</button>
        <button class="btn btn-green" id="saveNote">Simpan</button>
      </div>
    </div>
  </div>`;
  let selTags = new Set(n.tags || []);
  document.querySelectorAll("#nTagRow .pill").forEach(p => p.addEventListener("click", () => {
    const t = p.dataset.tagopt;
    if (selTags.has(t)) selTags.delete(t); else selTags.add(t);
    p.classList.toggle("active");
  }));
  const close = () => document.getElementById("modalRoot").innerHTML = "";
  document.getElementById("closeNoteModal").onclick = close;
  document.getElementById("cancelNote").onclick = close;
  document.getElementById("noteOverlay").addEventListener("click", e => { if (e.target.id === "noteOverlay") close(); });
  if (editing) document.getElementById("deleteNote").onclick = () => {
    if (confirm("Padam nota ini?")) { DB.notes = DB.notes.filter(x => x.id !== n.id); saveDB(); close(); renderNotesPage(pageEl); }
  };
  document.getElementById("saveNote").onclick = () => {
    n.title = document.getElementById("nTitle").value.trim();
    n.body = document.getElementById("nBody").value.trim();
    n.tags = [...selTags];
    n.updatedAt = todayISO();
    if (!editing) DB.notes.unshift(n);
    saveDB(); close(); renderNotesPage(pageEl);
    toast("Nota disimpan!");
  };
}

/* =========================================================
   PERSONAL RECORDS
   ========================================================= */
function renderRecordsPage(el) {
  const keys = Object.keys(DB.records);
  el.innerHTML = `
    <div class="page-title">Personal Record</div>
    <div class="page-sub">Rekod terbaik anda dikesan secara automatik daripada data workout.</div>
    <div class="grid grid-3">
      ${keys.length ? keys.map(k => {
        const r = DB.records[k];
        return `<div class="card hoverable">
          <div class="card-label">🥇 ${esc(r.name)}</div>
          <div class="card-value">${r.value}<span style="font-size:14px;color:var(--text-mute);"> kg</span></div>
          <div class="card-sub">Dicapai pada ${fmtDate(r.date)}</div>
        </div>`;
      }).join("") : emptyMini("Belum ada rekod. Tambah exercise dengan berat dalam Workout untuk mula menjejak PR.")}
    </div>
  `;
}

/* =========================================================
   PROGRESS GALLERY  (single source of truth: DB.gallery)
   ========================================================= */
let galleryFilter = "Semua";
let compareSelection = [];
const CATEGORY_OPTIONS = ["Depan","Sisi","Belakang","Muka","Bulking","Cutting"];

function filteredGallery() {
  let items = [...DB.gallery].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const today = todayISO();
  if (galleryFilter === "Minggu Ini") items = items.filter(i => daysBetween(i.date, today) >= 0 && daysBetween(i.date, today) <= 7);
  else if (galleryFilter === "Bulan Ini") items = items.filter(i => daysBetween(i.date, today) >= 0 && daysBetween(i.date, today) <= 30);
  else if (galleryFilter === "Tahun Ini") items = items.filter(i => i.date.slice(0,4) === today.slice(0,4));
  else if (galleryFilter !== "Semua") items = items.filter(i => (i.tags || []).includes(galleryFilter));
  return items;
}
function renderGalleryPage(el) {
  try {
    const tabs = ["Semua","Minggu Ini","Bulan Ini","Tahun Ini", ...CATEGORY_OPTIONS];
    const items = filteredGallery();

    el.innerHTML = `
      <div class="page-title">Progress Gallery</div>
      <div class="page-sub">Simpan gambar &amp; video kemajuan fizikal anda dari semasa ke semasa. Tersegerak automatik dengan Calendar.</div>
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-green" id="uploadBtn">📤 Muat Naik</button>
        <button class="btn btn-outline" id="compareBtn">🔀 Bandingkan (${compareSelection.length}/2)</button>
        ${compareSelection.length ? `<button class="btn btn-gray btn-sm" id="clearCmpBtn">Kosongkan pilihan</button>` : ""}
      </div>
      <div class="pill-row">
        ${tabs.map(t => `<div class="pill ${galleryFilter===t?"active":""}" data-tab="${esc(t)}">${esc(t)}</div>`).join("")}
      </div>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:14px;" id="galGrid">
        ${items.length ? items.map(g => galleryCardHtml(g)).join("") : `<div style="grid-column:1/-1;">${emptyMini("Tiada media dalam penapis ini. Muat naik gambar atau video pertama anda!")}</div>`}
      </div>
    `;

    el.querySelectorAll("[data-tab]").forEach(p => p.addEventListener("click", () => { galleryFilter = p.dataset.tab; renderGalleryPage(el); }));
    document.getElementById("uploadBtn").onclick = () => openUploadModal(todayISO(), () => renderGalleryPage(el), CATEGORY_OPTIONS.includes(galleryFilter) ? galleryFilter : null);
    const clearBtn = document.getElementById("clearCmpBtn");
    if (clearBtn) clearBtn.onclick = () => { compareSelection = []; renderGalleryPage(el); };

    el.querySelectorAll("[data-cmp]").forEach(cb => cb.addEventListener("click", e => {
      e.stopPropagation();
      const id = cb.dataset.cmp;
      const item = DB.gallery.find(x => x.id === id);
      if (cb.checked) {
        if (item.type === "video") { cb.checked = false; toast("Hanya gambar boleh dibandingkan"); return; }
        if (compareSelection.length >= 2) { cb.checked = false; toast("Hanya boleh pilih 2 gambar untuk dibandingkan"); return; }
        compareSelection.push(id);
      } else {
        compareSelection = compareSelection.filter(x => x !== id);
      }
      renderGalleryPage(el);
    }));
    el.querySelectorAll("[data-view]").forEach(c => c.addEventListener("click", (e) => {
      if (e.target.closest(".cmp-check")) return;
      const item = DB.gallery.find(g => g.id === c.dataset.view);
      if (item) openMediaLightbox(item, items);
    }));
    document.getElementById("compareBtn").onclick = () => {
      if (compareSelection.length < 2) { toast("Sila pilih 2 gambar terlebih dahulu untuk dibandingkan"); return; }
      const pair = compareSelection.map(id => DB.gallery.find(g => g.id === id)).filter(Boolean);
      if (pair.length !== 2) { toast("Gambar yang dipilih tidak sah, sila pilih semula"); compareSelection = []; renderGalleryPage(el); return; }
      openCompareModal(pair);
    };
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="page-title">Progress Gallery</div>${emptyMini("Ralat memaparkan galeri. Sila muat semula halaman.")}`;
  }
}

function galleryCardHtml(g) {
  const day = DB.days[g.date];
  const checked = compareSelection.includes(g.id);
  return `<div class="gal-card" data-view="${g.id}">
    ${g.type !== "video" ? `<div class="cmp-check"><input type="checkbox" data-cmp="${g.id}" ${checked?"checked":""} title="Pilih untuk banding"></div>` : ""}
    <div class="thumbwrap">
      ${g.type === "video" ? `<video src="${g.dataUrl}" muted></video><div class="playic">▶</div>` : `<img src="${g.dataUrl}" loading="lazy">`}
    </div>
    <div class="info">
      <div class="d">${g.date}${g.weight ? " · " + g.weight + "kg" : ""}</div>
      <div class="s">${day && day.workoutName ? esc(day.workoutName) : (g.note ? esc(g.note.slice(0,40)) : "")}</div>
      <div class="tags">${(g.tags||[]).slice(0,3).map(t => `<span class="tag-chip">${esc(t)}</span>`).join("")}</div>
    </div>
  </div>`;
}

/* ---------- Upload modal (full form, category required) ---------- */
function openUploadModal(defaultIso, onDone, preCategory) {
  const day = getDay(defaultIso);
  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-overlay open" id="uploadOverlay">
    <div class="modal wide">
      <div class="modal-head"><h3>Muat Naik Media</h3><button class="modal-close" id="closeUpload">✕</button></div>
      <div class="modal-body">
        <div class="field">
          <label>Pilih Fail (Gambar / Video — boleh banyak)</label>
          <input type="file" id="upFiles" accept="image/*,video/*" multiple>
        </div>
        <div id="upPreview" class="media-thumb-grid"></div>
        <div class="field-row">
          <div class="field"><label>Tarikh</label><input type="date" id="upDate" value="${defaultIso}"></div>
          <div class="field"><label>Berat Badan (kg)</label><input type="number" step="0.1" id="upWeight" value="${day.weight||""}"></div>
        </div>
        <div class="field">
          <label>Kategori (pilih sekurang-kurangnya satu)</label>
          <div class="checkbox-grid" id="upCatGrid">
            ${CATEGORY_OPTIONS.map(c => `<label class="tagcheck ${preCategory===c?"sel":""}" data-catopt="${c}"><input type="checkbox" value="${c}" ${preCategory===c?"checked":""}>${c}</label>`).join("")}
          </div>
        </div>
        <div class="field"><label>Catatan</label><textarea id="upNote" rows="2" placeholder="Catatan pilihan"></textarea></div>
        <div id="upError" style="display:none;color:var(--red);font-size:12.5px;margin-top:-6px;margin-bottom:10px;"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-gray" id="cancelUpload">Batal</button>
        <button class="btn btn-green" id="confirmUpload">Simpan</button>
      </div>
    </div>
  </div>`;

  let pendingFiles = [];
  const previewWrap = document.getElementById("upPreview");
  document.getElementById("upFiles").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    pendingFiles = pendingFiles.concat(files);
    await renderUpPreview();
  });
  async function renderUpPreview() {
    previewWrap.innerHTML = "";
    for (let i = 0; i < pendingFiles.length; i++) {
      try {
        const dataUrl = await readFileAsDataUrl(pendingFiles[i]);
        const kind = fileKind(pendingFiles[i]);
        const div = document.createElement("div");
        div.className = "media-thumb";
        div.innerHTML = (kind === "video" ? `<video src="${dataUrl}" muted></video><span class="vbadge">🎥</span>` : `<img src="${dataUrl}">`) +
          `<div class="mdel" data-rm="${i}">✕</div>`;
        previewWrap.appendChild(div);
      } catch (err) { console.error(err); }
    }
    previewWrap.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => {
      pendingFiles.splice(Number(b.dataset.rm), 1); renderUpPreview();
    }));
  }

  document.querySelectorAll("#upCatGrid .tagcheck").forEach(label => {
    const cb = label.querySelector("input");
    cb.addEventListener("change", () => label.classList.toggle("sel", cb.checked));
  });

  const close = () => document.getElementById("modalRoot").innerHTML = "";
  document.getElementById("closeUpload").onclick = close;
  document.getElementById("cancelUpload").onclick = close;
  document.getElementById("uploadOverlay").addEventListener("click", e => { if (e.target.id === "uploadOverlay") close(); });

  document.getElementById("confirmUpload").onclick = async () => {
    const errEl = document.getElementById("upError");
    errEl.style.display = "none";
    if (!pendingFiles.length) { errEl.textContent = "Sila pilih sekurang-kurangnya satu fail."; errEl.style.display = "block"; return; }
    const selectedCats = Array.from(document.querySelectorAll("#upCatGrid input:checked")).map(i => i.value);
    const allTags = [...selectedCats];
    if (!allTags.length) { errEl.textContent = "Sila pilih sekurang-kurangnya satu kategori sebelum menyimpan."; errEl.style.display = "block"; return; }

    const date = document.getElementById("upDate").value || todayISO();
    const weight = document.getElementById("upWeight").value;
    const note = document.getElementById("upNote").value.trim();

    try {
      for (const f of pendingFiles) {
        const dataUrl = await compressImageFile(f);
        DB.gallery.push({
          id: uid(), dataUrl, type: fileKind(f), mime: f.type || "",
          date, weight, note, tags: allTags, createdAt: new Date().toISOString()
        });
      }
      saveDB();
      close();
      toast(`${pendingFiles.length} media disimpan & disegerak dengan Calendar!`);
      onDone && onDone();
    } catch (err) {
      console.error(err);
      toast("Gagal memuat naik sebahagian fail, sila cuba lagi", "⚠️");
    }
  };
}

/* ---------- Lightbox: view / edit / replace / delete (shared by Calendar & Gallery) ---------- */
function openMediaLightbox(item, list) {
  const items = list || mediaForDate(item.date);
  let idx = Math.max(0, items.findIndex(x => x.id === item.id));
  let infoOpen = false;

  function cur() { return items[idx]; }

  function renderView() {
    const g = cur();
    const day = DB.days[g.date];
    const canPrev = idx > 0, canNext = idx < items.length - 1;
    document.getElementById("modalRoot").innerHTML = `
    <div class="lb-fullscreen" id="lbOverlay">
      <button class="lb-close-thin" id="closeLb">✕</button>
      <div class="lb-date-thin">${g.date}${items.length>1?` · ${idx+1}/${items.length}`:""}</div>
      ${canPrev?`<button class="lb-arrow-thin lb-arrow-left" id="lbPrev">‹</button>`:""}
      ${canNext?`<button class="lb-arrow-thin lb-arrow-right" id="lbNext">›</button>`:""}
      <div class="lb-stage" id="lbStage">
        <div class="lightbox-media">
          ${g.type === "video" ? `<video src="${g.dataUrl}" controls playsinline></video>` : `<img src="${g.dataUrl}" alt="">`}
        </div>
      </div>
      <button class="lb-info-toggle" id="lbInfoToggle">ⓘ</button>
      <div class="lb-sheet ${infoOpen?"open":""}" id="lbSheet">
        ${day ? `<div class="grid grid-4" style="margin-bottom:14px;">
          <div class="card"><div class="card-label">Workout</div><div class="card-sub" style="color:var(--text);">${esc(day.workoutName||"—")}</div></div>
          <div class="card"><div class="card-label">Mood</div><div class="card-sub" style="color:var(--text);font-size:18px;">${day.mood||"—"}</div></div>
          <div class="card"><div class="card-label">Berat</div><div class="card-sub" style="color:var(--text);">${g.weight?g.weight+" kg":"—"}</div></div>
          <div class="card"><div class="card-label">Daily Score</div><div class="card-sub" style="color:var(--text);">${dailyScore(g.date)}</div></div>
        </div>` : `<div class="card-sub" style="margin-bottom:10px;">${g.weight?"Berat: "+g.weight+" kg":""}</div>`}
        <div class="tags" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          ${(g.tags||[]).map(t => `<span class="tag-chip">${esc(t)}</span>`).join("") || `<span class="card-sub">Tiada kategori</span>`}
        </div>
        ${g.note ? `<div class="card-sub" style="margin-bottom:12px;">${esc(g.note)}</div>` : ""}
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-red" id="delGal">Padam</button>
          <button class="btn btn-green" id="editGalBtn">✎ Ubah</button>
        </div>
      </div>
    </div>`;

    document.getElementById("closeLb").onclick = closeFn;
    document.getElementById("lbInfoToggle").onclick = () => { infoOpen = !infoOpen; renderView(); };
    document.getElementById("delGal").onclick = () => {
      if (confirm("Padam media ini?")) {
        DB.gallery = DB.gallery.filter(x => x.id !== g.id);
        saveDB(); closeFn();
        refreshCurrentPage();
        toast("Media dipadam");
      }
    };
    document.getElementById("editGalBtn").onclick = renderEdit;
    const prevBtn = document.getElementById("lbPrev");
    const nextBtn = document.getElementById("lbNext");
    if (prevBtn) prevBtn.onclick = () => { idx--; infoOpen = false; renderView(); };
    if (nextBtn) nextBtn.onclick = () => { idx++; infoOpen = false; renderView(); };

    const stage = document.getElementById("lbStage");
    let touchStartX = null;
    stage.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", e => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx > 50 && canPrev) { idx--; infoOpen = false; renderView(); }
      else if (dx < -50 && canNext) { idx++; infoOpen = false; renderView(); }
      touchStartX = null;
    }, { passive: true });

    function keyHandler(e) {
      if (e.key === "Escape") closeFn();
      else if (e.key === "ArrowLeft" && canPrev) { idx--; infoOpen = false; renderView(); }
      else if (e.key === "ArrowRight" && canNext) { idx++; infoOpen = false; renderView(); }
    }
    document.removeEventListener("keydown", window._lbKeyHandler || (()=>{}));
    window._lbKeyHandler = keyHandler;
    document.addEventListener("keydown", keyHandler);
  }

  function renderEdit() {
    const g = cur();
    document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay open" id="lbOverlay">
      <div class="modal wide">
        <div class="modal-head"><h3>Ubah Media — ${g.date}</h3><button class="modal-close" id="closeLb">✕</button></div>
        <div class="modal-body">
          <div class="lightbox-media" style="max-height:40vh;margin-bottom:16px;">
            ${g.type === "video" ? `<video src="${g.dataUrl}" controls playsinline></video>` : `<img src="${g.dataUrl}" alt="">`}
          </div>
          <div class="field-row">
            <div class="field"><label>Tarikh</label><input type="date" id="gDate" value="${g.date}"></div>
            <div class="field"><label>Berat Badan (kg)</label><input type="number" step="0.1" id="gW" value="${g.weight||""}"></div>
          </div>
          <div class="field">
            <label>Kategori</label>
            <div class="checkbox-grid" id="gCatGrid">
              ${CATEGORY_OPTIONS.map(c => `<label class="tagcheck ${g.tags&&g.tags.includes(c)?"sel":""}" data-catopt="${c}"><input type="checkbox" value="${c}" ${g.tags&&g.tags.includes(c)?"checked":""}>${c}</label>`).join("")}
            </div>
          </div>
          <div class="field"><label>Catatan</label><textarea id="gNote" rows="2">${esc(g.note||"")}</textarea></div>
          <div id="lbError" style="display:none;color:var(--red);font-size:12.5px;"></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-gray" id="cancelEdit">Batal</button>
          <button class="btn btn-green" id="saveGal">Simpan</button>
        </div>
      </div>
    </div>`;

    document.querySelectorAll("#gCatGrid .tagcheck").forEach(label => {
      const cb = label.querySelector("input");
      cb.addEventListener("change", () => label.classList.toggle("sel", cb.checked));
    });
    document.getElementById("closeLb").onclick = renderView;
    document.getElementById("cancelEdit").onclick = renderView;
    document.getElementById("saveGal").onclick = () => {
      const errEl = document.getElementById("lbError");
      errEl.style.display = "none";
      const selectedCats = Array.from(document.querySelectorAll("#gCatGrid input:checked")).map(i => i.value);
      if (!selectedCats.length) { errEl.textContent = "Sila pilih sekurang-kurangnya satu kategori."; errEl.style.display = "block"; return; }
      g.date = document.getElementById("gDate").value || g.date;
      g.weight = document.getElementById("gW").value;
      g.tags = selectedCats;
      g.note = document.getElementById("gNote").value;
      saveDB();
      toast("Media dikemas kini!");
      renderView();
      refreshCurrentPage();
    };
  }

  function closeFn() {
    document.removeEventListener("keydown", window._lbKeyHandler || (()=>{}));
    document.getElementById("modalRoot").innerHTML = "";
  }

  renderView();
}

function refreshCurrentPage() {
  const wrap = document.getElementById("pageWrap");
  if (!wrap) return;
  if (currentPage === "gallery") renderGalleryPage(wrap);
  else if (currentPage === "calendar") renderCalendarPage(wrap);
  else if (currentPage === "dashboard") renderDashboard(wrap);
}

/* ---------- Compare (draggable before/after slider) ---------- */
function openCompareModal(pair) {
  let [a, b] = pair;
  if (new Date(a.date) > new Date(b.date)) { [a, b] = [b, a]; }
  const wDiff = (a.weight && b.weight) ? (parseFloat(b.weight) - parseFloat(a.weight)).toFixed(1) : null;
  const dayDiff = Math.abs(daysBetween(a.date, b.date));
  let workoutCount = 0;
  let d = new Date(a.date);
  const endD = new Date(b.date);
  while (d <= endD) { const di = todayISO(d); if (DB.days[di] && DB.days[di].done) workoutCount++; d.setDate(d.getDate() + 1); }

  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-overlay open" id="cmpOverlay">
    <div class="modal wide">
      <div class="modal-head"><h3>Perbandingan Before &amp; After</h3><button class="modal-close" id="closeCmp">✕</button></div>
      <div class="modal-body">
        <div class="compare-wrap" id="cmpWrap">
          <img src="${a.dataUrl}" class="cmp-before-img">
          <div class="compare-after-wrap" id="cmpAfterWrap">
            <img src="${b.dataUrl}" class="cmp-after-img">
          </div>
          <div class="compare-slider-handle" id="cmpHandle"></div>
          <div class="compare-label before">${a.date}${a.weight?" · "+a.weight+"kg":""}</div>
          <div class="compare-label after">${b.date}${b.weight?" · "+b.weight+"kg":""}</div>
        </div>
        <div class="grid grid-3" style="margin-top:16px;">
          <div class="card"><div class="card-label">Perbezaan Hari</div><div class="card-value" style="font-size:20px;">${dayDiff} hari</div></div>
          <div class="card"><div class="card-label">Perbezaan Berat</div><div class="card-value" style="font-size:20px;">${wDiff !== null ? (wDiff>0?"+":"")+wDiff+" kg" : "—"}</div></div>
          <div class="card"><div class="card-label">Workout Selesai</div><div class="card-value" style="font-size:20px;">${workoutCount}</div></div>
        </div>
      </div>
    </div>
  </div>`;

  const wrap = document.getElementById("cmpWrap");
  const afterWrap = document.getElementById("cmpAfterWrap");
  const handle = document.getElementById("cmpHandle");
  let dragging = false;

  function setPct(pct) {
    pct = Math.max(0, Math.min(100, pct));
    afterWrap.style.width = pct + "%";
    handle.style.left = pct + "%";
  }
  setPct(50);

  function pointerToPct(clientX) {
    const rect = wrap.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  }
  function onDown(e) { dragging = true; e.preventDefault(); }
  function onMove(e) {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setPct(pointerToPct(clientX));
  }
  function onUp() { dragging = false; }

  handle.addEventListener("mousedown", onDown);
  handle.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchend", onUp);
  wrap.addEventListener("click", (e) => { if (e.target === handle) return; setPct(pointerToPct(e.clientX)); });

  function cleanupListeners() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("touchend", onUp);
  }
  document.getElementById("closeCmp").onclick = () => {
    cleanupListeners();
    document.getElementById("modalRoot").innerHTML = "";
    compareSelection = [];
    refreshCurrentPage();
  };
}

/* =========================================================
   ANALYTICS
   ========================================================= */
let analyticsRange = "weekly";
function renderAnalyticsPage(el) {
  el.innerHTML = `
    <div class="page-title">Analytics</div>
    <div class="page-sub">Lihat semua statistik dan trend dalam bentuk visual.</div>
    <div class="pill-row">
      ${[["weekly","Mingguan"],["monthly","Bulanan"],["yearly","Tahunan"],["all","Keseluruhan"]].map(([k,l]) =>
        `<div class="pill ${analyticsRange===k?"active":""}" data-range="${k}">${l}</div>`).join("")}
    </div>
    <div class="grid grid-4" id="analyticsSummary" style="margin-bottom:20px;"></div>
    <div class="grid grid-2" style="margin-bottom:20px;">
      <div class="chart-box"><h4>Workout Completion</h4><canvas id="chartWorkout" height="160"></canvas></div>
      <div class="chart-box"><h4>Habit Completion</h4><canvas id="chartHabit" height="160"></canvas></div>
    </div>
    <div class="grid grid-2">
      <div class="chart-box"><h4>Berat Badan</h4><canvas id="chartWeight" height="160"></canvas></div>
      <div class="chart-box"><h4>Kalori & Air</h4><canvas id="chartCalWater" height="160"></canvas></div>
    </div>
  `;
  el.querySelectorAll("[data-range]").forEach(p => p.addEventListener("click", () => { analyticsRange = p.dataset.range; renderAnalyticsPage(el); }));
  buildAnalytics();
}
function rangeDates() {
  const n = analyticsRange === "weekly" ? 7 : analyticsRange === "monthly" ? 30 : analyticsRange === "yearly" ? 365 : 9999;
  const allDates = Object.keys(DB.days).sort();
  const start = analyticsRange === "all" ? (allDates[0] || todayISO()) : todayISO(new Date(Date.now() - (n-1) * 86400000));
  const arr = [];
  let d = new Date(start);
  const end = new Date();
  while (d <= end) { arr.push(todayISO(d)); d.setDate(d.getDate() + 1); }
  return arr;
}
function buildAnalytics() {
  const dates = rangeDates();
  const workoutDays = dates.map(iso => DB.days[iso]).filter(Boolean);
  const doneCount = workoutDays.filter(d => d.done).length;
  const restCount = workoutDays.filter(d => d.rest).length;
  const totalExercises = workoutDays.reduce((s, d) => s + (d.exercises ? d.exercises.length : 0), 0);
  const totalSets = workoutDays.reduce((s, d) => s + (d.exercises || []).reduce((s2, e) => s2 + ((e.sets || []).filter(x => x.done).length), 0), 0);
  const totalReps = workoutDays.reduce((s, d) => s + (d.exercises || []).reduce((s2, e) => s2 + (e.sets || []).filter(x => x.done).reduce((s3, x) => s3 + (parseInt(x.reps) || 0), 0), 0), 0);
  const habitTotal = DB.habits.length * dates.length;
  const habitDone = dates.reduce((s, iso) => s + DB.habits.filter(h => DB.habitLogs[h.id+"|"+iso]).length, 0);
  const taskDone = DB.tasks.filter(t => t.done && dates.includes(t.due)).length;
  const taskTotal = DB.tasks.filter(t => dates.includes(t.due)).length;
  const avgWater = avg(workoutDays.map(d => parseFloat(d.waterL)).filter(x => !isNaN(x)));
  const avgCal = avg(workoutDays.map(d => parseFloat(d.calories)).filter(x => !isNaN(x)));
  const weights = dates.map(iso => ({ iso, w: DB.days[iso] && DB.days[iso].weight ? parseFloat(DB.days[iso].weight) : null })).filter(x => x.w);

  document.getElementById("analyticsSummary").innerHTML = [
    ["Workout Completion", (workoutDays.length? Math.round(doneCount/workoutDays.length*100):0)+"%", doneCount+" hari selesai"],
    ["Habit Completion", (habitTotal? Math.round(habitDone/habitTotal*100):0)+"%", habitDone+"/"+habitTotal],
    ["Task Completion", (taskTotal? Math.round(taskDone/taskTotal*100):0)+"%", taskDone+"/"+taskTotal+" tugasan"],
    ["Current Streak", currentStreak()+" hari", "Jangan putus!"],
    ["Avg Water", (avgWater||0).toFixed(1)+" L", "Purata pengambilan"],
    ["Avg Calories", Math.round(avgCal||0)+" kcal", "Purata dibakar"],
    ["Total Exercise", totalExercises, totalSets+" set selesai"],
    ["Total Rep", totalReps, "Set yang ditanda selesai"],
  ].map(([l,v,s]) => `<div class="card"><div class="card-label">${l}</div><div class="card-value" style="font-size:22px;">${v}</div><div class="card-sub">${s}</div></div>`).join("");

  new Chart(document.getElementById("chartWorkout"), {
    type: "bar",
    data: { labels: dates.map(d => d.slice(5)), datasets: [{ data: dates.map(iso => { const d = DB.days[iso]; return d ? (d.rest?50:d.done?100:20) : 0; }), backgroundColor: dates.map(iso => { const d = DB.days[iso]; return !d?"#2A2E38": d.rest?"#FFB84D": d.done?"#00D4AA":"#FF4757"; }), borderRadius:5 }] },
    options: { plugins:{legend:{display:false}}, scales:{x:{ticks:{color:"#7A7F8A",maxTicksLimit:12},grid:{display:false}},y:{display:false}} }
  });
  new Chart(document.getElementById("chartHabit"), {
    type: "bar",
    data: { labels: DB.habits.map(h => h.name), datasets: [{ data: DB.habits.map(h => { const c = dates.filter(iso => DB.habitLogs[h.id+"|"+iso]).length; return dates.length? Math.round(c/dates.length*100):0; }), backgroundColor: DB.habits.map(h => h.color), borderRadius: 6 }] },
    options: { indexAxis: "y", plugins:{legend:{display:false}}, scales:{x:{max:100,ticks:{color:"#7A7F8A"},grid:{color:"#2A2E38"}},y:{ticks:{color:"#B8BCC4"},grid:{display:false}}} }
  });
  new Chart(document.getElementById("chartWeight"), {
    type: "line",
    data: { labels: weights.map(w => w.iso.slice(5)), datasets: [{ data: weights.map(w => w.w), borderColor:"#4A90D9", backgroundColor:"rgba(74,144,217,.15)", fill:true, tension:.35, pointRadius:2 }] },
    options: { plugins:{legend:{display:false}}, scales:{x:{ticks:{color:"#7A7F8A",maxTicksLimit:10},grid:{display:false}},y:{ticks:{color:"#7A7F8A"},grid:{color:"#2A2E38"}}} }
  });
  new Chart(document.getElementById("chartCalWater"), {
    type: "bar",
    data: { labels: dates.map(d=>d.slice(5)), datasets: [
      { label:"Kalori", data: dates.map(iso => DB.days[iso]?.calories||0), backgroundColor:"#FF6B7A" },
      { label:"Air (x100ml)", data: dates.map(iso => (DB.days[iso]?.waterL||0)*10), backgroundColor:"#6BA8E8" }
    ] },
    options: { plugins:{legend:{labels:{color:"#B8BCC4"}}}, scales:{x:{ticks:{color:"#7A7F8A",maxTicksLimit:10},grid:{display:false}},y:{ticks:{color:"#7A7F8A"},grid:{color:"#2A2E38"}}} }
  });
}
function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

/* =========================================================
   MOOD / WATER / SLEEP / NUTRITION TRACKERS
   ========================================================= */
function renderMoodPage(el) {
  const dates = Array.from({length:14},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(13-i)); return todayISO(d); });
  const moods = ["😀","😄","🙂","😐","😞","😢","😡"];
  const today = getDay(todayISO());
  el.innerHTML = `
    <div class="page-title">Mood Tracker</div>
    <div class="page-sub">Rekod perasaan anda setiap hari.</div>
    <div class="card" style="margin-bottom:20px;">
      <div class="card-label">Mood Hari Ini</div>
      <div class="emoji-row" id="moodToday" style="margin-top:10px;">
        ${moods.map(m => `<div class="emoji-opt ${today.mood===m?"sel":""}" data-mood="${m}" style="width:46px;height:46px;font-size:22px;">${m}</div>`).join("")}
      </div>
    </div>
    <div class="chart-box"><h4>Trend Mood — 14 Hari Terakhir</h4>
      <div style="display:flex;gap:10px;justify-content:space-between;margin-top:16px;flex-wrap:wrap;">
        ${dates.map(iso => `<div style="text-align:center;font-size:11px;color:var(--text-mute);">
          <div style="font-size:22px;">${(DB.days[iso]&&DB.days[iso].mood)||"—"}</div>${iso.slice(5)}
        </div>`).join("")}
      </div>
    </div>
  `;
  el.querySelectorAll("#moodToday .emoji-opt").forEach(o => o.addEventListener("click", () => {
    today.mood = o.dataset.mood; today.marked = true; saveDB(); renderMoodPage(el);
  }));
}

function renderWaterPage(el) {
  const iso = todayISO();
  const day = getDay(iso);
  const cur = Math.round((parseFloat(day.waterL)||0)*1000);
  const target = DB.settings.waterTarget;
  const pct = Math.min(100, Math.round(cur/target*100));
  el.innerHTML = `
    <div class="page-title">Water Tracker</div>
    <div class="page-sub">Sasaran harian: ${target} ml</div>
    <div class="card" style="text-align:center;padding:30px;">
      <div style="font-size:36px;font-weight:800;color:var(--blue-hi);">${cur} ml</div>
      <div class="card-sub" style="margin-bottom:16px;">${pct}% daripada sasaran</div>
      <div class="progressbar" style="max-width:400px;margin:0 auto 20px;"><div style="width:${pct}%;background:var(--blue);"></div></div>
      <button class="water-drop-btn" id="addWater">+250ml</button>
      <button class="btn btn-outline btn-sm" id="resetWater" style="display:block;margin:16px auto 0;">Reset</button>
    </div>
  `;
  document.getElementById("addWater").onclick = () => {
    day.waterL = ((parseFloat(day.waterL)||0) + 0.25).toFixed(2);
    day.marked = true; saveDB(); renderWaterPage(el);
  };
  document.getElementById("resetWater").onclick = () => { day.waterL = 0; saveDB(); renderWaterPage(el); };
}

function renderSleepPage(el) {
  const iso = todayISO();
  const day = getDay(iso);
  let duration = "—";
  if (day.sleepStart && day.sleepEnd) {
    let [sh, sm] = day.sleepStart.split(":").map(Number);
    let [eh, em] = day.sleepEnd.split(":").map(Number);
    let mins = (eh*60+em) - (sh*60+sm); if (mins < 0) mins += 24*60;
    duration = (mins/60).toFixed(1) + " jam";
  }
  el.innerHTML = `
    <div class="page-title">Sleep Tracker</div>
    <div class="page-sub">Rekod masa tidur dan kualiti tidur anda.</div>
    <div class="card" style="max-width:480px;">
      <div class="field-row">
        <div class="field"><label>Masa Tidur</label><input type="time" id="sStart" value="${day.sleepStart||""}"></div>
        <div class="field"><label>Masa Bangun</label><input type="time" id="sEnd" value="${day.sleepEnd||""}"></div>
      </div>
      <div class="card-sub" style="margin-bottom:14px;">Tempoh tidur: <strong style="color:var(--text);">${duration}</strong></div>
      <label>Kualiti Tidur</label>
      <div class="star-row" id="starRow" style="margin-top:6px;">
        ${[1,2,3,4,5].map(i => `<span class="star ${day.sleepQuality>=i?"on":""}" data-star="${i}">★</span>`).join("")}
      </div>
      <button class="btn btn-green" id="saveSleep" style="margin-top:16px;">Simpan</button>
    </div>
  `;
  let q = day.sleepQuality || 0;
  document.querySelectorAll("#starRow .star").forEach(s => s.addEventListener("click", () => {
    q = Number(s.dataset.star);
    document.querySelectorAll("#starRow .star").forEach((x,i) => x.classList.toggle("on", i < q));
  }));
  document.getElementById("saveSleep").onclick = () => {
    day.sleepStart = document.getElementById("sStart").value;
    day.sleepEnd = document.getElementById("sEnd").value;
    day.sleepQuality = q; day.marked = true;
    saveDB(); toast("Rekod tidur disimpan!"); renderSleepPage(el);
  };
}

function renderNutritionPage(el) {
  const iso = todayISO();
  const n = getNutrition(iso);
  const tgt = DB.settings.nutritionTarget;

  function pct(val, target) { return target ? Math.min(100, Math.round((parseFloat(val)||0) / target * 100)) : 0; }

  el.innerHTML = `
    <div class="page-title">Nutrition</div>
    <div class="page-sub">Rekod pengambilan makronutrien harian. Data ini disimpan berasingan daripada Calendar.</div>
    <div class="card" style="max-width:520px;margin-bottom:20px;">
      <div class="field-row">
        <div class="field"><label>Protein (g)</label><input type="number" id="nProtein" value="${n.protein||""}"></div>
        <div class="field"><label>Karbohidrat (g)</label><input type="number" id="nCarbs" value="${n.carbs||""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Lemak (g)</label><input type="number" id="nFat" value="${n.fat||""}"></div>
        <div class="field"><label>Kalori (kcal) — auto dikira</label><input type="number" id="nCal" value="${n.calories||""}" readonly style="opacity:.75;"></div>
      </div>
      <button class="btn btn-green" id="saveNutrition">Simpan</button>
    </div>

    <div class="section-title">Sasaran Harian</div>
    <div class="grid grid-4" style="margin-bottom:10px;">
      <div class="card">
        <div class="card-label">Protein</div>
        <div class="card-value" style="font-size:18px;">${n.protein||0}<span style="font-size:12px;color:var(--text-mute);"> / ${tgt.protein}g</span></div>
        <div class="progressbar" style="margin-top:8px;"><div style="width:${pct(n.protein,tgt.protein)}%;background:var(--green);"></div></div>
      </div>
      <div class="card">
        <div class="card-label">Karbohidrat</div>
        <div class="card-value" style="font-size:18px;">${n.carbs||0}<span style="font-size:12px;color:var(--text-mute);"> / ${tgt.carbs}g</span></div>
        <div class="progressbar" style="margin-top:8px;"><div style="width:${pct(n.carbs,tgt.carbs)}%;background:var(--blue);"></div></div>
      </div>
      <div class="card">
        <div class="card-label">Lemak</div>
        <div class="card-value" style="font-size:18px;">${n.fat||0}<span style="font-size:12px;color:var(--text-mute);"> / ${tgt.fat}g</span></div>
        <div class="progressbar" style="margin-top:8px;"><div style="width:${pct(n.fat,tgt.fat)}%;background:var(--yellow);"></div></div>
      </div>
      <div class="card">
        <div class="card-label">Kalori</div>
        <div class="card-value" style="font-size:18px;">${n.calories||0}<span style="font-size:12px;color:var(--text-mute);"> / ${tgt.calories}</span></div>
        <div class="progressbar" style="margin-top:8px;"><div style="width:${pct(n.calories,tgt.calories)}%;background:var(--purple);"></div></div>
      </div>
    </div>
  `;

  function recalcCalories() {
    const p = parseFloat(document.getElementById("nProtein").value) || 0;
    const c = parseFloat(document.getElementById("nCarbs").value) || 0;
    const f = parseFloat(document.getElementById("nFat").value) || 0;
    document.getElementById("nCal").value = Math.round(p*4 + c*4 + f*9);
  }
  ["nProtein","nCarbs","nFat"].forEach(id => document.getElementById(id).addEventListener("input", recalcCalories));

  document.getElementById("saveNutrition").onclick = () => {
    n.protein = document.getElementById("nProtein").value;
    n.carbs = document.getElementById("nCarbs").value;
    n.fat = document.getElementById("nFat").value;
    n.calories = document.getElementById("nCal").value;
    saveDB(); toast("Data pemakanan disimpan!"); renderNutritionPage(el);
  };
}

/* =========================================================
   INIT
   ========================================================= */
function init() {
  if (!localStorage.getItem(STORE_KEY)) {
    // seed a little sample data so the UI isn't empty on first run
    DB.habits.push({ id: uid(), name: "Workout", icon: "💪", color: "#00D4AA" });
    DB.habits.push({ id: uid(), name: "Minum Air", icon: "💧", color: "#4A90D9" });
    DB.habits.push({ id: uid(), name: "Baca Al-Quran", icon: "📖", color: "#A78BFA" });
    saveDB();
  }
  initProfileUI();
  renderNav();
  renderPage();
}
init();
