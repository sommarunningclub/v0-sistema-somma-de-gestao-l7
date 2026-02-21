import { syncCustomersFromAsaas, getSyncedCustomers, getSyncedCustomersCount, filterSyncedCustomers } from '@/lib/services/asaas-sync'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('[v0] Starting customer sync from Asaas')
    
    const syncLog = await syncCustomersFromAsaas(100, 0)
    
    return NextResponse.json({
      success: true,
      message: 'Sincronização iniciada com sucesso',
      syncLog,
    })
  } catch (error) {
    console.error('[v0] Error syncing customers:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const searchTerm = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    console.log('[v0] Customer API GET request:', { action, searchTerm, status, limit, offset })

    if (action === 'count') {
      const count = await getSyncedCustomersCount()
      return NextResponse.json({
        success: true,
        count,
      })
    }

    if (action === 'filter' && searchTerm) {
      const customers = await filterSyncedCustomers(searchTerm, status || undefined, limit, offset)
      return NextResponse.json({
        success: true,
        data: customers,
        count: customers.length,
      })
    }

    // Get all synced customers
    const customers = await getSyncedCustomers(limit, offset)
    return NextResponse.json({
      success: true,
      data: customers,
      count: customers.length,
    })
  } catch (error) {
    console.error('[v0] Error fetching customers:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}
