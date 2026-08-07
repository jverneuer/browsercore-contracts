import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary", "html"],
            thresholds: {
                statements: 94,
                branches: 94,
                functions: 94,
                lines: 94,
            },
        },
    },
});
