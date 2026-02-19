import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-client'
import { enrichWithValidationData } from '@/lib/validation-utils' // Declare the variable before using it

export const dynamic = 'force-dynamic'

interface CheckInData {
  nome: string
  telefone: string
  cpf: string
  data: string
  validated?: boolean
  validated_at?: string | null
}

// Google Sheets ID da planilha "Check-in Somma 2026"
// Extraído de: https://docs.google.com/spreadsheets/d/1BLZq7Bof8NT3id5TaAbabMMi6v45sFH5S2QzGZafx-c/edit
const SHEET_ID = "1BLZq7Bof8NT3id5TaAbabMMi6v45sFH5S2QzGZafx-c"
const SHEET_NAME = "Check-in"

// URL de exportação CSV direta do Google Sheets (muito mais confiável que Apps Script)
const GOOGLE_SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(GOOGLE_SHEETS_CSV_URL, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'text/csv, text/plain, */*',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] Google Sheets error response:', errorText)
      throw new Error(`Google Sheets responded with status ${response.status}: ${errorText}`)
    }

    const csvText = await response.text()

    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json({
        data: [],
        message: 'No data available'
      })
    }

    // Parse the CSV
    const data = parseCSV(csvText)

    // Enriquecer dados com informações de validação do Supabase
    const enrichedData = await enrichWithValidationData(data)

    return NextResponse.json({
      data: enrichedData,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[v0] Error in GET /api/checkin:', error)
    console.error('[v0] Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch check-in data',
        data: [],
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Parse CSV text into CheckInData array
 */
function parseCSV(csvText: string): CheckInData[] {
  const lines = csvText.trim().split('\n')
  
  if (lines.length < 2) {
    return []
  }

  // Parse header row (remove quotes from Google Sheets CSV format)
  const rawHeaders = parseCSVLine(lines[0])
  const headers = rawHeaders.map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())

  // Find column indices based on sheet structure:
  // Nome Completo | Numero de Telefone | CPF | DATA
  const nomeIndex = headers.findIndex(h => 
    h.includes('nome') || h.includes('name')
  )
  const telefoneIndex = headers.findIndex(h => 
    h.includes('telefone') || h.includes('phone') || h.includes('whatsapp') || h.includes('numero')
  )
  const cpfIndex = headers.findIndex(h => 
    h.includes('cpf')
  )
  const dataIndex = headers.findIndex(h => 
    h.includes('data') || h.includes('date') || h.includes('hora')
  )

  const data: CheckInData[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cells = parseCSVLine(line).map(c => c.replace(/^"|"$/g, '').trim())
    
    // Get values with fallback to column index if headers not found
    const nome = nomeIndex !== -1 ? cells[nomeIndex] : cells[0]
    const telefone = telefoneIndex !== -1 ? cells[telefoneIndex] : cells[1]
    const cpf = cpfIndex !== -1 ? cells[cpfIndex] : cells[2]
    const dateVal = dataIndex !== -1 ? cells[dataIndex] : cells[3]

    if (nome && cpf) {
      data.push({
        nome: nome || '',
        telefone: telefone || '',
        cpf: cpf || '',
        data: dateVal || '',
      })
    }
  }

  return data
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current)
  return cells
}
