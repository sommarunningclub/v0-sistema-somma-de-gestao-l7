import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

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

async function run() {
  // 1. Create the 3 events
  const eventos = [
    {
      titulo: 'Somma Club — Edição #01',
      data_evento: '2026-03-07',
      checkin_status: 'encerrado',
      horario_inicio: '07:00',
      local: 'Parque da Cidade — Brasília, DF',
      pelotoes: ['4km', '6km', '8km'],
    },
    {
      titulo: 'Somma Club — Edição #02 de Março',
      data_evento: '2026-03-14',
      checkin_status: 'encerrado',
      horario_inicio: '07:00',
      local: 'Parque da Cidade — Brasília, DF',
      pelotoes: ['4km', '6km', '8km'],
    },
    {
      titulo: 'Somma Club — Edição #03 de Março',
      data_evento: '2026-03-21',
      checkin_status: 'bloqueado',
      horario_inicio: '07:00',
      local: 'Parque da Cidade — Brasília, DF',
      pelotoes: ['4km', '6km', '8km'],
    },
  ];

  console.log('Criando eventos...');
  const { data: created, error: createErr } = await supabase
    .from('eventos')
    .insert(eventos)
    .select();

  if (createErr) {
    console.log('ERRO ao criar eventos:', createErr.message);
    return;
  }

  for (const e of created) {
    console.log(`  ✓ ${e.titulo} (${e.data_evento}) — ${e.checkin_status} — id: ${e.id}`);
  }

  // 2. Link existing check-ins by matching data_do_evento
  console.log('\nVinculando check-ins existentes...');

  // Edição #01: data_do_evento = 2026-03-07
  const ev01 = created.find(e => e.data_evento === '2026-03-07');
  if (ev01) {
    const { count, error } = await supabase
      .from('checkins')
      .update({ evento_id: ev01.id })
      .eq('data_do_evento', '2026-03-07')
      .is('evento_id', null)
      .select('id', { count: 'exact', head: true });

    console.log(`  ✓ Edição #01: ${count || 0} check-ins vinculados ${error ? '(ERRO: ' + error.message + ')' : ''}`);
  }

  // Edição #02: data_do_evento = 2026-03-14
  const ev02 = created.find(e => e.data_evento === '2026-03-14');
  if (ev02) {
    const { count, error } = await supabase
      .from('checkins')
      .update({ evento_id: ev02.id })
      .eq('data_do_evento', '2026-03-14')
      .is('evento_id', null)
      .select('id', { count: 'exact', head: true });

    console.log(`  ✓ Edição #02: ${count || 0} check-ins vinculados ${error ? '(ERRO: ' + error.message + ')' : ''}`);
  }

  console.log('\nPronto!');
}

run().catch(e => console.error(e));
