package io.ATTTT.classGPT.dto;

import java.time.LocalDateTime;

public record PostSummary(
        Long id,
        String title,
        String body,
        Long courseId,
        String courseCode,
        String courseName,
        Long authorId,
        String authorFirstName,
        String authorLastName,
        LocalDateTime createdAt,

        int replyCount
) {}