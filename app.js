import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, onDisconnect, update, get } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "firebase/auth";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyAFyVeuw-GqMe08M-aIsWXVBlnBB0NXJ_0",
  authDomain: "adidas-run-app.firebaseapp.com",
  projectId: "adidas-run-app",
  storageBucket: "adidas-run-app.firebasestorage.app",
  messagingSenderId: "222314003122",
  appId: "1:222314003122:web:6c493d2c1817b4acb867ab",
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
    otherUsers: {},
    dailyQuest: null,
    historyRouteActive: false,
    historyRouteMarkers: [],
    historyRoutePolyline: null,
    historyRouteSelected: null
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
        btnAuthSubmit: document.getElementById('btnAuthSubmit'),
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

    document.getElementById('btnClearHistoryRoute')?.addEventListener('click', clearHistoryRoute);
    document.getElementById('btnPlayHistoryReplay')?.addEventListener('click', () => {
        if (state.historyRouteSelected && state.historyRouteSelected.path) {
            // Temporarily swap active pathPoints for replay
            const originalPath = [...state.pathPoints];
            state.pathPoints = state.historyRouteSelected.path;
            
            // Trigger standard replay
            startReplay();
            
            // Wrap stopReplay to restore original path points
            const originalStopReplay = stopReplay;
            stopReplay = () => {
                originalStopReplay();
                state.pathPoints = originalPath;
                stopReplay = originalStopReplay; // Restore stopReplay function
            };
        }
    });
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
    UI.btnAuthSubmit.innerText = isRegisterMode ? "KAYIT OL" : "GİRİŞ YAP";
    
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
        state.history = data.history ? (Array.isArray(data.history) ? data.history : Object.values(data.history)).sort((a,b)=>b.timestamp-a.timestamp) : [];
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
    renderBadges();
    initDailyQuest();
    if (state.healthData) renderDailyPlan();
    listenForOtherUsers();
    
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 17);
            updateUserMarker(latitude, longitude);
            syncMyLocation(latitude, longitude);
            fetchWeather(latitude, longitude);
        });
    } else {
        fetchWeather(41.0082, 28.9784); // Default to Istanbul Center
    }
}

function saveData() {
    if(!myUserId) return;
    const userRef = ref(db, 'users/' + myUserId);
    update(userRef, { name: state.userName, avatar: state.avatarUrl, xp: state.xp, level: state.level, healthData: state.healthData, platform: 'Web' });
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
    
    let dist = 0;
    if (state.lastLocation) {
        dist = calculateDistance(state.lastLocation[0], state.lastLocation[1], latitude, longitude);
        if (dist > 2) { 
            state.totalDistance += dist; 
            addXP(Math.floor(dist / 2)); 
            
            // Increment quest distance
            trackDailyQuestProgress('distance', dist / 1000);
        }
    }
    state.lastLocation = currentLatLng; state.pathPoints.push(currentLatLng);
    if (UI.distance) UI.distance.innerText = (state.totalDistance / 1000).toFixed(2);
    polyline.setLatLngs(state.pathPoints); updateUserMarker(latitude, longitude); syncMyLocation(latitude, longitude);
    if (!state.isReplaying) map.panTo(currentLatLng);

    // Dynamic Stats updates
    const weight = state.healthData ? parseFloat(state.healthData.weight) || 70 : 70;
    const oldCalories = Math.floor(((state.totalDistance - dist) / 1000) * weight * 1.03);
    const newCalories = Math.floor((state.totalDistance / 1000) * weight * 1.03);
    const diffCalories = Math.max(0, newCalories - oldCalories);
    if (UI.calories) UI.calories.innerText = newCalories;
    if (diffCalories > 0) trackDailyQuestProgress('calories', diffCalories);
    
    const oldSteps = Math.floor((state.totalDistance - dist) / 0.78);
    const newSteps = Math.floor(state.totalDistance / 0.78);
    const diffSteps = Math.max(0, newSteps - oldSteps);
    state.steps = newSteps;
    if (UI.steps) UI.steps.innerText = newSteps;
    if (diffSteps > 0) trackDailyQuestProgress('steps', diffSteps);
    
    if (state.startTime) {
        const durationMin = (Date.now() - state.startTime) / 60000;
        const distKm = state.totalDistance / 1000;
        if (distKm > 0.02) {
            const paceVal = durationMin / distKm;
            const paceMin = Math.floor(paceVal);
            const paceSec = Math.floor((paceVal - paceMin) * 60);
            if (UI.pace) UI.pace.innerText = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
        } else {
            if (UI.pace) UI.pace.innerText = "0:00";
        }
    }
}

