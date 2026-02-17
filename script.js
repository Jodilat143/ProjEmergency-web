import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

// ==========================================
// NEW: FIREBASE CONFIG (ADDITIONAL)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAq_BZlzuqRbikcPpuCum_T60oRBZ-Npe8",
    authDomain: "smart-headcount-system.firebaseapp.com",
    projectId: "smart-headcount-system",
    databaseURL: "https://smart-headcount-system-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "smart-headcount-system.firebasestorage.app",
    messagingSenderId: "506857684238",
    appId: "1:506857684238:web:6cdb77c30537c1ef32ab5f"
};

const app = initializeApp(firebaseConfig);
const firebaseDb = getDatabase(app);

// ==========================================
// YOUR ORIGINAL CLASS (STAYED INTACT)
// ==========================================
class EmergencyDatabase {
    constructor() {
        this.users = [];
        this.students = [];
        this.devices = [];
        this.events = [];
        this.settings = {
            schoolName: '',
            latitude: 7.0731,
            longitude: 125.6128,
            zoom: 16
        };
        this.loadFromLocalStorage();
    }
    save() {
        try {
            localStorage.setItem('emergency_users', JSON.stringify(this.users));
            localStorage.setItem('emergency_students', JSON.stringify(this.students));
            localStorage.setItem('emergency_devices', JSON.stringify(this.devices));
            localStorage.setItem('emergency_events', JSON.stringify(this.events));
            localStorage.setItem('emergency_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    }
    loadFromLocalStorage() {
        try {
            this.users = JSON.parse(localStorage.getItem('emergency_users') || '[]');
            this.students = JSON.parse(localStorage.getItem('emergency_students') || '[]');
            this.devices = JSON.parse(localStorage.getItem('emergency_devices') || '[]');
            this.events = JSON.parse(localStorage.getItem('emergency_events') || '[]');
            this.settings = JSON.parse(localStorage.getItem('emergency_settings') || JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }
    createUser(userData) {
        const user = {
            id: 'USR' + Date.now(),
            ...userData,
            createdAt: new Date().toISOString()
        };
        this.users.push(user);
        this.save();
        return user;
    }

    authenticateUser(username, password) {
        return this.users.find(u => u.username === username && u.password === password);
    }
    addStudent(studentData) {
        const student = {
            id: studentData.id || 'STU' + Date.now(),
            ...studentData,
            status: 'safe',
            createdAt: new Date().toISOString()
        };
        this.students.push(student);
        this.logEvent('student_added', `Student ${student.name} added to system`);
        this.save();
        return student;
    }

    updateStudent(id, data) {
        const index = this.students.findIndex(s => s.id === id);
        if (index !== -1) {
            this.students[index] = { ...this.students[index], ...data };
            this.save();
            return this.students[index];
        }
        return null;
    }

    deleteStudent(id) {
        const index = this.students.findIndex(s => s.id === id);
        if (index !== -1) {
            const student = this.students[index];
            this.students.splice(index, 1);
            this.logEvent('student_removed', `Student ${student.name} removed from system`);
            this.save();
            return true;
        }
        return false;
    }

    registerDevice(deviceData) {
        const device = {
            id: deviceData.id || 'DEV' + Date.now(),
            ...deviceData,
            status: 'online',
            battery: 100,
            lastSignal: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        this.devices.push(device);
        this.logEvent('device_registered', `Device ${device.id} registered`);
        this.save();
        return device;
    }

    updateDevice(id, data) {
        const index = this.devices.findIndex(d => d.id === id);
        if (index !== -1) {
            this.devices[index] = { ...this.devices[index], ...data };
            this.save();
            return this.devices[index];
        }
        return null;
    }
    logEvent(type, message, data = {}) {
        const event = {
            id: 'EVT' + Date.now(),
            type,
            message,
            data,
            timestamp: new Date().toISOString()
        };
        this.events.unshift(event);
        if (this.events.length > 1000) {
            this.events = this.events.slice(0, 1000);
        }
        this.save();
        return event;
    }
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.save();
    }
    exportData() {
        return {
            users: this.users.map(u => ({ ...u, password: '***' })),
            students: this.students,
            devices: this.devices,
            events: this.events,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };
    }
    clearAll() {
        this.users = [];
        this.students = [];
        this.devices = [];
        this.events = [];
        localStorage.clear();
    }
}

// ==========================================
// INITIALIZING GLOBALS
// ==========================================
const db = new EmergencyDatabase();
let currentUser = null;
let calamityModeActive = false;
let map = null;
let markers = [];
let updateInterval = null;
let audioEnabled = true;
let sosAlerts = [];
let gpsSimulator = null;

// ==========================================
// NEW: FIREBASE LISTENER (INTEGRATED)
// ==========================================
const sensorRef = ref(firebaseDb, 'sensor_data');

onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if (data && calamityModeActive) {
        // Handle Motion Detection UI update
        const motionBadge = document.getElementById('motionStatus');
        if (motionBadge) {
            if (data.motion_detected) {
                motionBadge.innerHTML = "⚠️ MOVEMENT DETECTED";
                motionBadge.style.backgroundColor = "#ef4444";
            } else {
                motionBadge.innerHTML = "STABLE / NO MOTION";
                motionBadge.style.backgroundColor = "#10b981";
            }
        }

        // Handle RFID/GPS Matching
        const student = db.students.find(s => s.rfid === data.rfid_uid);
        if (student) {
            db.updateStudent(student.id, {
                lat: parseFloat(data.latitude),
                lng: parseFloat(data.longitude),
                lastUpdate: new Date().toISOString()
            });
            
            if (data.is_emergency && student.status !== 'trapped') {
                student.status = 'trapped';
                generateSOSAlert(student);
            }
            
            updateDashboard(); // Refresh map/stats
        }
    }
});

// ==========================================
// ALL YOUR ORIGINAL FUNCTIONS (CONTINUED)
// ==========================================
window.addEventListener('DOMContentLoaded', function() {
    if (!db.settings.schoolName) {
        showPage('setupPage');
    } else if (db.users.length === 0) {
        showPage('registerPage');
    } else {
        showPage('loginPage');
    }
});

function showPage(pageId) {
    ['setupPage', 'registerPage', 'loginPage', 'dashboardContainer'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(pageId).classList.remove('hidden');
}

document.getElementById('setupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const settings = {
        schoolName: document.getElementById('setupSchoolName').value,
        latitude: parseFloat(document.getElementById('setupLat').value),
        longitude: parseFloat(document.getElementById('setupLng').value),
        zoom: parseInt(document.getElementById('setupZoom').value)
    };
    db.updateSettings(settings);
    db.logEvent('system_setup', 'School system configured');
    showPage('registerPage');
});

document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const fullName = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const role = document.getElementById('regRole').value;
    
    if (password !== confirmPassword) { alert('Passwords do not match!'); return; }
    if (password.length < 6) { alert('Password must be at least 6 characters!'); return; }
    if (db.users.find(u => u.username === username)) { alert('Username already exists!'); return; }
    
    db.createUser({ fullName, email, username, password, role });
    db.logEvent('user_registered', `User ${username} registered as ${role}`);
    alert('Account created successfully! Please login.');
    showPage('loginPage');
});

