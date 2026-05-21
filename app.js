import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, onDisconnect, update, get } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "firebase/auth";

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

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);
let myUserId = null;

// Preset Avatars
const PRESET_AVATARS = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Runner1&backgroundColor=e2ff00",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Runner2&backgroundColor=e2ff00",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Runner3&backgroundColor=e2ff00",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Runner4&backgroundColor=e2ff00",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Runner5&backgroundColor=e2ff00",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Runner6&backgroundColor=e2ff00"
];
let selectedRegisterAvatar = PRESET_AVATARS[0];
let isRegisterMode = false;

// --- State ---
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
    xp: 0,
    level: 1,
    userName: 'Koşucu',
    avatarUrl: '',
    history: [],
    healthData: null,
    otherUsers: {} 
};

let UI = {}; // Will be populated on init
let map, polyline, replayPolyline, userMarker;

function init() {
    UI = {
        app: document.getElementById('app'),
        authOverlay: document.getElementById('auth-overlay'),
        authForm: document.getElementById('auth-form'),
        authEmail: document.getElementById('auth-email'),
        authPassword: document.getElementById('auth-password'),
        authName: document.getElementById('auth-name'),
        authNameGroup: document.getElementById('auth-name-group'),
        authAvatarGroup: document.getElementById('auth-avatar-group'),
        authTitle: document.getElementById('auth-title'),
        btnAuthToggle: document.getElementById('btnAuthToggle'),
        authToggleText: document.getElementById('auth-toggle-text'),
        registerAvatarPicker: document.getElementById('register-avatar-picker'),
        
        btnChangeAvatar: document.getElementById('btnChangeAvatar'),
        drawerAvatarPickerContainer: document.getElementById('drawer-avatar-picker-container'),
        drawerAvatarPicker: document.getElementById('drawer-avatar-picker'),
        inputAvatarUrl: document.getElementById('input-avatar-url'),
        btnSaveAvatarUrl: document.getElementById('btnSaveAvatarUrl'),
        btnLogout: document.getElementById('btnLogout'),
        
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

    renderAvatarPicker(UI.registerAvatarPicker, (url) => { selectedRegisterAvatar = url; });
    renderAvatarPicker(UI.drawerAvatarPicker, (url) => { 
        state.avatarUrl = url; 
        updateProfileUI(); 
        saveData(); 
        if(myUserId && state.lastLocation) syncMyLocation(state.lastLocation[0], state.lastLocation[1]);
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            myUserId = user.uid;
            UI.authOverlay.classList.add('hidden');
            loadUserData(user.uid);
        } else {
            myUserId = null;
            UI.authOverlay.classList.remove('hidden');
            UI.drawer.classList.remove('active');
        }
    });

    UI.btnAuthToggle?.addEventListener('click', toggleAuthMode);
    UI.authForm?.addEventListener('submit', handleAuthSubmit);
    UI.btnLogout?.addEventListener('click', () => signOut(auth));

    map = L.map('map', { zoomControl: false, center: [41.0082, 28.9784], zoom: 15 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    polyline = L.polyline([], { color: '#e2ff00', weight: 8, opacity: 0.8 }).addTo(map);
    replayPolyline = L.polyline([], { color: '#ffffff', weight: 10, opacity: 1 }).addTo(map);

    UI.btnChangeAvatar?.addEventListener('click', () => UI.drawerAvatarPickerContainer.classList.toggle('hidden'));
    UI.btnSaveAvatarUrl?.addEventListener('click', () => {
        if (UI.inputAvatarUrl.value) {
            state.avatarUrl = UI.inputAvatarUrl.value;
            updateProfileUI();
            saveData();
            if(myUserId && state.lastLocation) syncMyLocation(state.lastLocation[0], state.lastLocation[1]);
            UI.drawerAvatarPickerContainer.classList.add('hidden');
            UI.inputAvatarUrl.value = '';
        }
    });
    UI.inputName?.addEventListener('change', (e) => {
        state.userName = e.target.value;
        updateProfileUI();
        saveData();
        if(myUserId && state.lastLocation) syncMyLocation(state.lastLocation[0], state.lastLocation[1]);
    });

    UI.btnStart?.addEventListener('click', startTracking);
    UI.btnStop?.addEventListener('click', stopTracking);
    UI.btnReset?.addEventListener('click', resetTracking);
    UI.btnOpenDrawer?.addEventListener('click', () => UI.drawer.classList.add('active'));
    UI.btnCloseDrawer?.addEventListener('click', () => UI.drawer.classList.remove('active'));
    UI.drawerOverlay?.addEventListener('click', () => UI.drawer.classList.remove('active'));
    UI.btnCreatePlan?.addEventListener('click', createDailyPlan);
    UI.btnClosePlan?.addEventListener('click', () => UI.dailyPlanCard.classList.add('hidden'));
    UI.btnHistory?.addEventListener('click', () => { renderHistory(); UI.historyModal.classList.remove('hidden'); });
    UI.btnCloseHistory?.addEventListener('click', () => UI.historyModal.classList.add('hidden'));
    UI.btnCloseFriend?.addEventListener('click', () => UI.friendModal.classList.add('hidden'));
    UI.btnReplay?.addEventListener('click', startReplay);
    UI.btnStopReplay?.addEventListener('click', stopReplay);
}

function renderAvatarPicker(container, onSelect) {
    if (!container) return;
    container.innerHTML = PRESET_AVATARS.map((url, i) => `<div class="avatar-option ${i===0?'selected':''}" style="background-image: url('${url}')" data-url="${url}"></div>`).join('');
    container.querySelectorAll('.avatar-option').forEach(el => {
        el.addEventListener('click', (e) => {
            container.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
            e.target.classList.add('selected');
            onSelect(e.target.dataset.url);
        });
    });
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    UI.authTitle.innerText = isRegisterMode ? "KAYIT OL" : "GİRİŞ YAP";
    UI.authToggleText.innerText = isRegisterMode ? "Zaten hesabınız var mı?" : "Hesabınız yok mu?";
    UI.btnAuthToggle.innerText = isRegisterMode ? "Giriş Yap" : "Kayıt Ol";
    
    if (isRegisterMode) {
        UI.authNameGroup.classList.remove('hidden');
        UI.authAvatarGroup.classList.remove('hidden');
        UI.authName.required = true;
    } else {
        UI.authNameGroup.classList.add('hidden');
        UI.authAvatarGroup.classList.add('hidden');
        UI.authName.required = false;
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = UI.authEmail.value;
    const password = UI.authPassword.value;
    const name = UI.authName.value;
    
    try {
        if (isRegisterMode) {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: name, photoURL: selectedRegisterAvatar });
            
            // Save initial data to DB
            const userRef = ref(db, 'users/' + user.uid);
            await set(userRef, { name: name, avatar: selectedRegisterAvatar, xp: 0, level: 1 });
            showToast("Kayıt Başarılı! Hoş geldin.");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("Giriş Başarılı!");
        }
    } catch (error) {
        showToast("Hata: " + error.message);
    }
}

async function loadUserData(uid) {
    const userRef = ref(db, 'users/' + uid);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
        const data = snapshot.val();
        state.userName = data.name || auth.currentUser.displayName || 'Koşucu';
        state.avatarUrl = data.avatar || auth.currentUser.photoURL || PRESET_AVATARS[0];
        state.xp = data.xp || 0;
        state.level = data.level || 1;
        state.history = data.history ? Object.values(data.history).sort((a,b)=>b.timestamp-a.timestamp) : [];
        state.healthData = data.healthData || null;
    } else {
        state.userName = auth.currentUser.displayName || 'Koşucu';
        state.avatarUrl = auth.currentUser.photoURL || PRESET_AVATARS[0];
        state.xp = 0; state.level = 1; state.history = [];
    }
    
    if (UI.inputName) UI.inputName.value = state.userName;
    updateGamificationUI();
    updateProfileUI();
    renderHistory();
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
}

