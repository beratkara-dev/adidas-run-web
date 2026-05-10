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
    lastMilestone: 0 // Track every 500m for voice
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
    btnSaveName: document.getElementById('btnSaveName'),
    avatarNav: document.getElementById('avatar-nav'),
    avatarDrawer: document.getElementById('avatar-drawer'),
    totalRuns: document.getElementById('total-runs'),
    
    btnHistory: document.getElementById('btnHistory'),
    historyModal: document.getElementById('history-modal'),
    btnCloseHistory: document.getElementById('btnCloseHistory'),
    historyList: document.getElementById('history-list'),

    btnReplay: document.getElementById('btnReplay'),
    replayOverlay: document.getElementById('replay-overlay'),
    btnStopReplay: document.getElementById('btnStopReplay')
};

// --- Map Initialization ---
const map = L.map('map', { zoomControl: false, center: [41.0082, 28.9784], zoom: 15 });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let polyline = L.polyline([], { color: '#e2ff00', weight: 8, opacity: 0.8 }).addTo(map);
let replayPolyline = L.polyline([], { color: '#ffffff', weight: 10, opacity: 1 }).addTo(map);
let userMarker = null;

// --- Voice Coach ---
function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Stop current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

// --- Core Logic ---
function init() {
    updateGamificationUI();
    updateProfileUI();
    renderHistory();
    
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
    
    UI.btnSaveName.addEventListener('click', () => {
        const newName = UI.inputName.value.trim();
        if (newName) {
            state.userName = newName;
            updateProfileUI();
            saveData();
            speak(`Profil güncellendi. Yeni ismin ${newName}`);
        }
    });

    UI.btnHistory.addEventListener('click', () => {
        renderHistory();
        UI.historyModal.classList.remove('hidden');
    });
    UI.btnCloseHistory.addEventListener('click', () => UI.historyModal.classList.add('hidden'));

    UI.btnReplay.addEventListener('click', startReplay);
    UI.btnStopReplay.addEventListener('click', stopReplay);
}

function startTracking() {
    if (!("geolocation" in navigator)) return;
    
    // Request Motion Permission for iOS
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(permissionState => {
            if (permissionState === 'granted') {
                window.addEventListener('devicemotion', onMotionUpdate);
            }
        });
    } else {
        window.addEventListener('devicemotion', onMotionUpdate);
    }

    state.isTracking = true;
    state.startTime = Date.now();
    state.lastMilestone = 0;
    
    UI.btnStart.classList.add('hidden');
    UI.activeControls.classList.remove('hidden');
    UI.btnReset.classList.add('hidden');
    UI.btnReplay.classList.add('hidden');

    state.timerInterval = setInterval(updateTimer, 1000);
    state.watchId = navigator.geolocation.watchPosition(onLocationUpdate, null, { enableHighAccuracy: true });
    
    speak(`Koşu başlatıldı. Başarılar ${state.userName}!`);
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
    speak(`Koşu tamamlandı. Toplam ${ (state.totalDistance / 1000).toFixed(2) } kilometre koştun. Harika bir iş çıkardın!`);
}

function resetTracking() {
    state.totalDistance = 0;
    state.steps = 0;
    state.pathPoints = [];
    state.lastLocation = null;
    state.startTime = null;

    UI.distance.innerText = "0.00";
    UI.time.innerText = "00:00:00";
    UI.steps.innerText = "0";
    UI.pace.innerText = "0:00";
    UI.calories.innerText = "0";

    polyline.setLatLngs([]);
    replayPolyline.setLatLngs([]);
    UI.btnStart.classList.remove('hidden');
    UI.activeControls.classList.add('hidden');
    UI.btnStop.classList.remove('hidden');
    UI.btnReplay.classList.add('hidden');
}

function onLocationUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;
    if (accuracy > 50) return; // Slightly relaxed for indoor/shaky GPS

    const currentLatLng = [latitude, longitude];

    if (state.lastLocation) {
        const dist = calculateDistance(state.lastLocation[0], state.lastLocation[1], latitude, longitude);
        // Minimum move threshold to avoid GPS "jumping" at home
        if (dist > 2) {
            state.totalDistance += dist;
            addXP(Math.floor(dist / 2)); 
        }
        
        const currentKm = state.totalDistance / 1000;
        if (Math.floor(state.totalDistance / 500) > state.lastMilestone) {
            state.lastMilestone = Math.floor(state.totalDistance / 500);
            speak(`${state.lastMilestone * 0.5} kilometre tamamlandı.`);
        }
    }

    state.lastLocation = currentLatLng;
    state.pathPoints.push(currentLatLng);
    
    UI.distance.innerText = (state.totalDistance / 1000).toFixed(2);
    UI.calories.innerText = Math.floor((state.totalDistance / 1000) * 65);
    
    polyline.setLatLngs(state.pathPoints);
    updateUserMarker(latitude, longitude);
    if (!state.isReplaying) map.panTo(currentLatLng);
}

