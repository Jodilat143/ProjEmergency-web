

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


const db = new EmergencyDatabase();





let currentUser = null;
let calamityModeActive = false;
let map = null;
let markers = [];
let updateInterval = null;
let audioEnabled = true;
let sosAlerts = [];
let gpsSimulator = null;





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
    
    
    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters!');
        return;
    }
    
    
    if (db.users.find(u => u.username === username)) {
        alert('Username already exists!');
        return;
    }
    
    
    const user = db.createUser({
        fullName,
        email,
        username,
        password,
        role
    });
    
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
            localStorage.setItem('emergency_session', JSON.stringify({
                userId: user.id,
                timestamp: Date.now()
            }));
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
        
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 3000);
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
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }
        
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
        reader.onload = function(event) {
            parseCSV(event.target.result);
        };
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
    
    const names = ['Juan Cruz', 'Maria Santos', 'Jose Reyes', 'Ana Garcia', 'Pedro Lopez', 
                   'Sofia Torres', 'Miguel Ramos', 'Isabel Flores', 'Carlos Mendoza', 'Lucia Hernandez',
                   'Diego Fernandez', 'Carmen Morales', 'Rafael Silva', 'Elena Rodriguez', 'Antonio Diaz'];
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
    
    if (total > 0) {
        document.getElementById('attendanceSummary').classList.remove('hidden');
    }
}





document.getElementById('activateCalamityBtn').addEventListener('click', function() {
    if (db.students.length === 0) {
        alert('Please add students first!');
        return;
    }
    
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
                            db.logEvent('status_change', `${student.name} status changed from ${oldStatus} to ${student.status}`);
                            
                            if (student.status === 'trapped') {
                                generateSOSAlert(student);
                            }
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
    const alert = {
        id: 'SOS' + Date.now(),
        student: student,
        time: new Date(),
        acknowledged: false
    };
    sosAlerts.unshift(alert);
    
    if (sosAlerts.length > 50) {
        sosAlerts = sosAlerts.slice(0, 50);
    }
    
    db.logEvent('sos_alert', `SOS alert from ${student.name}`, { studentId: student.id, location: { lat: student.lat, lng: student.lng } });
    
    
    if (audioEnabled) {
        playAlertSound();
    }
}

function generateSOSAlerts() {
    sosAlerts = [];
    const trapped = db.students.filter(s => s.status === 'trapped');
    
    trapped.slice(0, 10).forEach(student => {
        sosAlerts.push({
            id: 'SOS' + Date.now() + Math.random(),
            student: student,
            time: new Date(Date.now() - Math.random() * 300000),
            acknowledged: false
        });
    });
}

function playAlertSound() {
    
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        console.log('Audio not supported');
    }
}

function acknowledgeAlert(index) {
    if (sosAlerts[index]) {
        sosAlerts[index].acknowledged = true;
        db.logEvent('sos_acknowledged', `SOS alert acknowledged for ${sosAlerts[index].student.name}`);
        updateSOSPanel();
    }
}


window.acknowledgeAlert = acknowledgeAlert;





function initMap() {
    if (map) return;
    
    map = L.map('map').setView([db.settings.latitude, db.settings.longitude], db.settings.zoom);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© MikeyDev',
        maxZoom: 19
    }).addTo(map);
    
    
    L.circle([db.settings.latitude, db.settings.longitude], {
        color: 'blue',
        fillColor: '#3388ff',
        fillOpacity: 0.1,
        radius: 500
    }).addTo(map).bindPopup('<strong>' + db.settings.schoolName + '</strong><br>Campus Boundary');
    
    updateMapMarkers();
}