function saveData() {
    if(!myUserId) return;
    const userRef = ref(db, 'users/' + myUserId);
    update(userRef, { name: state.userName, avatar: state.avatarUrl, xp: state.xp, level: state.level, healthData: state.healthData });
}

function showToast(message) {
    if (!UI.toastContainer) return;
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

function startTracking() {
    state.isTracking = true; state.startTime = Date.now();
    UI.btnStart.classList.add('hidden'); UI.activeControls.classList.remove('hidden');
    state.timerInterval = setInterval(updateTimer, 1000);
    state.watchId = navigator.geolocation.watchPosition(onLocationUpdate, null, { enableHighAccuracy: true });
    showToast("Koşu Başlatıldı!"); speak(`Başarılar ${state.userName}!`);
}

function stopTracking() {
    state.isTracking = false; clearInterval(state.timerInterval);
    navigator.geolocation.clearWatch(state.watchId);
    UI.btnStop.classList.add('hidden'); UI.btnReset.classList.remove('hidden');
    if (state.pathPoints.length > 2) UI.btnReplay.classList.remove('hidden');
    saveRunToHistory(); saveData(); showToast("Koşu Bitti!");
}

function resetTracking() {
    state.totalDistance = 0; state.steps = 0; state.pathPoints = []; state.lastLocation = null; state.startTime = null;
    if (UI.distance) UI.distance.innerText = "0.00"; 
    if (UI.time) UI.time.innerText = "00:00:00";
    polyline.setLatLngs([]); replayPolyline.setLatLngs([]);
    UI.btnStart.classList.remove('hidden'); UI.activeControls.classList.add('hidden'); UI.btnStop.classList.remove('hidden');
}

function onLocationUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;
    if (accuracy > 60) return;
    const currentLatLng = [latitude, longitude];
    if (state.lastLocation) {
        const dist = calculateDistance(state.lastLocation[0], state.lastLocation[1], latitude, longitude);
        if (dist > 2) { state.totalDistance += dist; addXP(Math.floor(dist / 2)); }
    }
    state.lastLocation = currentLatLng; state.pathPoints.push(currentLatLng);
    if (UI.distance) UI.distance.innerText = (state.totalDistance / 1000).toFixed(2);
    polyline.setLatLngs(state.pathPoints); updateUserMarker(latitude, longitude); syncMyLocation(latitude, longitude);
    if (!state.isReplaying) map.panTo(currentLatLng);
}

