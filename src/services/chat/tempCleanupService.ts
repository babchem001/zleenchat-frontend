import { 
    cleanupTempDirectory,
    cleanupOldFiles,
 } from "./mediaCleanup";

export const runStartupCleanup = async () => {
  try {
    console.log("Running startup cleanup...");
    await cleanupTempDirectory();
    await cleanupOldFiles(24); // Cleanup files older than 24 hours
    console.log("Startup cleanup complete.");
  } catch (error) {
    console.error("Startup cleanup failed:", error);
  }
};
