// --- Configuration & State ---
let state = {
    isTracking: false,
    startTime: null,
    totalDistance: 0, // meters
    pathPoints: [],
    lastLocation: null,
    timerInterval: null,
    xp: parseInt(localStorage.getItem('run_xp')) || 0,
    level: parseInt(localStorage.getItem('run_lvl')) || 1,
    userName: localStorage.getItem('run_name') || 'Koşucu',
    history: JSON.parse(localStorage.getItem('run_history')) || []
};

const UI = {
    distance: document.getElementById('distance'),
    time: document.getElementById('time'),
    pace: document.getElementById('pace'),
    calories: document.getElementById('calories'),
    lvl: document.getElementById('lvl'),
    xpBar: document.getElementById('xp-progress'),
    btnStart: document.getElementById('btnStart'),
    btnStop: document.getElementById('btnStop'),
    btnReset: document.getElementById('btnReset'),
    activeControls: document.getElementById('active-controls'),
    
    // New UI Elements
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
    historyList: document.getElementById('history-list')
};

// --- Map Initialization ---
const map = L.map('map', {
    zoomControl: false,
    center: [41.0082, 28.9784], // Default Istanbul
    zoom: 15
});

// Using OpenStreetMap tiles (In CSS we apply a dark filter)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let polyline = L.polyline([], { color: '#e2ff00', weight: 8, opacity: 0.8 }).addTo(map);
let userMarker = null;

// --- Core Logic ---

function init() {
    updateGamificationUI();
    updateProfileUI();
    renderHistory();
    
    // Initial Geolocation
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 17);
            updateUserMarker(latitude, longitude);
        });
    }

    // Main Controls
    UI.btnStart.addEventListener('click', startTracking);
    UI.btnStop.addEventListener('click', stopTracking);
    UI.btnReset.addEventListener('click', resetTracking);

    // Drawer Controls
    UI.btnOpenDrawer.addEventListener('click', () => UI.drawer.classList.add('active'));
    UI.btnCloseDrawer.addEventListener('click', () => UI.drawer.classList.remove('active'));
    UI.drawerOverlay.addEventListener('click', () => UI.drawer.classList.remove('active'));
    
    // Profile Edit
    UI.btnSaveName.addEventListener('click', () => {
        const newName = UI.inputName.value.trim();
        if (newName) {
            state.userName = newName;
            updateProfileUI();
            saveData();
            alert("Profil güncellendi!");
        }
    });

    // History Controls
    UI.btnHistory.addEventListener('click', () => {
        renderHistory();
        UI.historyModal.classList.remove('hidden');
    });
    UI.btnCloseHistory.addEventListener('click', () => UI.historyModal.classList.add('hidden'));
}

function startTracking() {
    if (!("geolocation" in navigator)) {
        alert("Tarayıcınız konum özelliğini desteklemiyor.");
        return;
    }

    state.isTracking = true;
    state.startTime = Date.now();
    
    UI.btnStart.classList.add('hidden');
    UI.activeControls.classList.remove('hidden');
    UI.btnReset.classList.add('hidden');

    state.timerInterval = setInterval(updateTimer, 1000);

    state.watchId = navigator.geolocation.watchPosition(
        onLocationUpdate,
        err => console.error(err),
        { enableHighAccuracy: true, distanceFilter: 1 }
    );
}

function stopTracking() {
    state.isTracking = false;
    clearInterval(state.timerInterval);
    navigator.geolocation.clearWatch(state.watchId);

    UI.btnStop.classList.add('hidden');
    UI.btnReset.classList.remove('hidden');
    
    saveRunToHistory();
    saveData();
    checkBadges();
}

function resetTracking() {
    state.totalDistance = 0;
    state.pathPoints = [];
    state.lastLocation = null;
    state.startTime = null;

    UI.distance.innerText = "0.00";
    UI.time.innerText = "00:00:00";
    UI.pace.innerText = "0:00";
    UI.calories.innerText = "0";

    polyline.setLatLngs([]);
    UI.btnStart.classList.remove('hidden');
    UI.activeControls.classList.add('hidden');
    UI.btnStop.classList.remove('hidden');
}

function onLocationUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;
    if (accuracy > 30) return; // Ignore low accuracy

    const currentLatLng = [latitude, longitude];

    if (state.lastLocation) {
        const dist = calculateDistance(
            state.lastLocation[0], state.lastLocation[1],
            latitude, longitude
        );
        state.totalDistance += dist;
        addXP(Math.floor(dist / 10)); // 1 XP every 10 meters
    }

    state.lastLocation = currentLatLng;
    state.pathPoints.push(currentLatLng);
    
    // Update UI
    const distKm = state.totalDistance / 1000;
    UI.distance.innerText = distKm.toFixed(2);
    UI.calories.innerText = Math.floor(distKm * 65);
    
    // Update Map
    polyline.setLatLngs(state.pathPoints);
    updateUserMarker(latitude, longitude);
    map.panTo(currentLatLng);
}

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

// --- Utils ---

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function updateTimer() {
    const diff = Date.now() - state.startTime;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    
    UI.time.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    
    if (state.totalDistance > 10) {
        const totalSeconds = diff / 1000;
        const paceSecs = totalSeconds / (state.totalDistance / 1000);
        const pm = Math.floor(paceSecs / 60);
        const ps = Math.floor(paceSecs % 60);
        UI.pace.innerText = `${pm}:${ps.toString().padStart(2, '0')}`;
    }
}

function addXP(amount) {
    state.xp += amount;
    const nextLevelXP = state.level * 500;
    if (state.xp >= nextLevelXP) {
        state.xp -= nextLevelXP;
        state.level++;
        alert(`SEVİYE ATLADIN! Yeni Seviye: ${state.level}`);
    }
    updateGamificationUI();
    saveData();
}

function updateGamificationUI() {
    UI.lvl.innerText = state.level;
    const progress = (state.xp / (state.level * 500)) * 100;
    UI.xpBar.style.width = `${progress}%`;
}

function updateProfileUI() {
    const initial = state.userName.charAt(0).toUpperCase();
    UI.avatarNav.innerText = initial;
    UI.avatarDrawer.innerText = initial;
    UI.inputName.value = state.userName;
    UI.totalRuns.innerText = state.history.length;
    
    // Update map marker if exists
    if (userMarker) updateUserMarker(...userMarker.getLatLng());
}

function saveRunToHistory() {
    const distanceKm = state.totalDistance / 1000;
    if (distanceKm < 0.01) return;

    const run = {
        id: Date.now(),
        date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        distance: distanceKm.toFixed(2),
        time: UI.time.innerText,
        calories: UI.calories.innerText
    };

    state.history.unshift(run);
    if (state.history.length > 5) state.history.pop();
    
    localStorage.setItem('run_history', JSON.stringify(state.history));
    renderHistory();
}

function renderHistory() {
    if (state.history.length === 0) {
        UI.historyList.innerHTML = '<p style="text-align:center; color:gray; padding:20px;">Henüz koşu geçmişi yok.</p>';
        return;
    }

    UI.historyList.innerHTML = state.history.map(run => `
        <div class="history-item">
            <div class="history-left">
                <div class="history-date">${run.date}</div>
                <div class="history-data">${run.distance} KM</div>
            </div>
            <div class="history-right">
                <div class="history-data">${run.time}</div>
            </div>
        </div>
    `).join('');
}

function saveData() {
    localStorage.setItem('run_xp', state.xp);
    localStorage.setItem('run_lvl', state.level);
    localStorage.setItem('run_name', state.userName);
}

function checkBadges() {
    // Simple logic for demonstration
    if (state.totalDistance > 100 && !localStorage.getItem('badge_first')) {
        alert("ROZET KAZANDIN: İlk Adım!");
        localStorage.setItem('badge_first', 'true');
    }
}

init();
