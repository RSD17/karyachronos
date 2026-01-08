import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const questions = document.querySelectorAll(".question");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
let currentStep = 0;
let CURRENT_USER = null; // <- store the signed-in user

// ------------------- AUTHENTICATION -------------------
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Not signed in? Redirect to login/signup
        window.location.href = "/html/loginsignup.html";
    } else {
        CURRENT_USER = user;
        console.log("Auth ready for post-signup:", user.uid);
        // Initialize first step once user is ready
        showStep(currentStep);
    }
});

// ------------------- WIZARD LOGIC -------------------
function showStep(step) {
    questions.forEach((q, idx) => {
        q.classList.toggle("active", idx === step);
    });

    prevBtn.disabled = step === 0;
    nextBtn.textContent = step === questions.length - 1 ? "Submit" : "Next";

    updateProgress(step);
}

// Progress bar
function updateProgress(step) {
    const totalQuestions = questions.length;
    const progressPercent = (step / (totalQuestions - 1)) * 100;
    document.getElementById("progressBar").style.width = progressPercent + "%";
}

// Navigation buttons
prevBtn.addEventListener("click", () => {
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
    }
});

nextBtn.addEventListener("click", async () => {
    // Validate current input
    const inputs = questions[currentStep].querySelectorAll("input, select");
    for (let input of inputs) {
        if (!input.checkValidity()) {
            input.reportValidity();
            return;
        }
    }

    if (currentStep < questions.length - 1) {
        currentStep++;
        showStep(currentStep);
    } else {
        // Collect form data
        const data = {
            education: document.getElementById("education").value,
            schoolDays: document.getElementById("schoolDays").value,
            wakeWeekdays: document.getElementById("wakeWeekdays").value,
            wakeWeekends: document.getElementById("wakeWeekends").value,
            bedWeekdays: document.getElementById("bedWeekdays").value,
            bedWeekends: document.getElementById("bedWeekends").value,
            schoolTimings: document.getElementById("schoolTimings").value,
            productiveTime: document.getElementById("productiveTime").value,
            studyHours: document.getElementById("studyHours").value
        };

        try {
            if (!CURRENT_USER) throw new Error("User not signed in yet");

            await setDoc(doc(db, "users", CURRENT_USER.uid), data, { merge: true }); // merge:true preserves existing signup info

            // Redirect to dashboard
            window.location.href = "/html/dashboard.html";

        } catch (error) {
            console.error("Error saving post-signup data:", error);
            alert("Something went wrong. Please try again.");
        }
    }
});

// Keep slider output in sync with range input (if present)
const schoolDaysInput = document.getElementById('schoolDays');
const schoolDaysVal = document.getElementById('schoolDaysVal');
if (schoolDaysInput && schoolDaysVal) {
  schoolDaysVal.textContent = schoolDaysInput.value;
  schoolDaysInput.addEventListener('input', () => {
    schoolDaysVal.textContent = schoolDaysInput.value;
    schoolDaysInput.setAttribute('aria-valuenow', schoolDaysInput.value);
  });
}