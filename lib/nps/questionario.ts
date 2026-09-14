/**
 * Questionário do NPS da Assessoria, espelhado do site.
 *
 * GERADO a partir de NOVO-SITE-SOMMA-V3/lib/assessoria-nps/survey.ts. Não edite
 * à mão. Mudou o sentido de uma pergunta, uma alternativa ou uma escala? É
 * versão nova, e este arquivo ganha outra entrada em `QUESTIONARIOS` em vez de
 * ter a atual alterada: é isso que mantém as rodadas comparáveis. Pergunta nova
 * que não muda as outras (como `declared_professor`) entra na mesma versão;
 * nas respostas antigas ela aparece como não exibida.
 *
 * O painel só lê rótulos: título, alternativas e quando cada pergunta aparece.
 * A lógica condicional e a validação vivem no site.
 */

export type TipoPergunta = 'scale' | 'rating' | 'single' | 'multi' | 'text'

export interface OpcaoQuestionario {
  valor: string
  rotulo: string
}

export interface SeguimentoQuestionario {
  /** Valor da alternativa que abre o campo extra. */
  quando: string
  campo: string
  rotulo: string
  tipo: 'text' | 'multi'
  opcoes?: OpcaoQuestionario[]
}

export interface PerguntaQuestionario {
  /** Nome da coluna em `nps_assessoria_responses`. */
  id: string
  secao: string
  tipo: TipoPergunta
  /** Como aparece quando o professor não é conhecido ("seu professor"). */
  titulo: string
  obrigatoria: boolean
  /** No site, o enunciado troca "seu professor" pelo apelido do professor do aluno ("o Ale"). */
  citaProfessor?: boolean
  opcoes?: OpcaoQuestionario[]
  /** Escala 1 a 5: um rótulo por ponto. */
  rotulos?: string[]
  /** Escala 0 a 10: rótulo das pontas. */
  extremos?: { min: string; max: string }
  seguimento?: SeguimentoQuestionario
  /** Quando a pergunta não aparece para todo mundo. */
  condicao?: string
}

export interface SecaoQuestionario {
  id: string
  titulo: string
}

export interface Questionario {
  versao: string
  secoes: SecaoQuestionario[]
  perguntas: PerguntaQuestionario[]
}

/** Opções de "Quem é o seu professor?" (`declared_professor`). `nome` é igual ao cadastro (`professors.name`). */
export interface ProfessorDaPesquisa {
  valor: string
  nome: string
  apelido: string
}

export const PROFESSORES_DA_PESQUISA: ProfessorDaPesquisa[] = [
  {
    "valor": "alexandre_alves",
    "nome": "Alexandre Alves",
    "apelido": "Ale"
  },
  {
    "valor": "joseph_pereira",
    "nome": "Joseph Pereira",
    "apelido": "Jojô"
  },
  {
    "valor": "mateus_fonseca",
    "nome": "Mateus Fonseca",
    "apelido": "Mateus"
  }
]

