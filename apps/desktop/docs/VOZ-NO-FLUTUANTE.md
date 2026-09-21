# Voz no flutuante (KAN-6)

Estado em 2026-09-21. Cobre KAN-41 (push-to-talk), KAN-42 (atalho), KAN-43 (anexo de áudio) e a decisão do KAN-44 (always-listening).

## O que existe

- **Segurar para falar** — segurar o atalho global (padrão `Ctrl+Space`; reserva `Ctrl+Shift+Space` se o primeiro estiver tomado por outro programa) ou o botão de microfone do composer grava; soltar para e transcreve. O texto entra no composer do Assist para o atendente ler, corrigir e decidir enviar — nunca vai direto.
  - Com a ilha oculta ou compacta, o atalho abre a ilha antes de gravar. Sem o atalho, a ilha oculta não grava: o botão de microfone exige a ilha aberta.
  - Indicador: a pílula mostra "Ouvindo" (status live) enquanto grava; o composer mostra "Ouvindo… solte para transcrever" e "Transcrevendo…".
  - Falhas aparecem no composer (permissão negada, sem microfone, transcrição indisponível). Sessão caída ou checklist aberto: o atalho não grava.
  - Permissão: `getUserMedia` só é chamado ao começar a gravar; o WebView2 mostra o prompt do sistema na primeira vez. Ao parar, as trilhas do microfone são encerradas — o indicador do SO apaga.
- **Anexo de áudio** — clipe no composer aceita `ogg`, `mp3`, `m4a` (o que sai do WhatsApp), além de `webm` e `wav`. Limite de 12MB (~5 min). A API detecta o formato pelos bytes, transcreve no upload e guarda a transcrição junto do anexo; o modelo lê a transcrição, não o áudio. Erro de formato e de tamanho aparecem antes de subir.
- **Transcrição** — `linvo-api`, AI SDK `transcribe` + OpenAI (`LLM_TRANSCRIPTION_MODEL`, padrão `gpt-4o-mini-transcribe`, idioma `pt`), com a mesma credencial do LLM (BYO key por usuário/workspace ou a da plataforma). Só OpenAI por enquanto — é o único vendor implementado no `ModelFactory`.

## Decisão: sem always-listening (KAN-44)

Não implementar escuta contínua nesta fase. Won't Do enquanto os pontos abaixo não mudarem.

**LGPD.** Escuta contínua captura a voz do atendente e, pelo alto-falante, a do cliente — dado pessoal (e, em saúde/financeiro, sensível) de quem não consentiu com o Linvo. Exigiria base legal própria, aviso ao cliente em cada atendimento, política de retenção e trilha de auditoria. O push-to-talk mantém o ato de gravar explícito e do atendente: ele decide quando e o que vai para a transcrição.

**Custo.** Um turno de 6h com escuta contínua transcreveria ~360 min/atendente/dia. Com preço de transcrição na casa de centavos por minuto, isso vira dezenas de reais por atendente por mês só de áudio, quase todo silêncio ou conversa irrelevante — e cobrado na chave BYO do cliente. O push-to-talk transcreve segundos, sob demanda.

**Produto.** O valor está em responder rápido ao que o atendente pergunta, não em vigiar a conversa. Escuta contínua muda a natureza do Assist (de ferramenta para monitor) e cria expectativa de proatividade que a fase atual não sustenta.

**Se a decisão mudar:** revisar este arquivo, abrir spike com (1) VAD/segmentação local para não enviar silêncio, (2) modelo de consentimento e aviso ao cliente, (3) retenção zero por padrão, (4) opt-in por workspace com custo estimado exibido. Só depois disso vira história.
