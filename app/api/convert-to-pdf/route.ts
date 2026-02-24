import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promises as fs } from "fs"
import path from "path"

// Função para executar comandos no shell de forma segura
const execShellCommand = (cmd: string) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn("[v0] Shell command error:", stderr)
        reject(error)
      }
      resolve(stdout ? stdout : stderr)
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const { htmlContent } = await request.json()
    if (!htmlContent) {
      return NextResponse.json({ error: "htmlContent é obrigatório" }, { status: 400 })
    }

    console.log("[v0] Converting HTML to PDF, content length:", htmlContent.length)

    // Usar um diretório temporário seguro
    const tempDir = "/tmp"
    const uniqueId = Date.now()
    const htmlPath = path.join(tempDir, `contrato-${uniqueId}.html`)
    const pdfPath = path.join(tempDir, `contrato-${uniqueId}.pdf`)

    // Salva o conteúdo HTML em um arquivo temporário
    await fs.writeFile(htmlPath, htmlContent, "utf-8")
    console.log("[v0] HTML file written to:", htmlPath)

    // Comando para converter HTML para PDF usando WeasyPrint
    const command = `weasyprint ${htmlPath} ${pdfPath}`
    console.log("[v0] Executing command:", command)
    await execShellCommand(command)

    // Lê o arquivo PDF gerado como um Buffer
    const pdfBuffer = await fs.readFile(pdfPath)
    console.log("[v0] PDF generated, size:", pdfBuffer.length, "bytes")

    // Converte o Buffer para base64
    const pdfBase64 = pdfBuffer.toString("base64")

    // Limpa os arquivos temporários
    await fs.unlink(htmlPath)
    await fs.unlink(pdfPath)
    console.log("[v0] Temporary files cleaned up")

    // Retorna o PDF em base64
    return NextResponse.json({ pdfBase64 })

  } catch (error: any) {
    console.error("[v0] Erro ao converter HTML para PDF:", error.message)
    return NextResponse.json(
      { 
        error: "Falha ao gerar o PDF", 
        details: error.message || "Erro desconhecido",
        hint: "Verifique se weasyprint está instalado: pip3 install weasyprint"
      }, 
      { status: 500 }
    )
  }
}
