import { NextRequest, NextResponse } from "next/server"
import PDFDocument from "pdfkit"

export const POST = async (request: NextRequest) => {
  try {
    const { htmlContent } = await request.json()

    if (!htmlContent || typeof htmlContent !== "string" || htmlContent.length === 0) {
      return NextResponse.json(
        { error: "htmlContent é obrigatório e deve ser uma string não-vazia" },
        { status: 400 }
      )
    }

    console.log("[v0] Convertendo contrato para PDF via PDFKit, tamanho HTML:", htmlContent.length)

    // Extrair texto puro do HTML (remover tags)
    const plainText = htmlContent
      .replace(/<[^>]*>/g, "") // Remove tags HTML
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .trim()

    if (plainText.length === 0) {
      return NextResponse.json(
        { error: "Conteúdo do contrato vazio após processamento" },
        { status: 400 }
      )
    }

    // Criar PDF usando PDFKit
    const doc = new PDFDocument({
      bufferPages: true,
      margin: 50,
      size: "A4",
    })

    // Configurar fonte padrão
    doc.fontSize(11).font("Helvetica")

    // Adicionar conteúdo ao PDF
    const lines = plainText.split("\n").filter(line => line.trim())

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine) {
        // Detectar se é um título (caixa alta, curto)
        if (trimmedLine.length < 100 && trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 10) {
          doc.fontSize(12).font("Helvetica-Bold")
          doc.text(trimmedLine, { align: "center" })
          doc.fontSize(11).font("Helvetica")
        } else {
          doc.fontSize(11).text(trimmedLine, { align: "justify" })
        }
        doc.moveDown(0.3)
      }
    }

    // Converter documento para buffer
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []

      doc.on("data", (chunk: Buffer) => {
        chunks.push(chunk)
      })

      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks)
        const pdfBase64 = pdfBuffer.toString("base64")

        console.log("[v0] PDF gerado com sucesso via PDFKit, tamanho:", pdfBase64.length)

        resolve(
          NextResponse.json({
            pdfBase64,
            success: true,
            message: "Contrato convertido para PDF com sucesso",
          })
        )
      })

      doc.on("error", (error: Error) => {
        console.error("[v0] Erro ao gerar PDF:", error.message)
        reject(error)
      })

      doc.end()
    })
  } catch (error: unknown) {
    console.error("[v0] Erro na conversão para PDF:", error instanceof Error ? error.message : String(error))

    return NextResponse.json(
      {
        error: "Falha ao converter contrato para PDF",
        details: error instanceof Error ? error.message : "Erro desconhecido",
        hint: "Verifique se o conteúdo do contrato está correto e não contém caracteres inválidos.",
      },
      { status: 500 }
    )
  }
}