function syncMyLocation(lat, lng) {
    if(!myUserId) return;
    const userRef = ref(db, 'users/' + myUserId);
    update(userRef, { name: state.userName, avatar: state.avatarUrl, lat: lat, lng: lng, lvl: state.level, dist: (state.totalDistance / 1000).toFixed(2), lastActive: Date.now() });
    onDisconnect(userRef).update({ lastActive: 0 }); // Just mark inactive when disconnected
}

function listenForOtherUsers() {
    if(!myUserId) return;
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val(); if (!users) return;
        Object.keys(users).forEach(id => {
            if (id === myUserId) return;
            const u = users[id];
            
            // Only show users active in last 5 minutes
            const isActive = u.lastActive > Date.now() - 5 * 60 * 1000;
            if (!isActive) {
                if (state.otherUsers[id]) { map.removeLayer(state.otherUsers[id].marker); delete state.otherUsers[id]; }
                return;
            }

            if (state.otherUsers[id]) { 
                state.otherUsers[id].marker.setLatLng([u.lat, u.lng]); 
            } else {
                let avatarHtml = u.avatar 
                    ? `<div class="map-user-marker active-pulse" style="background-image: url('${u.avatar}')"></div>`
                    : `<div class="map-user-marker active-pulse gradient-avatar">${(u.name||'K').charAt(0).toUpperCase()}</div>`;
                
                const icon = L.divIcon({ className: 'custom-div-icon', html: avatarHtml, iconSize: [45, 45], iconAnchor: [22, 22] });
                const marker = L.marker([u.lat, u.lng], { icon: icon }).addTo(map);
                
                marker.on('click', () => { 
                    UI.friendName.innerText = u.name || "Biri Koşuyor"; 
                    UI.friendLvl.innerText = `LVL ${u.lvl || 1}`; 
                    UI.friendDist.innerText = `${u.dist || 0} KM`; 
                    if(u.avatar) {
                        UI.friendAvatar.style.backgroundImage = `url('${u.avatar}')`;
                        UI.friendAvatar.innerText = "";
                    } else {
                        UI.friendAvatar.style.backgroundImage = 'none';
                        UI.friendAvatar.innerText = (u.name||'K').charAt(0).toUpperCase();
                    }
                    UI.friendModal.classList.remove('hidden'); 
                });
                state.otherUsers[id] = { marker: marker };
            }
        });
    });
}

function renderDailyPlan() {
    if (!state.healthData || !UI.targetSteps) return;
    const { height, weight, age, gender } = state.healthData;
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = (gender === 'male') ? bmr + 5 : bmr - 161;
    UI.targetSteps.innerText = Math.floor(weight * 100 + 3000).toLocaleString();
    UI.targetBurn.innerText = `${Math.floor(weight * 5)} kcal`;
    UI.targetIntake.innerText = `${Math.floor(bmr * 1.2)} kcal`;
    UI.dailyPlanCard.classList.remove('hidden');
}

function createDailyPlan() {
    const h = parseFloat(UI.inputHeight.value), w = parseFloat(UI.inputWeight.value), a = parseInt(UI.inputAge.value);
    if (!h || !w || !a) { showToast("Verileri girin!"); return; }
    state.healthData = { height: h, weight: w, age: a, gender: UI.inputGender.value };
    saveData();
    renderDailyPlan(); UI.drawer.classList.remove('active'); showToast("Plan Hazır!");
}

