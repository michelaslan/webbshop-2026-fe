// Automatically open the modal when the page loads
// Why? We want to gate the app — no one can use it without logging in first
window.addEventListener("load", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    document.getElementById("login-modal").style.display = "flex";
  }
  // If token exists the user is already logged in, modal stays hidden
});

// Close button handler (kept for later when we re-enable it)
document.getElementById("close-login").addEventListener("click", () => {
  document.getElementById("login-modal").style.display = "none";
});

// Login submit handler
document.getElementById("login-submit").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    document.getElementById("login-error").textContent = "Please fill in all fields";
    document.getElementById("login-error").style.display = "block";
    return;
  }

  try {
      const res = await fetch("https://webbshop-2026-be-g08.vercel.app/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem("token", data.token);
      const user = data.user || { email };
      localStorage.setItem("user", JSON.stringify(user));

      const profileName = document.getElementById("profile-name");
      const profileEmail = document.getElementById("profile-email");
      if (profileName && user.name) profileName.textContent = user.name;
      if (profileEmail && user.email) profileEmail.textContent = user.email;

      document.getElementById("login-modal").style.display = "none";
    }
    else {
      // Show the error message from the server
      document.getElementById("login-error").textContent = data.error || "Invalid email or password";
      document.getElementById("login-error").style.display = "block";
    }
  } catch (error) {
    document.getElementById("login-error").textContent = "Something went wrong, please try again";
    document.getElementById("login-error").style.display = "block";
  }
});