//Declarate
const addPlantBtn = document.querySelector("#addPlantBtn");
const addPlantPanel = document.querySelector(".addPlant-panel");
const plantPanelClose = document.querySelector(".plantPanel-close");

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

//Convert uploaded image to a string
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function saveUserPost(){
    const plantTypeInput = document.querySelector("#plantTypeInput").value;
    const lightLevelInput = document.querySelector("#LightLevelInput").value;
    const imageFile = document.getElementById("imageUpload").files[0];
    const imageBase64 = imageFile ? await toBase64(imageFile) : null;
    const latlng = marker.getLatLng();
    const myPosts = document.querySelector("#myPosts");

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`);
    const data = await response.json();
    const currentAddress = data.display_name;

    const userData = {
        owner: 123,
        name: plantTypeInput,
        lightLevel: lightLevelInput,
        address: currentAddress,
        imageUrl: imageBase64
    };
    try {
        const response = await fetch("https://webbshop-2026-be-g08.vercel.app/plants", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });
        const result = await response.json();
        console.log(result);

        const popupContent = `
            <div class="popupDiv">
                <p>Plant: ${plantTypeInput}</p><br>
                <p>Light: ${lightLevelInput}</p><br>
                <p>Address: ${currentAddress}</p><br>
                ${imageBase64 ? `<img src="${imageBase64}"/>` : ""}
            </div>
        `;

        L.marker(latlng)
            .addTo(map)
            .bindPopup(popupContent)
            .openPopup();

        const post = document.createElement("li");
        post.innerHTML = `
            <div class="postDiv-profile">
                ${imageBase64 ? `<img src="${imageBase64}"/>` : ""}
                <p>${plantTypeInput}</p>
            </div>
        `
        myPosts.append(post);
    }
    catch (error) {
        console.error(error);
    }
}

//Run functions
openAddPlantPanel();
closeAddPlantPanel();

const uploadBtn = document.querySelector("#upload");
if (uploadBtn) {
    uploadBtn.addEventListener("click", saveUserPost);
}