// --- Step Counting ---
function onMotionUpdate(event) {
    if (!state.isTracking) return;
    
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    // Calculate total acceleration magnitude
    const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    
    // Simple step detection threshold (tuned for walking/running)
    const threshold = 12.5; 
    const now = Date.now();
    
    if (magnitude > threshold && (now - state.lastStepTime) > 300) {
        state.steps++;
        state.lastStepTime = now;
        UI.steps.innerText = state.steps;
        
        // Every step gives a tiny bit of XP if at home
        if (state.totalDistance < 10) addXP(0.1); 
    }
}

// --- Cinematic Replay ---
function startReplay() {
    if (state.pathPoints.length < 2) return;
    state.isReplaying = true;
    UI.app.classList.add('replay-mode');
    UI.replayOverlay.classList.remove('hidden');
    
    replayPolyline.setLatLngs([]);
    map.setView(state.pathPoints[0], 18);
    
    speak("Sinematik rota tekrarı başlatılıyor.");

    let i = 0;
    const replayInterval = setInterval(() => {
        if (i >= state.pathPoints.length || !state.isReplaying) {
            clearInterval(replayInterval);
            if (state.isReplaying) setTimeout(stopReplay, 2000);
            return;
        }
        
        const point = state.pathPoints[i];
        replayPolyline.addLatLng(point);
        map.panTo(point, { animate: true, duration: 0.5 });
        updateUserMarker(point[0], point[1]);
        i++;
    }, 400);

    state.replayIntervalId = replayInterval;
}

function stopReplay() {
    state.isReplaying = false;
    clearInterval(state.replayIntervalId);
    UI.app.classList.remove('replay-mode');
    UI.replayOverlay.classList.add('hidden');
    replayPolyline.setLatLngs([]);
    
    if (state.lastLocation) map.setView(state.lastLocation, 17);
}

// --- Helpers ---
function updateUserMarker(lat, lng) {
    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background: black; border: 3px solid white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-family: sans-serif; box-shadow: 0 0 10px rgba(0,0,0,0.5);">${state.userName.charAt(0)}</div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
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
    if (state.xp >= nextLevelXP) {
        state.xp -= nextLevelXP;
        state.level++;
        speak(`Tebrikler Berat, seviye atladın! Yeni seviyen ${state.level}`);
    }
    updateGamificationUI();
    saveData();
}

function updateGamificationUI() {
    UI.lvl.innerText = state.level;
    UI.xpBar.style.width = `${(state.xp / (state.level * 500)) * 100}%`;
}

function updateProfileUI() {
    const initial = state.userName.charAt(0).toUpperCase();
    UI.avatarNav.innerText = initial; UI.avatarDrawer.innerText = initial;
    UI.inputName.value = state.userName; UI.totalRuns.innerText = state.history.length;
}

function saveRunToHistory() {
    const distKm = (state.totalDistance / 1000).toFixed(2);
    if (distKm < 0.01) return;
    const run = { date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), distance: distKm, time: UI.time.innerText };
    state.history.unshift(run);
    if (state.history.length > 5) state.history.pop();
    localStorage.setItem('run_history', JSON.stringify(state.history));
}

function renderHistory() {
    if (state.history.length === 0) { UI.historyList.innerHTML = '<p style="text-align:center;color:gray;padding:20px;">Henüz geçmiş yok.</p>'; return; }
    UI.historyList.innerHTML = state.history.map(run => `
        <div class="history-item">
            <div><div class="history-date">${run.date}</div><div class="history-data">${run.distance} KM</div></div>
            <div class="history-data">${run.time}</div>
        </div>
    `).join('');
}

function saveData() {
    localStorage.setItem('run_xp', state.xp); localStorage.setItem('run_lvl', state.level); localStorage.setItem('run_name', state.userName);
}

init();
