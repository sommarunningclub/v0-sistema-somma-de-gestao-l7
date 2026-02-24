import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { htmlContent } = await request.json()
    if (!htmlContent) {
      return NextResponse.json({ error: "htmlContent é obrigatório" }, { status: 400 })
    }

    console.log("[v0] Converting HTML to PDF, content length:", htmlContent.length)

    // Solução: Usar html2pdf.js no servidor via Node.js
    // A biblioteca html2pdf não está disponível nativamente no Node.js
    // Então usamos uma abordagem alternativa: enviar para um serviço de conversão gratuito
    // OU gerar um data URL base64 da string HTML que pode ser tratada no cliente

    // SOLUÇÃO IMPLEMENTADA: Converter diretamente no cliente usando html2pdf.js
    // Mas como estamos no servidor, usaremos uma estratégia simplificada:
    // Vamos criar um PDF simples usando um gerador HTTP-based ou mudar para client-side

    // Para Vercel, a melhor solução é usar a biblioteca 'pdf-lib' que é puro JavaScript
    // Mas html2pdf não é fácil no backend. Então vamos usar uma API externa gratuita como fallback

    // FALLBACK SIMPLES: Retornar o HTML como base64 data URL (não é PDF, mas permite download)
    // Melhor: Usar 'html-to-text' ou enviar para conversion API

    // Para uma solução real sem dependências externas, usaremos:
    // 1. Converter HTML → Base64 string que pode ser usada como data URI
    // 2. Ou enviar para um serviço de conversão

    // SOLUÇÃO DEFINITIVA: Usar https://api.html2pdf.app (serviço gratuito)
    const html2pdfApiUrl = "https://api.html2pdf.app/v1/generate"
    
    const conversionRes = await fetch(html2pdfApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: htmlContent,
        options: {
          margin: 10,
          filename: "contrato.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
        },
      }),
    })

    if (!conversionRes.ok) {
      // Fallback: Se o serviço externo falhar, retornar mensagem clara
      throw new Error(`Serviço de conversão indisponível (${conversionRes.status})`)
    }

    const pdfBuffer = await conversionRes.arrayBuffer()
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64")

    console.log("[v0] PDF generated via api.html2pdf.app, size:", pdfBase64.length, "bytes")

    return NextResponse.json({ pdfBase64 })

  } catch (error: any) {
    console.error("[v0] Erro ao converter HTML para PDF:", error.message)

    // Se tudo falhar, tentar uma segunda estratégia: simular PDF básico
    // Vamos criar um PDF mínimo válido usando pure JavaScript
    return NextResponse.json(
      { 
        error: "Falha ao gerar o PDF", 
        details: error.message || "Erro de conversão",
        hint: "O serviço de conversão pode estar temporariamente indisponível. Tente novamente em alguns segundos.",
      }, 
      { status: 500 }
    )
  }
}
