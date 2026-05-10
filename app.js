import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, onDisconnect, update } from "firebase/database";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyD7AlwtZFi1T93Pmjfi7Jb0YJLpyX680p8",
  authDomain: "adidas-run-app.firebaseapp.com",
  projectId: "adidas-run-app",
  storageBucket: "adidas-run-app.firebasestorage.app",
  messagingSenderId: "727314003122",
  appId: "1:727314003122:web:6c493d2c1817b4acb867ab",
  measurementId: "G-7912T2VW5L"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const myUserId = Math.random().toString(36).substring(7);

// --- Configuration & State ---
let state = {
    isTracking: false,
    isReplaying: false,
    startTime: null,
    totalDistance: 0, 
    pathPoints: [],
    lastLocation: null,
    timerInterval: null,
    steps: 0,
    lastStepTime: 0,
    xp: parseInt(localStorage.getItem('run_xp')) || 0,
    level: parseInt(localStorage.getItem('run_lvl')) || 1,
    userName: localStorage.getItem('run_name') || 'Koşucu',
    history: JSON.parse(localStorage.getItem('run_history')) || [],
    healthData: JSON.parse(localStorage.getItem('run_health')) || null,
    lastMilestone: 0,
    otherUsers: {} 
};

const UI = {
    app: document.getElementById('app'),
    distance: document.getElementById('distance'),
    time: document.getElementById('time'),
    steps: document.getElementById('steps'),
    pace: document.getElementById('pace'),
    calories: document.getElementById('calories'),
    lvl: document.getElementById('lvl'),
    xpBar: document.getElementById('xp-progress'),
    btnStart: document.getElementById('btnStart'),
    btnStop: document.getElementById('btnStop'),
    btnReset: document.getElementById('btnReset'),
    activeControls: document.getElementById('active-controls'),
    
    btnOpenDrawer: document.getElementById('btnOpenDrawer'),
    btnCloseDrawer: document.getElementById('btnCloseDrawer'),
    drawer: document.getElementById('drawer'),
    drawerOverlay: document.querySelector('.drawer-overlay'),
    inputName: document.getElementById('input-name'),
    avatarNav: document.getElementById('avatar-nav'),
    avatarDrawer: document.getElementById('avatar-drawer'),
    
    btnHistory: document.getElementById('btnHistory'),
    historyModal: document.getElementById('history-modal'),
    btnCloseHistory: document.getElementById('btnCloseHistory'),
    historyList: document.getElementById('history-list'),

    btnReplay: document.getElementById('btnReplay'),
    replayOverlay: document.getElementById('replay-overlay'),
    btnStopReplay: document.getElementById('btnStopReplay'),

    btnClosePlan: document.getElementById('btnClosePlan'),
    inputHeight: document.getElementById('input-height'),
    inputWeight: document.getElementById('input-weight'),
    inputAge: document.getElementById('input-age'),
    inputGender: document.getElementById('input-gender'),
    btnCreatePlan: document.getElementById('btnCreatePlan'),
    dailyPlanCard: document.getElementById('daily-plan-card'),
    targetSteps: document.getElementById('target-steps'),
    targetBurn: document.getElementById('target-burn'),
    targetIntake: document.getElementById('target-intake'),
    mealAdvice: document.getElementById('meal-advice'),
    dailyTask: document.getElementById('daily-task'),
    toastContainer: document.getElementById('toast-container'),

    friendModal: document.getElementById('friend-modal'),
    friendName: document.getElementById('friend-name'),
    friendLvl: document.getElementById('friend-lvl'),
    friendDist: document.getElementById('friend-dist'),
    friendAvatar: document.getElementById('friend-avatar'),
    btnCloseFriend: document.getElementById('btnCloseFriend')
};

// --- Map Initialization ---
const map = L.map('map', { zoomControl: false, center: [41.0082, 28.9784], zoom: 15 });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let polyline = L.polyline([], { color: '#e2ff00', weight: 8, opacity: 0.8 }).addTo(map);
let replayPolyline = L.polyline([], { color: '#ffffff', weight: 10, opacity: 1 }).addTo(map);
let userMarker = null;

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast'; toast.innerText = message;
    UI.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'tr-TR';
    window.speechSynthesis.speak(utterance);
}

// --- Core Logic ---
function init() {
    updateGamificationUI(); updateProfileUI(); renderHistory();
    if (state.healthData) renderDailyPlan();
    listenForOtherUsers();

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 17);
            updateUserMarker(latitude, longitude);
            syncMyLocation(latitude, longitude); 
        });
    }

    UI.btnStart.addEventListener('click', startTracking);
    UI.btnStop.addEventListener('click', stopTracking);
    UI.btnReset.addEventListener('click', resetTracking);
    UI.btnOpenDrawer.addEventListener('click', () => UI.drawer.classList.add('active'));
    UI.btnCloseDrawer.addEventListener('click', () => UI.drawer.classList.remove('active'));
    UI.drawerOverlay.addEventListener('click', () => UI.drawer.classList.remove('active'));
    UI.btnCreatePlan.addEventListener('click', createDailyPlan);
    UI.btnClosePlan.addEventListener('click', () => UI.dailyPlanCard.classList.add('hidden'));
    UI.btnHistory.addEventListener('click', () => { renderHistory(); UI.historyModal.classList.remove('hidden'); });
    UI.btnCloseHistory.addEventListener('click', () => UI.historyModal.classList.add('hidden'));
    UI.btnCloseFriend.addEventListener('click', () => UI.friendModal.classList.add('hidden'));
    UI.btnReplay.addEventListener('click', startReplay);
    UI.btnStopReplay.addEventListener('click', stopReplay);
}

