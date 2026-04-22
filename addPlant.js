const addPlantBtn = document.querySelector("#addPlantBtn");
const addPlantPanel = document.querySelector(".addPlant-panel");
const plantPanelClose = document.querySelector(".plantPanel-close");

function openAddPlantPanel (){
    if (addPlantBtn) {
        addPlantBtn.addEventListener("click", () => {
            if (!addPlantPanel) return;
            addPlantPanel.classList.add('open');
            addPlantPanel.setAttribute('aria-hidden', 'false');
});
    }
}

function closeAddPlantPanel (){
    if (plantPanelClose) {
        plantPanelClose.addEventListener("click", () => {
            if (!addPlantPanel) return;
            addPlantPanel.classList.remove('open');
            addPlantPanel.setAttribute('aria-hidden', 'true');
        });
    }
}

function lightLabel(level) {
    const map = { 1: "Low Light", 2: "Day Light", 3: "Extreme Light" };
    return map[Number(level)] || level;
}

document.getElementById("imageUpload").addEventListener("change", () => {
    const file = document.getElementById("imageUpload").files[0];
    const label = document.getElementById("image-chosen");
    if (label) label.style.display = file ? "inline" : "none";
});

function addMarkerToMap(plant) {
    const lat = plant.location?.coordinates?.lat;
    const lng = plant.location?.coordinates?.lng;
    if (!lat || !lng) return;

    const popupContent = `
        <div class="popupDiv">
            <p>Plant: ${plant.name}</p><br>
            <p>Light: ${lightLabel(plant.lightLevel)}</p><br>
            <p>Address: ${plant.location?.address || ""}</p><br>
            <img src="${plant.imageUrl}" style="max-width:150px"/>
        </div>
    `;
    L.marker([lat, lng])
        .addTo(map)
        .bindPopup(popupContent);
}

function addPostToProfile(plant) {
    const myPosts = document.querySelector("#myPosts");
    if (!myPosts) return;
    const post = document.createElement("li");
    post.innerHTML = `
        <div class="postDiv-profile">
            <img src="${plant.imageUrl}" style="max-width:80px"/>
            <p>${plant.name}</p>
        </div>
    `;
    myPosts.appendChild(post);
}

async function loadMyPlants() {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    const myPosts = document.querySelector("#myPosts");
    if (myPosts) myPosts.innerHTML = "";

    try {
        const res = await fetch("https://webbshop-2026-be-g08.vercel.app/plants/mine", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        const plants = await res.json();
        if (!Array.isArray(plants)) return;

        plants.forEach(plant => {
            addMarkerToMap(plant);
            addPostToProfile(plant);
        });
    } catch (err) {
        console.error("Failed to load user plants:", err);
    }
}

async function uploadImageToImgBB(file) {
    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch("https://api.imgbb.com/1/upload?key=331073604ea81cda0e079535d9847ea5", {
        method: "POST",
        body: formData
    });
    const data = await res.json();
    return data.data.url;
}

async function saveUserPost() {
    const plantTypeInput = document.querySelector("#plantTypeInput").value;
    const lightLevelInput = parseInt(document.querySelector("#LightLevelInput").value);
    const imageFile = document.getElementById("imageUpload").files[0];
    const latlng = marker.getLatLng();

    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`);
    const geoData = await geoRes.json();
    const addr = geoData.address || {};
    const street = [addr.road || addr.pedestrian || "", addr.house_number || ""].filter(Boolean).join(" ");
    const city = addr.city || addr.town || addr.village || addr.municipality || "";
    const country = addr.country || "";
    const currentAddress = [street, city, country].filter(Boolean).join(", ");

    const token = sessionStorage.getItem("token");
    const user = JSON.parse(sessionStorage.getItem("user"));

    let imageUrl = "https://placehold.co/300x200?text=No+Image";
    if (imageFile) {
        imageUrl = await uploadImageToImgBB(imageFile);
    }

    const plantData = {
        name: plantTypeInput,
        species: plantTypeInput,
        description: "",
        imageUrl: imageUrl,
        lightLevel: lightLevelInput,
        location: {
            coordinates: {
                lat: latlng.lat,
                lng: latlng.lng
            },
            address: currentAddress
        }
    };

    try {
        const response = await fetch("https://webbshop-2026-be-g08.vercel.app/plants", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(plantData)
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("Failed to save plant:", result);
            return;
        }

        console.log("Plant saved:", result);
        addMarkerToMap(result);
        addPostToProfile(result);

        document.getElementById("imageUpload").value = "";
        const imageLabel = document.getElementById("image-chosen");
        if (imageLabel) imageLabel.style.display = "none";

        const successMsg = document.getElementById("post-success");
        if (successMsg) {
            successMsg.style.display = "block";
            setTimeout(() => { successMsg.style.display = "none"; }, 3000);
        }
    } catch (error) {
        console.error("Error saving plant:", error);
    }
}

openAddPlantPanel();
closeAddPlantPanel();

const uploadBtn = document.querySelector("#upload");
if (uploadBtn) {
    uploadBtn.addEventListener("click", saveUserPost);
}

