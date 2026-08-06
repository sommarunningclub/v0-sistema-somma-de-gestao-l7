import { InsiderCadastroForm } from '@/components/insider/insider-cadastro-form'

export default function InsiderPage() {
  return (
    <section className="px-5 py-20 md:py-28">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-[#FF2C03]">
            Cadastro Insider
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            Mantenha seus dados de Insider atualizados
          </h1>
          <p className="mt-4 max-w-prose text-base text-white/70 md:text-lg">
            Digite seu CPF para começar. Se você já é Insider, seus dados aparecem para conferência.
            Se ainda não é, o cadastro leva menos de 2 minutos.
          </p>
        </div>
        <InsiderCadastroForm />
      </div>
    </section>
  )
}
