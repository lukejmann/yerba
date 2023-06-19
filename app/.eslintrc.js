module.exports = {
	extends: [require.resolve('./config/eslint.js')],
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: './tsconfig.json'
	},
	ignorePatterns: ['tests/**/*']
};