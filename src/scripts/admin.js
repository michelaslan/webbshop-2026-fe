const ADMIN_API_BASE = "https://webbshop-2026-be-g08.vercel.app";

let adminRefreshTimer = null;

function getAdminToken() {
  return localStorage.getItem("token") || "";
}

function getCurrentStoredUserRaw() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (error) {
    return null;
  }
}

function safeAdminText(value) {
  const safeValue = value === null || value === undefined ? "" : value;
  return String(safeValue)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function lightLabel(value) {
  const normalized = String(value || "2").trim();
  if (normalized === "1") return "Low Light";
  if (normalized === "3") return "Extreme Light";
  return "Normal Light";
}

function normalizeOwnerId(owner) {
  if (!owner) return "";
  if (typeof owner === "string" || typeof owner === "number") return String(owner);
  if (typeof owner === "object") {
    if (owner._id !== undefined && owner._id !== null) return String(owner._id);
    if (owner.id !== undefined && owner.id !== null) return String(owner.id);
    if (owner.userId !== undefined && owner.userId !== null) return String(owner.userId);
  }
  return "";
}

function normalizeOwnerName(owner) {
  if (owner && typeof owner === "object" && owner.name) {
    return String(owner.name).trim();
  }
  return "";
}

function normalizePlantForAdmin(plant) {
  const id = String((plant && (plant._id || plant.id)) || "");
  const ownerId = normalizeOwnerId(plant && plant.owner);
  const ownerName = normalizeOwnerName(plant && plant.owner);
  return {
    id,
    ownerId,
    ownerName,
    name: String((plant && plant.name) || "Växt"),
    imageUrl: String((plant && plant.imageUrl) || ""),
    lightLevel: String((plant && plant.lightLevel) || "2"),
    description: String((plant && plant.description) || ""),
  };
}

async function fetchRoleFromDatabase(token) {
  if (!token) return "";
  try {
    const response = await fetch(`${ADMIN_API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return "";
    const data = await response.json();
    const user = (data && data.user) || (data && data.data && data.data.user) || null;
    const role = user && user.role ? String(user.role).trim().toLowerCase() : "";

    const storedUser = getCurrentStoredUserRaw() || {};
    if (role) {
      localStorage.setItem("user", JSON.stringify({ ...storedUser, role }));
      sessionStorage.setItem("user", JSON.stringify({ ...storedUser, role }));
    }
    return role;
  } catch (error) {
    return "";
  }
}

async function isCurrentUserAdminFromDatabase() {
  const token = getAdminToken();
  if (!token) return false;
  const storedUser = getCurrentStoredUserRaw();
  const storedRole = storedUser && storedUser.role ? String(storedUser.role).trim().toLowerCase() : "";
  if (storedRole === "admin") return true;
  const roleFromDb = await fetchRoleFromDatabase(token);
  return roleFromDb === "admin";
}

async function fetchAllPlantsForAdmin() {
  try {
    const response = await fetch(`${ADMIN_API_BASE}/plants`);
    if (!response.ok) return [];
    const payload = await response.json();
    if (!Array.isArray(payload)) return [];
    return payload.map(normalizePlantForAdmin).filter((plant) => plant.id);
  } catch (e) {
    return [];
  }
}

function ensureAdminListContainer() {
return document.getElementById("admin-plants-list");
}

function renderAdminOverview(plants) {
  const postsList = ensureAdminListContainer();
  if (!postsList) {
    console.error("Kunde inte hitta #admin-plants-list i HTML");
    return;
  }

  postsList.innerHTML = "";
  if (!Array.isArray(plants) || plants.length === 0) {
    postsList.innerHTML = `<li class="profile-post-item"><span>Det finns inga posts att visa.</span></li>`;
    return;
  }

  const groups = new Map();
  plants.forEach((plant) => {
    const ownerId = String(plant.ownerId || "");
    if (!groups.has(ownerId)) groups.set(ownerId, []);
    groups.get(ownerId).push(plant);
  });
groups.forEach((ownerPlants, ownerId) => {
    const first = ownerPlants[0] || {};
    const ownerName = first.ownerName || `Användare ${ownerId.slice(-5)}`;
    
    // Skapa en rubrik för varje användares växter
    const titleItem = document.createElement("li");
    titleItem.className = "admin-user-group-title";
    titleItem.innerHTML = `<strong>Växter tillhörande: ${safeAdminText(ownerName)}</strong>`;
    postsList.append(titleItem);

    ownerPlants.forEach((plant) => {
      const item = document.createElement("li");
      item.className = "profile-post-item"; // Behåll din CSS-klass
      item.innerHTML = `
        <div class="postDiv-profile">
          ${plant.imageUrl ? `<img src="${safeAdminText(plant.imageUrl)}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;"/>` : ""}
          <div>
            <p><strong>${safeAdminText(plant.name)}</strong></p>
            <small>${safeAdminText(lightLabel(plant.lightLevel))}</small>
          </div>
        </div>
        <div class="profile-post-actions">
          <button class="profile-post-edit" data-admin-edit-plant="${plant.id}">Redigera</button>
          <button class="profile-post-delete" data-admin-delete-plant="${plant.id}">Ta bort</button>
        </div>
      `;
      postsList.append(item);
    });
  });

  bindAdminButtons(plants);
}

async function fetchAllUsers() {
  try {
    const token = getAdminToken();
    const res = await fetch(`${ADMIN_API_BASE}/auth/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function fetchAllTradesAdmin() {
	const token = getAdminToken();
	if (!token) return [];

	const headers = {
		Authorization: `Bearer ${token}`,
	};

	try {
		const res = await fetch(`${ADMIN_API_BASE}/trades`, { headers });

		if (!res.ok) return [];

		const data = await res.json();
		return Array.isArray(data) ? data : [];
	} catch (err) {
		console.error("fetchAllTradesAdmin error:", err);
		return [];
	}
}

function bindUserActions() {
  document.querySelectorAll("[data-promote]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const userId = btn.getAttribute("data-promote");
      const res = await fetch(`${ADMIN_API_BASE}/auth/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAdminToken()}`
        },
        body: JSON.stringify({ role: "admin" })
      });
      if (res.ok) {
        alert("User is now admin");
        refreshAdminDashboard();
      }
    });
  });
}

