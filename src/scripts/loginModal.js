window.addEventListener("load", () => {
  initializeAuthUi();
});

async function initializeAuthUi() {
  const token = localStorage.getItem("token");
  if (!token) {
    document.getElementById("login-modal").style.display = "flex";
    return;
  }

  await syncCurrentUserFromDatabase(token);
  window.dispatchEvent(new Event("auth-changed"));
}

function applyUserToProfileUi(user) {
  const profileName = document.getElementById("profile-name");
  const profileEmail = document.getElementById("profile-email");
  if (profileName && user && user.name) profileName.textContent = user.name;
  if (profileEmail && user && user.email) profileEmail.textContent = user.email;
}

function storeUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
  sessionStorage.setItem("user", JSON.stringify(user));
}

function normalizeUserResponse(payload, fallback) {
  const base = fallback || {};
  const user = payload && payload.user ? payload.user : payload;
  if (!user || typeof user !== "object") {
    return { ...base };
  }

  return {
    ...base,
    ...user,
    name: user.name || base.name || "Du",
    email: user.email || base.email || "",
  };
}

async function syncCurrentUserFromDatabase(token) {
  const existingUser = JSON.parse(localStorage.getItem("user") || "null");

  try {
    const meResponse = await fetch("https://webbshop-2026-be-g08.vercel.app/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!meResponse.ok) {
      if (existingUser) {
        applyUserToProfileUi(existingUser);
      }
      return existingUser;
    }

    const meData = await meResponse.json();
    const user = normalizeUserResponse(meData, existingUser || undefined);
    storeUser(user);
    applyUserToProfileUi(user);
    return user;
  } catch (error) {
    if (existingUser) {
      applyUserToProfileUi(existingUser);
    }
    return existingUser;
  }
}

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
      localStorage.setItem("token", data.token);
      const existingUser = JSON.parse(localStorage.getItem("user") || "null");
      const fallbackUser = normalizeUserResponse(data.user || { email }, existingUser || undefined);
      storeUser(fallbackUser);
      applyUserToProfileUi(fallbackUser);

      // Fetch the canonical profile after login so name/email reflect current database values.
      await syncCurrentUserFromDatabase(data.token);

      document.getElementById("login-modal").style.display = "none";
      window.dispatchEvent(new Event("auth-changed"));
    } else {
      showLoginError(data.error || "Fel e-post eller lösenord.");
    }
  } catch (error) {
    showLoginError("Kunde inte ansluta, försök igen.");
  }
});
