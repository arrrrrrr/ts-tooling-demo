import baseConfig from '@local/eslint-config/config.mts';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    ...baseConfig,
    {
        languageOptions: {
            parserOptions: {
              ecmaVersion: 2024,
                project: [
                    './tsconfig.json',
                    './backend/tsconfig.json',
                    './config/*/tsconfig.json'
                ],
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
);
