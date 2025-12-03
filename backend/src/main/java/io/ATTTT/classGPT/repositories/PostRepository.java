package io.ATTTT.classGPT.repositories;

import io.ATTTT.classGPT.models.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findByAccount_Id(Long accountId);
    Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<Post> findByCourseIdOrderByCreatedAtDesc(Long courseId);

}
