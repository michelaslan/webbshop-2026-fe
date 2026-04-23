// get buttons and panels
const addPlantBtn = document.querySelector("#addPlantBtn");
const addPlantPanel = document.querySelector(".addPlant-panel");
const plantPanelClose = document.querySelector(".plantPanel-close");
const imageInput = document.getElementById("imageUpload");
const imageChosen = document.getElementById("image-chosen");

// show the add plant panel
function openAddPlantPanel() {
	if (!addPlantBtn || !addPlantPanel) return;
	addPlantBtn.addEventListener("click", () => {
		addPlantPanel.classList.add("open");
		addPlantPanel.setAttribute("aria-hidden", "false");
	});
}

// hide the add plant panel
function closeAddPlantPanelUi() {
	if (!plantPanelClose || !addPlantPanel) return;
	plantPanelClose.addEventListener("click", () => {
		addPlantPanel.classList.remove("open");
		addPlantPanel.setAttribute("aria-hidden", "true");
	});
}

// show "image chosen" if file picked
function bindImageSelectedIndicator() {
	if (!imageInput || !imageChosen) return;
	imageInput.addEventListener("change", () => {
		const hasFile = Boolean(imageInput.files && imageInput.files[0]);
		imageChosen.style.display = hasFile ? "inline" : "none";
	});
}

// for old code reloads plant list
window.loadMyPlants = function loadMyPlantsBridge() {
	window.dispatchEvent(new Event("auth-changed"));
};

openAddPlantPanel();
closeAddPlantPanelUi();
bindImageSelectedIndicator();
