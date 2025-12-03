package io.ATTTT.classGPT.repositories;

import io.ATTTT.classGPT.models.Course;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CourseRepository extends JpaRepository<Course, Long> {
    Optional<Course> findByJoinCode(String joinCode);
    boolean existsByJoinCode(String joinCode);
}