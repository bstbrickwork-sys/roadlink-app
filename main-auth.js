// RoadLink Main Auth Integration
// Replace your current demo code with this

import { signUp, logIn, logOut, initAuth, getUserProfile, updateUserStatus } from './auth.js';

// Get Firebase instances from global window object
const auth = window.firebaseAuth;
const database = window.firebaseDB;

let currentUser = null;

// Initialize authentication
async function initialize() {
    console.log("🚀 Initializing RoadLink Auth...");
    
    // Check if user is already logged in
    currentUser = await initAuth(auth, database);
    
    if (currentUser) {
        // User is logged in - load their profile and show app
        const profile = await getUserProfile(database, currentUser.uid);
        if (profile.success) {
            showApp(profile.data);
            updateUserStatus(database, currentUser.uid, 'online');
        }
    } else {
        // No user logged in - show signup screen
        showSignup();
    }
    
    setupAuthListeners();
}

// Show signup screen
function showSignup() {
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('signupScreen').style.display = 'block';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('setupScreen').classList.remove('active');
}

// Show login screen
function showLogin() {
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('signupScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('setupScreen').classList.remove('active');
}

// Show main app
function showApp(userData) {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('setupScreen').classList.remove('active');
    
    // Start the app with user data
    startApp(userData);
}

// Start main app (replace your existing startBtn code with this)
function startApp(userData) {
    console.log("✅ Starting app for:", userData.displayName);
    
    // Hide setup screen
    document.getElementById('setupScreen').classList.remove('active');
    
    // Show app elements
    document.getElementById('statsBar').classList.add('active');
    document.getElementById('mapContainer').classList.add('active');
    document.getElementById('voiceControl').classList.add('active');
    document.getElementById('quickMessages').classList.add('active');
    document.getElementById('chatContainer').classList.add('active');
    document.getElementById('nearbyDrivers').classList.add('active');
    
    // Update status indicator
    document.getElementById('statusIndicator').classList.add('active');
    document.getElementById('toggleBtn').textContent = 'Online';
    document.getElementById('toggleBtn').classList.add('active');
    
    // Store user data globally for use in other functions
    window.currentUserData = userData;
    
    // Initialize map and other features
    if (typeof initMap === 'function') {
        initMap();
    }
    
    console.log("🚗 RoadLink active!");
}

// Setup event listeners for auth screens
function setupAuthListeners() {
    // Signup button
    document.getElementById('signupBtn').addEventListener('click', async () => {
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const displayName = document.getElementById('signupName').value.trim();
        const vehicleReg = document.getElementById('signupVehicleReg').value.trim();
        
        // Validation
        if (!email || !password || !displayName) {
            showError('signupError', 'Please fill in all required fields');
            return;
        }
        
        if (password.length < 6) {
            showError('signupError', 'Password must be at least 6 characters');
            return;
        }
        
        // Disable button during signup
        const btn = document.getElementById('signupBtn');
        btn.disabled = true;
        btn.textContent = 'Creating account...';
        
        // Create account
        const result = await signUp(auth, database, email, password, {
            displayName,
            vehicleReg,
            showReg: true,
            voiceEnabled: true
        });
        
        if (result.success) {
            // Success - load profile and show app
            const profile = await getUserProfile(database, result.user.uid);
            currentUser = result.user;
            showApp(profile.data);
            updateUserStatus(database, currentUser.uid, 'online');
        } else {
            // Error
            showError('signupError', result.error);
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            showError('loginError', 'Please enter email and password');
            return;
        }
        
        // Disable button during login
        const btn = document.getElementById('loginBtn');
        btn.disabled = true;
        btn.textContent = 'Logging in...';
        
        // Log in
        const result = await logIn(auth, email, password);
        
        if (result.success) {
            // Success - load profile and show app
            const profile = await getUserProfile(database, result.user.uid);
            currentUser = result.user;
            showApp(profile.data);
            updateUserStatus(database, currentUser.uid, 'online');
        } else {
            // Error
            showError('loginError', result.error);
            btn.disabled = false;
            btn.textContent = 'Log In';
        }
    });
    
    // Switch between login/signup
    document.getElementById('showLoginLink').addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });
    
    document.getElementById('showSignupLink').addEventListener('click', (e) => {
        e.preventDefault();
        showSignup();
    });
    
    // Add logout button functionality (if you have one)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (currentUser) {
                await logOut(auth, database, currentUser.uid);
                currentUser = null;
                showSignup();
            }
        });
    }
}

// Show error message
function showError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Set user status to offline when page closes
window.addEventListener('beforeunload', () => {
    if (currentUser) {
        updateUserStatus(database, currentUser.uid, 'offline');
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Export for use in other modules
export { currentUser, showApp, startApp };