function startTracking() {
    if (!("geolocation" in navigator)) return;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(p => { if (p === 'granted') window.addEventListener('devicemotion', onMotionUpdate); });
    } else { window.addEventListener('devicemotion', onMotionUpdate); }
    state.isTracking = true; state.startTime = Date.now();
    UI.btnStart.classList.add('hidden'); UI.activeControls.classList.remove('hidden');
    state.timerInterval = setInterval(updateTimer, 1000);
    state.watchId = navigator.geolocation.watchPosition(onLocationUpdate, null, { enableHighAccuracy: true });
    showToast("Koşu Başlatıldı! 🏃‍♂️"); speak(`Koşu başladı. Başarılar ${state.userName}!`);
}

function stopTracking() {
    state.isTracking = false; clearInterval(state.timerInterval);
    navigator.geolocation.clearWatch(state.watchId); window.removeEventListener('devicemotion', onMotionUpdate);
    UI.btnStop.classList.add('hidden'); UI.btnReset.classList.remove('hidden');
    if (state.pathPoints.length > 2) UI.btnReplay.classList.remove('hidden');
    saveRunToHistory(); saveData(); showToast("Koşu Tamamlandı! 🏆");
    speak(`Koşu bitti. ${(state.totalDistance / 1000).toFixed(2)} kilometre koştun.`);
}

function resetTracking() {
    state.totalDistance = 0; state.steps = 0; state.pathPoints = []; state.lastLocation = null; state.startTime = null;
    UI.distance.innerText = "0.00"; UI.time.innerText = "00:00:00"; UI.steps.innerText = "0"; UI.pace.innerText = "0:00"; UI.calories.innerText = "0";
    polyline.setLatLngs([]); replayPolyline.setLatLngs([]);
    UI.btnStart.classList.remove('hidden'); UI.activeControls.classList.add('hidden'); UI.btnStop.classList.remove('hidden'); UI.btnReplay.classList.add('hidden');
}

function onLocationUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords; if (accuracy > 50) return;
    const currentLatLng = [latitude, longitude];
    if (state.lastLocation) {
        const dist = calculateDistance(state.lastLocation[0], state.lastLocation[1], latitude, longitude);
        if (dist > 2) { state.totalDistance += dist; addXP(Math.floor(dist / 2)); }
    }
    state.lastLocation = currentLatLng; state.pathPoints.push(currentLatLng);
    UI.distance.innerText = (state.totalDistance / 1000).toFixed(2); UI.calories.innerText = Math.floor((state.totalDistance / 1000) * 65);
    polyline.setLatLngs(state.pathPoints); updateUserMarker(latitude, longitude); syncMyLocation(latitude, longitude);
    if (!state.isReplaying) map.panTo(currentLatLng);
}

function onMotionUpdate(event) {
    if (!state.isTracking) return;
    const acc = event.accelerationIncludingGravity; if (!acc) return;
    const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    const now = Date.now();
    if (magnitude > 12.5 && (now - state.lastStepTime) > 300) {
        state.steps++; state.lastStepTime = now; UI.steps.innerText = state.steps;
        if (state.totalDistance < 10) addXP(0.2); 
    }
}

// --- Firebase Sync ---
function syncMyLocation(lat, lng) {
    const userRef = ref(db, 'users/' + myUserId);
    update(userRef, { name: state.userName, lat: lat, lng: lng, lvl: state.level, dist: (state.totalDistance / 1000).toFixed(2), lastActive: Date.now() });
    onDisconnect(userRef).remove();
}

function listenForOtherUsers() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val(); if (!users) return;
        Object.keys(users).forEach(id => {
            if (id === myUserId) return;
            const u = users[id];
            if (state.otherUsers[id]) { state.otherUsers[id].marker.setLatLng([u.lat, u.lng]); }
            else {
                const icon = L.divIcon({ className: 'other-user-icon', html: `<div style="background:rgba(255,255,255,0.9);border:2px solid #000;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:bold;font-size:10px;">${u.name.charAt(0)}</div>`, iconSize: [30, 30] });
                const marker = L.marker([u.lat, u.lng], { icon: icon }).addTo(map);
                marker.on('click', () => { UI.friendName.innerText = `${u.name} Koşuyor`; UI.friendLvl.innerText = `LVL ${u.lvl}`; UI.friendDist.innerText = `${u.dist} KM`; UI.friendAvatar.innerText = u.name.charAt(0); UI.friendModal.classList.remove('hidden'); });
                state.otherUsers[id] = { marker: marker };
            }
        });
        Object.keys(state.otherUsers).forEach(id => { if (!users[id]) { map.removeLayer(state.otherUsers[id].marker); delete state.otherUsers[id]; } });
    });
}

