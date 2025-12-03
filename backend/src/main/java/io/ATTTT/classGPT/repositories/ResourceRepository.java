package io.ATTTT.classGPT.repositories;

import io.ATTTT.classGPT.models.Resource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ResourceRepository extends JpaRepository<Resource, Long> {

    List<Resource> findByCourseIdOrderByUploadedAtDesc(Long courseId);
}
