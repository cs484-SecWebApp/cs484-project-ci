package io.ATTTT.classGPT.models;
import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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
//    @JoinColumn(name = "account_id", nullable = false) //Need to put this back once login is figured out
    private Account author;

    @ManyToOne
    @JoinColumn(name = "post_id", nullable = false)
    @JsonBackReference
    private Post post;

    private boolean fromInstructor;
    
    // Fixed: Changed from LLMGenerated to llmGenerated for proper Java naming
    @Column(name = "llm_generated")
    private boolean llmGenerated;
    
    private boolean endorsed;

    @PrePersist
    protected void onCreate(){
        createdAt = LocalDateTime.now();
    }

}