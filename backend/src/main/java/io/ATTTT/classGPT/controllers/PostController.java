package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.dto.PostSummary;
import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.models.Replies;
import io.ATTTT.classGPT.repositories.RepliesRepository;
import io.ATTTT.classGPT.services.AccountService;
import io.ATTTT.classGPT.services.EnrollmentService;
import io.ATTTT.classGPT.services.GeminiService;
import io.ATTTT.classGPT.services.PostService;
import io.ATTTT.classGPT.services.CourseService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import io.ATTTT.classGPT.dto.PostSummary;
import io.ATTTT.classGPT.dto.ReplySummary;


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
    private final EnrollmentService enrollmentService;
    private final CourseService courseService;

    private PostSummary toPostSummary(Post p) {
        var course = p.getCourse();
        var author = p.getAccount();
        int replyCount = (p.getReplies() != null) ? p.getReplies().size() : 0;
        var replies = p.getReplies() != null
                ? p.getReplies().stream()
                .map(this::toReplySummary)
                .toList()
                : List.<ReplySummary>of();

        return new PostSummary(
                p.getId(),
                p.getTitle(),
                p.getBody(),
                course != null ? course.getId()   : null,
                course != null ? course.getCode() : null,
                course != null ? course.getName() : null,
                author != null ? author.getId()   : null,
                author != null ? author.getFirstName() : null,
                author != null ? author.getLastName()  : null,
                p.getCreatedAt(),
                replies.size(),
                replies
        );
    }

    private ReplySummary toReplySummary(Replies r) {
        var author = r.getAuthor();
        return new ReplySummary(
                r.getId(),
                r.getBody(),
                r.isFromInstructor(),
                r.isLlmGenerated(),
                r.isEndorsed(),
                r.isFlagged(),
                r.getParentReplyId(),
                author != null ? author.getId() : null,
                author != null ? (author.getFirstName() + " " + author.getLastName()) : null,
                r.getCreatedAt()
        );
    }


    @GetMapping
    public List<PostSummary> getAllPosts() {
        return postService.getAll()
                .stream()
                .map(this::toPostSummary)
                .toList();
    }



    @GetMapping("/classes/{courseId}")
    public List<PostSummary> getPostsForCourse(@PathVariable Long courseId,
                                               Principal principal) {
        Account me = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        if (!enrollmentService.isEnrolled(me.getId(), courseId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        List<Post> posts = postService.getPostsForCourse(courseId);

        log.info("Returning {} posts for course {}", posts.size(), courseId);
        posts.forEach(p -> log.info("  post id={} title='{}'", p.getId(), p.getTitle()));

        return posts.stream()
                .map(this::toPostSummary)
                .toList();
    }


    @PutMapping("/{id}")
    public ResponseEntity<PostSummary> updatePost(@PathVariable Long id,
                                                  @RequestBody Post incoming) {
        return postService.getById(id)
                .map(existing -> {
                    existing.setTitle(incoming.getTitle());
                    existing.setBody(incoming.getBody());
                    Post saved = postService.save(existing);
                    return ResponseEntity.ok(toPostSummary(saved));
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
    public ResponseEntity<ReplySummary> addReply(@PathVariable Long id,
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
            reply.setFromInstructor(account.hasRole("ROLE_ADMIN"));
        } else {
            Account account = accountService.findByEmail("user.user@domain.com")
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            reply.setAuthor(account);
            reply.setFromInstructor(false);
        }

        reply.setLlmGenerated(false);
        reply.setParentReplyId(req.getParentReplyId());

        Replies saved = repliesRepository.save(reply);
        return ResponseEntity.ok(toReplySummary(saved));
    }


    @PostMapping("/{id}/LLMReply")
    public ResponseEntity<ReplySummary> addLLMReply(@PathVariable Long id,
                                                    Principal principal) {
        Post post = postService.getById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        Replies reply = new Replies();
        reply.setBody(geminiService.generateReply(post));
        reply.setPost(post);
        reply.setAuthor(null);
        reply.setFromInstructor(false);
        reply.setLlmGenerated(true);
        reply.setParentReplyId(null);

        Replies saved = repliesRepository.save(reply);
        return ResponseEntity.ok(toReplySummary(saved));
    }


    @PutMapping("/{postId}/replies/{replyId}/endorse")
    public ResponseEntity<ReplySummary> endorseReply(@PathVariable Long postId,
                                                     @PathVariable Long replyId,
                                                     Principal principal) {

        Optional<Replies> replyOpt = repliesRepository.findById(replyId);
        if (replyOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Replies reply = replyOpt.get();
        if (!reply.getPost().getId().equals(postId)) {
            return ResponseEntity.badRequest().build();
        }

        reply.setEndorsed(!reply.isEndorsed());
        Replies saved = repliesRepository.save(reply);

        return ResponseEntity.ok(toReplySummary(saved));
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
                        info.flagged  = reply.isFlagged();
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

    @PutMapping("/{postId}/replies/{replyId}/flag")
    public ResponseEntity<ReplySummary> flagReply(@PathVariable Long postId,
                                                  @PathVariable Long replyId,
                                                  Principal principal) {

        Optional<Replies> replyOpt = repliesRepository.findById(replyId);
        if (replyOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Replies reply = replyOpt.get();
        if (!reply.getPost().getId().equals(postId)) {
            return ResponseEntity.badRequest().build();
        }

        if (!reply.isLlmGenerated()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        reply.setFlagged(!reply.isFlagged());
        Replies saved = repliesRepository.save(reply);
        return ResponseEntity.ok(toReplySummary(saved));
    }

    @PostMapping("/classes/{courseId}")
    public ResponseEntity<PostSummary> createPostForCourse(@PathVariable Long courseId,
                                                           @RequestBody CreatePostRequest req,
                                                           Principal principal) {
        Account me;
        if (principal != null) {
            String email = principal.getName();
            me = accountService.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        } else {
            me = accountService.findByEmail("user.user@domain.com")
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        }

        if (!enrollmentService.isEnrolled(me.getId(), courseId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        var course = courseService.getById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        Post post = new Post();
        post.setTitle(req.getTitle());
        post.setBody(req.getBody());
        post.setAccount(me);
        post.setCourse(course);

        Post saved = postService.save(post);


        return ResponseEntity.ok(toPostSummary(saved));
    }



    @Data
    public static class CreateFollowupRequest {
        private String body;
        private Long parentReplyId;
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
        public boolean flagged;
        public String replyBody;
    }

    @Data
    public static class CreatePostRequest {
        private String title;
        private String body;
    }

}