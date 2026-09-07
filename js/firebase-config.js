/* =========================================================
   firebase-config.js
   STEP 1 of the Firebase migration — connect this project to
   a real Firebase project. This file does ONLY that: it does
   not change login, storage, or any page behaviour yet.

   WHAT THIS FILE DOES
   - Initializes Firebase using your project's keys
   - Creates three shared references that every later step
     (login, profile, trips, expenses...) will reuse:
       auth       -> Firebase Authentication
       db         -> Cloud Firestore (database)
       fbStorage  -> Firebase Storage (for profile pictures)

   HOW TO GET YOUR OWN KEYS (one-time setup, do this first)
   1. Go to https://console.firebase.google.com and create a
      project (or open an existing one).
   2. Click the gear icon (top-left) -> "Project settings".
   3. Under "Your apps", click the </> (web) icon to register
      a web app (nickname can be anything, e.g. "TourMate").
   4. Firebase will show you a firebaseConfig object — copy the
      values it gives you into the object below.
   5. Turn the services on from the left sidebar:
       - Build -> Authentication -> Get started -> enable "Email/Password"
       - Build -> Firestore Database -> Create database (start in test mode for now)
       - Build -> Storage -> Get started

   NOTE ON SECURITY: these config values are NOT secret. They
   identify your Firebase project, they don't grant access by
   themselves — access is controlled separately by Firestore/
   Storage/Auth security rules (we'll set those up in a later
   step). It's normal and safe for them to be visible in your
   public GitHub Pages source.
   ========================================================= */

// TODO: replace every value below with the config from YOUR Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyC7fsdk6_tb_UyxrWAhMO-hLko31jAV9e8",
  authDomain: "tourmate007.firebaseapp.com",
  projectId: "tourmate007",
  storageBucket: "tourmate007.firebasestorage.app",
  messagingSenderId: "45660193682",
  appId: "1:45660193682:web:c91d80113244f4eecbb74b",
  measurementId: "G-6YZF90WKZK"
};

// Connect this website to that Firebase project.
firebase.initializeApp(firebaseConfig);

// Shared handles other files will use, e.g. auth.signInWithEmailAndPassword(...),
// db.collection("trips"), fbStorage.ref("profilePictures/...").
const auth = firebase.auth();
const db = firebase.firestore();
const fbStorage = firebase.storage();

// Quick sanity check — open the browser console (F12) after loading
// any page. You should see "Firebase connected: ✅ yes". If you still
// see the placeholder keys above, it will still say yes (the SDK loaded
// fine) but real Auth/Firestore calls will fail until you paste in your
// real project config. Safe to delete this line later.
console.log("Firebase connected:", firebase.apps.length > 0 ? "✅ yes" : "❌ no");
