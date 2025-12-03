package io.ATTTT.classGPT.dto;

import io.ATTTT.classGPT.models.Enrollment;

public record EnrollmentResponse(
        Long id,
        Long courseId,
        String courseName
) {
    public static EnrollmentResponse from(Enrollment e) {
        return new EnrollmentResponse(
                e.getId(),
                e.getCourse().getId(),
                e.getCourse().getName()
        );
    }
}
