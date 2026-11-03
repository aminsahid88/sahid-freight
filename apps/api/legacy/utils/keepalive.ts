import https from "https";

export const keepAlive = () => {
  setInterval(() => {
    https.get("https://sahid-freight-production.up.railway.app/health")
      .on("error", () => {});
  }, 4 * 60 * 1000); // ping every 4 minutes
};
