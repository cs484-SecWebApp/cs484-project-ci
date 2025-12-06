package io.ATTTT.classGPT.repositories;

import io.ATTTT.classGPT.models.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findByAccount_Id(Long accountId);
    Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<Post> findByCourseIdOrderByCreatedAtDesc(Long courseId);

    @Query("""
      SELECT p
      FROM Post p
      WHERE p.course.id = :courseId
        AND (
          LOWER(p.title) LIKE LOWER(CONCAT('%', :q, '%'))
          OR LOWER(p.body)  LIKE LOWER(CONCAT('%', :q, '%'))
        )
      ORDER BY p.createdAt DESC
      """)
    List<Post> searchSimilar(@Param("courseId") Long courseId,
                             @Param("q") String q);

    @Query("SELECT DISTINCT p FROM Post p " +
            "JOIN p.account.authorities a " +
            "WHERE p.course.id = :courseId " +
            "AND (a.name = 'ROLE_ADMIN') " +
            "ORDER BY p.createdAt DESC")
    List<Post> findRecentInstructorPosts(@Param("courseId") Long courseId, Pageable pageable);
}
