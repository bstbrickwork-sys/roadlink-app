// RoadLink Authentication System
// Uses Firebase Auth + Realtime Database

import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

import { 
    ref, 
    set, 
    get,
    child 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// Auth state listener
export function initAuth(auth, database) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("✅ User logged in:", user.email);
                resolve(user);
            } else {
                console.log("❌ No user logged in");
                resolve(null);
            }
        });
    });
}

// Sign up new user
export async function signUp(auth, database, email, password, userData) {
    try {
        // Create auth account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Save user profile to database
        await set(ref(database, 'users/' + user.uid), {
            email: email,
            displayName: userData.displayName,
            vehicleReg: userData.vehicleReg || '',
            showReg: userData.showReg !== false,
            voiceEnabled: userData.voiceEnabled !== false,
            createdAt: Date.now(),
            status: 'offline'
        });
        
        console.log("✅ Sign up successful!");
        return { success: true, user };
        
    } catch (error) {
        console.error("❌ Sign up error:", error.message);
        return { success: false, error: error.message };
    }
}

// Log in existing user
export async function logIn(auth, email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Login successful!");
        return { success: true, user: userCredential.user };
        
    } catch (error) {
        console.error("❌ Login error:", error.message);
        return { success: false, error: error.message };
    }
}

// Log out user
export async function logOut(auth, database, userId) {
    try {
        // Set status to offline
        if (userId) {
            await set(ref(database, `users/${userId}/status`), 'offline');
        }
        
        await signOut(auth);
        console.log("✅ Logged out");
        return { success: true };
        
    } catch (error) {
        console.error("❌ Logout error:", error.message);
        return { success: false, error: error.message };
    }
}

// Get user profile data
export async function getUserProfile(database, userId) {
    try {
        const snapshot = await get(child(ref(database), `users/${userId}`));
        
        if (snapshot.exists()) {
            return { success: true, data: snapshot.val() };
        } else {
            return { success: false, error: "User profile not found" };
        }
        
    } catch (error) {
        console.error("❌ Get profile error:", error.message);
        return { success: false, error: error.message };
    }
}

// Update user status (online/offline)
export async function updateUserStatus(database, userId, status) {
    try {
        await set(ref(database, `users/${userId}/status`), status);
        console.log(`✅ Status updated: ${status}`);
        return { success: true };
        
    } catch (error) {
        console.error("❌ Update status error:", error.message);
        return { success: false, error: error.message };
    }
}
