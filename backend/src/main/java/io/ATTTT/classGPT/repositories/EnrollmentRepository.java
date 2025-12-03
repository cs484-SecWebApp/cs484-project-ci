package io.ATTTT.classGPT.repositories;

import io.ATTTT.classGPT.models.Enrollment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    boolean existsByAccountIdAndCourseId(Long accountId, Long courseId);
    List<Enrollment> findByAccountId(Long accountId);
}
