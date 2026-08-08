import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'
import { PageLoading } from '@/components/ui/page-loading'

/**
 * Entrada do painel.
 *
 * Duas colunas no desktop: à esquerda a fotografia do clube, à direita o
 * formulário. No celular a foto é o fundo da tela, com um véu que escurece de
 * baixo para cima — a imagem respira no topo e o formulário fica legível
 * embaixo.
 *
 * Ativos oficiais em `public/` (basta substituir os arquivos para atualizar):
 *  - `IMG_1479_JPG.jpg` — fotografia da corrida (retrato 2336×3504)
 *  - `Logo_Nova_Somma_Branca_Laranja.png` — wordmark branca+laranja (1280×343)
 *
 * O véu é um equilíbrio medido no navegador: forte o bastante no rodapé para
 * o texto branco não sumir contra a vegetação, leve no centro para a foto
 * continuar viva.
 */
const FOTO_URL = '/IMG_1479_JPG.jpg'
const LOGO_URL = '/Logo_Nova_Somma_Branca_Laranja.png'

export default function LoginPage() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col bg-canvas lg:grid lg:grid-cols-[1.1fr_minmax(28rem,0.9fr)]">
      {/* ---------- Fotografia ---------- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 lg:relative lg:inset-auto"
      >
        {/*
          No celular a foto é ampliada a 135% da altura, não apenas `cover`.
          Motivo: a viewport do celular (~0.46) é mais estreita que o retrato
          2:3, então `cover` encaixa a altura exatamente e recorta só nas
          laterais — `background-position` vertical fica sem efeito e a tela
          herda o topo escuro da vegetação. Com 135% há folga vertical, e 40%
          traz os corpos iluminados para o quadro.
          No desktop a área é larga: `cover` já mostra a cena inteira.
        */}
        <div
          className="absolute inset-0 bg-[length:auto_135%] bg-[position:50%_40%] bg-no-repeat lg:bg-cover lg:bg-[position:center_30%]"
          style={{ backgroundImage: `url(${FOTO_URL})` }}
        />

        {/*
          Véu mobile leve — só o suficiente para assentar a foto. O
          escurecimento pesado embaixo é responsabilidade do degradê do próprio
          formulário; empilhar os dois apagava a imagem por completo.
        */}
        <div className="absolute inset-0 bg-canvas/10 lg:bg-transparent" />
        {/* Véu desktop: escurecimento geral + fusão com a coluna do formulário. */}
        <div className="absolute inset-0 hidden lg:block lg:bg-canvas/15" />
        <div className="absolute inset-0 hidden lg:block lg:bg-gradient-to-t lg:from-canvas/85 lg:via-transparent lg:to-canvas/25" />
        <div className="absolute inset-0 hidden lg:block lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-canvas/60" />

        {/* Assinatura tática sobre a foto, apoiada em fundo próprio */}
        <div className="absolute inset-x-0 top-0 hidden items-center gap-3 border-b border-brand-line bg-canvas/70 px-6 py-2 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-brand backdrop-blur-sm lg:flex">
          <span>Somma Club</span>
          <span className="text-brand/40">{'//'}</span>
          <span>Acesso Restrito</span>
        </div>

        <div className="absolute bottom-0 left-0 hidden max-w-md p-10 lg:block">
          <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-brand">
            Sistema Somma de Gestão
          </p>
          <p className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-ink-strong">
            Operação, relacionamento e gestão do clube em um só painel.
          </p>
        </div>
      </div>

      {/* ---------- Formulário ---------- */}
      <div
        className={
          // No celular o formulário tem fundo próprio (degradê para o canvas):
          // assim a legibilidade não depende do que estiver na foto atrás — e
          // trocar a imagem no futuro não quebra o contraste do texto.
          'relative z-10 flex flex-1 flex-col items-center justify-end px-5 pb-safe pt-safe ' +
          'bg-gradient-to-t from-canvas from-[58%] via-canvas/85 to-transparent ' +
          'lg:justify-center lg:border-l lg:border-line lg:bg-surface lg:bg-none lg:px-12'
        }
      >
        <div className="w-full max-w-sm py-8 lg:py-10">
          {/*
            A wordmark é horizontal (1280×343) e já traz o nome — dispensa
            texto ao lado. `h-10/h-12` preserva a proporção sem esmagar.
          */}
          <img
            src={LOGO_URL}
            alt="Somma Club"
            className="h-10 w-auto lg:h-12"
          />

          <h1 className="mt-7 text-2xl font-semibold tracking-tight text-ink-strong">
            Entrar no sistema
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Use as credenciais fornecidas pela administração do clube.
          </p>

          <div className="mt-6 lg:mt-7">
            <Suspense fallback={<PageLoading label="Carregando..." />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  )
}
