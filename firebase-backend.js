// Firebase Backend Integration Example
// This file shows how to integrate Firebase for real-time features

// SETUP INSTRUCTIONS:
// 1. Create a Firebase project at https://console.firebase.google.com
// 2. Enable Firestore Database
// 3. Get your config from Project Settings > General
// 4. Replace the config below with your actual config
// 5. Add this script after the Firebase SDK in index.html

// Firebase Configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase (uncomment when ready to use)
// firebase.initializeApp(firebaseConfig);
// const db = firebase.firestore();

class FirebaseBackend {
  constructor() {
    this.db = null;
    this.unsubscribeDrivers = null;
    this.unsubscribeMessages = null;
  }

  initialize() {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    this.db = firebase.firestore();
    
    // Enable offline persistence
    this.db.enablePersistence()
      .catch((err) => {
        console.log('Persistence error:', err);
      });
  }

  // Update user location in Firestore
  async updateLocation(userId, location, userData) {
    try {
      await this.db.collection('activeDrivers').doc(userId).set({
        userId: userId,
        username: userData.username,
        vehicleReg: userData.showReg ? userData.vehicleReg : null,
        location: new firebase.firestore.GeoPoint(location.lat, location.lng),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        isOnline: true
      }, { merge: true });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }

  // Listen to nearby drivers
  watchNearbyDrivers(userLocation, range, callback) {
    // Note: For production, you'd want to use a proper geospatial query
    // Consider using GeoFirestore or similar library for efficient location queries
    
    // Simple implementation (not efficient for large scale):
    this.unsubscribeDrivers = this.db.collection('activeDrivers')
      .where('isOnline', '==', true)
      .onSnapshot((snapshot) => {
        const drivers = [];
        
        snapshot.forEach((doc) => {
          const driver = doc.data();
          const driverLocation = driver.location;
          
          // Calculate distance (simple haversine)
          const distance = this.calculateDistance(
            userLocation.lat,
            userLocation.lng,
            driverLocation.latitude,
            driverLocation.longitude
          );
          
          // Only include if within range
          if (distance <= range) {
            drivers.push({
              id: doc.id,
              name: driver.username,
              reg: driver.vehicleReg,
              lat: driverLocation.latitude,
              lng: driverLocation.longitude,
              distance: distance,
              lastUpdated: driver.lastUpdated
            });
          }
        });
        
        callback(drivers);
      });
  }

  // Send message
  async sendMessage(userId, message, location, userData) {
    try {
      await this.db.collection('messages').add({
        userId: userId,
        username: userData.username,
        vehicleReg: userData.showReg ? userData.vehicleReg : null,
        text: message,
        location: new firebase.firestore.GeoPoint(location.lat, location.lng),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: firebase.firestore.Timestamp.fromDate(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        )
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  // Listen to nearby messages
  watchNearbyMessages(userLocation, range, callback) {
    // Listen for new messages
    this.unsubscribeMessages = this.db.collection('messages')
      .where('timestamp', '>', new Date(Date.now() - 60000)) // Last minute
      .orderBy('timestamp', 'desc')
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const message = change.doc.data();
            const messageLocation = message.location;
            
            // Calculate distance
            const distance = this.calculateDistance(
              userLocation.lat,
              userLocation.lng,
              messageLocation.latitude,
              messageLocation.longitude
            );
            
            // Only show if within range
            if (distance <= range) {
              callback({
                id: change.doc.id,
                sender: message.username,
                vehicleReg: message.vehicleReg,
                text: message.text,
                timestamp: message.timestamp,
                distance: distance,
                isOwn: message.userId === this.currentUserId
              });
            }
          }
        });
      });
  }

  // Set user offline
  async setOffline(userId) {
    try {
      await this.db.collection('activeDrivers').doc(userId).update({
        isOnline: false,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error setting offline:', error);
    }
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Clean up listeners
  cleanup() {
    if (this.unsubscribeDrivers) {
      this.unsubscribeDrivers();
    }
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
    }
  }
}

// Usage in app.js:
/*
// Initialize Firebase backend
const backend = new FirebaseBackend();
backend.initialize();

// Update location
backend.updateLocation(this.userData.id, this.currentLocation, this.userData);

// Watch nearby drivers
backend.watchNearbyDrivers(this.currentLocation, this.range, (drivers) => {
  this.nearbyDrivers = drivers;
  this.updateDriversList();
  this.nearbyCount.textContent = drivers.length;
});

// Send message
backend.sendMessage(this.userData.id, messageText, this.currentLocation, this.userData);

// Watch messages
backend.watchNearbyMessages(this.currentLocation, this.range, (message) => {
  this.addMessage(message);
});

// Set offline when going offline
backend.setOffline(this.userData.id);
*/

// FIRESTORE SECURITY RULES
// Add these rules in Firebase Console > Firestore > Rules
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Active drivers collection
    match /activeDrivers/{driverId} {
      allow read: if true; // Anyone can see active drivers
      allow create, update: if request.auth != null; // Only authenticated users can update
      allow delete: if request.auth.uid == driverId; // Only user can delete their own record
    }
    
    // Messages collection
    match /messages/{messageId} {
      allow read: if true; // Anyone can read messages
      allow create: if request.auth != null; // Only authenticated users can send messages
      allow delete: if request.auth.uid == resource.data.userId; // Only message sender can delete
    }
  }
}
*/

// FIRESTORE INDEXES
// Create these indexes in Firebase Console > Firestore > Indexes
/*
Collection: messages
Fields:
- timestamp (Descending)
- location (GeoPoint)
*/

// COST ESTIMATION FOR FIREBASE
/*
Free Tier (Spark Plan):
- 50,000 reads/day
- 20,000 writes/day
- 1 GB storage
- Good for ~100-500 daily active users

Blaze Plan (Pay as you go):
- $0.06 per 100,000 reads
- $0.18 per 100,000 writes
- $0.18/GB storage
- Estimated cost for 10,000 users: $20-50/month
*/