function createDailyPlan() {
    const h = parseFloat(UI.inputHeight.value), w = parseFloat(UI.inputWeight.value), a = parseInt(UI.inputAge.value), g = UI.inputGender.value;
    if (!h || !w || !a) { showToast("Lütfen verileri girin!"); return; }
    state.healthData = { height: h, weight: w, age: a, gender: g }; localStorage.setItem('run_health', JSON.stringify(state.healthData));
    renderDailyPlan(); UI.drawer.classList.remove('active'); showToast("Program Hazır! ⚡");
}

function renderDailyPlan() {
    const { height, weight, age, gender } = state.healthData;
    let bmr = (10 * weight) + (6.25 * height) - (5 * age); bmr = (gender === 'male') ? bmr + 5 : bmr - 161;
    UI.targetSteps.innerText = Math.floor(weight * 100 + 3000).toLocaleString(); UI.targetBurn.innerText = `${Math.floor(weight * 5)} kcal`; UI.targetIntake.innerText = `${Math.floor(bmr * 1.2)} kcal`;
    UI.mealAdvice.innerHTML = `Kahvaltıda yulaf, öğlen ızgara tavuk önerilir. Kaloriyi aşmamaya çalış!`;
    UI.dailyPlanCard.classList.remove('hidden'); UI.dailyTask.innerText = "Plan Aktif";
}

function startReplay() {
    if (state.pathPoints.length < 2) return;
    state.isReplaying = true; UI.app.classList.add('replay-mode'); UI.replayOverlay.classList.remove('hidden');
    replayPolyline.setLatLngs([]); map.setView(state.pathPoints[0], 18);
    let i = 0;
    state.replayIntervalId = setInterval(() => {
        if (i >= state.pathPoints.length || !state.isReplaying) { stopReplay(); return; }
        replayPolyline.addLatLng(state.pathPoints[i]); map.panTo(state.pathPoints[i], { animate: true, duration: 0.5 });
        updateUserMarker(state.pathPoints[i][0], state.pathPoints[i][1]); i++;
    }, 400);
}

function stopReplay() { state.isReplaying = false; clearInterval(state.replayIntervalId); UI.app.classList.remove('replay-mode'); UI.replayOverlay.classList.add('hidden'); if (state.lastLocation) map.setView(state.lastLocation, 17); }
function updateUserMarker(lat, lng) { if (userMarker) userMarker.setLatLng([lat, lng]); else { const icon = L.divIcon({ className: 'custom-div-icon', html: `<div style="background:black;border:3px solid white;border-radius:50%;width:35px;height:35px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">${state.userName.charAt(0)}</div>`, iconSize: [35, 35], iconAnchor: [17, 17] }); userMarker = L.marker([lat, lng], { icon: icon }).addTo(map); } }
function calculateDistance(lat1, lon1, lat2, lon2) { const R = 6371e3, φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180, Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180, a = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2; return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); }
function updateTimer() { if (!state.startTime) return; const diff = Date.now() - state.startTime, h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000); UI.time.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; if (state.totalDistance > 5) { const paceSecs = (diff / 1000) / (state.totalDistance / 1000); UI.pace.innerText = `${Math.floor(paceSecs / 60)}:${Math.floor(paceSecs % 60).toString().padStart(2, '0')}`; } }
function addXP(amount) { state.xp += amount; const nextLevelXP = state.level * 500; if (state.xp >= nextLevelXP) { state.xp -= nextLevelXP; state.level++; showToast("SEVİYE ATLADIN! 🎉"); speak(`Tebrikler, seviye ${state.level} oldun!`); } updateGamificationUI(); saveData(); }
function updateGamificationUI() { UI.lvl.innerText = state.level; UI.xpBar.style.width = `${(state.xp / (state.level * 500)) * 100}%`; }
function updateProfileUI() { const initial = state.userName.charAt(0).toUpperCase(); UI.avatarNav.innerText = initial; UI.avatarDrawer.innerText = initial; }
function saveRunToHistory() { const distKm = (state.totalDistance / 1000).toFixed(2); if (distKm < 0.01) return; state.history.unshift({ date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), distance: distKm, time: UI.time.innerText }); if (state.history.length > 5) state.history.pop(); localStorage.setItem('run_history', JSON.stringify(state.history)); }
function renderHistory() { if (state.history.length === 0) { UI.historyList.innerHTML = '<p style="text-align:center;color:gray;padding:20px;">Geçmiş yok.</p>'; return; } UI.historyList.innerHTML = state.history.map(run => `<div class="history-item"><div><div class="history-date">${run.date}</div><div class="history-data">${run.distance} KM</div></div><div class="history-data">${run.time}</div></div>`).join(''); }
function saveData() { localStorage.setItem('run_xp', state.xp); localStorage.setItem('run_lvl', state.level); localStorage.setItem('run_name', state.userName); }

init();
