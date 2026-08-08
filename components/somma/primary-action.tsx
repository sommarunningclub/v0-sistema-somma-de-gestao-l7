'use client'

import * as React from 'react'

/**
 * Coordena quem é a ação principal da tela no celular.
 *
 * O painel tem duas formas de oferecer a mesma ação: o FAB do `PageHeader`
 * (sempre visível) e o botão de um `EmptyState` (contextual, aparece quando não
 * há nada cadastrado). Ter as duas ao mesmo tempo produzia dois botões laranja
 * idênticos — em CRM eles literalmente se sobrepunham na tela.
 *
 * A regra: **quando um estado vazio oferece a ação, ele ganha.** Ele é
 * contextual, explica o que vai acontecer e fica no fluxo de leitura; o FAB se
 * recolhe enquanto isso. Assim há sempre exatamente uma ação principal visível.
 *
 * A comunicação é por um contador em módulo, não por contexto de React, porque
 * `PageHeader` e `EmptyState` são irmãos na árvore — nenhum é ancestral do
 * outro.
 */

let ativos = 0
const ouvintes = new Set<(temEstadoVazioComAcao: boolean) => void>()

function notificar() {
  const valor = ativos > 0
  ouvintes.forEach((ouvinte) => ouvinte(valor))
}

/** Chamado por um `EmptyState` que renderiza ação, enquanto estiver montado. */
export function useRegistrarAcaoDeEstadoVazio(ativo: boolean) {
  React.useEffect(() => {
    if (!ativo) return
    ativos += 1
    notificar()
    return () => {
      ativos -= 1
      notificar()
    }
  }, [ativo])
}

/** `true` quando algum estado vazio já está oferecendo a ação principal. */
export function useEstadoVazioAssumiuAcao(): boolean {
  const [assumiu, setAssumiu] = React.useState(() => ativos > 0)

  React.useEffect(() => {
    const ouvinte = (valor: boolean) => setAssumiu(valor)
    ouvintes.add(ouvinte)
    setAssumiu(ativos > 0)
    return () => {
      ouvintes.delete(ouvinte)
    }
  }, [])

  return assumiu
}