function updateMapMarkers() {
    if (!map) return;
    
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    db.students.forEach(student => {
        let color, label;
        
        if (student.status === 'safe') {
            color = '#10b981';
            label = 'Safe';
        } else if (student.status === 'trapped') {
            color = '#ef4444';
            label = 'Trapped - NEEDS RESCUE';
        } else if (student.status === 'missing') {
            color = '#1f2937';
            label = 'Missing - Last Known Location';
        }
        
        
        const hasGPS = student.gpsDevice;
        const iconSize = hasGPS ? 24 : 16;
        
        const icon = L.divIcon({
            html: `<div style="background: ${color}; width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); ${hasGPS ? 'animation: pulse-marker 2s infinite;' : ''}"></div>`,
            className: '',
            iconSize: [iconSize, iconSize]
        });
        
        const marker = L.marker([student.lat, student.lng], { icon })
            .bindPopup(`
                <div style="min-width: 200px;">
                    <strong style="font-size: 16px;">${student.name}</strong><br>
                    <strong>ID:</strong> ${student.id}<br>
                    <strong>Class:</strong> ${student.class} - ${student.section}<br>
                    <strong>Status:</strong> <span style="color: ${color}; font-weight: bold;">${label}</span><br>
                    <strong>Location:</strong> ${student.lat.toFixed(6)}, ${student.lng.toFixed(6)}<br>
                    <strong>RFID:</strong> ${student.rfid || 'Not assigned'}<br>
                    <strong>GPS Device:</strong> ${student.gpsDevice || 'Not assigned'}<br>
                    <strong>Contact:</strong> ${student.contact}<br>
                    <strong>Last Update:</strong> ${student.lastUpdate ? new Date(student.lastUpdate).toLocaleTimeString() : 'N/A'}
                </div>
            `)
            .addTo(map);
        
        markers.push(marker);
    });
}


const style = document.createElement('style');
style.textContent = `
    @keyframes pulse-marker {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.7; }
    }
`;
document.head.appendChild(style);





function updateDashboard() {
    if (!calamityModeActive) return;
    
    
    if (gpsSimulator) {
        gpsSimulator.updatePositions();
    }
    
    
    const safe = db.students.filter(s => s.status === 'safe').length;
    const trapped = db.students.filter(s => s.status === 'trapped').length;
    const missing = db.students.filter(s => s.status === 'missing').length;
    const devicesActive = db.students.filter(s => s.gpsDevice).length;
    
    document.getElementById('safeCount').textContent = safe;
    document.getElementById('trappedCount').textContent = trapped;
    document.getElementById('missingCount').textContent = missing;
    document.getElementById('devicesActive').textContent = devicesActive;
    
    document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
    
    updateMapMarkers();
    updateSOSPanel();
    updateAnalytics();
    updateReportsTable();
}

function updateSOSPanel() {
    const active = sosAlerts.filter(a => !a.acknowledged);
    document.getElementById('sosCount').textContent = active.length;
    
    const sosList = document.getElementById('sosList');
    if (active.length === 0) {
        sosList.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">No active SOS alerts</div>';
    } else {
        sosList.innerHTML = active.map((alert, idx) => `
            <div class="alert-item">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong style="font-size: 15px;">${alert.student.name}</strong>
                    <span style="font-size: 12px; color: #6b7280;">${alert.time.toLocaleTimeString()}</span>
                </div>
                <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">
                    📍 ${alert.student.lat.toFixed(6)}, ${alert.student.lng.toFixed(6)}
                </div>
                <div style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
                    📱 GPS: ${alert.student.gpsDevice || 'N/A'} | RFID: ${alert.student.rfid || 'N/A'}
                </div>
                <button class="btn" onclick="acknowledgeAlert(${idx})" style="background: #10b981; color: white; padding: 8px 16px; font-size: 13px;">
                    ✓ Acknowledge & Respond
                </button>
            </div>
        `).join('');
    }
}

function updateAnalytics() {
    const locations = [
        { name: 'Building A - 3rd Floor', count: Math.floor(Math.random() * 30) + 10, level: 'critical' },
        { name: 'Building B - Main Corridor', count: Math.floor(Math.random() * 20) + 5, level: 'high' },
        { name: 'Playground Area', count: Math.floor(Math.random() * 15) + 5, level: 'medium' },
        { name: 'Cafeteria', count: Math.floor(Math.random() * 10) + 3, level: 'low' }
    ];
    
    document.getElementById('analyticsContent').innerHTML = locations.map(loc => `
        <div class="congestion-item">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <strong>${loc.name}</strong>
                <span class="congestion-badge ${loc.level}">${loc.level.toUpperCase()}</span>
            </div>
            <div style="font-size: 13px; color: #6b7280;">
                ${loc.count} students detected | Capacity: ${loc.level === 'critical' ? 'EXCEEDED' : 'Normal'}
            </div>
        </div>
    `).join('');
}





function loadStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = db.students.map(student => `
        <tr>
            <td>${student.id}</td>
            <td><strong>${student.name}</strong></td>
            <td>${student.class} - ${student.section}</td>
            <td>${student.rfid || '<span style="color: #6b7280;">Not assigned</span>'}</td>
            <td>${student.gpsDevice || '<span style="color: #6b7280;">Not assigned</span>'}</td>
            <td><span class="status-badge ${student.status}">${student.status.toUpperCase()}</span></td>
            <td>
                <button class="action-btn edit" onclick="editStudent('${student.id}')">✏️ Edit</button>
                <button class="action-btn delete" onclick="deleteStudent('${student.id}')">🗑️ Delete</button>
            </td>
        </tr>
    `).join('');
}

function editStudent(id) {
    const student = db.students.find(s => s.id === id);
    if (!student) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Student';
    document.getElementById('studentId').value = student.id;
    document.getElementById('studentId').readOnly = true;
    document.getElementById('studentName').value = student.name;
    document.getElementById('studentClass').value = student.class;
    document.getElementById('studentSection').value = student.section;
    document.getElementById('studentContact').value = student.contact;
    document.getElementById('studentRFID').value = student.rfid;
    document.getElementById('studentGPS').value = student.gpsDevice;
    
    document.getElementById('studentModal').classList.remove('hidden');
}

function deleteStudent(id) {
    if (confirm('Delete this student? This cannot be undone.')) {
        db.deleteStudent(id);
        loadStudentsTable();
        updateAttendanceSummary();
    }
}

window.editStudent = editStudent;
window.deleteStudent = deleteStudent;


document.getElementById('studentSearch').addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase();
    const tbody = document.getElementById('studentsTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
});









document.getElementById('registerDeviceBtn').addEventListener('click', () => {
    populateDeviceStudentDropdown();
    document.getElementById('deviceModal').classList.remove('hidden');
});

document.getElementById('closeDeviceModal').addEventListener('click', () => {
    document.getElementById('deviceModal').classList.add('hidden');
});

document.getElementById('deviceForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const deviceData = {
        type: document.getElementById('deviceType').value,
        id: document.getElementById('deviceId').value,
        assignedTo: document.getElementById('deviceStudent').value,
        battery: 100,
        status: 'online'
    };
    
    db.registerDevice(deviceData);
    
    
    const student = db.students.find(s => s.id === deviceData.assignedTo);
    if (student) {
        if (deviceData.type === 'rfid' || deviceData.type === 'both') {
            student.rfid = deviceData.id;
        }
        if (deviceData.type === 'gps' || deviceData.type === 'both') {
            student.gpsDevice = deviceData.id;
        }
        db.save();
    }
    
    document.getElementById('deviceModal').classList.add('hidden');
    loadDevicesTable();
    updateDeviceStats();
    alert('Device registered successfully!');
});

