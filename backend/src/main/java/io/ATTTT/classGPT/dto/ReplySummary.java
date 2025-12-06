package io.ATTTT.classGPT.dto;

import java.time.LocalDateTime;

public record ReplySummary(
    Long id,
    String body,
    boolean fromInstructor,
    boolean llmGenerated,
    boolean endorsed,
    boolean flagged,
    boolean reviewed,
    boolean instructorEdited,
    boolean replacedByInstructor,
    Long parentReplyId,
    Long authorId,
    String authorName,
    String editedByName,
    String flagReason,
    String originalLlmResponse,
    LocalDateTime createdAt,
    LocalDateTime editedAt,
    LocalDateTime flaggedAt
) {}
