package io.ATTTT.classGPT.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LLMActivityDto {
    private Long id;                    // Reply ID
    private Long postId;                // Parent post ID
    private String postTitle;           // Post title for display
    private String llmResponsePreview;  // Truncated response preview
    private LocalDateTime createdAt;
    private boolean reviewed;
    private boolean flagged;
    private boolean endorsed;
    private String flagReason;          // Why student flagged it
    private String flaggedByName;       // Who flagged it

    public LLMActivityDto(Long id, Long postId, String postTitle, String llmResponsePreview,
                          LocalDateTime createdAt, boolean reviewed, boolean flagged, boolean endorsed) {
        this.id = id;
        this.postId = postId;
        this.postTitle = postTitle;
        this.llmResponsePreview = llmResponsePreview;
        this.createdAt = createdAt;
        this.reviewed = reviewed;
        this.flagged = flagged;
        this.endorsed = endorsed;
    }
    
    // Alias for frontend compatibility
    public Long getReplyId() {
        return id;
    }
}