function populateDeviceStudentDropdown() {
    const select = document.getElementById('deviceStudent');
    select.innerHTML = '<option value="">Select Student</option>' +
        db.students.map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`).join('');
}

function loadDevicesTable() {
    const tbody = document.getElementById('devicesTableBody');
    tbody.innerHTML = db.devices.map(device => {
        const student = db.students.find(s => s.id === device.assignedTo);
        const batteryColor = device.battery > 50 ? '#10b981' : device.battery > 20 ? '#f59e0b' : '#ef4444';
        
        return `
            <tr>
                <td><strong>${device.id}</strong></td>
                <td><span class="status-badge">${device.type.toUpperCase()}</span></td>
                <td>${student ? student.name : 'Unassigned'}</td>
                <td><span class="status-badge ${device.status}">${device.status.toUpperCase()}</span></td>
                <td><span style="color: ${batteryColor};">🔋 ${device.battery}%</span></td>
                <td>${new Date(device.lastSignal).toLocaleString()}</td>
                <td>
                    <button class="action-btn edit" onclick="pingDevice('${device.id}')">📡 Ping</button>
                    <button class="action-btn delete" onclick="unregisterDevice('${device.id}')">🗑️ Remove</button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateDeviceStats() {
    document.getElementById('totalDevices').textContent = db.devices.length;
    document.getElementById('onlineDevices').textContent = db.devices.filter(d => d.status === 'online').length;
    document.getElementById('offlineDevices').textContent = db.devices.filter(d => d.status === 'offline').length;
}

function pingDevice(deviceId) {
    const device = db.devices.find(d => d.id === deviceId);
    if (device) {
        device.lastSignal = new Date().toISOString();
        device.status = 'online';
        db.save();
        db.logEvent('device_ping', `Device ${deviceId} pinged successfully`);
        loadDevicesTable();
        alert('Device pinged successfully! Status: ONLINE');
    }
}

function unregisterDevice(deviceId) {
    if (confirm('Remove this device? Student assignments will be cleared.')) {
        const index = db.devices.findIndex(d => d.id === deviceId);
        if (index !== -1) {
            db.devices.splice(index, 1);
            db.save();
            loadDevicesTable();
            updateDeviceStats();
        }
    }
}

window.pingDevice = pingDevice;
window.unregisterDevice = unregisterDevice;


setInterval(() => {
    db.devices.forEach(device => {
        
        if (device.battery > 0 && Math.random() < 0.3) {
            device.battery = Math.max(0, device.battery - Math.floor(Math.random() * 2));
        }
        
        
        if (Math.random() < 0.05) {
            device.status = device.status === 'online' ? 'offline' : 'online';
        }
    });
    db.save();
    
    if (document.getElementById('devicesTableBody').innerHTML) {
        loadDevicesTable();
        updateDeviceStats();
    }
}, 30000); 





function updateReportsTable() {
    const statusFilter = document.getElementById('statusFilter').value;
    const classFilter = document.getElementById('classFilter').value;
    
    let filtered = db.students;
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(s => s.status === statusFilter);
    }
    
    if (classFilter !== 'all') {
        filtered = filtered.filter(s => s.class === classFilter);
    }
    
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = filtered.map(student => `
        <tr>
            <td>${student.id}</td>
            <td><strong>${student.name}</strong></td>
            <td>${student.class} - ${student.section}</td>
            <td><span class="status-badge ${student.status}">${student.status.toUpperCase()}</span></td>
            <td>${student.lat.toFixed(6)}, ${student.lng.toFixed(6)}</td>
            <td>${student.rfid || 'N/A'}</td>
            <td>${student.lastUpdate ? new Date(student.lastUpdate).toLocaleString() : 'N/A'}</td>
        </tr>
    `).join('');
}

function populateClassFilter() {
    const classes = [...new Set(db.students.map(s => s.class))];
    const select = document.getElementById('classFilter');
    select.innerHTML = '<option value="all">All Classes</option>' +
        classes.map(c => `<option value="${c}">${c}</option>`).join('');
}

document.getElementById('statusFilter').addEventListener('change', updateReportsTable);
document.getElementById('classFilter').addEventListener('change', updateReportsTable);


document.getElementById('exportCSV').addEventListener('click', () => {
    const csv = ['Student ID,Name,Class,Section,Status,Latitude,Longitude,RFID,GPS Device,Contact,Last Update'];
    db.students.forEach(s => {
        csv.push([
            s.id,
            s.name,
            s.class,
            s.section,
            s.status,
            s.lat,
            s.lng,
            s.rfid || '',
            s.gpsDevice || '',
            s.contact,
            s.lastUpdate || ''
        ].join(','));
    });
    
    downloadFile(csv.join('\n'), 'emergency_report_' + Date.now() + '.csv', 'text/csv');
    db.logEvent('data_export', 'CSV report exported');
});

document.getElementById('exportExcel').addEventListener('click', () => {
    alert('Excel export would use a library like SheetJS to generate .xlsx files with formatted data, charts, and multiple sheets.');
    db.logEvent('data_export', 'Excel export requested');
});