function renderUsers(users) {
  const list = document.getElementById("admin-users-list");
  if (!list) return;
  list.innerHTML = "";
  if (!users.length) {
    list.innerHTML = "<li>Inga användare</li>";
    return;
  }
  users.forEach(user => {
    const li = document.createElement("li");
    li.className = "admin-user-item";
    li.innerHTML = `
      <div>
        <strong>${safeAdminText(user.name)}</strong>
        <p>${safeAdminText(user.email)}</p>
        <small>Roll: ${safeAdminText(user.role)}</small>
      </div>
      <button data-promote="${user._id}">Gör admin</button>
    `;
    list.appendChild(li);
  });
  bindUserActions();
}

async function deleteTrade(tradeId) {
    if (!confirm("Vill du verkligen radera denna trade från historiken permanent?")) return;
    
    try {
        const res = await fetch(`${ADMIN_API_BASE}/trades/${tradeId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getAdminToken()}` }
        });
        
        if (res.ok) {
            refreshAdminDashboard(); // Uppdatera listan
        } else {
            alert("Kunde inte radera trade. Försök igen." + (res.statusText ? ` (${res.statusText})` : ""));
        }
    } catch (err) {
        console.error("Delete trade error:", err);
    }
}

function renderTrade(trades, allPlants, allUsers) {
  const list = document.getElementById("admin-trades-list");
  if (!list) return;

  list.innerHTML = "";
  if (!trades || trades.length === 0) {
    list.innerHTML = "<p>Inga trades hittades i systemet.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "admin-trades-list";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Status</th>
        <th>Från</th>
        <th>Till</th>
        <th>Erbjuden</th>
        <th>Efterfrågad</th>
        <th>Åtgärder</th>
      </tr>
    </thead>
    <tbody id="trade-body"></tbody>
  `;
  list.appendChild(table);

  const tbody = document.getElementById("trade-body");

  trades.forEach(trade => {
    const requesterId = trade.requester?._id || trade.requester?.id || trade.requester;
    const receiverId  = trade.receiver?._id || trade.receiver?.id || trade.receiver;
    const requester = allUsers.find(u => String(u._id) === String(requesterId));
    const receiver  = allUsers.find(u => String(u._id) === String(receiverId));
    const offeredId = trade.offeredPlant?._id || trade.offeredPlant?.id || trade.offeredPlant;
    const requestedId = trade.requestedPlant?._id || trade.requestedPlant?.id || trade.requestedPlant;
    const offered = allPlants.find(p => String(p.id) === String(offeredId));
    const requested = allPlants.find(p => String(p.id) === String(requestedId));
    
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="status-badge ${trade.status}">${safeAdminText(trade.status)}</span></td>
      <td>${safeAdminText(requester ? requester.name : "Okänd")}</td>
      <td>${safeAdminText(receiver ? receiver.name : "Okänd")}</td>
      <td>${safeAdminText(offered ? offered.name : "Borttagen")}</td>
      <td>${safeAdminText(requested ? requested.name : "Borttagen")}</td>
      <td>
        <button class="profile-post-delete" data-delete-trade="${trade._id}">Radera</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // VIKTIGT: Bind knapparna HÄR, utanför loopen
  list.querySelectorAll("[data-delete-trade]").forEach(btn => {
    btn.onclick = (e) => {
      const id = btn.getAttribute("data-delete-trade");
      deleteTrade(id);
    };
  });
}

async function editPlantAsAdmin(plantId, plants) {
  const token = getAdminToken();
  if (!token) return alert("Du måste vara inloggad.");
  const target = plants.find((plant) => plant.id === plantId);
  if (!target) return;
  const nextDescription = prompt("Ny beskrivning:", target.description || "");
  if (nextDescription === null) return;
  const response = await fetch(`${ADMIN_API_BASE}/plants/${plantId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ description: String(nextDescription || "").trim() }),
  });
  if (response.ok) {
    window.dispatchEvent(new Event("auth-changed"));
    await refreshAdminDashboard();
  }
}

