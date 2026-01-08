// LOGIN/SIGNUP PANEL TOGGLE
document.addEventListener("DOMContentLoaded", () => {
  const showSignUpButton = document.getElementById('showSignUp');
  const showSignInButton = document.getElementById('showSignIn');
  const container = document.getElementById('container');

  console.log(showSignUpButton, showSignInButton, container);

  showSignUpButton.addEventListener('click', () => {
    container.classList.add("right-panel-active");
  });

  showSignInButton.addEventListener('click', () => {
    container.classList.remove("right-panel-active");
  });

  console.log("Login/Signup toggle script loaded.");
});
