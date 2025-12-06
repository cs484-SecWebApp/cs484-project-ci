package io.ATTTT.classGPT.models;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
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

    @ManyToOne
    private Account author;

    @ManyToOne
    @JoinColumn(name = "post_id", nullable = false)
    @JsonBackReference
    private Post post;

    private boolean fromInstructor;

    @Column(name = "llm_generated")
    private boolean llmGenerated;

    private boolean endorsed;

    @Column(name = "parent_reply_id")
    private Long parentReplyId;

    // ========== FLAGGING FIELDS ==========

    @Column(nullable = false)
    private boolean flagged = false;

    @Column(name = "flagged_at")
    private LocalDateTime flaggedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "flagged_by_id")
    @JsonIgnore
    private Account flaggedBy;

    @Column(name = "flag_reason", length = 500)
    private String flagReason;

    // ========== REVIEW FIELDS ==========

    @Column(name = "reviewed")
    private boolean reviewed = false;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "reviewed_by_id")
    @JsonIgnore
    private Account reviewedBy;

    @Column(name = "review_feedback", length = 1000)
    private String reviewFeedback;

    // ========== INSTRUCTOR EDIT FIELDS ==========

    @Column(name = "instructor_edited")
    private boolean instructorEdited = false;

    @Column(name = "replaced_by_instructor")
    private boolean replacedByInstructor = false;

    @Column(name = "edited_at")
    private LocalDateTime editedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "edited_by_id")
    @JsonIgnore
    private Account editedBy;

    // ========== ORIGINAL LLM RESPONSE (for learning) ==========

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

    // ========== COMPUTED JSON PROPERTIES ==========
    // These provide readable names in JSON without exposing full Account entities

    @com.fasterxml.jackson.annotation.JsonProperty("editedByName")
    public String getEditedByName() {
        try {
            if (editedBy == null) return null;
            String firstName = editedBy.getFirstName();
            String lastName = editedBy.getLastName();
            if (firstName == null && lastName == null) return null;
            return ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
        } catch (Exception e) {
            return null;
        }
    }

    @com.fasterxml.jackson.annotation.JsonProperty("flaggedByName")
    public String getFlaggedByName() {
        try {
            if (flaggedBy == null) return null;
            String firstName = flaggedBy.getFirstName();
            String lastName = flaggedBy.getLastName();
            if (firstName == null && lastName == null) return null;
            return ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
        } catch (Exception e) {
            return null;
        }
    }

    @com.fasterxml.jackson.annotation.JsonProperty("reviewedByName")
    public String getReviewedByName() {
        try {
            if (reviewedBy == null) return null;
            String firstName = reviewedBy.getFirstName();
            String lastName = reviewedBy.getLastName();
            if (firstName == null && lastName == null) return null;
            return ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
        } catch (Exception e) {
            return null;
        }
    }
}