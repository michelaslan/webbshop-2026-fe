window.addEventListener("load", () => {
  const token = sessionStorage.getItem("token");
  if (!token) {
    document.getElementById("login-modal").style.display = "flex";
  } else {
    setTimeout(() => loadMyPlants(), 500);
  }
});

document.getElementById("login-email").addEventListener("input", clearLoginError);
document.getElementById("login-password").addEventListener("input", clearLoginError);

function clearLoginError() {
  const el = document.getElementById("login-error");
  el.textContent = "";
  el.classList.add("hidden");
}

function showLoginError(msg) {
  const el = document.getElementById("login-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

document.getElementById("login-submit").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showLoginError("Fyll i e-post och lösenord.");
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
      sessionStorage.setItem("token", data.token);
      const user = data.user || { email };
      sessionStorage.setItem("user", JSON.stringify(user));

      const profileName = document.getElementById("profile-name");
      const profileEmail = document.getElementById("profile-email");
      if (profileName && user.name) profileName.textContent = user.name;
      if (profileEmail && user.email) profileEmail.textContent = user.email;

      document.getElementById("login-modal").style.display = "none";
      setTimeout(() => loadMyPlants(), 500);
    } else {
      showLoginError(data.error || "Fel e-post eller lösenord.");
    }
  } catch (error) {
    showLoginError("Kunde inte ansluta, försök igen.");
  }
});
