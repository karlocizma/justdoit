import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "justdoit",
  dirs: ["./jobs"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
    },
  },
});
