import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgYFHvMZ_Uj-Qe_2N6fIaabCThgrzgS_w",
  authDomain: "karyachronos-c4162.firebaseapp.com",
  projectId: "karyachronos-c4162",
  storageBucket: "karyachronos-c4162.appspot.com",
  messagingSenderId: "981408232716",
  appId: "1:981408232716:web:a7a0816d0e20b3e0c2c529"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
