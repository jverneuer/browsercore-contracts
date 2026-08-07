import { defineConfig } from "oxlint";

export default defineConfig({
    categories: {
        correctness: "error",
        suspicious: "error",
        pedantic: "error",
        style: "off",
    },
    typescript: {
        typeAware: true,
    },
});
