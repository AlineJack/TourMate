/* =========================================================
   firebase-config.js
   TourMate uses Firebase Authentication only in the current
   local-first phase. All application data (tours, experiences,
   profiles, settings, sharing state) is handled by localStorage.

   Firebase Auth is the identity layer:
     auth -> sign-up, email verification, login, logout

   Firestore/Storage are intentionally NOT initialized here yet.
   That prevents unused SDK dependencies from breaking pages such
   as the Planner before Leaflet/map.js can initialize.
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyC7fsdk6_tb_UyxrWAhMO-hLko31jAV9e8",
  authDomain: "tourmate007.firebaseapp.com",
  projectId: "tourmate007",
  storageBucket: "tourmate007.firebasestorage.app",
  messagingSenderId: "45660193682",
  appId: "1:45660193682:web:c91d80113244f4eecbb74b",
  measurementId: "G-6YZF90WKZK"
};

firebase.initializeApp(firebaseConfig);

// The only Firebase service used by the current application phase.
const auth = firebase.auth();

console.log("Firebase Auth connected:", firebase.apps.length > 0 ? "✅ yes" : "❌ no");
