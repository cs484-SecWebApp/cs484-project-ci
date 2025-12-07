package io.ATTTT.classGPT.models;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Replies {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String body;

    private LocalDateTime createdAt;

    private LocalDateTime modifiedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "author_id")
    @JsonIgnoreProperties({"posts", "password", "authorities"})
    private Account author;

    @ManyToOne
    @JoinColumn(name = "post_id", nullable = false)
    @JsonBackReference
    private Post post;

    @Column(name = "from_instructor")
    private boolean fromInstructor = false;
    
    // NEW: Distinguishes formal instructor answers from followup replies
    // - true: Written in the "Instructor's Answer" box (should appear in Instructor Answer section)
    // - false: Written in the followup discussion (should stay in Followup Discussions)
    @Column(name = "is_instructor_answer")
    private boolean isInstructorAnswer = false;
    
    @Column(name = "llm_generated")
    private boolean llmGenerated = false;
    
    @Column(name = "endorsed")
    private boolean endorsed = false;

    @Column(name = "parent_reply_id")
    private Long parentReplyId;

    // ========== REVIEW/ENDORSEMENT FIELDS ==========
    
    @Column(name = "reviewed")
    private boolean reviewed = false;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_id")
    @JsonIgnore
    private Account reviewedBy;

    @Column(name = "review_feedback", length = 1000)
    private String reviewFeedback;

    // ========== FLAGGING FIELDS ==========
    
    @Column(name = "flagged")
    private boolean flagged = false;

    @Column(name = "flagged_at")
    private LocalDateTime flaggedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flagged_by_id")
    @JsonIgnore
    private Account flaggedBy;

    @Column(name = "flag_reason", length = 500)
    private String flagReason;

    // ========== INSTRUCTOR EDIT FIELDS ==========
    
    @Column(name = "instructor_edited")
    private boolean instructorEdited = false;

    @Column(name = "replaced_by_instructor")
    private boolean replacedByInstructor = false;

    @Column(name = "edited_at")
    private LocalDateTime editedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "edited_by_id")
    @JsonIgnore
    private Account editedBy;

    // ========== ORIGINAL LLM RESPONSE (FOR LEARNING) ==========
    
    @Column(name = "original_llm_response", columnDefinition = "TEXT")
    private String originalLlmResponse;

    // ========== LIFECYCLE CALLBACKS ==========
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        modifiedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        modifiedAt = LocalDateTime.now();
    }

    // ========== HELPER METHODS ==========
    
    public String getFlaggedByName() {
        if (flaggedBy == null) return null;
        return (flaggedBy.getFirstName() + " " + flaggedBy.getLastName()).trim();
    }
}