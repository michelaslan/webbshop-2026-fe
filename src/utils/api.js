
export function getBaseUrl() {
  if (window.location.hostname.includes("localhost")) {
    return "http://localhost:3000/";
  }
  // TODO: Add deployed backend URL
  return "https://your-backend.vercel.app/";
}
