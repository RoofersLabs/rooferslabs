import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    // Test runner hygiene.
    //
    // Jest supplies describe/it/expect as globals. When the editor's language
    // server goes stale — anything that recreates node_modules under an open
    // window, `npm ci` included — it stops resolving @types/jest and reports
    // every one of them as undefined. The quick fixes it then offers are both
    // wrong and destructive: "add import from 'node:test'" pulls in a different
    // runner whose `it` is not Jest's and which has no `expect` at all, and
    // "create function 'expect'" writes a local stub that silently shadows the
    // real matcher, so `expect(x).toBe(y)` stops asserting anything.
    //
    // Both have landed in this repo. Neither is something anyone would type on
    // purpose, and both are invisible in review — hence a lint rule rather than
    // a note. `npm test` and `npm run typecheck` also catch them, but only
    // after the damage is already committed.
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:test',
              message:
                "This project's tests run on Jest, whose describe/it/expect are globals — do not import a second runner. If the editor says they are undefined, it is the language server: Command Palette → 'TypeScript: Restart TS Server'.",
            },
          ],
        },
      ],
    },
  },
);