async function deletePlantAsAdmin(plantId) {
  const token = getAdminToken();
  if (!token) return alert("Du måste vara inloggad.");
  if (!confirm("Är du säker på att du vill ta bort posten?")) return;
  const response = await fetch(`${ADMIN_API_BASE}/plants/${plantId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.ok) {
    window.dispatchEvent(new Event("auth-changed"));
    await refreshAdminDashboard();
  }
}


function bindAdminButtons(plants) {
  const postsList = ensureAdminListContainer();
  if (!postsList) return;
  postsList.querySelectorAll("[data-admin-edit-plant]").forEach((button) => {
    button.addEventListener("click", () => editPlantAsAdmin(button.getAttribute("data-admin-edit-plant"), plants));
  });
  postsList.querySelectorAll("[data-admin-delete-plant]").forEach((button) => {
    button.addEventListener("click", () => deletePlantAsAdmin(button.getAttribute("data-admin-delete-plant")));
  });
}

async function refreshAdminDashboard() {
  const isAdmin = await isCurrentUserAdminFromDatabase();
  const adminBtn = document.getElementById("openAdmin");
  const panel = document.getElementById("admin-panel");

  if (isAdmin && adminBtn) {
    adminBtn.classList.remove("hidden");
  }

  if (!isAdmin) {
    if (panel) panel.classList.remove("open");
    return;
  }

  try {
    const [plants, users, trades] = await Promise.all([
      fetchAllPlantsForAdmin(),
      fetchAllUsers(),
      fetchAllTradesAdmin(),
    ]);
    renderAdminOverview(plants);
    renderUsers(users);
    renderTrade(trades, plants, users);
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

async function initAdminOverview() {
  const isAdmin = await isCurrentUserAdminFromDatabase();
  if (!isAdmin) return;
  if (adminRefreshTimer) clearInterval(adminRefreshTimer);
  adminRefreshTimer = setInterval(refreshAdminDashboard, 15000);
  refreshAdminDashboard();
}

window.addEventListener("load", () => {
  const adminBtn = document.getElementById("openAdmin");
  const adminPanel = document.getElementById("admin-panel");

  adminBtn?.addEventListener("click", () => {
    if (adminPanel) {
      adminPanel.classList.add("open");
      adminPanel.classList.remove("hidden"); // Viktigt!
      refreshAdminDashboard();
    }
  });

  document.getElementById("closeAdminPanel")?.addEventListener("click", () => {
    adminPanel?.classList.remove("open");
    adminPanel?.classList.add("hidden");
  });

  initAdminOverview();
});

window.addEventListener("auth-changed", initAdminOverview);