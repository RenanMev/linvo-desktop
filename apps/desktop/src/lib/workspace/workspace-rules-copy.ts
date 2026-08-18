export const rulesCopy = {
  catalogTitle: "Regras",
  catalogDescription: "O que o assistente segue neste workspace.",
  catalogOpen: "Abrir regras",
  catalogEmpty: "Nenhuma cadastrada ainda",
  catalogEmptyTitle: "Nenhuma regra ainda",
  catalogEmptyHint: "Adicione regras ou extraia de documentos.",
  catalogOne: "1 regra",
  catalogMany: (count: number) => `${count} regras`,
  extractTitle: "Extrair de documentos",
  extractRowHint: "A IA sugere regras a partir de arquivos.",
  extractDescription:
    "A IA lê os arquivos e sugere regras. Você revisa antes de ativar.",
  extractOpen: "Extrair de documentos",
  extractRestrictedTitle: "Sem permissão para extrair regras",
  extractRestrictedHint:
    "Peça acesso a quem administra este workspace.",
} as const;
