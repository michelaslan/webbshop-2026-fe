document.addEventListener("DOMContentLoaded", initRegister);

function initRegister() {
  const registerForm = document.getElementById("registerForm");

  registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleRegister();
  });
}

function handleRegister() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // TODO: Call register API when backend is ready
  console.log("Register:", { name, email });
  alert("Registration functionality not implemented yet");
}
