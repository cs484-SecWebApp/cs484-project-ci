package io.ATTTT.classGPT.dto;

import java.time.LocalDateTime;

public record ReplySummary(
        Long id,
        String body,
        boolean fromInstructor,
        boolean llmGenerated,
        boolean endorsed,
        boolean flagged,
        Long parentReplyId,
        Long authorId,
        String authorName,
        LocalDateTime createdAt
) {}
