package io.ATTTT.classGPT.dto;

import java.time.LocalDateTime;

public record ResourceSummary(
        Long id,
        String title,
        String originalFilename,
        String contentType,
        Long courseId,
        LocalDateTime createdAt
) {}