document.getElementById('exportPDF').addEventListener('click', () => {
    alert('PDF export would use jsPDF library to generate formatted reports with:\n• School letterhead\n• Student data tables\n• Maps and charts\n• Summary statistics');
    db.logEvent('data_export', 'PDF export requested');
});

document.getElementById('printReport').addEventListener('click', () => {
    window.print();
});

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}





function loadEventHistory() {
    const timeline = document.getElementById('eventTimeline');
    
    const eventIcons = {
        user_login: '🔐',
        user_logout: '🚪',
        calamity_activated: '⚠️',
        student_added: '👤',
        student_removed: '❌',
        device_registered: '📱',
        sos_alert: '🚨',
        sos_acknowledged: '✅',
        status_change: '🔄',
        data_export: '📤',
        system_setup: '⚙️'
    };
    
    const eventColors = {
        user_login: '#10b981',
        calamity_activated: '#ef4444',
        sos_alert: '#ef4444',
        student_added: '#3b82f6',
        device_registered: '#f59e0b'
    };
    
    timeline.innerHTML = db.events.slice(0, 100).map(event => `
        <div class="timeline-item">
            <div class="timeline-icon" style="background: ${eventColors[event.type] || '#6b7280'};">
                ${eventIcons[event.type] || '📝'}
            </div>
            <div class="timeline-content">
                <div class="timeline-time">${new Date(event.timestamp).toLocaleString()}</div>
                <div class="timeline-text">${event.message}</div>
            </div>
        </div>
    `).join('');
}





document.getElementById('saveLocationBtn').addEventListener('click', () => {
    const settings = {
        schoolName: document.getElementById('settingsSchoolName').value,
        latitude: parseFloat(document.getElementById('settingsLat').value),
        longitude: parseFloat(document.getElementById('settingsLng').value),
        zoom: parseInt(document.getElementById('settingsZoom').value)
    };
    
    db.updateSettings(settings);
    db.logEvent('settings_updated', 'Location settings updated');
    
    
    document.getElementById('schoolNameDisplay').textContent = settings.schoolName;
    
    
    if (map) {
        map.setView([settings.latitude, settings.longitude], settings.zoom);
    }
    
    alert('Location settings saved successfully!');
});

document.getElementById('changePasswordBtn').addEventListener('click', () => {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (newPassword && newPassword.length >= 6) {
        const confirmPassword = prompt('Confirm new password:');
        if (newPassword === confirmPassword) {
            currentUser.password = newPassword;
            const index = db.users.findIndex(u => u.id === currentUser.id);
            if (index !== -1) {
                db.users[index].password = newPassword;
                db.save();
                db.logEvent('password_changed', 'User password changed');
                alert('Password changed successfully!');
            }
        } else {
            alert('Passwords do not match!');
        }
    }
});

document.getElementById('backupDataBtn').addEventListener('click', () => {
    const backup = db.exportData();
    const json = JSON.stringify(backup, null, 2);
    downloadFile(json, 'emergency_backup_' + Date.now() + '.json', 'application/json');
    db.logEvent('data_backup', 'Full system backup created');
    alert('Backup created successfully!');
});

document.getElementById('restoreDataBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                if (confirm('Restore from backup? Current data will be overwritten!')) {
                    db.students = backup.students || [];
                    db.devices = backup.devices || [];
                    db.events = backup.events || [];
                    db.settings = backup.settings || db.settings;
                    db.save();
                    db.logEvent('data_restore', 'System restored from backup');
                    alert('Data restored successfully! Reloading...');
                    location.reload();
                }
            } catch (err) {
                alert('Invalid backup file!');
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm('⚠️ DELETE ALL DATA?\n\nThis will permanently delete:\n• All students\n• All devices\n• All event history\n\nThis CANNOT be undone!')) {
        if (confirm('Are you absolutely sure? Type YES in the next prompt to confirm.')) {
            const confirmation = prompt('Type YES to delete all data:');
            if (confirmation === 'YES') {
                db.clearAll();
                alert('All data cleared. System will restart.');
                location.reload();
            }
        }
    }
});