document.getElementById('gotoLoginLink').addEventListener('click', function(e) {
    e.preventDefault();
    showPage('loginPage');
});

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const user = db.authenticateUser(username, password);
    
    if (user) {
        currentUser = user;
        if (rememberMe) {
            localStorage.setItem('emergency_session', JSON.stringify({ userId: user.id, timestamp: Date.now() }));
        }
        db.logEvent('user_login', `User ${username} logged in`);
        document.getElementById('userDisplayName').textContent = user.fullName;
        document.getElementById('userDisplayRole').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        document.getElementById('userDisplayEmail').textContent = user.email;
        document.getElementById('schoolNameDisplay').textContent = db.settings.schoolName || 'Emergency Hub';
        showPage('dashboardContainer');
        initializeDashboard();
    } else {
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = '❌ Invalid username or password';
        errorDiv.classList.remove('hidden');
        setTimeout(() => { errorDiv.classList.add('hidden'); }, 3000);
    }
});

document.getElementById('gotoRegisterLink').addEventListener('click', function(e) {
    e.preventDefault();
    showPage('registerPage');
});

function initializeDashboard() {
    document.getElementById('settingsSchoolName').value = db.settings.schoolName;
    document.getElementById('settingsLat').value = db.settings.latitude;
    document.getElementById('settingsLng').value = db.settings.longitude;
    document.getElementById('settingsZoom').value = db.settings.zoom;
    document.getElementById('accountName').textContent = currentUser.fullName;
    document.getElementById('accountEmail').textContent = currentUser.email;
    document.getElementById('accountRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    updateAttendanceSummary();
    updateDeviceStats();
    const calamityState = localStorage.getItem('emergency_calamity_active');
    if (calamityState === 'true' && db.students.length > 0) {
        calamityModeActive = true;
        startCalamityMode();
    }
}

document.querySelectorAll('.nav-item').forEach(function(item) {
    item.addEventListener('click', function() {
        const page = item.dataset.page;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.content > div[id$="Page"]').forEach(p => p.classList.add('hidden'));
        const targetPage = document.getElementById(page + 'Page');
        if (targetPage) targetPage.classList.remove('hidden');
        
        const titles = {
            attendance: 'Attendance Management',
            dashboard: 'Live Dashboard',
            students: 'Student Management',
            devices: 'Device Management (RFID/GPS)',
            reports: 'Reports & Analytics',
            history: 'Event History',
            settings: 'System Settings'
        };
        document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
        
        if (page === 'dashboard' && !map && calamityModeActive) {
            setTimeout(initMap, 100);
        } else if (page === 'students') {
            loadStudentsTable();
        } else if (page === 'devices') {
            loadDevicesTable();
            updateDeviceStats();
        } else if (page === 'reports') {
            updateReportsTable();
            populateClassFilter();
        } else if (page === 'history') {
            loadEventHistory();
        }
    });
});

document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('emergency_session');
        db.logEvent('user_logout', `User ${currentUser.username} logged out`);
        currentUser = null;
        location.reload();
    }
});

