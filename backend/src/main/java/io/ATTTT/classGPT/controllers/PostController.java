package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.models.Replies;
import io.ATTTT.classGPT.repositories.RepliesRepository;
import io.ATTTT.classGPT.services.AccountService;
import io.ATTTT.classGPT.services.GeminiService;
import io.ATTTT.classGPT.services.PostService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private static final Logger log = LoggerFactory.getLogger(PostController.class);

    private final PostService postService;
    private final GeminiService geminiService;
    private final AccountService accountService;
    private final RepliesRepository repliesRepository;


    @GetMapping
    public List<Post> getAllPosts() {
        return postService.getAll();
    }


    @GetMapping("/{id}")
    public ResponseEntity<Post> getPost(@PathVariable Long id){
        return postService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
//    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Post> createPost(@RequestBody Post incoming,
                                           Principal principal) {
//        String email = principal.getName();
//        Account account = accountService.findByEmail(email)
//                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        Account account;

        if (principal != null) { //Temp anonymous implementation (will be removed once log in is handled
            String email = principal.getName();
            account = accountService.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        } else {
            // fallback demo user
            account = accountService.findByEmail("user.user@domain.com")
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        }

        Post post = new Post();
        post.setTitle(incoming.getTitle());
        post.setBody(incoming.getBody());
        post.setAccount(account);

        Post saved = postService.save(post);
        return ResponseEntity.ok(saved);
    }


    @PutMapping("/{id}")
//    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Post> updatePost(@PathVariable Long id,
                                           @RequestBody Post incoming) {

        return postService.getById(id)
                .map(existing -> {
                    existing.setTitle(incoming.getTitle());
                    existing.setBody(incoming.getBody());
                    Post saved = postService.save(existing);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }


    @DeleteMapping("/{id}")
//    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Object> deletePost(@PathVariable Long id) {
        return postService.getById(id)
                .map(post -> {
                    postService.delete(post);
                    return ResponseEntity.noContent().build();
                })
                .orElse(ResponseEntity.notFound().build());
    }


    @PostMapping("/{id}/replies")
//    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Object> addReply(@PathVariable Long id,
                                           @RequestBody CreateFollowupRequest req,
                                           Principal principal) {
        Post post = postService.getById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        Replies reply = new Replies();
        reply.setBody(req.getBody());
        reply.setPost(post);

        if (principal != null) {
            String email = principal.getName();
            Account account = accountService.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            reply.setAuthor(account);
            // Check if the author has ROLE_ADMIN (instructor)
            reply.setFromInstructor(account.hasRole("ROLE_ADMIN"));
        } else {
            // Fallback for anonymous posts
            Account account = accountService.findByEmail("user.user@domain.com")
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            reply.setAuthor(account);
            reply.setFromInstructor(false);
        }

        reply.setLlmGenerated(false);
        Replies saved = repliesRepository.save(reply);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/LLMReply")
//    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Object> addLLMReply(@PathVariable Long id,
                                           Principal principal) {
        Post post = postService.getById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));


        Replies reply = new Replies();
        reply.setBody(geminiService.generateReply(post));
        reply.setPost(post);

        // Set author to null or a system account for AI replies
        reply.setAuthor(null);
        reply.setFromInstructor(false);
        reply.setLlmGenerated(true);
        
        Replies saved = repliesRepository.save(reply);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{postId}/replies/{replyId}/endorse")
//    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Replies> endorseReply(@PathVariable Long postId,
                                                  @PathVariable Long replyId,
                                                  Principal principal) {
        // Verify the reply exists and belongs to this post
        Optional<Replies> replyOpt = repliesRepository.findById(replyId);
        if (replyOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Replies reply = replyOpt.get();
        if (!reply.getPost().getId().equals(postId)) {
            return ResponseEntity.badRequest().build();
        }

        // Toggle endorsed status
        reply.setEndorsed(!reply.isEndorsed());
        Replies saved = repliesRepository.save(reply);
        
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/statistics")
    public ResponseEntity<StatisticsResponse> getStatistics() {
        List<Post> allPosts = postService.getAll();
        
        StatisticsResponse stats = new StatisticsResponse();
        stats.totalPosts = allPosts.size();
        stats.totalReplies = 0;
        stats.totalAIReplies = 0;
        stats.totalEndorsements = 0;
        
        List<AIGenerationInfo> aiGenerations = new ArrayList<>();
        
        for (Post post : allPosts) {
            List<Replies> replies = post.getReplies();
            if (replies != null) {
                stats.totalReplies += replies.size();
                
                for (Replies reply : replies) {
                    // Track AI generations
                    if (reply.isLlmGenerated()) {
                        stats.totalAIReplies++;
                        
                        AIGenerationInfo info = new AIGenerationInfo();
                        info.replyId = reply.getId();
                        info.postId = post.getId();
                        info.postTitle = post.getTitle();
                        info.generatedAt = reply.getCreatedAt();
                        info.endorsed = reply.isEndorsed();
                        info.replyBody = reply.getBody();
                        aiGenerations.add(info);
                    }
                    
                    // Count endorsements
                    if (reply.isEndorsed()) {
                        stats.totalEndorsements++;
                    }
                }
            }
        }
        
        // Sort AI generations by most recent
        aiGenerations.sort((a, b) -> b.generatedAt.compareTo(a.generatedAt));
        stats.aiGenerations = aiGenerations;
        
        return ResponseEntity.ok(stats);
    }

    @Data
    public static class CreateFollowupRequest {
        private String body;
    }

    @Data
    public static class StatisticsResponse {
        public int totalPosts;
        public int totalReplies;
        public int totalAIReplies;
        public int totalEndorsements;
        public List<AIGenerationInfo> aiGenerations;
    }

    @Data
    public static class AIGenerationInfo {
        public Long replyId;
        public Long postId;
        public String postTitle;
        public LocalDateTime generatedAt;
        public boolean endorsed;
        public String replyBody;
    }

}