export const QUESTIONARIO_V1: Questionario = {
  "versao": "assessoria_nps_v1",
  "secoes": [
    {
      "id": "identificacao",
      "titulo": "Identificação"
    },
    {
      "id": "geral",
      "titulo": "Experiência geral"
    },
    {
      "id": "professor",
      "titulo": "Seu professor"
    },
    {
      "id": "treinos",
      "titulo": "Seus treinos"
    },
    {
      "id": "whatsapp",
      "titulo": "WhatsApp"
    },
    {
      "id": "comunidade",
      "titulo": "Comunidade"
    },
    {
      "id": "domingos",
      "titulo": "Domingos"
    },
    {
      "id": "semana",
      "titulo": "Treinos na semana"
    },
    {
      "id": "estrutura",
      "titulo": "Estrutura"
    },
    {
      "id": "final",
      "titulo": "Avaliação final"
    }
  ],
  "perguntas": [
    {
      "id": "nps_score",
      "secao": "geral",
      "tipo": "scale",
      "titulo": "De 0 a 10, o quanto você recomendaria a Assessoria Somma Club para um amigo?",
      "obrigatoria": true,
      "extremos": {
        "min": "Nada provável",
        "max": "Muito provável"
      }
    },
    {
      "id": "nps_reason",
      "secao": "geral",
      "tipo": "text",
      "titulo": "Qual é o principal motivo para a sua nota?",
      "obrigatoria": false
    },
    {
      "id": "overall_quality",
      "secao": "geral",
      "tipo": "rating",
      "titulo": "Como você avalia a qualidade geral da Assessoria Somma Club?",
      "obrigatoria": true,
      "rotulos": [
        "Muito ruim",
        "Ruim",
        "Regular",
        "Boa",
        "Excelente"
      ]
    },
    {
      "id": "expectation_delivery",
      "secao": "geral",
      "tipo": "rating",
      "titulo": "Hoje, você sente que a assessoria entrega o que você esperava quando entrou?",
      "obrigatoria": true,
      "rotulos": [
        "Muito abaixo do esperado",
        "Abaixo do esperado",
        "Dentro do esperado",
        "Acima do esperado",
        "Muito acima do esperado"
      ]
    },
    {
      "id": "declared_professor",
      "secao": "professor",
      "tipo": "single",
      "titulo": "Quem é o seu professor?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "alexandre_alves",
          "rotulo": "Alexandre Alves (Ale)"
        },
        {
          "valor": "joseph_pereira",
          "rotulo": "Joseph Pereira (Jojô)"
        },
        {
          "valor": "mateus_fonseca",
          "rotulo": "Mateus Fonseca"
        },
        {
          "valor": "unknown",
          "rotulo": "Não sei"
        }
      ],
      "condicao": "Só quando o link não traz o professor (o link pessoal já traz)"
    },
    {
      "id": "teacher_followup",
      "secao": "professor",
      "tipo": "rating",
      "titulo": "Você sente que seu professor acompanha sua rotina de treinos com frequência?",
      "obrigatoria": true,
      "citaProfessor": true,
      "rotulos": [
        "Nunca",
        "Raramente",
        "Às vezes",
        "Frequentemente",
        "Sempre"
      ]
    },
    {
      "id": "teacher_understands_goals",
      "secao": "professor",
      "tipo": "rating",
      "titulo": "Você sente que seu professor conhece seus objetivos e acompanha sua evolução?",
      "obrigatoria": true,
      "citaProfessor": true,
      "rotulos": [
        "Nada",
        "Pouco",
        "Razoavelmente",
        "Bem",
        "Muito bem"
      ]
    },
    {
      "id": "teacher_whatsapp_access",
      "secao": "professor",
      "tipo": "rating",
      "titulo": "Você tem facilidade para conversar individualmente com seu professor pelo WhatsApp quando precisa?",
      "obrigatoria": true,
      "citaProfessor": true,
      "rotulos": [
        "Muito difícil",
        "Difícil",
        "Razoável",
        "Fácil",
        "Muito fácil"
      ]
    },
    {
      "id": "teacher_support_quality",
      "secao": "professor",
      "tipo": "rating",
      "titulo": "Quando você chama seu professor no privado, sente que recebe atenção e suporte adequados?",
      "obrigatoria": true,
      "citaProfessor": true,
      "rotulos": [
        "Nunca",
        "Raramente",
        "Às vezes",
        "Frequentemente",
        "Sempre"
      ]
    },
    {
      "id": "teacher_communication_quality",
      "secao": "professor",
      "tipo": "rating",
      "titulo": "Como você avalia a qualidade da comunicação com seu professor?",
      "obrigatoria": true,
      "citaProfessor": true,
      "rotulos": [
        "Muito ruim",
        "Ruim",
        "Regular",
        "Boa",
        "Excelente"
      ]
    },
    {
      "id": "training_quality",
      "secao": "treinos",
      "tipo": "rating",
      "titulo": "Como você avalia a qualidade dos seus treinos?",
      "obrigatoria": true,
      "rotulos": [
        "Muito ruim",
        "Ruim",
        "Regular",
        "Boa",
        "Excelente"
      ]
    },
    {
      "id": "training_level_fit",
      "secao": "treinos",
      "tipo": "rating",
      "titulo": "Você considera que os treinos são adequados ao seu nível atual?",
      "obrigatoria": true,
      "rotulos": [
        "Nada adequados",
        "Pouco adequados",
        "Razoavelmente adequados",
        "Bem adequados",
        "Totalmente adequados"
      ]
    },
    {
      "id": "training_goal_alignment",
      "secao": "treinos",
      "tipo": "rating",
      "titulo": "Você considera que os treinos estão alinhados aos seus objetivos pessoais?",
      "obrigatoria": true,
      "rotulos": [
        "Nada alinhados",
        "Pouco alinhados",
        "Razoavelmente alinhados",
        "Bem alinhados",
        "Totalmente alinhados"
      ]
    },
    {
      "id": "perceived_progress",
      "secao": "treinos",
      "tipo": "rating",
      "titulo": "Você percebe evolução desde que começou a treinar com a Assessoria Somma?",
      "obrigatoria": true,
      "rotulos": [
        "Nenhuma evolução",
        "Pouca evolução",
        "Evolução moderada",
        "Boa evolução",
        "Muita evolução"
      ]
    },
    {
      "id": "needs_more_feedback",
      "secao": "treinos",
      "tipo": "single",
      "titulo": "Você sente necessidade de mais feedback do professor sobre sua evolução?",
      "obrigatoria": true,
      "citaProfessor": true,
      "opcoes": [
        {
          "valor": "yes",
          "rotulo": "Sim"
        },
        {
          "valor": "no",
          "rotulo": "Não"
        },
        {
          "valor": "sometimes",
          "rotulo": "Às vezes"
        }
      ]
    },
    {
      "id": "whatsapp_group_quality",
      "secao": "whatsapp",
      "tipo": "rating",
      "titulo": "Como você avalia os grupos de WhatsApp da Assessoria Somma?",
      "obrigatoria": true,
      "rotulos": [
        "Muito ruins",
        "Ruins",
        "Regulares",
        "Bons",
        "Excelentes"
      ]
    },
    {
      "id": "whatsapp_connection",
      "secao": "whatsapp",
      "tipo": "rating",
      "titulo": "O grupo ajuda você a se sentir mais conectado com outros membros da assessoria?",
      "obrigatoria": true,
      "rotulos": [
        "Nada",
        "Pouco",
        "Razoavelmente",
        "Bastante",
        "Muito"
      ]
    },
    {
      "id": "whatsapp_message_volume",
      "secao": "whatsapp",
      "tipo": "single",
      "titulo": "Como você considera o volume de mensagens nos grupos?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "very_low",
          "rotulo": "Muito baixo"
        },
        {
          "valor": "low",
          "rotulo": "Baixo"
        },
        {
          "valor": "adequate",
          "rotulo": "Adequado"
        },
        {
          "valor": "high",
          "rotulo": "Alto"
        },
        {
          "valor": "very_high",
          "rotulo": "Muito alto"
        }
      ]
    },
    {
      "id": "whatsapp_information_clarity",
      "secao": "whatsapp",
      "tipo": "rating",
      "titulo": "Você considera que as informações importantes ficam claras e fáceis de encontrar no grupo?",
      "obrigatoria": true,
      "rotulos": [
        "Nunca",
        "Raramente",
        "Às vezes",
        "Frequentemente",
        "Sempre"
      ]
    },
    {
      "id": "whatsapp_content_preferences",
      "secao": "whatsapp",
      "tipo": "multi",
      "titulo": "O que você gostaria de receber mais nos grupos?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "training_guidance",
          "rotulo": "Orientações sobre os treinos"
        },
        {
          "valor": "coach_content",
          "rotulo": "Conteúdo dos professores"
        },
        {
          "valor": "running_tips",
          "rotulo": "Dicas de corrida"
        },
        {
          "valor": "race_info",
          "rotulo": "Informações sobre provas"
        },
        {
          "valor": "announcements",
          "rotulo": "Avisos da assessoria"
        },
        {
          "valor": "student_results",
          "rotulo": "Resultados e evolução dos alunos"
        },
        {
          "valor": "member_interaction",
          "rotulo": "Interação entre os membros"
        },
        {
          "valor": "benefits_partners",
          "rotulo": "Benefícios e parceiros"
        },
        {
          "valor": "other",
          "rotulo": "Outro"
        }
      ],
      "seguimento": {
        "quando": "other",
        "campo": "whatsapp_content_other",
        "rotulo": "O que mais?",
        "tipo": "text"
      }
    },
    {
      "id": "community_climate",
      "secao": "comunidade",
      "tipo": "rating",
      "titulo": "Como você avalia o clima entre os membros da Assessoria Somma?",
      "obrigatoria": true,
      "rotulos": [
        "Muito ruim",
        "Ruim",
        "Regular",
        "Bom",
        "Excelente"
      ]
    },
    {
      "id": "community_belonging",
      "secao": "comunidade",
      "tipo": "rating",
      "titulo": "Você se sente parte da comunidade Somma?",
      "obrigatoria": true,
      "rotulos": [
        "Nada",
        "Pouco",
        "Razoavelmente",
        "Bastante",
        "Muito"
      ]
    },
    {
      "id": "community_interaction",
      "secao": "comunidade",
      "tipo": "rating",
      "titulo": "Você sente que existe abertura para conversar, interagir e conhecer outros membros?",
      "obrigatoria": true,
      "rotulos": [
        "Nada",
        "Pouco",
        "Razoavelmente",
        "Bastante",
        "Muito"
      ]
    },
    {
      "id": "community_one_word",
      "secao": "comunidade",
      "tipo": "text",
      "titulo": "Se você tivesse que definir o clima da Assessoria Somma em uma palavra, qual seria?",
      "obrigatoria": false
    },
    {
      "id": "sunday_frequency",
      "secao": "domingos",
      "tipo": "single",
      "titulo": "Com que frequência você participa dos encontros presenciais de domingo?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "never",
          "rotulo": "Nunca"
        },
        {
          "valor": "rarely",
          "rotulo": "Raramente"
        },
        {
          "valor": "sometimes_monthly",
          "rotulo": "Algumas vezes por mês"
        },
        {
          "valor": "almost_every_sunday",
          "rotulo": "Quase todos os domingos"
        },
        {
          "valor": "every_sunday",
          "rotulo": "Todos os domingos"
        }
      ]
    },
    {
      "id": "sunday_support_quality",
      "secao": "domingos",
      "tipo": "rating",
      "titulo": "Como você avalia o suporte presencial oferecido pela assessoria aos domingos?",
      "obrigatoria": true,
      "rotulos": [
        "Muito ruim",
        "Ruim",
        "Regular",
        "Bom",
        "Excelente"
      ],
      "condicao": "Só para quem frequenta os encontros de domingo"
    },
    {
      "id": "sunday_value",
      "secao": "domingos",
      "tipo": "rating",
      "titulo": "O encontro presencial de domingo agrega valor à sua experiência na Assessoria Somma?",
      "obrigatoria": true,
      "rotulos": [
        "Nada",
        "Pouco",
        "Razoavelmente",
        "Bastante",
        "Muito"
      ],
      "condicao": "Só para quem frequenta os encontros de domingo"
    },
    {
      "id": "sunday_improvements",
      "secao": "domingos",
      "tipo": "text",
      "titulo": "O que poderia melhorar nos encontros presenciais de domingo?",
      "obrigatoria": false,
      "condicao": "Só para quem frequenta os encontros de domingo"
    },
    {
      "id": "weekday_training_interest",
      "secao": "semana",
      "tipo": "single",
      "titulo": "Se a Assessoria Somma passasse a oferecer treinos presenciais durante a semana, você teria interesse em participar?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "yes",
          "rotulo": "Sim"
        },
        {
          "valor": "maybe",
          "rotulo": "Talvez"
        },
        {
          "valor": "no",
          "rotulo": "Não"
        }
      ]
    },
    {
      "id": "preferred_weekday_combination",
      "secao": "semana",
      "tipo": "single",
      "titulo": "Qual combinação de dias seria melhor para você?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "mon_wed",
          "rotulo": "Segunda e quarta"
        },
        {
          "valor": "tue_thu",
          "rotulo": "Terça e quinta"
        },
        {
          "valor": "no_preference",
          "rotulo": "Não tenho preferência"
        },
        {
          "valor": "other",
          "rotulo": "Outro"
        }
      ],
      "seguimento": {
        "quando": "other",
        "campo": "preferred_weekday_other",
        "rotulo": "Quais dias?",
        "tipo": "text"
      },
      "condicao": "Só para quem tem interesse em treino na semana (sim ou talvez)"
    },
    {
      "id": "preferred_period",
      "secao": "semana",
      "tipo": "single",
      "titulo": "Em qual período você teria maior disponibilidade para participar?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "morning",
          "rotulo": "Manhã"
        },
        {
          "valor": "afternoon",
          "rotulo": "Tarde"
        },
        {
          "valor": "evening",
          "rotulo": "Noite"
        },
        {
          "valor": "multiple",
          "rotulo": "Tenho disponibilidade em mais de um período"
        }
      ],
      "seguimento": {
        "quando": "multiple",
        "campo": "available_periods",
        "rotulo": "Quais períodos?",
        "tipo": "multi",
        "opcoes": [
          {
            "valor": "morning",
            "rotulo": "Manhã"
          },
          {
            "valor": "afternoon",
            "rotulo": "Tarde"
          },
          {
            "valor": "evening",
            "rotulo": "Noite"
          }
        ]
      },
      "condicao": "Só para quem tem interesse em treino na semana (sim ou talvez)"
    },
    {
      "id": "preferred_morning_time",
      "secao": "semana",
      "tipo": "single",
      "titulo": "Caso os treinos fossem pela manhã, qual horário seria melhor?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "before_6",
          "rotulo": "Antes das 6h"
        },
        {
          "valor": "6_to_7",
          "rotulo": "Entre 6h e 7h"
        },
        {
          "valor": "7_to_8",
          "rotulo": "Entre 7h e 8h"
        },
        {
          "valor": "after_8",
          "rotulo": "Depois das 8h"
        }
      ],
      "condicao": "Só para quem escolheu manhã"
    },
    {
      "id": "preferred_evening_time",
      "secao": "semana",
      "tipo": "single",
      "titulo": "Caso os treinos fossem à noite, qual horário seria melhor?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "17_to_18",
          "rotulo": "Entre 17h e 18h"
        },
        {
          "valor": "18_to_19",
          "rotulo": "Entre 18h e 19h"
        },
        {
          "valor": "19_to_20",
          "rotulo": "Entre 19h e 20h"
        },
        {
          "valor": "after_20",
          "rotulo": "Depois das 20h"
        }
      ],
      "condicao": "Só para quem escolheu noite"
    },
    {
      "id": "expected_weekly_frequency",
      "secao": "semana",
      "tipo": "single",
      "titulo": "Quantas vezes por semana você provavelmente participaria de um treino presencial?",
      "obrigatoria": true,
      "opcoes": [
        {
          "valor": "once",
          "rotulo": "1 vez"
        },
        {
          "valor": "twice",
          "rotulo": "2 vezes"
        },
        {
          "valor": "three_plus",
          "rotulo": "3 vezes ou mais"
        },
        {
          "valor": "depends_on_schedule",
          "rotulo": "Dependeria dos horários"
        }
      ],
      "condicao": "Só para quem tem interesse em treino na semana (sim ou talvez)"
    },
    {
      "id": "physical_structure_quality",
      "secao": "estrutura",
      "tipo": "rating",
      "titulo": "Como você avalia a estrutura oferecida pela Somma nos encontros presenciais?",
      "obrigatoria": true,
      "rotulos": [
        "Muito ruim",
        "Ruim",
        "Regular",
        "Boa",
        "Excelente"
      ],
      "condicao": "Só para quem frequenta os encontros de domingo"
    },
    {
      "id": "physical_structure_improvements",
      "secao": "estrutura",
      "tipo": "text",
      "titulo": "O que você acredita que poderia melhorar na estrutura ou na experiência presencial?",
      "obrigatoria": false,
      "condicao": "Só para quem frequenta os encontros de domingo"
    },
    {
      "id": "cost_benefit",
      "secao": "final",
      "tipo": "rating",
      "titulo": "Considerando tudo que recebe atualmente, como você avalia o custo benefício da Assessoria Somma?",
      "obrigatoria": true,
      "rotulos": [
        "Muito ruim",
        "Ruim",
        "Regular",
        "Bom",
        "Excelente"
      ]
    },
    {
      "id": "renewal_probability",
      "secao": "final",
      "tipo": "scale",
      "titulo": "Se sua assinatura terminasse hoje, qual seria a chance de você renovar?",
      "obrigatoria": true,
      "extremos": {
        "min": "Nenhuma chance",
        "max": "Com certeza"
      }
    },
    {
      "id": "what_is_excellent",
      "secao": "final",
      "tipo": "text",
      "titulo": "O que a Assessoria Somma faz hoje que você considera excelente e não deveria mudar?",
      "obrigatoria": false
    },
    {
      "id": "what_needs_improvement",
      "secao": "final",
      "tipo": "text",
      "titulo": "O que mais precisa melhorar na Assessoria Somma hoje?",
      "obrigatoria": false
    },
    {
      "id": "one_change",
      "secao": "final",
      "tipo": "text",
      "titulo": "Se você pudesse mudar ou criar uma única coisa dentro da Assessoria Somma, o que seria?",
      "obrigatoria": false
    }
  ]
}

export const QUESTIONARIOS: Record<string, Questionario> = {
  [QUESTIONARIO_V1.versao]: QUESTIONARIO_V1,
}

export function questionarioDaVersao(versao: string | null | undefined): Questionario | null {
  if (!versao) return null
  return QUESTIONARIOS[versao] ?? null
}
