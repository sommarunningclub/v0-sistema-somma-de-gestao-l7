#!/usr/bin/env python3
import subprocess
import os

os.chdir('/vercel/share/v0-project')

try:
    print('[v0] Restaurando arquivo original do git...')
    result = subprocess.run(
        ['git', 'checkout', 'app/pagamentos/clientes/page.tsx'],
        capture_output=True,
        text=True,
        check=True
    )
    print('[v0] Stdout:', result.stdout)
    print('[v0] Arquivo restaurado com sucesso!')
except subprocess.CalledProcessError as e:
    print(f'[v0] Erro ao restaurar: {e.stderr}')
except Exception as e:
    print(f'[v0] Erro: {str(e)}')
