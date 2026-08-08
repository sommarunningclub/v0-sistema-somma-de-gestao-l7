'use client'

import { EventosModule } from '@/components/modules/eventos-module'

/**
 * `/eventos` é redirecionado pelo middleware para `/?section=eventos`, onde o
 * módulo é montado dentro do shell do painel. Esta rota existe como porta de
 * entrada direta — e para manter o link legado funcionando caso o redirect
 * seja alterado no futuro.
 */
export default function EventosPage() {
  return <EventosModule />
}
