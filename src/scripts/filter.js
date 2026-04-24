const filterBtn = document.getElementById("filterBtn");
const filterPanel = document.querySelector(".filter-panel");
const filterClose = document.querySelector(".filter-panel-close");
const applyFilter = document.getElementById("applyFilter");
const clearFilter = document.getElementById("clearFilter");
const FILTER_API_BASE = "https://webbshop-2026-be-g08.vercel.app";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// Open/close filter panel
if (filterBtn && filterPanel) {
  filterBtn.addEventListener("click", () => {
    filterPanel.classList.toggle("open");
  });
}

if (filterClose && filterPanel) {
  filterClose.addEventListener("click", () => {
    filterPanel.classList.remove("open");
  });
}

// Apply filter — fetches plants from backend with filters and triggers map update
if (applyFilter && filterPanel) applyFilter.addEventListener("click", async () => {
  const checkedNames = document.querySelectorAll(".filter-checkbox-item input[data-type='name']:checked");
  const checkedLevels = document.querySelectorAll(".filter-checkbox-item input[data-type='light']:checked");
  
  const selectedNames = Array.from(checkedNames).map(cb => cb.value);
  const selectedLevels = Array.from(checkedLevels).map(cb => cb.value);

  const params = new URLSearchParams();
  selectedNames.forEach(name => params.append("name", name));
  selectedLevels.forEach(level => params.append("lightLevel", level));

  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${FILTER_API_BASE}/plants?${params.toString()}`, { headers });
    const plants = await res.json();
    window.dispatchEvent(new CustomEvent("plantsFiltered", { detail: plants }));
  } catch (error) {
    console.error("Filter error:", error);
  } finally {
    filterPanel.classList.remove("open");
  }
});

// Clear filter — fetches all plants and resets the dropdowns
if (clearFilter && filterPanel) clearFilter.addEventListener("click", async () => {
  document.querySelectorAll(".filter-checkbox-item input").forEach(cb => cb.checked = false);

  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${FILTER_API_BASE}/plants`, { headers });
    const plants = await res.json();
    window.dispatchEvent(new CustomEvent("plantsFiltered", { detail: plants }));
  } catch (error) {
    console.error("Clear filter error:", error);
  } finally {
    filterPanel.classList.remove("open");
  }
});