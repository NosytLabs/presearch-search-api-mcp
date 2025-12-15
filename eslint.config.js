export default [
    {
        ignores: ["node_modules/**", "dist/**", "coverage/**"]
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off"
        }
    }
];
