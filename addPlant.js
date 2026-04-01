let addPlantBtn = document.querySelector("#addPlantBtn");
let addPlantPanel = document.querySelector(".addPlant-panel");

if (addPlantBtn) {
    addPlantBtn.addEventListener("click", () => {
        if (!addPlantPanel) return;

        addPlantPanel.classList.add('open');
        addPlantPanel.setAttribute('aria-hidden', 'false');
    });
}