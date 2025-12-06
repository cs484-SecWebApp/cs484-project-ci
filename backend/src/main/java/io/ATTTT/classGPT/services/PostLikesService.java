
package io.ATTTT.classGPT.services;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.models.PostLikes;
import io.ATTTT.classGPT.repositories.PostLikesRepository;
import io.ATTTT.classGPT.repositories.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PostLikesService {

    private final PostLikesRepository postLikesRepository;
    private final PostRepository postRepository;

    @Transactional
    public boolean toggleLike(Long postId, Account account) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        var existingLike = postLikesRepository.findByPostIdAndAccountId(postId, account.getId());

        if (existingLike.isPresent()) {
            postLikesRepository.delete(existingLike.get());
            post.setUpVotes(Math.max(0, post.getUpVotes() - 1));
            postRepository.save(post);
            return false;
        } else {

            PostLikes like = new PostLikes();
            like.setPost(post);
            like.setAccount(account);
            postLikesRepository.save(like);

            post.setUpVotes(post.getUpVotes() + 1);
            postRepository.save(post);
            return true;
        }
    }

    public boolean hasUserLiked(Long postId, Long accountId) {
        return postLikesRepository.existsByPostIdAndAccountId(postId, accountId);
    }


    public long getLikeCount(Long postId) {
        return postLikesRepository.countByPostId(postId);
    }
}
