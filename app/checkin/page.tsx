'use client'

import { CheckInModule } from '@/components/modules/checkin-module'

/**
 * `/checkin` é redirecionado pelo middleware para `/?section=checkin`, onde o
 * módulo é montado dentro do shell do painel. Esta rota existe como porta de
 * entrada direta — e para manter o link legado funcionando caso o redirect
 * seja alterado no futuro.
 */
export default function CheckInPage() {
  return <CheckInModule />
}