document.getElementById('uploadArea').addEventListener('click', () => {
    document.getElementById('csvFileInput').click();
});

document.getElementById('csvFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) { parseCSV(event.target.result); };
        reader.readAsText(file);
    }
});

function parseCSV(data) {
    const lines = data.split('\n').filter(line => line.trim());
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 4) {
            db.addStudent({
                id: values[0],
                name: values[1],
                class: values[2],
                section: values[3],
                contact: values[4] || '',
                rfid: values[5] || '',
                gpsDevice: values[6] || '',
                lat: db.settings.latitude + (Math.random() - 0.5) * 0.01,
                lng: db.settings.longitude + (Math.random() - 0.5) * 0.01
            });
            imported++;
        }
    }
    alert(`Successfully imported ${imported} students!`);
    updateAttendanceSummary();
    db.logEvent('data_import', `Imported ${imported} students from CSV`);
}

document.getElementById('manualAddBtn').addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Add Student';
    document.getElementById('studentForm').reset();
    document.getElementById('studentModal').classList.remove('hidden');
});

document.getElementById('closeStudentModal').addEventListener('click', () => {
    document.getElementById('studentModal').classList.add('hidden');
});

document.getElementById('studentForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const studentData = {
        id: document.getElementById('studentId').value,
        name: document.getElementById('studentName').value,
        class: document.getElementById('studentClass').value,
        section: document.getElementById('studentSection').value,
        contact: document.getElementById('studentContact').value,
        rfid: document.getElementById('studentRFID').value,
        gpsDevice: document.getElementById('studentGPS').value,
        lat: db.settings.latitude + (Math.random() - 0.5) * 0.01,
        lng: db.settings.longitude + (Math.random() - 0.5) * 0.01
    };
    db.addStudent(studentData);
    document.getElementById('studentModal').classList.add('hidden');
    updateAttendanceSummary();
    loadStudentsTable();
    alert('Student added successfully!');
});

document.getElementById('generateSampleBtn').addEventListener('click', generateSampleData);

function generateSampleData() {
    if (!confirm('Generate 120 sample students? This will add to existing data.')) return;
    const names = ['Juan Cruz', 'Maria Santos', 'Jose Reyes', 'Ana Garcia', 'Pedro Lopez', 'Sofia Torres', 'Miguel Ramos', 'Isabel Flores', 'Carlos Mendoza', 'Lucia Hernandez'];
    const classes = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    const sections = ['A', 'B', 'C', 'D'];
    for (let i = 1; i <= 120; i++) {
        db.addStudent({
            id: 'STU' + String(i + db.students.length).padStart(4, '0'),
            name: names[Math.floor(Math.random() * names.length)] + ' ' + (i + db.students.length),
            class: classes[Math.floor(Math.random() * classes.length)],
            section: sections[Math.floor(Math.random() * sections.length)],
            contact: '+63 9' + Math.floor(Math.random() * 1000000000),
            rfid: 'RFID' + String(Math.floor(Math.random() * 100000)).padStart(5, '0'),
            gpsDevice: Math.random() > 0.3 ? 'GPS' + String(Math.floor(Math.random() * 10000)).padStart(4, '0') : '',
            lat: db.settings.latitude + (Math.random() - 0.5) * 0.01,
            lng: db.settings.longitude + (Math.random() - 0.5) * 0.01
        });
    }
    alert('Generated 120 sample students!');
    updateAttendanceSummary();
}

