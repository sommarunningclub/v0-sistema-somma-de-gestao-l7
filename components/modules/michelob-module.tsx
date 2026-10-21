'use client'

import { Beer, ExternalLink, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, PageShell, Panel, PanelHeader } from '@/components/somma'

const PAINEL_MICHELOB = 'https://projeto-michelob-2026.vercel.app/michelob/admin'

/**
 * Módulo Michelob Ultra × Somma Club.
 *
 * O painel do Michelob roda em outro projeto, mas entra com os usuários daqui:
 * mesmo e-mail e senha. Esta permissão ("michelob") é o que libera o acesso lá.
 * Admin entra sempre. A conferência é feita pelas funções de michelob_ponte no banco.
 */
export function MichelobModule() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Parcerias"
        title="Michelob Ultra"
        description="Lista VIP, Ultra Pass, check-in e o Michelob Ultra Segment. O painel abre em outra aba e usa o mesmo e-mail e senha deste admin."
        primaryAction={
          <Button asChild>
            <a href={PAINEL_MICHELOB} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir painel Michelob
            </a>
          </Button>
        }
      />

      <Panel className="mb-4">
        <PanelHeader icon={ShieldCheck} title="Quem acessa" />
        <div className="space-y-2 p-4 text-sm text-ink-muted">
          <p>Administradores entram sempre. Os demais precisam do módulo Michelob ligado no cadastro, em Administração.</p>
          <p>Desativar a pessoa ou desligar o módulo corta o acesso ao painel do Michelob na hora, sem esperar a sessão vencer.</p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader icon={Beer} title="Endereço do painel" />
        <div className="p-4 text-sm">
          <a href={PAINEL_MICHELOB} target="_blank" rel="noopener noreferrer" className="break-all underline">
            {PAINEL_MICHELOB}
          </a>
        </div>
      </Panel>
    </PageShell>
  )
}
