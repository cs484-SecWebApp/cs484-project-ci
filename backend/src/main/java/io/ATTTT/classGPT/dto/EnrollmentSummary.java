package io.ATTTT.classGPT.dto;

public record EnrollmentSummary(
        Long id,
        Long courseId,
        String courseCode,
        String courseName,
        String term
) {}
