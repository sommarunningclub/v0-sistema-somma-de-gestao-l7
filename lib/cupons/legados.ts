/**
 * Códigos que também existem hardcoded no checkout do site
 * (NOVO-SITE-SOMMA-V3, lib/checkout/cupons.ts).
 *
 * O site procura o cupom no banco primeiro e só cai na lista dele se não achar
 * — então EXCLUIR um destes códigos aqui não o tira de circulação: ele volta a
 * valer com as regras antigas, gravadas no código. Para tirar do ar, desative.
 *
 * A tela usa esta lista só para avisar. Quando a lista do site for removida,
 * este arquivo some junto.
 */
export const CODIGOS_LEGADOS: ReadonlySet<string> = new Set([
  'ANALU',
  'SOMMA5',
  'SOMMA10',
  'SOMMA20',
  'SOMMA50',
  'PRIMEIRACOMPRA',
  'SOMMA99',
  'JO130',
  'JO150',
  'ALE200',
  'ALE180',
  'ALEX10',
  'ANDERSON10',
  'ARTHUR10',
  'BRUNA10',
  'CAROLINA10',
  'CRIS10',
  'CAMILLA10',
  'DIOGO10',
  'PRISCYLA10',
  'PRISCILA10',
  'GUSTAVO10',
  'JOAO10',
  'JOSEPH10',
  'KAMILA10',
  'LETICIA10',
  'LUANA10',
  'LUISA10',
  'MATEUS10',
  'MATHEUS10',
  'RAYSSA10',
  'RUAN10',
  'YASMIM10',
  'YASMIN10',
  'ANA10',
  'DAYANE10',
  'ALEX5',
  'ANDERSON5',
  'ARTHUR5',
  'BRUNA5',
  'CAROLINA5',
  'CRIS5',
  'CAMILLA5',
  'DIOGO5',
  'PRISCYLA5',
  'PRISCILA5',
  'GUSTAVO5',
  'JOAO5',
  'JOSEPH5',
  'KAMILA5',
  'LETICIA5',
  'LUANA5',
  'LUISA5',
  'MATEUS5',
  'MATHEUS5',
  'RAYSSA5',
  'RUAN5',
  'YASMIM5',
  'YASMIN5',
  'ANA5',
  'DAYANE5',
])

export function ehLegado(code: string): boolean {
  return CODIGOS_LEGADOS.has(code.toUpperCase())
}
