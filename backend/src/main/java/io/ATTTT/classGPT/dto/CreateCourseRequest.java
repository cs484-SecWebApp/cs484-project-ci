package io.ATTTT.classGPT.dto;

public record CreateCourseRequest(
        String code,
        String name,
        String term
) {}