document.getElementById('audioToggle').addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    document.getElementById('audioToggle').textContent = audioEnabled ? '🔊' : '🔇';
    db.logEvent('audio_toggled', `Audio alerts ${audioEnabled ? 'enabled' : 'disabled'}`);
});

document.getElementById('notificationsBtn').addEventListener('click', () => {
    alert('Notifications:\n\n' + 
          `• ${sosAlerts.filter(a => !a.acknowledged).length} Active SOS Alerts\n` +
          `• ${db.students.filter(s => s.status === 'trapped').length} Students Trapped\n` +
          `• ${db.students.filter(s => s.status === 'missing').length} Students Missing\n` +
          `• ${db.devices.filter(d => d.status === 'offline').length} Devices Offline`);
});





document.getElementById('refreshMapBtn')?.addEventListener('click', () => {
    updateMapMarkers();
    alert('Map refreshed!');
});

document.getElementById('fullscreenMapBtn')?.addEventListener('click', () => {
    const mapDiv = document.getElementById('map');
    if (mapDiv.requestFullscreen) {
        mapDiv.requestFullscreen();
    } else if (mapDiv.webkitRequestFullscreen) {
        mapDiv.webkitRequestFullscreen();
    }
});

document.getElementById('muteSOSBtn')?.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    alert(`SOS audio alerts ${audioEnabled ? 'enabled' : 'muted'}`);
});





let connectionOnline = true;

setInterval(() => {
    
    const isOnline = Math.random() > 0.1;
    
    if (isOnline !== connectionOnline) {
        connectionOnline = isOnline;
        const statusEl = document.getElementById('connectionStatus');
        const dotEl = statusEl.querySelector('.status-dot');
        const textEl = statusEl.querySelector('span:last-child');
        
        if (isOnline) {
            statusEl.className = 'connection-status online';
            dotEl.className = 'status-dot online';
            textEl.textContent = 'Online';
            db.logEvent('connection_restored', 'Connection restored');
        } else {
            statusEl.className = 'connection-status offline';
            dotEl.className = 'status-dot offline';
            textEl.textContent = 'Offline';
            db.logEvent('connection_lost', 'Connection lost');
        }
    }
}, 20000);





document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        const shortcuts = {
            '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6
        };
        
        if (shortcuts[e.key] !== undefined) {
            e.preventDefault();
            document.querySelectorAll('.nav-item')[shortcuts[e.key]]?.click();
        }
        
        if (e.key === 's') {
            e.preventDefault();
            document.getElementById('studentSearch')?.focus();
        }
    }
});





setInterval(() => {
    db.save();
}, 60000); 





console.log('═══════════════════════════════════════════════════════════');
console.log('🚨 ENHANCED EMERGENCY RESPONSE DASHBOARD');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('Features:');
console.log('✓ Real Authentication System');
console.log('✓ Customizable Campus Location');
console.log('✓ GPS & RFID Device Tracking');
console.log('✓ Real-time Status Updates');
console.log('✓ SOS Alert System');
console.log('✓ Complete Data Management');
console.log('✓ Export & Backup Functionality');
console.log('✓ Event History Logging');
console.log('');
console.log('Keyboard Shortcuts:');
console.log('Ctrl+1-7: Navigate pages');
console.log('Ctrl+S: Search students');
console.log('');
console.log('═══════════════════════════════════════════════════════════');





const session = localStorage.getItem('emergency_session');
if (session) {
    try {
        const sessionData = JSON.parse(session);
        const user = db.users.find(u => u.id === sessionData.userId);
        
        
        if (user && (Date.now() - sessionData.timestamp) < 86400000) {
            currentUser = user;
            document.getElementById('userDisplayName').textContent = user.fullName;
            document.getElementById('userDisplayRole').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
            document.getElementById('userDisplayEmail').textContent = user.email;
            document.getElementById('schoolNameDisplay').textContent = db.settings.schoolName || 'Emergency Hub';
            
            showPage('dashboardContainer');
            initializeDashboard();
            
            console.log('✓ Session restored for:', user.username);
        }
    } catch (e) {
        localStorage.removeItem('emergency_session');
    }
}