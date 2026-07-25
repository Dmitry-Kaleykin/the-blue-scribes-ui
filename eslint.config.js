import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';

export default typescriptEslint.config(
	{
		ignores: ['coverage', 'dist', 'dist-server', 'node_modules', '*.d.ts'],
	},
	{
		extends: [
			eslint.configs.recommended,
			...typescriptEslint.configs.recommended,
			...eslintPluginVue.configs['flat/essential'],
		],
		files: ['**/*.{ts,vue}'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: globals['shared-node-browser'],
			parserOptions: {
				parser: typescriptEslint.parser,
			},
		},
		rules: {
			'vue/block-order': [
				'error',
				{
					order: ['template', 'script', 'style'],
				},
			],
		},
	},
	eslintConfigPrettier,
	{
		rules: {
			curly: ['error', 'all'],
		},
	},
);