function syncMyLocation(lat, lng) {
    if(!myUserId) return;
    const userRef = ref(db, 'users/' + myUserId);
    update(userRef, { name: state.userName, avatar: state.avatarUrl, lat: lat, lng: lng, lvl: state.level, dist: (state.totalDistance / 1000).toFixed(2), lastActive: Date.now(), platform: 'Web' });
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
                    
                    const platformEl = document.querySelector('#friend-modal .friend-status-badge');
                    if (platformEl) {
                        platformEl.innerText = `● AKTİF KOŞUCU (${(u.platform || 'Web').toUpperCase()})`;
                    }
                    
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

function updateGamificationUI() { 
    if (UI.lvl) UI.lvl.innerText = state.level; 
    if (UI.xpBar) UI.xpBar.style.width = `${(state.xp / (state.level * 500)) * 100}%`; 
    
    // Update drawer levels dynamically
    const drawerLvl = document.getElementById('drawer-lvl-value');
    if (drawerLvl) drawerLvl.innerText = state.level;
    
    const drawerXpProgress = document.getElementById('drawer-xp-progress');
    if (drawerXpProgress) drawerXpProgress.style.width = `${(state.xp / (state.level * 500)) * 100}%`;
    
    const drawerXpCurrent = document.getElementById('drawer-xp-current');
    if (drawerXpCurrent) drawerXpCurrent.innerText = `${state.xp} XP`;
    
    const targetXp = state.level * 500;
    const drawerXpTarget = document.getElementById('drawer-xp-target');
    if (drawerXpTarget) drawerXpTarget.innerText = `${targetXp} XP`;
    
    const rankTitle = document.getElementById('drawer-rank-title');
    if (rankTitle) {
        if (state.level < 3) rankTitle.innerText = "YENİ BAŞLAYAN";
        else if (state.level < 6) rankTitle.innerText = "AKTİF KOŞUCU";
        else if (state.level < 10) rankTitle.innerText = "PROFESYONEL";
        else rankTitle.innerText = "EFSANEVİ KOŞUCU";
    }
}

function updateDrawerAllTimeStats() {
    const totalRuns = state.history ? state.history.length : 0;
    let totalDist = 0;
    if (state.history) {
        state.history.forEach(run => {
            totalDist += parseFloat(run.distance) || 0;
        });
    }
    const runsEl = document.getElementById('drawer-total-runs');
    if (runsEl) runsEl.innerText = totalRuns;
    const distEl = document.getElementById('drawer-total-dist');
    if (distEl) distEl.innerHTML = `${totalDist.toFixed(2)} <span style="font-size: 0.65rem; color: #fff;">KM</span>`;
}

function updateProfileUI() { 
    if (state.avatarUrl) {
        if(UI.avatarNav) { UI.avatarNav.style.backgroundImage = `url('${state.avatarUrl}')`; UI.avatarNav.style.backgroundSize = 'cover'; UI.avatarNav.style.backgroundPosition = 'center'; UI.avatarNav.innerText = ''; }
        if(UI.avatarDrawer) { UI.avatarDrawer.style.backgroundImage = `url('${state.avatarUrl}')`; UI.avatarDrawer.style.backgroundSize = 'cover'; UI.avatarDrawer.style.backgroundPosition = 'center'; UI.avatarDrawer.innerText = ''; }
    } else {
        if(UI.avatarNav) { UI.avatarNav.style.backgroundImage = 'none'; UI.avatarNav.innerText = state.userName.charAt(0).toUpperCase(); }
        if(UI.avatarDrawer) { UI.avatarDrawer.style.backgroundImage = 'none'; UI.avatarDrawer.innerText = state.userName.charAt(0).toUpperCase(); }
    }
    updateDrawerAllTimeStats();
    renderBadges();
}

function saveRunToHistory() { 
    const distKm = (state.totalDistance / 1000).toFixed(2); 
    if (parseFloat(distKm) < 0.01) return; 
    
    const currentCalories = document.getElementById('calories')?.innerText || "0";
    const currentPace = document.getElementById('pace')?.innerText || "0:00";
    
    const run = { 
        date: new Date().toLocaleDateString('tr-TR'), 
        distance: distKm, 
        time: UI.time.innerText, 
        calories: currentCalories,
        pace: currentPace,
        path: [...state.pathPoints],
        timestamp: Date.now() 
    };
    state.history.unshift(run); 
    if (state.history.length > 5) state.history.pop(); 
    
    if(myUserId) {
        const historyRef = ref(db, `users/${myUserId}/history`);
        set(historyRef, state.history);
    }
    renderHistory();
    updateDrawerAllTimeStats();
    renderBadges();
}

function renderHistory() { 
    if (!UI.historyList) return; 
    if (state.history.length === 0) { 
        UI.historyList.innerHTML = '<p style="color:gray;padding:20px;text-align:center;">Geçmiş koşu bulunmuyor.</p>'; 
        return; 
    } 
    
    UI.historyList.innerHTML = state.history.map((run, index) => {
        const hasRoute = run.path && run.path.length > 0;
        return `
            <div class="history-item-detailed" data-index="${index}">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                    <span style="font-weight: 800; color: #fff; font-size: 0.85rem;">📅 ${run.date}</span>
                    <span style="font-size: 0.6rem; color: var(--accent-color); font-weight: 800; letter-spacing: 0.5px;">${hasRoute ? '🗺️ ROTAYI GÖSTER' : 'İSTATİSTİKLER'}</span>
                </div>
                <div class="history-stats-grid">
                    <div class="history-stat-mini">
                        <div class="value">${run.distance}</div>
                        <div class="label">KM</div>
                    </div>
                    <div class="history-stat-mini">
                        <div class="value">${run.time}</div>
                        <div class="label">Süre</div>
                    </div>
                    <div class="history-stat-mini">
                        <div class="value">${run.calories || 0}</div>
                        <div class="label">kcal</div>
                    </div>
                    <div class="history-stat-mini">
                        <div class="value">${run.pace || '0:00'}</div>
                        <div class="label">Tempo</div>
                    </div>
                </div>
            </div>
        `;
    }).join(''); 
    
    // Bind click events
    UI.historyList.querySelectorAll('.history-item-detailed').forEach(el => {
        el.addEventListener('click', (e) => {
            const index = el.dataset.index;
            const run = state.history[index];
            if (run) showHistoryRoute(run);
        });
    });
}

// --- Badges & Daily Quest System Implementation ---
const BADGES = [
    { id: 'first_run', name: 'İlk Adım', icon: '🟢', desc: 'İlk koşunu tamamla!' },
    { id: 'speedy', name: 'Rüzgar', icon: '⚡', desc: '5:00 dk/km altında hız yap!' },
    { id: 'endurance', name: 'Maratoncu', icon: '🏃‍♂️', desc: '5 KM veya üzeri koş!' },
    { id: 'level_5', name: 'Uzman', icon: '🎖️', desc: 'Seviye 5\'e ulaş!' },
    { id: 'level_10', name: 'Efsane', icon: '👑', desc: 'Seviye 10\'a ulaş!' }
];

const QUEST_TEMPLATES = [
    { type: 'distance', target: 2.0, desc: 'Bugün toplam 2 KM koş.', reward: 150 },
    { type: 'calories', target: 200, desc: 'Bugün toplam 200 kcal yak.', reward: 120 },
    { type: 'steps', target: 3000, desc: 'Bugün toplam 3000 adım at.', reward: 100 }
];

function renderBadges() {
    const grid = document.getElementById('drawer-badges-grid');
    if (!grid) return;
    
    const hasFirstRun = state.history && state.history.length > 0;
    let hasSpeedy = false;
    let hasEndurance = false;
    
    if (state.history) {
        state.history.forEach(run => {
            if (parseFloat(run.distance) >= 5.0) hasEndurance = true;
            if (run.pace) {
                const parts = run.pace.split(':');
                if (parts.length >= 2) {
                    const min = parseInt(parts[0]) || 99;
                    if (min < 5) hasSpeedy = true;
                }
            }
        });
    }
    
    const isLevel5 = state.level >= 5;
    const isLevel10 = state.level >= 10;
    
    const unlockedMap = {
        first_run: hasFirstRun,
        speedy: hasSpeedy,
        endurance: hasEndurance,
        level_5: isLevel5,
        level_10: isLevel10
    };
    
    grid.innerHTML = BADGES.map(badge => {
        const isUnlocked = unlockedMap[badge.id];
        return `
            <div class="badge-item ${isUnlocked ? 'unlocked' : ''}">
                <div class="badge-icon">${badge.icon}</div>
                <div class="badge-name">${badge.name}</div>
                <div class="badge-tooltip">${badge.desc} ${isUnlocked ? '🔓 (Açıldı)' : '🔒 (Kilitli)'}</div>
            </div>
        `;
    }).join('');
}

function initDailyQuest() {
    if (!myUserId) return;
    const todayStr = new Date().toLocaleDateString('tr-TR');
    
    const questRef = ref(db, `users/${myUserId}/dailyQuest`);
    get(questRef).then(snapshot => {
        if (snapshot.exists()) {
            const savedQuest = snapshot.val();
            if (savedQuest.date === todayStr) {
                state.dailyQuest = savedQuest;
                updateDailyQuestUI();
                return;
            }
        }
        
        // Generate new daily quest
        const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
        state.dailyQuest = {
            type: template.type,
            target: template.target,
            current: 0,
            desc: template.desc,
            reward: template.reward,
            completed: false,
            date: todayStr
        };
        set(questRef, state.dailyQuest);
        updateDailyQuestUI();
    });
}

function updateDailyQuestUI() {
    if (!state.dailyQuest) return;
    
    const descEl = document.getElementById('quest-description');
    const progressTextEl = document.getElementById('quest-progress-text');
    const progressBarEl = document.getElementById('quest-progress-bar');
    
    if (descEl) descEl.innerText = state.dailyQuest.desc;
    
    let currentVal = state.dailyQuest.current;
    let targetVal = state.dailyQuest.target;
    
    let displayCurrent = currentVal;
    let displayTarget = targetVal;
    
    if (state.dailyQuest.type === 'distance') {
        displayCurrent = currentVal.toFixed(2) + ' KM';
        displayTarget = targetVal.toFixed(2) + ' KM';
    } else if (state.dailyQuest.type === 'calories') {
        displayCurrent = Math.round(currentVal) + ' kcal';
        displayTarget = targetVal + ' kcal';
    } else {
        displayCurrent = Math.round(currentVal) + ' adım';
        displayTarget = targetVal + ' adım';
    }
    
    if (progressTextEl) progressTextEl.innerText = `${displayCurrent} / ${displayTarget}`;
    
    const pct = Math.min((currentVal / targetVal) * 100, 100);
    if (progressBarEl) progressBarEl.style.width = `${pct}%`;
    
    if (state.dailyQuest.completed) {
        if (descEl) descEl.innerHTML = `🎉 ${state.dailyQuest.desc} <span style="color:var(--accent-color); font-weight:800;">(TAMAMLANDI)</span>`;
    }
}

function trackDailyQuestProgress(type, incrementalAmount) {
    if (!state.dailyQuest || state.dailyQuest.completed) return;
    
    if (state.dailyQuest.type === type) {
        state.dailyQuest.current += incrementalAmount;
        if (state.dailyQuest.current >= state.dailyQuest.target) {
            state.dailyQuest.current = state.dailyQuest.target;
            state.dailyQuest.completed = true;
            addXP(state.dailyQuest.reward);
            showToast(`GÜNLÜK GÖREV TAMAMLANDI! +${state.dailyQuest.reward} XP! 🎉`);
            speak(`Harika! Günlük görevini tamamladın ve ödülünü kazandın.`);
        }
        
        if (myUserId) {
            const questRef = ref(db, `users/${myUserId}/dailyQuest`);
            set(questRef, state.dailyQuest);
        }
        updateDailyQuestUI();
    }
}

// --- Map History Route Overlay Functions ---
function showHistoryRoute(run) {
    if (!run.path || run.path.length === 0) {
        showToast("Bu eski koşuda yol verisi bulunmuyor.");
        return;
    }
    
    clearHistoryRoute();
    
    state.historyRouteActive = true;
    state.historyRouteSelected = run;
    
    // Draw the history path using Leaflet
    state.historyRoutePolyline = L.polyline(run.path, { color: '#00e5ff', weight: 8, opacity: 0.9, dashArray: '10, 15' }).addTo(map);
    
    // Create Start Marker
    const startIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="map-flag-marker start">🏁</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });
    const startMarker = L.marker(run.path[0], { icon: startIcon }).addTo(map)
        .bindPopup("<b>BAŞLANGIÇ NOKTASI</b><br>" + run.date);
    state.historyRouteMarkers.push(startMarker);
    
    // Create End Marker
    const endIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="map-flag-marker end">🛑</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });
    const endMarker = L.marker(run.path[run.path.length - 1], { icon: endIcon }).addTo(map)
        .bindPopup("<b>BİTİŞ NOKTASI</b><br>Mesafe: " + run.distance + " KM<br>Süre: " + run.time);
    state.historyRouteMarkers.push(endMarker);
    
    // Adjust map to fit route
    map.fitBounds(state.historyRoutePolyline.getBounds(), { padding: [50, 50] });
    
    if (UI.historyModal) UI.historyModal.classList.add('hidden');
    
    const overlay = document.getElementById('history-route-overlay');
    const overlayDate = document.getElementById('history-route-date');
    const overlayStats = document.getElementById('history-route-stats');
    
    if (overlay) overlay.classList.remove('hidden');
    if (overlayDate) overlayDate.innerText = run.date;
    if (overlayStats) overlayStats.innerText = `${run.distance} KM | ${run.time} | ${run.calories || 0} KCAL | Tempo: ${run.pace || '0:00'}`;
    
    showToast("Rota haritaya yüklendi!");
}

