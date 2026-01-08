import { auth } from "/js/firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getCurrentUser } from "/js/user-service.js";

const usernameSpan = document.getElementById("dash-username");
const signOutBtn = document.getElementById("signOutBtn");
getCurrentUser()
  .then(user => {
      if (usernameSpan) {
          usernameSpan.textContent = user.username;
      }
  })
  .catch(() => {
      window.location.href = "/html/loginsignup.html";
  });

if (signOutBtn) {
  signOutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
          await signOut(auth);
          window.location.href = "/html/loginsignup.html";
      } catch (error) {
          console.error("Error signing out:", error);
      }
  });
}
