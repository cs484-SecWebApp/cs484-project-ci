package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.dto.PostSummary;
import io.ATTTT.classGPT.dto.LLMActivityDto;
import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.models.Replies;
import io.ATTTT.classGPT.repositories.RepliesRepository;
import io.ATTTT.classGPT.services.AccountService;
import io.ATTTT.classGPT.services.EnrollmentService;
import io.ATTTT.classGPT.services.GeminiService;
import io.ATTTT.classGPT.services.PostService;
import io.ATTTT.classGPT.services.CourseService;
import io.ATTTT.classGPT.services.PostLikesService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import io.ATTTT.classGPT.dto.ReplySummary;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

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
    private final PostLikesService postLikesService;

    // ============================================
    // HELPER METHODS
    // ============================================

    private PostSummary toPostSummary(Post p, Account currentUser) {
        var course = p.getCourse();
        var author = p.getAccount();
        int replyCount = (p.getReplies() != null) ? p.getReplies().size() : 0;
        var replies = p.getReplies() != null
                ? p.getReplies().stream()
                .map(this::toReplySummary)
                .toList()
                : List.<ReplySummary>of();

        boolean currentUserLiked = currentUser != null &&
                postLikesService.hasUserLiked(p.getId(), currentUser.getId());

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
                p.getModifiedAt(),
                replies.size(),
                replies,
                p.getUpVotes(),
                currentUserLiked
        );
    }

    private ReplySummary toReplySummary(Replies r) {
        var author = r.getAuthor();
        var editedBy = r.getEditedBy();
        return new ReplySummary(
                r.getId(),
                r.getBody(),
                r.isFromInstructor(),
                r.isLlmGenerated(),
                r.isEndorsed(),
                r.isFlagged(),
                r.isReviewed(),
                r.isInstructorEdited(),
                r.isReplacedByInstructor(),
                r.getParentReplyId(),
                author != null ? author.getId() : null,
                author != null ? (author.getFirstName() + " " + author.getLastName()) : null,
                editedBy != null ? (editedBy.getFirstName() + " " + editedBy.getLastName()) : null,
                r.getFlagReason(),
                r.getOriginalLlmResponse(),
                r.getCreatedAt(),
                r.getEditedAt(),
                r.getFlaggedAt()
        );
    }

    private Account getCurrentUser(Principal principal) {
        if (principal == null) {
            return null;
        }
        return accountService.findByEmail(principal.getName()).orElse(null);
    }

    // ============================================
    // POST CRUD ENDPOINTS
    // ============================================

    @GetMapping
    public List<PostSummary> getAllPosts(Principal principal) {
        Account currentUser = getCurrentUser(principal);

        return postService.getAll()
                .stream()
                .map(p -> toPostSummary(p, currentUser))
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Post> getPostById(@PathVariable Long id, Principal principal) {
        return postService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
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
                .map(p -> toPostSummary(p, me))
                .toList();
    }

    @PutMapping("/{id}")
    public ResponseEntity<PostSummary> updatePost(@PathVariable Long id,
                                                  @RequestBody Post incoming,
                                                  Principal principal) {
        Account currentUser = getCurrentUser(principal);

        return postService.getById(id)
                .map(existing -> {
                    existing.setTitle(incoming.getTitle());
                    existing.setBody(incoming.getBody());
                    existing.setModifiedAt(LocalDateTime.now());
                    Post saved = postService.save(existing);
                    return ResponseEntity.ok(toPostSummary(saved, currentUser));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Object> deletePost(@PathVariable Long id) {
        return postService.getById(id)
                .map(post -> {
                    postService.delete(post);
                    return ResponseEntity.noContent().build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ============================================
    // REPLY ENDPOINTS
    // ============================================

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
        reply.setReviewed(false);  // Mark as unreviewed initially

        Replies saved = repliesRepository.save(reply);
        return ResponseEntity.ok(toReplySummary(saved));
    }

    // ============================================
    // ENDORSEMENT ENDPOINT
    // ============================================

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

        Account account = null;
        if (principal != null) {
            account = accountService.findByEmail(principal.getName()).orElse(null);
        }

        boolean wasEndorsed = reply.isEndorsed();
        reply.setEndorsed(!wasEndorsed);
        
        // If endorsing an LLM reply, also mark it as reviewed and clear flags
        if (reply.isLlmGenerated() && reply.isEndorsed()) {
            reply.setReviewed(true);
            reply.setReviewedAt(LocalDateTime.now());
            reply.setReviewedBy(account);
            
            // Clear any flags since instructor has endorsed it
            reply.setFlagged(false);
            reply.setFlaggedAt(null);
            reply.setFlaggedBy(null);
            reply.setFlagReason(null);
            
            // Learning happens automatically via GeminiService RAG:
            // - Endorsed responses remain in forum context
            // - GeminiService will include them in future similar questions
            log.info("AI response {} endorsed by instructor {}. Will be included in future RAG context.", 
                    replyId, account != null ? account.getEmail() : "unknown");
        }
        
        Replies saved = repliesRepository.save(reply);

        return ResponseEntity.ok(toReplySummary(saved));
    }

    // ============================================
    // LLM ACTIVITY ENDPOINTS
    // ============================================

    /**
     * Get only FLAGGED LLM responses for a course (for instructor notification bell)
     */
    @GetMapping("/classes/{courseId}/flagged-responses")
    public ResponseEntity<List<LLMActivityDto>> getFlaggedResponses(
            @PathVariable Long courseId,
            Principal principal) {

        Account account = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        // Verify instructor has access to this course
        if (!enrollmentService.isEnrolled(account.getId(), courseId) &&
                !account.hasRole("ROLE_ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        // Get all posts for this course
        List<Post> posts = postService.getPostsForCourse(courseId);

        // Extract only FLAGGED LLM replies
        List<LLMActivityDto> flaggedResponses = posts.stream()
                .flatMap(post -> post.getReplies().stream()
                        .filter(reply -> reply.isLlmGenerated() && reply.isFlagged())
                        .map(reply -> {
                            LLMActivityDto dto = new LLMActivityDto(
                                reply.getId(),
                                post.getId(),
                                post.getTitle(),
                                reply.getBody().length() > 100
                                        ? reply.getBody().substring(0, 100) + "..."
                                        : reply.getBody(),
                                reply.getCreatedAt(),
                                reply.isReviewed(),
                                reply.isFlagged(),
                                reply.isEndorsed()
                            );
                            dto.setFlagReason(reply.getFlagReason());
                            dto.setFlaggedByName(reply.getFlaggedByName());
                            return dto;
                        }))
                .sorted((a, b) -> {
                    // Sort: unreviewed first, then by date descending
                    if (a.isReviewed() != b.isReviewed()) {
                        return a.isReviewed() ? 1 : -1;
                    }
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(flaggedResponses);
    }

    /**
     * Get all LLM activity for a course (for statistics/full view)
     */
    @GetMapping("/classes/{courseId}/llm-activity")
    public ResponseEntity<List<LLMActivityDto>> getLLMActivity(
            @PathVariable Long courseId,
            Principal principal) {

        Account account = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        // Verify instructor has access to this course
        if (!enrollmentService.isEnrolled(account.getId(), courseId) &&
                !account.hasRole("ROLE_ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        // Get all posts for this course
        List<Post> posts = postService.getPostsForCourse(courseId);

        // Extract all LLM replies
        List<LLMActivityDto> llmActivity = posts.stream()
                .flatMap(post -> post.getReplies().stream()
                        .filter(Replies::isLlmGenerated)
                        .map(reply -> new LLMActivityDto(
                                reply.getId(),
                                post.getId(),
                                post.getTitle(),
                                reply.getBody().length() > 100
                                        ? reply.getBody().substring(0, 100) + "..."
                                        : reply.getBody(),
                                reply.getCreatedAt(),
                                reply.isReviewed(),
                                reply.isFlagged(),
                                reply.isEndorsed()
                        )))
                .sorted((a, b) -> {
                    // Sort: unreviewed first, then flagged, then by date descending
                    if (a.isReviewed() != b.isReviewed()) {
                        return a.isReviewed() ? 1 : -1;
                    }
                    if (a.isFlagged() != b.isFlagged()) {
                        return a.isFlagged() ? -1 : 1;
                    }
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(llmActivity);
    }

    // ============================================
    // REVIEW ENDPOINTS
    // ============================================

    /**
     * Mark a reply as reviewed
     */
    @PutMapping("/{postId}/replies/{replyId}/review")
    public ResponseEntity<?> markReplyAsReviewed(
            @PathVariable Long postId,
            @PathVariable Long replyId,
            @RequestBody ReviewRequest request,
            Principal principal) {

        Account account = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        // Verify instructor role
        if (!account.hasRole("ROLE_ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only instructors can review responses");
        }

        Replies reply = repliesRepository.findById(replyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reply not found"));

        reply.setReviewed(true);
        reply.setReviewedAt(LocalDateTime.now());
        reply.setReviewedBy(account);

        if (request.getFeedback() != null) {
            reply.setReviewFeedback(request.getFeedback());
        }

        repliesRepository.save(reply);

        return ResponseEntity.ok().build();
    }

    /**
     * Update reply content (instructor editing LLM response)
     * Keeps llmGenerated=true but marks as edited by instructor.
     * 
     * LEARNING: The edited response stays in the forum with fromInstructor indicators.
     * GeminiService will include this in future RAG context, giving it higher priority
     * via the [INSTRUCTOR ANSWERED] tag in buildThreadDocument().
     */
    @PutMapping("/{postId}/replies/{replyId}")
    public ResponseEntity<ReplySummary> updateReply(
            @PathVariable Long postId,
            @PathVariable Long replyId,
            @RequestBody UpdateReplyRequest request,
            Principal principal) {

        Account account = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        // Verify instructor role
        if (!account.hasRole("ROLE_ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only instructors can edit responses");
        }

        Replies reply = repliesRepository.findById(replyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reply not found"));

        // Store original for reference (can be used for future fine-tuning)
        if (reply.isLlmGenerated() && reply.getOriginalLlmResponse() == null) {
            reply.setOriginalLlmResponse(reply.getBody());
        }

        // Update response content
        reply.setBody(request.getBody());
        reply.setInstructorEdited(true);
        reply.setEditedAt(LocalDateTime.now());
        reply.setEditedBy(account);
        
        // Mark as reviewed and endorsed
        reply.setReviewed(true);
        reply.setReviewedAt(LocalDateTime.now());
        reply.setReviewedBy(account);
        reply.setEndorsed(true);
        
        // Clear any flags since instructor has addressed it
        reply.setFlagged(false);
        reply.setFlaggedAt(null);
        reply.setFlaggedBy(null);
        reply.setFlagReason(null);

        // NOTE: llmGenerated stays TRUE - this is still an AI response, just edited
        // This allows it to still show as "AI Tutor" but with "Edited by Professor" badge

        if (request.getFeedback() != null) {
            reply.setReviewFeedback(request.getFeedback());
        }

        Replies saved = repliesRepository.save(reply);
        
        // Learning via GeminiService RAG:
        // This edited response will be included in future similar questions
        // The instructor edit is stored and the response is now endorsed
        log.info("AI response {} edited by instructor {}. Will be prioritized in future RAG context.", 
                replyId, account.getEmail());

        return ResponseEntity.ok(toReplySummary(saved));
    }

    /**
     * Replace LLM response entirely with instructor's answer.
     * Sets llmGenerated=false, marks as instructor response.
     * 
     * LEARNING: The replacement becomes a true instructor answer.
     * GeminiService will include this in findRecentInstructorPosts() and
     * mark it with [INSTRUCTOR ANSWERED] for highest priority in RAG.
     */
    @PutMapping("/{postId}/replies/{replyId}/replace")
    public ResponseEntity<ReplySummary> replaceLLMResponse(
            @PathVariable Long postId,
            @PathVariable Long replyId,
            @RequestBody UpdateReplyRequest request,
            Principal principal) {

        Account account = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        if (!account.hasRole("ROLE_ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        Replies reply = repliesRepository.findById(replyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        // Store original LLM response for reference (can be used for future fine-tuning)
        if (reply.isLlmGenerated()) {
            reply.setOriginalLlmResponse(reply.getBody());
            reply.setLlmGenerated(false); // Mark as no longer AI-generated
        }

        reply.setBody(request.getBody());
        reply.setInstructorEdited(true);
        reply.setReplacedByInstructor(true);
        reply.setEditedAt(LocalDateTime.now());
        reply.setEditedBy(account);
        reply.setReviewed(true);
        reply.setReviewedAt(LocalDateTime.now());
        reply.setReviewedBy(account);
        reply.setEndorsed(true);
        reply.setFromInstructor(true);  // This is now an instructor answer!
        
        // Clear any flags since instructor has replaced it
        reply.setFlagged(false);
        reply.setFlaggedAt(null);
        reply.setFlaggedBy(null);
        reply.setFlagReason(null);

        if (request.getFeedback() != null) {
            reply.setReviewFeedback(request.getFeedback());
        }

        Replies saved = repliesRepository.save(reply);
        
        // Learning via GeminiService RAG:
        // This is now fromInstructor=true, so it will be picked up by
        // findRecentInstructorPosts() and given [INSTRUCTOR ANSWERED] priority
        log.info("AI response {} replaced by instructor {}. Now marked as instructor answer for RAG.", 
                replyId, account.getEmail());

        return ResponseEntity.ok(toReplySummary(saved));
    }

    /**
     * Flag an LLM response (for students)
     */
    @PutMapping("/{postId}/replies/{replyId}/flag")
    public ResponseEntity<ReplySummary> flagReply(@PathVariable Long postId,
                                                  @PathVariable Long replyId,
                                                  @RequestBody(required = false) FlagRequest request,
                                                  Principal principal) {

        Account account = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

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
        
        if (reply.isFlagged()) {
            reply.setFlaggedAt(LocalDateTime.now());
            reply.setFlaggedBy(account);
            if (request != null && request.getReason() != null) {
                reply.setFlagReason(request.getReason());
            }
        } else {
            // Unflagging - clear the flag info
            reply.setFlaggedAt(null);
            reply.setFlaggedBy(null);
            reply.setFlagReason(null);
        }
        
        Replies saved = repliesRepository.save(reply);
        return ResponseEntity.ok(toReplySummary(saved));
    }

    // ============================================
    // STATISTICS ENDPOINT
    // ============================================

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
                        info.flagged = reply.isFlagged();
                        info.reviewed = reply.isReviewed();
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

    // ============================================
    // CREATE POST FOR COURSE
    // ============================================

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

        return ResponseEntity.ok(toPostSummary(saved, me));
    }

    // ============================================
    // LIKE ENDPOINT
    // ============================================

    @PostMapping("/{postId}/like")
    public ResponseEntity<LikeResponse> toggleLike(@PathVariable Long postId,
                                                   Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Account account = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        boolean liked = postLikesService.toggleLike(postId, account);
        long likeCount = postLikesService.getLikeCount(postId);

        LikeResponse response = new LikeResponse();
        response.liked = liked;
        response.likeCount = likeCount;

        return ResponseEntity.ok(response);
    }

    // ============================================
    // REQUEST/RESPONSE DTOs
    // ============================================

    @Data
    public static class CreateFollowupRequest {
        private String body;
        private Long parentReplyId;
    }

    @Data
    public static class CreatePostRequest {
        private String title;
        private String body;
    }

    @Data
    public static class ReviewRequest {
        private boolean reviewed;
        private String feedback;
    }

    @Data
    public static class UpdateReplyRequest {
        private String body;
        private boolean instructorEdited;
        private String feedback;
    }

    @Data
    public static class FlagRequest {
        private String reason;
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
        public boolean reviewed;
        public String replyBody;
    }

    @Data
    public static class LikeResponse {
        public boolean liked;
        public long likeCount;
    }
}