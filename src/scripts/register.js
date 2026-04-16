const loginModal = document.getElementById("login-modal");
const registerModal = document.getElementById("register-modal");

document.addEventListener("DOMContentLoaded", showRegister);

function showRegister(){
    document.querySelector(".modal-footer-text").addEventListener("click", () => {
        loginModal.style.display = "none"
        registerModal.style.display = "flex";
});
    const uploadUser = document.querySelector("#register-submit");
    if (uploadUser) {
        uploadUser.addEventListener("click", registerUser);
    }
}

async function registerUser() {
  const name = document.getElementById("register-name").value;
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;

    const userData = {
        name: name,
        email: email,
        password: password,
    };
    try {
        const response = await fetch("https://webbshop-2026-be-g08.vercel.app/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });
        const result = await response.json();
        console.log(userData);
        console.log(result);

        if (response.ok) {
            registerModal.style.display = "none";
            loginModal.style.display = "flex";
        } else {
            console.error("Registration failed:", result);
        }
    }
    catch (error) {
        console.error(error);
    }
}

function closeRegister(){
    const closeBtn = document.querySelector("#close-register");
    closeBtn.addEventListener("click", () => {
        registerModal.style.display = "none";
        loginModal.style.display = "flex";
    });
}

closeRegister();