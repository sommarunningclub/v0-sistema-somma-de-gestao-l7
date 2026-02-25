import { execSync } from 'child_process';
import path from 'path';

const projectPath = '/vercel/share/v0-project';
process.chdir(projectPath);

try {
  console.log('[v0] Restaurando arquivo original do git...');
  const result = execSync('git checkout app/pagamentos/clientes/page.tsx', {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  console.log('[v0] Resultado:', result);
  console.log('[v0] Arquivo restaurado com sucesso!');
} catch (error) {
  console.error('[v0] Erro ao restaurar:', error instanceof Error ? error.message : String(error));
}
