package io.ATTTT.classGPT.repositories;

import io.ATTTT.classGPT.models.PostLikes;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;


public interface PostLikesRepository extends JpaRepository<PostLikes, Long>{
    boolean existsByPostIdAndAccountId(Long postId, Long accountId);

    Optional<PostLikes> findByPostIdAndAccountId(Long postId, Long accountId);

    long countByPostId(Long postId);
}