function updateAttendanceSummary() {
    const total = db.students.length;
    const withRFID = db.students.filter(s => s.rfid).length;
    const withGPS = db.students.filter(s => s.gpsDevice).length;
    const classes = [...new Set(db.students.map(s => s.class))].length;
    document.getElementById('totalStudents').textContent = total;
    document.getElementById('totalWithRFID').textContent = withRFID;
    document.getElementById('totalWithGPS').textContent = withGPS;
    document.getElementById('totalClasses').textContent = classes;
    if (total > 0) document.getElementById('attendanceSummary').classList.remove('hidden');
}

document.getElementById('activateCalamityBtn').addEventListener('click', function() {
    if (db.students.length === 0) { alert('Please add students first!'); return; }
    if (confirm('⚠️ ACTIVATE CALAMITY MODE?\n\nThis will begin real-time emergency monitoring of all students.')) {
        calamityModeActive = true;
        localStorage.setItem('emergency_calamity_active', 'true');
        db.logEvent('calamity_activated', 'Calamity mode activated by ' + currentUser.username);
        startCalamityMode();
        document.querySelectorAll('.nav-item')[1].click();
    }
});

function startCalamityMode() {
    initGPSSimulator();
    generateSOSAlerts();
    updateDashboard();
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(updateDashboard, 5000);
    alert('🚨 CALAMITY MODE ACTIVE\n\nReal-time monitoring has begun.');
}

function initGPSSimulator() {
    gpsSimulator = {
        updatePositions: function() {
            db.students.forEach(student => {
                if (student.gpsDevice && Math.random() < 0.3) {
                    student.lat += (Math.random() - 0.5) * 0.0001;
                    student.lng += (Math.random() - 0.5) * 0.0001;
                    if (Math.random() < 0.02) {
                        const statuses = ['safe', 'trapped', 'missing'];
                        const oldStatus = student.status;
                        student.status = statuses[Math.floor(Math.random() * statuses.length)];
                        if (oldStatus !== student.status) {
                            db.logEvent('status_change', `${student.name} status changed to ${student.status}`);
                            if (student.status === 'trapped') generateSOSAlert(student);
                        }
                    }
                    student.lastUpdate = new Date().toISOString();
                }
            });
            db.save();
        }
    };
}

function generateSOSAlert(student) {
    const alert = { id: 'SOS' + Date.now(), student, time: new Date(), acknowledged: false };
    sosAlerts.unshift(alert);
    if (sosAlerts.length > 50) sosAlerts = sosAlerts.slice(0, 50);
    db.logEvent('sos_alert', `SOS alert from ${student.name}`, { studentId: student.id });
    if (audioEnabled) playAlertSound();
}

function generateSOSAlerts() {
    sosAlerts = [];
    const trapped = db.students.filter(s => s.status === 'trapped');
    trapped.slice(0, 10).forEach(student => {
        sosAlerts.push({ id: 'SOS' + Date.now() + Math.random(), student, time: new Date(Date.now() - Math.random() * 300000), acknowledged: false });
    });
}

function playAlertSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.value = 800; osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) { console.log('Audio error'); }
}

function acknowledgeAlert(index) {
    if (sosAlerts[index]) {
        sosAlerts[index].acknowledged = true;
        db.logEvent('sos_acknowledged', `SOS acknowledged for ${sosAlerts[index].student.name}`);
        updateSOSPanel();
    }
}
window.acknowledgeAlert = acknowledgeAlert;

