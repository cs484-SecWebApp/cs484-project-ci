package io.ATTTT.classGPT.services;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.models.Replies;
import io.ATTTT.classGPT.repositories.PostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class PostService {

    @Autowired
    private PostRepository postRepository;

    public Optional<Post> getById(Long id){
        return postRepository.findById(id);
    }

    public List<Post> getAll(){
        return postRepository.findAll();
    }

    public List<Post> getPostsForCourse(Long courseId) {
        return postRepository.findByCourseIdOrderByCreatedAtDesc(courseId);
    }

    public Post save(Post post){
        if (post.getId() == null) {
            post.setCreatedAt(LocalDateTime.now());
        }
        post.setModifiedAt(LocalDateTime.now());
        return postRepository.save(post);
    }

    public void delete(Post post) {
        postRepository.delete(post);
    }

    /**
     * Find posts with replies (answered questions) - semantic search
     */
    public List<Post> findSimilarPosts(Long courseId, String query, int limit) {
        List<Post> all = postRepository.searchSimilar(courseId, query);
        return all.stream()
                .filter(p -> p.getReplies() != null && !p.getReplies().isEmpty())
                .limit(limit)
                .toList();
    }

    /**
     * Find recent posts that involve instructors in any way:
     * - Posts created BY instructors (announcements)
     * - Posts that HAVE instructor replies (Q&A)
     */
    public List<Post> findRecentInstructorPosts(Long courseId, int limit) {
        List<Post> recentPosts = postRepository.findByCourseIdOrderByCreatedAtDesc(courseId);

        return recentPosts.stream()
                .filter(post -> {
                    Account author = post.getAccount();

                    if (author != null) {
                        return author.hasRole("ROLE_ADMIN");
                    }

                    return post.getReplies() != null &&
                            post.getReplies().stream()
                                    .anyMatch(Replies::isFromInstructor);
                })
                .limit(limit)
                .toList();
    }


    public String buildThreadDocument(Post post) {
        StringBuilder sb = new StringBuilder();

        // Mark if this thread has instructor involvement
        boolean hasInstructorReply = post.getReplies() != null &&
                post.getReplies().stream()
                        .anyMatch(Replies::isFromInstructor);

        sb.append("[POST #").append(post.getId()).append("]");

        if (hasInstructorReply) {
            sb.append(" [INSTRUCTOR ANSWERED]");
        }

        sb.append("\n");

        sb.append("Title: ")
                .append(nullSafe(post.getTitle()))
                .append("\n\n");

        sb.append("Question/Body:\n")
                .append(stripHtml(post.getBody()))
                .append("\n\n");

        // Get the best answer (prioritizing instructor replies)
        String bestAnswer = pickBestAnswer(post);
        if (bestAnswer != null && !bestAnswer.isBlank()) {
            sb.append("Best answer");

            // Find who gave the best answer
            if (post.getReplies() != null) {
                post.getReplies().stream()
                        .filter(r -> stripHtml(r.getBody()).equals(stripHtml(bestAnswer)))
                        .findFirst()
                        .ifPresent(reply -> {
                            if (reply.isFromInstructor()) {
                                sb.append(" (FROM INSTRUCTOR)");
                            }
                        });
            }

            sb.append(":\n")
                    .append(stripHtml(bestAnswer))
                    .append("\n\n");
        } else {
            sb.append("Best answer:\n")
                    .append("(No clear answer yet.)\n\n");
        }

        sb.append("Other context:\n");
        if (post.getCreatedAt() != null) {
            sb.append("- Created at: ").append(post.getCreatedAt()).append("\n");
        }
        if (post.getCourse() != null) {
            sb.append("- Course: ")
                    .append(nullSafe(post.getCourse().getCode()))
                    .append(" ")
                    .append(nullSafe(post.getCourse().getName()))
                    .append("\n");
        }

        return sb.toString();
    }


    private String pickBestAnswer(Post post) {
        var replies = post.getReplies();
        if (replies == null || replies.isEmpty()) return null;

        // Priority 1: Endorsed instructor reply
        var best = replies.stream()
                .filter(Replies::isFromInstructor)
                .filter(Replies::isEndorsed)
                .findFirst();

        // Priority 2: Any instructor reply (even if not endorsed)
        if (best.isEmpty()) {
            best = replies.stream()
                    .filter(Replies::isFromInstructor)
                    .findFirst();
        }

        // Priority 3: Endorsed student reply
        if (best.isEmpty()) {
            best = replies.stream()
                    .filter(r -> !r.isFromInstructor())
                    .filter(Replies::isEndorsed)
                    .findFirst();
        }

        // Priority 4: Non-LLM generated reply
        if (best.isEmpty()) {
            best = replies.stream()
                    .filter(r -> !r.isLlmGenerated())
                    .findFirst();
        }

        // Priority 5: Even LLM-generated is better than nothing
        if (best.isEmpty()) {
            best = replies.stream()
                    .filter(Replies::isLlmGenerated)
                    .findFirst();
        }

        return best.map(Replies::getBody).orElse(null);
    }

    private String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private String stripHtml(String html) {
        return html == null ? "" : html.replaceAll("<[^>]+>", "");
    }
}