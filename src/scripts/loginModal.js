// Automatically open the modal when the page loads
// Why? We want to gate the app — no one can use it without logging in first
window.addEventListener("load", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    document.getElementById("login-modal").style.display = "flex";
  }
  // If token exists the user is already logged in, modal stays hidden
});

function completeLogin(user, token) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));

  const profileName = document.getElementById("profile-name");
  const profileEmail = document.getElementById("profile-email");
  if (profileName && user.name) profileName.textContent = user.name;
  if (profileEmail && user.email) profileEmail.textContent = user.email;

  window.dispatchEvent(new Event("auth-changed"));
  document.getElementById("login-modal").style.display = "none";
}

// Close button handler (kept for later when we re-enable it)
document.getElementById("close-login").addEventListener("click", () => {
  document.getElementById("login-modal").style.display = "none";
});

// Login submit handler
document.getElementById("login-submit").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  const loginError = document.getElementById("login-error");

  if (!email || !password) {
    loginError.textContent = "Please fill in all fields";
    loginError.style.display = "block";
    return;
  }

  loginError.style.display = "none";

  try {
      const res = await fetch("https://webbshop-2026-be-g08.vercel.app/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      const user = data.user || { email };
      completeLogin(user, data.token);
    }
    else {
      // Show the error message from the server
      loginError.textContent = data.error || "Invalid email or password";
      loginError.style.display = "block";
    }
  } catch (error) {
    loginError.textContent = "Something went wrong, please try again";
    loginError.style.display = "block";
  }
});