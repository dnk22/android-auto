import { startMediaServer } from "./src/app.js";

startMediaServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
