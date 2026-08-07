import { defineConfig } from "oxlint";

export default defineConfig({
    plugins: ["typescript", "unicorn", "import"],
    env: {
        node: true,
    },
    categories: {
        correctness: "error",
        suspicious: "error",
        pedantic: "error",
        style: "off",
    },
    rules: {
        "no-console": "warn",
        "no-debugger": "error",
        eqeqeq: "error",
        "no-var": "error",
        "prefer-const": "error",
        "object-shorthand": "error",
        curly: "error",
        "no-unreachable": "error",
        "no-constant-condition": "error",
        "no-self-compare": "error",
        "typescript/no-explicit-any": "error",
        "typescript/no-non-null-assertion": "error",
        "typescript/no-namespace": "error",
        "typescript/consistent-type-imports": "error",
        "typescript/ban-ts-comment": "error",
        "unicorn/prefer-node-protocol": "error",
        "unicorn/no-process-exit": "error",
        "import/no-cycle": "error",
        "import/no-duplicates": "error",
        "import/no-self-import": "error",
        // Interface parameters can't be readonly in contract definitions
        "prefer-readonly-parameter-types": "off",
        // contracts.ts re-exports everything — file length is intentional
        "max-lines": "off",
        "max-lines-per-function": "off",
        "max-classes-per-file": "off",
        "no-inline-comments": "off",
        // Duplicate imports are resolved by fixing the source, not disabling
        "no-duplicate-imports": "error",
        "no-useless-constructor": "error",
        "no-template-curly-in-string": "error",
        "no-unneeded-ternary": "error",
    },
    ignorePatterns: ["dist", "coverage", "node_modules"],
});
