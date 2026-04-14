document.addEventListener("DOMContentLoaded", showRegister);

function showRegister(){
  document.querySelector(".modal-footer-text").addEventListener("click", () => {
    document.getElementById("login-modal").style.display = "none"
    document.getElementById("register-modal").style.display = "flex";

});
}

async function RegisterUser() {
  const name = document.getElementById("register-name").value;
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;

    const userData = {
        name: name,
        email: email,
        password: password,
    };
    try {
        const response = await fetch("https://webbshop-2026-be-g08.vercel.app/users", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });
        const result = await response.json();
        console.log(result);
    }
    catch (error) {
        console.error(error);
    }
}

const uploadUser = document.querySelector("#register-submit");
if (uploadUser) {
    uploadUser.addEventListener("click", RegisterUser);
  }