import js from "@eslint/js"
import tseslint from "typescript-eslint"
import svelte from "eslint-plugin-svelte"
import prettier from "eslint-config-prettier"
import globals from "globals"

export default tseslint.config(
	{
		ignores: [
			"node_modules/",
			"build/",
			"dist/",
			".svelte-kit/",
			"out/",
			"coverage/",
			"drizzle/migrations/",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs["flat/recommended"],
	prettier,
	...svelte.configs["flat/prettier"],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-empty-object-type": "off",
		},
	},
	{
		files: ["**/*.svelte"],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},
)
