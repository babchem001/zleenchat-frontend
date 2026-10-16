// import { processPendingJobs } from "./mediaWorker";

// let isRunning = false;
// export const startWorker = () => {
//   if (isRunning) {
//     return;
//   }
//   isRunning = true;
//   runLoop();
// };

// const runLoop = async () => {
//   while (true) {
//     try {
//       await processPendingJobs();
//     } catch (error) {
//       console.log("Worker loop error:", error);
//     }
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//   }
// };

import { processPendingJobs } from "./mediaWorker";
import { useAuthStore } from "../store/auth/authStorage";

let isRunning = false;

export const startWorker = () => {
  if (isRunning) {
    return;
  }

  isRunning = true;
  void runLoop();
};

const runLoop = async () => {
  while (true) {
    try {
      const authState = useAuthStore.getState();
      if (authState.isHydrated && authState.isAuthenticated) {
        await processPendingJobs();
      }
    } catch (error) {
      console.log("Worker loop error:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};