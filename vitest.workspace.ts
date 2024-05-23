import tsconfigPaths from "vite-tsconfig-paths"
// eslint-disable-next-line import/no-unresolved
import { defineWorkspace } from "vitest/config"

export default defineWorkspace([
  {
    plugins: [tsconfigPaths()],
    test: {
      name: "server",
      root: "./server",
      include: ["./tests/**/*.test.ts", "**/*.test.ts"],
      setupFiles: ["./tests/utils/setup.ts"],
      globalSetup: ["./server/tests/utils/globalSetup.ts"],
      // Isolate doesn't work with Mongoose
      isolate: false,
      // poolOptions: {
      //   threads: {
      //     singleThread: true,
      //   },
      // },
    },
  },
  {
    test: {
      name: "ui",
      root: "./ui",
      include: ["./**/*.test.(js|jsx)"],
      setupFiles: ["./tests/setup.ts"],
    },
  },
  {
    test: {
      name: "shared",
      root: "./shared",
      include: ["**/*.test.ts"],
    },
  },
])
