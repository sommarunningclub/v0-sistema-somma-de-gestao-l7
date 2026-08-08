import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const config = [
  {
    ignores: [
      '.next/**',
      '.claude/**',
      'node_modules/**',
      'public/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // O painel exibe imagens vindas de CDNs externas e de upload do usuário;
      // `next/image` exige configuração de domínio que não vale a troca aqui.
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config
