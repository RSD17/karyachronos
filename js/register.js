import { auth, db } from "/js/firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } 
    from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Function to show success/error messages
function showMessage(message, elementId, isError = false) { 
    const msgDiv = document.getElementById(elementId);
    if (!msgDiv) return;
    msgDiv.textContent = message;
    msgDiv.style.display = "block";
    msgDiv.style.opacity = "1";
    msgDiv.style.color = isError ? "#ff4b2b" : "#2ecc71";
    setTimeout(() => msgDiv.style.opacity = "0", 4000);
    setTimeout(() => msgDiv.style.display = "none", 4500);
}

// ---------------- Sign Up ----------------
const signupForm = document.getElementById("signupForm");
signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("rEmail").value.trim();
    const password = document.getElementById("rPassword").value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Save user data to Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            username: username,
            email: email,
            createdAt: new Date()
        });

        // Optional: save username locally for post-signup use
        localStorage.setItem("username", username);

        // Redirect to post-signup form
        window.location.href = "/html/postSignup.html";

    } catch (error) {
        let msg = "Something went wrong.";
        if (error.code === "auth/email-already-in-use") msg = "Email already in use.";
        if (error.code === "auth/weak-password") msg = "Password must be at least 6 characters.";
        if (error.code === "auth/invalid-email") msg = "Invalid email address.";
        showMessage(msg, "signUpMsg", true);
    }
});

// ---------------- Sign In ----------------
const signinForm = document.getElementById("signinForm");
signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("lEmail").value.trim();
    const password = document.getElementById("lPassword").value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage("Signed in successfully", "signInMsg");
        signinForm.reset();

        // Redirect to dashboard after successful login
        window.location.href = "/html/dashboard.html";
    } catch (error) {
        showMessage("Invalid email or password.", "signInMsg", true);
    }
});