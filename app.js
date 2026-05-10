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
    lastMilestone: 0
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

    // Health UI
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
    dailyTask: document.getElementById('daily-task')
};

// --- Map Initialization ---
const map = L.map('map', { zoomControl: false, center: [41.0082, 28.9784], zoom: 15 });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let polyline = L.polyline([], { color: '#e2ff00', weight: 8, opacity: 0.8 }).addTo(map);
let replayPolyline = L.polyline([], { color: '#ffffff', weight: 10, opacity: 1 }).addTo(map);
let userMarker = null;

function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    window.speechSynthesis.speak(utterance);
}

// --- Core Logic ---
function init() {
    updateGamificationUI();
    updateProfileUI();
    renderHistory();
    if (state.healthData) renderDailyPlan();

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 17);
            updateUserMarker(latitude, longitude);
        });
    }

    UI.btnStart.addEventListener('click', startTracking);
    UI.btnStop.addEventListener('click', stopTracking);
    UI.btnReset.addEventListener('click', resetTracking);
    UI.btnOpenDrawer.addEventListener('click', () => UI.drawer.classList.add('active'));
    UI.btnCloseDrawer.addEventListener('click', () => UI.drawer.classList.remove('active'));
    UI.drawerOverlay.addEventListener('click', () => UI.drawer.classList.remove('active'));
    
    UI.btnCreatePlan.addEventListener('click', createDailyPlan);

    UI.btnHistory.addEventListener('click', () => { renderHistory(); UI.historyModal.classList.remove('hidden'); });
    UI.btnCloseHistory.addEventListener('click', () => UI.historyModal.classList.add('hidden'));

    UI.btnReplay.addEventListener('click', startReplay);
    UI.btnStopReplay.addEventListener('click', stopReplay);
}

function startTracking() {
    if (!("geolocation" in navigator)) return;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(p => { if (p === 'granted') window.addEventListener('devicemotion', onMotionUpdate); });
    } else { window.addEventListener('devicemotion', onMotionUpdate); }

    state.isTracking = true;
    state.startTime = Date.now();
    UI.btnStart.classList.add('hidden');
    UI.activeControls.classList.remove('hidden');
    state.timerInterval = setInterval(updateTimer, 1000);
    state.watchId = navigator.geolocation.watchPosition(onLocationUpdate, null, { enableHighAccuracy: true });
    speak(`Koşu başladı. Başarılar ${state.userName}!`);
}

function stopTracking() {
    state.isTracking = false;
    clearInterval(state.timerInterval);
    navigator.geolocation.clearWatch(state.watchId);
    window.removeEventListener('devicemotion', onMotionUpdate);
    UI.btnStop.classList.add('hidden');
    UI.btnReset.classList.remove('hidden');
    if (state.pathPoints.length > 2) UI.btnReplay.classList.remove('hidden');
    saveRunToHistory();
    saveData();
    speak(`Koşu bitti. ${(state.totalDistance / 1000).toFixed(2)} kilometre koştun.`);
}

function resetTracking() {
    state.totalDistance = 0; state.steps = 0; state.pathPoints = []; state.lastLocation = null; state.startTime = null;
    UI.distance.innerText = "0.00"; UI.time.innerText = "00:00:00"; UI.steps.innerText = "0"; UI.pace.innerText = "0:00"; UI.calories.innerText = "0";
    polyline.setLatLngs([]); replayPolyline.setLatLngs([]);
    UI.btnStart.classList.remove('hidden'); UI.activeControls.classList.add('hidden'); UI.btnReplay.classList.add('hidden');
}

function onLocationUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;
    if (accuracy > 50) return;
    const currentLatLng = [latitude, longitude];
    if (state.lastLocation) {
        const dist = calculateDistance(state.lastLocation[0], state.lastLocation[1], latitude, longitude);
        if (dist > 2) { state.totalDistance += dist; addXP(Math.floor(dist / 2)); }
    }
    state.lastLocation = currentLatLng;
    state.pathPoints.push(currentLatLng);
    UI.distance.innerText = (state.totalDistance / 1000).toFixed(2);
    UI.calories.innerText = Math.floor((state.totalDistance / 1000) * 65);
    polyline.setLatLngs(state.pathPoints);
    updateUserMarker(latitude, longitude);
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

// --- AI Plan & Health ---
function createDailyPlan() {
    const h = parseFloat(UI.inputHeight.value);
    const w = parseFloat(UI.inputWeight.value);
    const a = parseInt(UI.inputAge.value);
    const g = UI.inputGender.value;

    if (!h || !w || !a) { alert("Lütfen tüm sağlık verilerini girin!"); return; }

    state.healthData = { height: h, weight: w, age: a, gender: g };
    localStorage.setItem('run_health', JSON.stringify(state.healthData));
    
    renderDailyPlan();
    UI.drawer.classList.remove('active');
    speak("Harika! Senin için özel bir günlük sağlık planı oluşturdum. Dashboard'dan inceleyebilirsin.");
}

