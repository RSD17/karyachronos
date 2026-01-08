import { auth } from "/js/firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const signOutLink = document.querySelector('[data-signout]');

  // If navbar doesn't exist on this page, do nothing
  if (!signOutLink) return;

  signOutLink.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      await signOut(auth);
      window.location.href = "/html/index.html";
    } catch (err) {
      console.error("Sign out failed:", err);
      alert("Sign out failed. Please try again.");
    }
  });
});