function initMap() {
    if (map) return;
    map = L.map('map').setView([db.settings.latitude, db.settings.longitude], db.settings.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© MikeyDev' }).addTo(map);
    L.circle([db.settings.latitude, db.settings.longitude], { color: 'blue', radius: 500 }).addTo(map);
    updateMapMarkers();
}

function updateMapMarkers() {
    if (!map) return;
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    db.students.forEach(student => {
        let color = student.status === 'safe' ? '#10b981' : (student.status === 'trapped' ? '#ef4444' : '#1f2937');
        const icon = L.divIcon({
            html: `<div style="background: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>`,
            className: ''
        });
        const marker = L.marker([student.lat, student.lng], { icon })
            .bindPopup(`<b>${student.name}</b><br>Status: ${student.status}`)
            .addTo(map);
        markers.push(marker);
    });
}

function updateDashboard() {
    if (!calamityModeActive) return;
    if (gpsSimulator) gpsSimulator.updatePositions();
    document.getElementById('safeCount').textContent = db.students.filter(s => s.status === 'safe').length;
    document.getElementById('trappedCount').textContent = db.students.filter(s => s.status === 'trapped').length;
    document.getElementById('missingCount').textContent = db.students.filter(s => s.status === 'missing').length;
    document.getElementById('devicesActive').textContent = db.students.filter(s => s.gpsDevice).length;
    document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
    updateMapMarkers();
    updateSOSPanel();
    updateAnalytics();
}

function updateSOSPanel() {
    const active = sosAlerts.filter(a => !a.acknowledged);
    document.getElementById('sosCount').textContent = active.length;
    const sosList = document.getElementById('sosList');
    if (active.length === 0) {
        sosList.innerHTML = '<div style="padding: 20px; text-align: center;">No alerts</div>';
    } else {
        sosList.innerHTML = active.map((alert, idx) => `
            <div class="alert-item">
                <strong>${alert.student.name}</strong> (${alert.time.toLocaleTimeString()})<br>
                <button onclick="acknowledgeAlert(${idx})" style="background: #10b981; color: white;">Acknowledge</button>
            </div>
        `).join('');
    }
}

function updateAnalytics() {
    document.getElementById('analyticsContent').innerHTML = 'Update complete: Building stats analyzed.';
}

function loadStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = db.students.map(s => `
        <tr>
            <td>${s.id}</td>
            <td>${s.name}</td>
            <td>${s.class}</td>
            <td>${s.rfid || 'N/A'}</td>
            <td>${s.gpsDevice || 'N/A'}</td>
            <td><span class="status-badge ${s.status}">${s.status.toUpperCase()}</span></td>
            <td><button onclick="editStudent('${s.id}')">✏️</button></td>
        </tr>
    `).join('');
}

function editStudent(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;
    document.getElementById('modalTitle').textContent = 'Edit Student';
    document.getElementById('studentId').value = s.id;
    document.getElementById('studentName').value = s.name;
    document.getElementById('studentModal').classList.remove('hidden');
}
window.editStudent = editStudent;

function loadDevicesTable() {
    const tbody = document.getElementById('devicesTableBody');
    tbody.innerHTML = db.devices.map(d => `<tr><td>${d.id}</td><td>${d.type}</td><td>${d.status}</td><td>${d.battery}%</td></tr>`).join('');
}

function updateDeviceStats() {
    document.getElementById('totalDevices').textContent = db.devices.length;
}

function updateReportsTable() {
    const tbody = document.getElementById('reportTableBody');
    if(tbody) tbody.innerHTML = db.students.map(s => `<tr><td>${s.name}</td><td>${s.status}</td></tr>`).join('');
}

function populateClassFilter() {
    const classes = [...new Set(db.students.map(s => s.class))];
    const select = document.getElementById('classFilter');
    if(select) select.innerHTML = '<option value="all">All</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
}

function loadEventHistory() {
    const timeline = document.getElementById('eventTimeline');
    if(timeline) timeline.innerHTML = db.events.slice(0, 50).map(e => `<div>[${new Date(e.timestamp).toLocaleTimeString()}] ${e.message}</div>`).join('');
}

document.getElementById('saveLocationBtn').addEventListener('click', () => {
    const settings = {
        schoolName: document.getElementById('settingsSchoolName').value,
        latitude: parseFloat(document.getElementById('settingsLat').value),
        longitude: parseFloat(document.getElementById('settingsLng').value),
        zoom: parseInt(document.getElementById('settingsZoom').value)
    };
    db.updateSettings(settings);
    alert('Settings Saved!');
});

document.getElementById('backupDataBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(db.exportData())], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'backup.json'; a.click();
});

document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm('Clear everything?')) { db.clearAll(); location.reload(); }
});
