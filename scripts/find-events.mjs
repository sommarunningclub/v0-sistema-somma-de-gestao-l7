import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env.local manually
const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await supabase
  .from('checkins')
  .select('nome_do_evento, data_do_evento');

if (error) { console.log('ERRO:', error.message); process.exit(1); }

const eventos = {};
for (const c of data) {
  const key = (c.data_do_evento || 'sem-data') + '|' + (c.nome_do_evento || 'sem-nome');
  if (!eventos[key]) {
    eventos[key] = { nome: c.nome_do_evento, data: c.data_do_evento, count: 0 };
  }
  eventos[key].count++;
}

console.log('Eventos encontrados nos check-ins:');
console.log('─'.repeat(60));
Object.values(eventos)
  .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  .forEach(e => console.log(`${e.data}  |  ${e.nome}  |  ${e.count} check-ins`));
