const loginModal = document.getElementById("login-modal");
const registerModal = document.getElementById("register-modal");

document.addEventListener("DOMContentLoaded", showRegister);

function showRegister() {
    document.querySelector(".modal-footer-text").addEventListener("click", () => {
        loginModal.style.display = "none";
        registerModal.style.display = "flex";
    });
    const uploadUser = document.querySelector("#register-submit");
    if (uploadUser) {
        uploadUser.addEventListener("click", registerUser);
    }
}

["register-name", "register-email", "register-password"].forEach(id => {
    document.getElementById(id).addEventListener("input", clearRegisterError);
});

function clearRegisterError() {
    const el = document.getElementById("register-error");
    el.textContent = "";
    el.classList.add("hidden");
}

function showRegisterError(msg) {
    const el = document.getElementById("register-error");
    el.textContent = msg;
    el.classList.remove("hidden");
}

async function registerUser() {
    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;

    if (!name || !email || !password) {
        showRegisterError("Fyll i alla fält.");
        return;
    }

    const userData = { name, email, password };

    try {
        const response = await fetch("https://webbshop-2026-be-g08.vercel.app/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const result = await response.json();

        if (response.ok) {
            // Pre-store name so it survives into the first login (login response has no name)
            const existingUser = JSON.parse(localStorage.getItem("user") || "null");
            localStorage.setItem("user", JSON.stringify({ ...(existingUser || {}), name, email }));
            registerModal.style.display = "none";
            loginModal.style.display = "flex";
        } else {
            showRegisterError(result.error || "Registreringen misslyckades, försök igen.");
        }
    } catch (error) {
        showRegisterError("Kunde inte ansluta, försök igen.");
    }
}

function closeRegister() {
    const closeBtn = document.querySelector("#close-register");
    closeBtn.addEventListener("click", () => {
        registerModal.style.display = "none";
        loginModal.style.display = "flex";
    });
}

closeRegister();
