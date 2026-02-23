// RoadLink - Main Application Logic

class RoadLinkApp {
    constructor() {
        this.isOnline = false;
        this.map = null;
        this.userMarker = null;
        this.driverMarkers = new Map();
        this.currentLocation = null;
        this.recognition = null;
        this.userData = null;
        this.nearbyDrivers = [];
        this.messages = [];
        this.messageCount = 0;
        this.range = 5000; // 5km in meters
        
        this.init();
        this.backend = window.FirebaseBackend ? new window.FirebaseBackend() : null;
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.checkInstallPrompt();
        this.initVoiceRecognition();
    }

    setupElements() {
        // Screens
        this.setupScreen = document.getElementById('setupScreen');
        this.statsBar = document.getElementById('statsBar');
        this.mapContainer = document.getElementById('mapContainer');
        this.voiceControl = document.getElementById('voiceControl');
        this.quickMessages = document.getElementById('quickMessages');
        this.chatContainer = document.getElementById('chatContainer');
        this.nearbyDriversEl = document.getElementById('nearbyDrivers');

        // Header elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.toggleBtn = document.getElementById('toggleBtn');

        // Setup form
        this.vehicleReg = document.getElementById('vehicleReg');
        this.username = document.getElementById('username');
        this.showReg = document.getElementById('showReg');
        this.voiceEnabled = document.getElementById('voiceEnabled');
        this.startBtn = document.getElementById('startBtn');

        // Voice elements
        this.voiceBtn = document.getElementById('voiceBtn');
        this.voiceStatus = document.getElementById('voiceStatus');

        // Chat elements
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');

        // Stats
        this.nearbyCount = document.getElementById('nearbyCount');
        this.rangeValue = document.getElementById('rangeValue');
        this.messagesCount = document.getElementById('messagesCount');
        this.chatNearbyCount = document.getElementById('chatNearbyCount');

        // Drivers list
        this.driverList = document.getElementById('driverList');
    }

