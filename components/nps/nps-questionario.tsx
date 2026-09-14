'use client'

import { ListChecks } from 'lucide-react'
import { EmptyState, Panel, PanelHeader } from '@/components/somma'
import { questionarioDaVersao, type PerguntaQuestionario, type TipoPergunta } from '@/lib/nps/questionario'

const TIPO: Record<TipoPergunta, string> = {
  scale: 'Nota de 0 a 10',
  rating: 'Escala de 1 a 5',
  single: 'Escolha única',
  multi: 'Várias respostas',
  text: 'Texto livre',
}

function Etiqueta({ children, destaque = false }: { children: React.ReactNode; destaque?: boolean }) {
  return (
    <span
      className={
        destaque
          ? 'rounded-sm border border-brand-border bg-brand-softer px-1.5 py-0.5 text-[0.6875rem] text-ink'
          : 'rounded-sm border border-line bg-surface-sunken px-1.5 py-0.5 text-[0.6875rem] text-ink-muted'
      }
    >
      {children}
    </span>
  )
}

function Alternativas({ pergunta: p }: { pergunta: PerguntaQuestionario }) {
  if (p.extremos) {
    return (
      <p className="mt-2 text-meta text-ink-muted">
        0 = {p.extremos.min} · 10 = {p.extremos.max}
      </p>
    )
  }
  const itens = p.rotulos
    ? p.rotulos.map((r, i) => `${i + 1} ${r}`)
    : p.opcoes
      ? p.opcoes.map((o) => o.rotulo)
      : []
  if (itens.length === 0) return null
  return (
    <>
      <p className="mt-2 text-meta text-ink-muted">{itens.join(' · ')}</p>
      {p.seguimento ? (
        <p className="mt-1 text-meta text-ink-muted">
          Se escolher “{p.opcoes?.find((o) => o.valor === p.seguimento?.quando)?.rotulo ?? p.seguimento.quando}”: {p.seguimento.rotulo}
          {p.seguimento.opcoes ? ` (${p.seguimento.opcoes.map((o) => o.rotulo).join(', ')})` : ''}
        </p>
      ) : null}
    </>
  )
}

/**
 * Prévia do questionário da rodada. Não é editável de propósito: rodadas com
 * perguntas diferentes não podem ser comparadas. Mudar pergunta é criar uma
 * versão nova no site.
 */
export function NpsQuestionario({ versao }: { versao: string }) {
  const questionario = questionarioDaVersao(versao)

  if (!questionario) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Versão de questionário desconhecida"
        description={`O painel não tem a descrição da versão ${versao}.`}
      />
    )
  }

  let numero = 0

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-meta text-ink-muted">
        Versão <span className="font-mono text-ink">{questionario.versao}</span>: {questionario.perguntas.length} perguntas,
        antecedidas por nome e sobrenome (obrigatórios). É o mesmo questionário em todas as rodadas desta versão; mudar uma
        pergunta cria uma versão nova, para não somar respostas de perguntas diferentes.
      </p>

      {questionario.secoes
        .filter((s) => s.id !== 'identificacao')
        .map((secao) => {
          const perguntas = questionario.perguntas.filter((p) => p.secao === secao.id)
          return (
            <Panel key={secao.id}>
              <PanelHeader title={secao.titulo} description={`${perguntas.length} ${perguntas.length === 1 ? 'pergunta' : 'perguntas'}`} />
              <ol className="divide-y divide-line">
                {perguntas.map((p) => {
                  numero += 1
                  return (
                    <li key={p.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                      <span className="w-6 shrink-0 font-mono text-meta tabular-nums text-ink-subtle">{numero}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-ink-strong">{p.titulo}</p>
                        <p className="mt-1.5 flex flex-wrap gap-1.5">
                          <Etiqueta>{TIPO[p.tipo]}</Etiqueta>
                          <Etiqueta>{p.obrigatoria ? 'Obrigatória' : 'Opcional'}</Etiqueta>
                          {p.condicao ? <Etiqueta destaque>{p.condicao}</Etiqueta> : null}
                        </p>
                        <Alternativas pergunta={p} />
                      </div>
                    </li>
                  )
                })}
              </ol>
            </Panel>
          )
        })}
    </div>
  )
}
