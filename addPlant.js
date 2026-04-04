//Declarate
let addPlantBtn = document.querySelector("#addPlantBtn");
let addPlantPanel = document.querySelector(".addPlant-panel");
let plantPanelClose = document.querySelector(".plantPanel-close");
let plantTypeInput = document.querySelector("#plantTypeInput").value;
let lightLevelInput = document.querySelector("#LightLevelInput").value;


//Add plant panel: Open
function openAddPlantPanel (){
    if (addPlantBtn) {
        addPlantBtn.addEventListener("click", () => {
            if (!addPlantPanel) return;
            addPlantPanel.classList.add('open');
            addPlantPanel.setAttribute('aria-hidden', 'false');
        });
    }
}

//Add plant panel: Close
function closeAddPlantPanel (){
    if (plantPanelClose) {
        plantPanelClose.addEventListener("click", () => {
            if (!addPlantPanel) return;
            addPlantPanel.classList.remove('open');
            addPlantPanel.setAttribute('aria-hidden', 'true');
        });
    }
}

async function saveUserPost(){
    const userData = {
        plantType: plantTypeInput,
        lightLevel: lightLevelInput,
        address: currentAddress
    };
    try {
        const response = await fetch("http://localhost:3000/api/userposts", {
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

//Run functions
openAddPlantPanel();
closeAddPlantPanel();