    setupEventListeners() {
        // Start button
        this.startBtn.addEventListener('click', () => this.startApp());

        // Toggle online/offline
        this.toggleBtn.addEventListener('click', () => this.toggleOnline());

        // Voice button
        this.voiceBtn.addEventListener('click', () => this.toggleVoiceListening());

        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Quick message buttons
        document.querySelectorAll('.quick-msg-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const msg = e.currentTarget.getAttribute('data-msg');
                this.sendQuickMessage(msg);
            });
        });

        // Install prompt
        document.getElementById('dismissBtn')?.addEventListener('click', () => {
            document.getElementById('installPrompt').classList.remove('active');
        });
    }

    startApp() {
        // Validate inputs
        if (!this.username.value.trim()) {
            this.showAlert('Please enter a display name', 'error');
            return;
        }

        // Store user data
        this.userData = {
            username: this.username.value.trim(),
            vehicleReg: this.vehicleReg.value.trim(),
            showReg: this.showReg.checked,
            voiceEnabled: this.voiceEnabled.checked,
            id: this.generateId()
        };

        // Save to localStorage
        localStorage.setItem('roadlink_user', JSON.stringify(this.userData));

        // Hide setup screen
        this.setupScreen.classList.remove('active');

        // Show main app
        this.statsBar.classList.add('active');
        this.mapContainer.classList.add('active');
        if (this.userData.voiceEnabled) {
            this.voiceControl.classList.add('active');
        }
        this.quickMessages.classList.add('active');
        this.chatContainer.classList.add('active');
        this.nearbyDriversEl.classList.add('active');

        // Initialize map
        this.initMap();

        // Request location permission
        this.requestLocation();
    }

    generateId() {
        return 'driver_' + Math.random().toString(36).substr(2, 9);
    }

    initMap() {
        // Initialize Leaflet map
        this.map = L.map('map').setView([51.505, -0.09], 13);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add scale control
        L.control.scale().addTo(this.map);
    }

    requestLocation() {
        if (!navigator.geolocation) {
            this.showAlert('Geolocation is not supported by your browser', 'error');
            return;
        }

        this.showAlert('Requesting location access...', 'warning');

        navigator.geolocation.getCurrentPosition(
            (position) => this.onLocationSuccess(position),
            (error) => this.onLocationError(error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    onLocationSuccess(position) {
        this.currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        // Center map on user location
        this.map.setView([this.currentLocation.lat, this.currentLocation.lng], 15);

        // Add user marker
        this.userMarker = L.marker([this.currentLocation.lat, this.currentLocation.lng], {
            icon: L.divIcon({
                className: 'user-marker',
                html: '<div style="background: #1a73e8; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20]
            })
        }).addTo(this.map);

        // Add circle showing range
        L.circle([this.currentLocation.lat, this.currentLocation.lng], {
            radius: this.range,
            color: '#1a73e8',
            fillColor: '#1a73e8',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(this.map);

        this.showAlert('Location acquired! You\'re now visible to nearby drivers.', 'success');

        // Start watching position
        this.watchPosition();

        // Simulate nearby drivers (in production, this would be real-time from a server)
        this.simulateNearbyDrivers();
    }

    onLocationError(error) {
        let message = 'Unable to get your location';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied. Please enable location access.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable.';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out.';
                break;
        }
        this.showAlert(message, 'error');
    }

    watchPosition() {
        if (!navigator.geolocation) return;

        navigator.geolocation.watchPosition(
            (position) => {
                this.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // Update user marker position
                if (this.userMarker) {
                    this.userMarker.setLatLng([this.currentLocation.lat, this.currentLocation.lng]);
                }

                // Update nearby drivers
                this.updateNearbyDrivers();
            },
            (error) => console.error('Position watch error:', error),
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }

  async toggleOnline() {
    this.isOnline = !this.isOnline;
    
    if (this.isOnline) {
        this.toggleBtn.textContent = 'Go Offline';
        this.toggleBtn.classList.add('active');
        this.statusIndicator.classList.add('active');
        this.showAlert('You are now online and visible', 'success');

        // Start updating location to Firebase every 5 seconds
        if (this.backend && this.backend.currentUserId) {
            this.locationUpdateInterval = setInterval(() => {
                if (this.currentLocation && this.isOnline) {
                    this.backend.updateLocation(
                        this.backend.currentUserId,
                        this.currentLocation,
                        this.userData
                    );
                }
            }, 5000);

            // Watch nearby drivers from Firebase
            this.backend.watchNearbyDrivers(this.currentLocation, this.range, (drivers) => {
                this.nearbyDrivers = drivers;
                this.updateDriversList();
                this.nearbyCount.textContent = drivers.length;
                this.chatNearbyCount.textContent = `${drivers.length} nearby`;
            });

            // Watch nearby messages from Firebase
            this.backend.watchNearbyMessages(this.currentLocation, this.range, (message) => {
                this.addMessage(message);
                this.messageCount++;
                this.messagesCount.textContent = this.messageCount;
            });
        }
    } else {
        this.toggleBtn.textContent = 'Go Online';
        this.toggleBtn.classList.remove('active');
        this.statusIndicator.classList.remove('active');
        this.showAlert('You are now offline', 'warning');

        // Stop location updates
        if (this.locationUpdateInterval) {
            clearInterval(this.locationUpdateInterval);
        }

        // Mark offline in Firebase
        if (this.backend && this.backend.currentUserId) {
            await this.backend.setOffline(this.backend.currentUserId);
            this.backend.cleanup();
        }

        // Clear nearby drivers
        this.nearbyDrivers = [];
        this.driverMarkers.forEach(marker => this.map.removeLayer(marker));
        this.driverMarkers.clear();
    }
}
    // Voice Recognition
    initVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const text = event.results[last][0].transcript.toLowerCase();
            
            console.log('Voice command:', text);
            
            if (text.includes('open chat') || text.includes('open channel')) {
                this.voiceStatus.textContent = 'Chat activated! Start speaking...';
                this.showAlert('Chat activated by voice!', 'success');
                this.messageInput.focus();
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.voiceBtn.classList.remove('listening');
        };

        this.recognition.onend = () => {
            if (this.voiceBtn.classList.contains('listening')) {
                this.recognition.start(); // Keep listening
            }
        };
    }

    toggleVoiceListening() {
        if (!this.recognition) {
            this.showAlert('Voice recognition not supported', 'error');
            return;
        }

        if (this.voiceBtn.classList.contains('listening')) {
            this.recognition.stop();
            this.voiceBtn.classList.remove('listening');
            this.voiceStatus.textContent = 'Tap microphone or say "Open Chat"';
        } else {
            this.recognition.start();
            this.voiceBtn.classList.add('listening');
            this.voiceStatus.textContent = 'Listening... Say "Open Chat"';
        }
    }

    // Messaging
    async sendMessage() {
    const text = this.messageInput.value.trim();
    if (!text) return;

    // Send to Firebase
    if (this.backend && this.backend.currentUserId && this.currentLocation) {
        await this.backend.sendMessage(
            this.backend.currentUserId,
            text,
            this.currentLocation,
            this.userData
        );
    } else {
        // Fallback if Firebase not ready
        this.addMessage({
            id: Date.now(),
            sender: this.userData.username,
            vehicleReg: this.userData.showReg ? this.userData.vehicleReg : null,
            text: text,
            timestamp: new Date(),
            isOwn: true,
            distance: 0
        });
    }

    this.messageInput.value = '';
}
    async sendQuickMessage(text) {
    if (this.backend && this.backend.currentUserId && this.currentLocation) {
        await this.backend.sendMessage(
            this.backend.currentUserId,
            text,
            this.currentLocation,
            this.userData
        );
    } else {
        this.addMessage({
            id: Date.now(),
            sender: this.userData.username,
            vehicleReg: this.userData.showReg ? this.userData.vehicleReg : null,
            text: text,
            timestamp: new Date(),
            isOwn: true,
            distance: 0
        });
    }

    this.showAlert('Quick message sent!', 'success');
}
    addMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.isOwn ? 'own' : 'other'}`;
    
    const displayName = message.vehicleReg ? 
        `${message.sender} (${message.vehicleReg})` : 
        message.sender;

    // Handle Firebase timestamp objects
    let timeDisplay = '';
    if (message.timestamp) {
        const date = message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp);
        timeDisplay = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    messageEl.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${displayName}</span>
            ${!message.isOwn ? `<span class="message-distance">${this.formatDistance(message.distance)}</span>` : ''}
            ${timeDisplay ? `<span class="message-time">${timeDisplay}</span>` : ''}
        </div>
        <div class="message-text">${this.escapeHtml(message.text)}</div>
    `;

    this.chatMessages.appendChild(messageEl);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
}
  }


        const randomDriver = this.nearbyDrivers[Math.floor(Math.random() * this.nearbyDrivers.length)];
        if (!randomDriver) return;

        this.addMessage({
            id: Date.now(),
            sender: randomDriver.name,
            vehicleReg: randomDriver.reg,
            text: responses[Math.floor(Math.random() * responses.length)],
            timestamp: new Date(),
            isOwn: false,
            distance: randomDriver.distance
        });

        this.messageCount++;
        this.messagesCount.textContent = this.messageCount;
    }

    // Nearby Drivers Simulation
 
        // In production, this would be real-time data from a server
        const driverNames = ['Trucker Joe', 'Lisa M', 'Mike R', 'Sarah K', 'Driver Bob'];
        const vehicles = ['TRK 456', 'CAR 789', 'VAN 123', 'SUV 321', 'PKP 555'];

        this.nearbyDrivers = [];

        for (let i = 0; i < 5; i++) {
            const distance = Math.random() * this.range;
            const angle = Math.random() * Math.PI * 2;
            
            // Calculate position offset
            const latOffset = (distance / 111320) * Math.cos(angle);
            const lngOffset = (distance / (111320 * Math.cos(this.currentLocation.lat * Math.PI / 180))) * Math.sin(angle);

            const driver = {
                id: this.generateId(),
                name: driverNames[i],
                reg: vehicles[i],
                lat: this.currentLocation.lat + latOffset,
                lng: this.currentLocation.lng + lngOffset,
                distance: distance
            };

            this.nearbyDrivers.push(driver);
            this.addDriverMarker(driver);
        }

        this.updateDriversList();
        this.nearbyCount.textContent = this.nearbyDrivers.length;
        this.chatNearbyCount.textContent = `${this.nearbyDrivers.length} nearby`;
    }

    addDriverMarker(driver) {
        const marker = L.marker([driver.lat, driver.lng], {
            icon: L.divIcon({
                className: 'driver-marker',
                html: '<div style="background: #34a853; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
                iconSize: [16, 16]
            })
        }).addTo(this.map);

        marker.bindPopup(`
            <div style="color: #202124;">
                <strong>${driver.name}</strong><br>
                ${driver.reg}<br>
                <small>${this.formatDistance(driver.distance)}</small>
            </div>
        `);

        this.driverMarkers.set(driver.id, marker);
    }

    updateDriversList() {
        this.driverList.innerHTML = '';

        // Sort by distance
        this.nearbyDrivers.sort((a, b) => a.distance - b.distance);

        this.nearbyDrivers.forEach(driver => {
            const driverEl = document.createElement('div');
            driverEl.className = 'driver-item';
            driverEl.innerHTML = `
                <div class="driver-info">
                    <div class="driver-icon">🚗</div>
                    <div class="driver-details">
                        <div class="driver-reg">${driver.name} • ${driver.reg}</div>
                        <div class="driver-distance">${this.formatDistance(driver.distance)}</div>
                    </div>
                </div>
            `;
            this.driverList.appendChild(driverEl);
        });
    }
 }

    // Utilities
    formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)}m away`;
        } else {
            return `${(meters / 1000).toFixed(1)}km away`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showAlert(message, type = 'success') {
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.textContent = message;
        document.body.appendChild(alert);

        setTimeout(() => {
            alert.remove();
        }, 3000);
    }

    // Install Prompt
    checkInstallPrompt() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // Show custom install prompt after a delay
            setTimeout(() => {
                document.getElementById('installPrompt').classList.add('active');
            }, 3000);
        });

        document.getElementById('installBtn')?.addEventListener('click', async () => {
            if (!deferredPrompt) return;

            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response: ${outcome}`);
            
            deferredPrompt = null;
            document.getElementById('installPrompt').classList.remove('active');
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new RoadLinkApp();
    });
} else {
    new RoadLinkApp();
}