function renderDailyPlan() {
    const { height, weight, age, gender } = state.healthData;
    
    // BMR Calculation (Mifflin-St Jeor)
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = (gender === 'male') ? bmr + 5 : bmr - 161;

    const targetSteps = Math.floor(weight * 100 + 3000);
    const targetBurn = Math.floor(weight * 5);
    const targetIntake = Math.floor(bmr * 1.2); // Sedentary maintenance

    UI.targetSteps.innerText = targetSteps.toLocaleString();
    UI.targetBurn.innerText = `${targetBurn} kcal`;
    UI.targetIntake.innerText = `${targetIntake} kcal`;
    
    UI.mealAdvice.innerHTML = `<b>Öneri:</b> Kahvaltıda yulaf, öğlen ızgara tavuk, akşam sebze ağırlıklı beslen. Günlük ${targetIntake} kaloriyi aşmamaya çalış!`;
    UI.dailyPlanCard.classList.remove('hidden');
    UI.dailyTask.innerText = "Plan Aktif!";
}

function startReplay() {
    if (state.pathPoints.length < 2) return;
    state.isReplaying = true;
    UI.app.classList.add('replay-mode'); UI.replayOverlay.classList.remove('hidden');
    replayPolyline.setLatLngs([]); map.setView(state.pathPoints[0], 18);
    let i = 0;
    state.replayIntervalId = setInterval(() => {
        if (i >= state.pathPoints.length || !state.isReplaying) { stopReplay(); return; }
        replayPolyline.addLatLng(state.pathPoints[i]);
        map.panTo(state.pathPoints[i], { animate: true, duration: 0.5 });
        updateUserMarker(state.pathPoints[i][0], state.pathPoints[i][1]);
        i++;
    }, 400);
}

function stopReplay() {
    state.isReplaying = false; clearInterval(state.replayIntervalId);
    UI.app.classList.remove('replay-mode'); UI.replayOverlay.classList.add('hidden');
    if (state.lastLocation) map.setView(state.lastLocation, 17);
}

function updateUserMarker(lat, lng) {
    if (userMarker) userMarker.setLatLng([lat, lng]);
    else {
        const icon = L.divIcon({ className: 'custom-div-icon', html: `<div style="background:black;border:3px solid white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${state.userName.charAt(0)}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
        userMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function updateTimer() {
    const diff = Date.now() - state.startTime;
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
    UI.time.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (state.totalDistance > 10) {
        const paceSecs = (diff / 1000) / (state.totalDistance / 1000);
        UI.pace.innerText = `${Math.floor(paceSecs / 60)}:${Math.floor(paceSecs % 60).toString().padStart(2, '0')}`;
    }
}

function addXP(amount) {
    state.xp += amount;
    const nextLevelXP = state.level * 500;
    if (state.xp >= nextLevelXP) { state.xp -= nextLevelXP; state.level++; speak(`Tebrikler, seviye ${state.level} oldun!`); }
    updateGamificationUI(); saveData();
}

function updateGamificationUI() { UI.lvl.innerText = state.level; UI.xpBar.style.width = `${(state.xp / (state.level * 500)) * 100}%`; }
function updateProfileUI() { const initial = state.userName.charAt(0).toUpperCase(); UI.avatarNav.innerText = initial; UI.avatarDrawer.innerText = initial; UI.inputName.value = state.userName; }
function saveRunToHistory() {
    const distKm = (state.totalDistance / 1000).toFixed(2); if (distKm < 0.01) return;
    state.history.unshift({ date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), distance: distKm, time: UI.time.innerText });
    if (state.history.length > 5) state.history.pop(); localStorage.setItem('run_history', JSON.stringify(state.history));
}

function renderHistory() {
    if (state.history.length === 0) { UI.historyList.innerHTML = '<p style="text-align:center;color:gray;padding:20px;">Geçmiş yok.</p>'; return; }
    UI.historyList.innerHTML = state.history.map(run => `<div class="history-item"><div><div class="history-date">${run.date}</div><div class="history-data">${run.distance} KM</div></div><div class="history-data">${run.time}</div></div>`).join('');
}

function saveData() { localStorage.setItem('run_xp', state.xp); localStorage.setItem('run_lvl', state.level); localStorage.setItem('run_name', state.userName); }

init();
