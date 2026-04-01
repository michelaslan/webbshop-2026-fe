let addPlantBtn = document.querySelector("#addPlantBtn");
let addPlantPanel = document.querySelector(".addPlant-panel");
let plantPanelClose = document.querySelector(".plantPanel-close");

if (addPlantBtn) {
    addPlantBtn.addEventListener("click", () => {
        if (!addPlantPanel) return;

        addPlantPanel.classList.add('open');
        addPlantPanel.setAttribute('aria-hidden', 'false');
    });
}

if (plantPanelClose) {
    plantPanelClose.addEventListener("click", () => {
        if (!addPlantPanel) return;

        addPlantPanel.classList.remove('open');
        addPlantPanel.setAttribute('aria-hidden', 'true');

    });
}