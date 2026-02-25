import { NextRequest, NextResponse } from "next/server"
import { jsPDF } from "jspdf"

export const POST = async (request: NextRequest) => {
  try {
    const { htmlContent } = await request.json()

    if (!htmlContent || typeof htmlContent !== "string" || htmlContent.length === 0) {
      return NextResponse.json(
        { error: "htmlContent é obrigatório e deve ser uma string não-vazia" },
        { status: 400 }
      )
    }

    console.log("[v0] Convertendo contrato para PDF via jsPDF, tamanho HTML:", htmlContent.length)

    // Extrair texto puro do HTML
    const plainText = htmlContent
      .replace(/<[^>]*>/g, "") // Remove tags HTML
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()

    if (plainText.length === 0) {
      return NextResponse.json(
        { error: "Conteúdo do contrato vazio após processamento" },
        { status: 400 }
      )
    }

    // Usar jsPDF para gerar PDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    // Configurações de fonte
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    const lineHeight = 5
    const maxWidth = pageWidth - 2 * margin
    let yPosition = margin

    // Dividir texto em linhas que cabem na página
    const lines = doc.splitTextToSize(plainText, maxWidth)

    // Adicionar linhas ao documento
    for (const line of lines) {
      // Se chegou ao final da página, adiciona nova página
      if (yPosition > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
      }
      doc.text(line, margin, yPosition)
      yPosition += lineHeight
    }

    // Converter para base64
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
    const pdfBase64 = pdfBuffer.toString("base64")

    console.log("[v0] PDF gerado com sucesso via jsPDF, tamanho:", pdfBase64.length)

    return NextResponse.json({
      pdfBase64,
      success: true,
      message: "Contrato convertido para PDF com sucesso",
    })
  } catch (error: unknown) {
    console.error("[v0] Erro na conversão para PDF:", error instanceof Error ? error.message : String(error))

    return NextResponse.json(
      {
        error: "Falha ao converter contrato para PDF",
        details: error instanceof Error ? error.message : "Erro desconhecido",
        hint: "Tente novamente. Se o problema persistir, contate o suporte.",
      },
      { status: 500 }
    )
  }
}


