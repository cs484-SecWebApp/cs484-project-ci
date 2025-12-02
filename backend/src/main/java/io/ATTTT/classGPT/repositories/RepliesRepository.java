package io.ATTTT.classGPT.repositories;

import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.models.Replies;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RepliesRepository extends JpaRepository<Replies, Long> {
    List<Replies> findByPost(Post post);

    List<Replies> findByLlmGeneratedTrueAndFlaggedTrueOrderByCreatedAtAsc();
}
