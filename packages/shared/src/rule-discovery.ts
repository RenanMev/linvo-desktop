import { z } from "zod";

export const ruleDiscoverySessionStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "READY",
  "FAILED",
]);

export const ruleSourceDocumentStatusSchema = z.enum([
  "PENDING",
  "EXTRACTING",
  "EXTRACTED",
  "FAILED",
]);

export const ruleCandidateCategorySchema = z.enum([
  "BUSINESS_RULE",
  "RESPONSE_PATTERN",
  "FAQ_POLICY",
]);

export const ruleCandidateStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
]);

export const ruleDiscoveryApprovalModeSchema = z.enum(["QUESTION", "ALLOW"]);

export const ruleCandidatePromotionSourceSchema = z.enum(["MANUAL", "AUTO"]);

export const ruleDiscoveryEventTypeSchema = z.enum([
  "session_started",
  "document_reading",
  "document_extracted",
  "thinking",
  "candidate_found",
  "classified",
  "auto_promoted",
  "auto_skipped",
  "document_done",
  "session_ready",
  "session_failed",
  "candidate_undone",
]);

export const ruleDiscoveryEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  seq: z.number().int(),
  type: ruleDiscoveryEventTypeSchema,
  message: z.string(),
  payload: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});

export const ruleSourceDocumentSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  status: ruleSourceDocumentStatusSchema,
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ruleCandidateSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  sourceDocumentId: z.string(),
  category: ruleCandidateCategorySchema,
  title: z.string(),
  content: z.string(),
  confidence: z.number(),
  sourceExcerpt: z.string().nullable(),
  status: ruleCandidateStatusSchema,
  promoteToRule: z.boolean().nullable(),
  promoteToKnowledge: z.boolean().nullable(),
  promotionSource: ruleCandidatePromotionSourceSchema.nullable(),
  businessRuleId: z.string().nullable(),
  knowledgeDocumentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ruleDiscoverySessionSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  status: ruleDiscoverySessionStatusSchema,
  approvalMode: ruleDiscoveryApprovalModeSchema,
  confidenceThreshold: z.number(),
  documentCount: z.number().int(),
  candidateCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ruleDiscoverySessionDetailSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  status: ruleDiscoverySessionStatusSchema,
  approvalMode: ruleDiscoveryApprovalModeSchema,
  confidenceThreshold: z.number(),
  error: z.string().nullable(),
  documents: z.array(ruleSourceDocumentSchema),
  candidates: z.array(ruleCandidateSchema),
  events: z.array(ruleDiscoveryEventSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createRuleDiscoverySessionResponseSchema = z.object({
  session: ruleDiscoverySessionDetailSchema,
});

export const listRuleDiscoverySessionsResponseSchema = z.object({
  sessions: z.array(ruleDiscoverySessionSummarySchema),
});

export const getRuleDiscoverySessionResponseSchema = z.object({
  session: ruleDiscoverySessionDetailSchema,
});

export const updateRuleDiscoverySessionInputSchema = z
  .object({
    approvalMode: ruleDiscoveryApprovalModeSchema.optional(),
    confidenceThreshold: z.number().min(0).max(1).optional(),
  })
  .refine(
    (value) =>
      value.approvalMode !== undefined || value.confidenceThreshold !== undefined,
    { message: "informe approvalMode e/ou confidenceThreshold" },
  );

export const updateRuleDiscoverySessionResponseSchema = z.object({
  session: ruleDiscoverySessionDetailSchema,
});

export const acceptRuleCandidateInputSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1).optional(),
    promoteToRule: z.boolean().optional(),
    promoteToKnowledge: z.boolean().optional(),
  })
  .refine(
    (value) => value.promoteToRule === true || value.promoteToKnowledge === true,
    {
      message: "selecione ao menos um destino (regra ou knowledge)",
    },
  );

export const promotedBusinessRuleSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  content: z.string(),
  priority: z.number().int(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const promotedKnowledgeDocumentSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  content: z.string(),
  source: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const acceptRuleCandidateResponseSchema = z.object({
  candidate: ruleCandidateSchema,
  businessRule: promotedBusinessRuleSchema.optional(),
  knowledgeDocument: promotedKnowledgeDocumentSchema.optional(),
});

export const rejectRuleCandidateResponseSchema = z.object({
  candidate: ruleCandidateSchema,
});

export const undoRuleCandidateResponseSchema = z.object({
  candidate: ruleCandidateSchema,
});

export type RuleDiscoverySessionStatus = z.infer<
  typeof ruleDiscoverySessionStatusSchema
>;
export type RuleSourceDocumentStatus = z.infer<
  typeof ruleSourceDocumentStatusSchema
>;
export type RuleCandidateCategory = z.infer<typeof ruleCandidateCategorySchema>;
export type RuleCandidateStatus = z.infer<typeof ruleCandidateStatusSchema>;
export type RuleDiscoveryApprovalMode = z.infer<
  typeof ruleDiscoveryApprovalModeSchema
>;
export type RuleCandidatePromotionSource = z.infer<
  typeof ruleCandidatePromotionSourceSchema
>;
export type RuleDiscoveryEventType = z.infer<
  typeof ruleDiscoveryEventTypeSchema
>;
export type RuleDiscoveryEvent = z.infer<typeof ruleDiscoveryEventSchema>;
export type RuleSourceDocument = z.infer<typeof ruleSourceDocumentSchema>;
export type RuleCandidate = z.infer<typeof ruleCandidateSchema>;
export type RuleDiscoverySessionSummary = z.infer<
  typeof ruleDiscoverySessionSummarySchema
>;
export type RuleDiscoverySessionDetail = z.infer<
  typeof ruleDiscoverySessionDetailSchema
>;
export type CreateRuleDiscoverySessionResponse = z.infer<
  typeof createRuleDiscoverySessionResponseSchema
>;
export type ListRuleDiscoverySessionsResponse = z.infer<
  typeof listRuleDiscoverySessionsResponseSchema
>;
export type GetRuleDiscoverySessionResponse = z.infer<
  typeof getRuleDiscoverySessionResponseSchema
>;
export type UpdateRuleDiscoverySessionInput = z.infer<
  typeof updateRuleDiscoverySessionInputSchema
>;
export type UpdateRuleDiscoverySessionResponse = z.infer<
  typeof updateRuleDiscoverySessionResponseSchema
>;
export type AcceptRuleCandidateInput = z.infer<
  typeof acceptRuleCandidateInputSchema
>;
export type AcceptRuleCandidateResponse = z.infer<
  typeof acceptRuleCandidateResponseSchema
>;
export type RejectRuleCandidateResponse = z.infer<
  typeof rejectRuleCandidateResponseSchema
>;
export type UndoRuleCandidateResponse = z.infer<
  typeof undoRuleCandidateResponseSchema
>;