function clearHistoryRoute() {
    state.historyRouteActive = false;
    state.historyRouteSelected = null;
    
    if (state.historyRoutePolyline) {
        map.removeLayer(state.historyRoutePolyline);
        state.historyRoutePolyline = null;
    }
    
    state.historyRouteMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    state.historyRouteMarkers = [];
    
    const overlay = document.getElementById('history-route-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// --- Dynamic Weather Forecasting (Open-Meteo API) ---
async function fetchWeather(lat, lng) {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            const code = data.current_weather.weathercode;
            
            // Map weathercode to emoji and text description
            let emoji = "☀️";
            let desc = "Koşu İdeal";
            
            if (code === 0) { emoji = "☀️"; desc = "Güneşli"; }
            else if ([1, 2, 3].includes(code)) { emoji = "⛅"; desc = "Parçalı Bulutlu"; }
            else if ([45, 48].includes(code)) { emoji = "🌫️"; desc = "Sisli"; }
            else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) { emoji = "🌧️"; desc = "Yağmurlu"; }
            else if ([71, 73, 75, 77, 85, 86].includes(code)) { emoji = "❄️"; desc = "Karlı"; }
            else if ([95, 96, 99].includes(code)) { emoji = "⛈️"; desc = "Fırtınalı"; }
            
            let advice = "Koşu İdeal";
            if (temp > 30) advice = "Çok Sıcak 💧";
            else if (temp < 5) advice = "Çok Soğuk ❄️";
            else if (emoji === "🌧️") advice = "Yağmurluk Alın 🧥";
            else if (emoji === "⛈️") advice = "Evde Kalın 🏠";
            
            const weatherEl = document.getElementById('weather-text');
            if (weatherEl) {
                const widget = weatherEl.parentElement;
                if (widget) {
                    widget.innerHTML = `<span>${emoji}</span><span id="weather-text">${temp}°C ${desc} (${advice})</span>`;
                }
            }
        }
    } catch (e) {
        console.error("Hava durumu yüklenemedi:", e);
    }
}

window.addEventListener('DOMContentLoaded', init);