function startReplay() {
    state.isReplaying = true; UI.app.classList.add('replay-mode'); UI.replayOverlay.classList.remove('hidden');
    let i = 0;
    state.replayIntervalId = setInterval(() => {
        if (i >= state.pathPoints.length || !state.isReplaying) { stopReplay(); return; }
        replayPolyline.addLatLng(state.pathPoints[i]); map.panTo(state.pathPoints[i]); i++;
    }, 400);
}

function stopReplay() { state.isReplaying = false; clearInterval(state.replayIntervalId); UI.app.classList.remove('replay-mode'); UI.replayOverlay.classList.add('hidden'); }

function updateUserMarker(lat, lng) { 
    let avatarHtml = state.avatarUrl 
        ? `<div class="map-user-marker active-pulse" style="background-image: url('${state.avatarUrl}')"></div>`
        : `<div class="map-user-marker active-pulse gradient-avatar">${state.userName.charAt(0).toUpperCase()}</div>`;
        
    if (userMarker) {
        userMarker.setLatLng([lat, lng]); 
        // Update icon html incase avatar changed
        const icon = L.divIcon({ className: 'custom-div-icon', html: avatarHtml, iconSize: [45, 45], iconAnchor: [22, 22] });
        userMarker.setIcon(icon);
    } else { 
        const icon = L.divIcon({ className: 'custom-div-icon', html: avatarHtml, iconSize: [45, 45], iconAnchor: [22, 22] }); 
        userMarker = L.marker([lat, lng], { icon: icon }).addTo(map); 
    } 
}

function calculateDistance(lat1, lon1, lat2, lon2) { const R = 6371e3, φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180, Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180, a = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2; return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); }
function updateTimer() { if (!state.startTime) return; const diff = Date.now() - state.startTime, h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000); UI.time.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }
function addXP(amount) { state.xp += amount; const nextLevelXP = state.level * 500; if (state.xp >= nextLevelXP) { state.xp -= nextLevelXP; state.level++; showToast("LEVEL UP! 🎉"); } updateGamificationUI(); saveData(); }

function updateGamificationUI() { if (UI.lvl) UI.lvl.innerText = state.level; if (UI.xpBar) UI.xpBar.style.width = `${(state.xp / (state.level * 500)) * 100}%`; }

function updateProfileUI() { 
    if (state.avatarUrl) {
        if(UI.avatarNav) { UI.avatarNav.style.backgroundImage = `url('${state.avatarUrl}')`; UI.avatarNav.style.backgroundSize = 'cover'; UI.avatarNav.style.backgroundPosition = 'center'; UI.avatarNav.innerText = ''; }
        if(UI.avatarDrawer) { UI.avatarDrawer.style.backgroundImage = `url('${state.avatarUrl}')`; UI.avatarDrawer.style.backgroundSize = 'cover'; UI.avatarDrawer.style.backgroundPosition = 'center'; UI.avatarDrawer.innerText = ''; }
    } else {
        if(UI.avatarNav) { UI.avatarNav.style.backgroundImage = 'none'; UI.avatarNav.innerText = state.userName.charAt(0).toUpperCase(); }
        if(UI.avatarDrawer) { UI.avatarDrawer.style.backgroundImage = 'none'; UI.avatarDrawer.innerText = state.userName.charAt(0).toUpperCase(); }
    }
}

function saveRunToHistory() { 
    const distKm = (state.totalDistance / 1000).toFixed(2); 
    if (distKm < 0.01) return; 
    const run = { date: new Date().toLocaleDateString('tr-TR'), distance: distKm, time: UI.time.innerText, timestamp: Date.now() };
    state.history.unshift(run); 
    if (state.history.length > 5) state.history.pop(); 
    
    if(myUserId) {
        const historyRef = ref(db, `users/${myUserId}/history`);
        set(historyRef, state.history);
    }
    renderHistory();
}

function renderHistory() { 
    if (!UI.historyList) return; 
    if (state.history.length === 0) { UI.historyList.innerHTML = '<p style="color:gray;padding:20px;">Geçmiş yok.</p>'; return; } 
    UI.historyList.innerHTML = state.history.map(run => `<div class="history-item"><div>${run.date} - ${run.time}</div><div>${run.distance} KM</div></div>`).join(''); 
}

window.addEventListener('DOMContentLoaded', init);
