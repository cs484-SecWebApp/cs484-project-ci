package io.ATTTT.classGPT.models;


import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;


import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@SequenceGenerator(name = "post_seq", sequenceName = "post_seq", allocationSize = 1)
public class Post{

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)

    @EqualsAndHashCode.Include
    private Long id;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    private String imageFilePath;

    private LocalDateTime createdAt;

    private LocalDateTime modifiedAt;

    @ElementCollection
    @CollectionTable(
            name = "post_tags",
            joinColumns = @JoinColumn(name = "post_id")
    )
    @Column(name = "tag_value")
    private List<String> tags = new ArrayList<>();

    private boolean isPinned;

    private int upVotes;


    @ManyToOne
    @JoinColumn(name = "account_id", referencedColumnName = "id", nullable = false)
    private Account account;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonManagedReference
    private List<Replies> replies = new ArrayList<>();

    @Override
    public String toString(){
        return "Post{" +
                "id" + id +
                ", title='" + title + "'" +
                ", body='" + body + "'" +
                ", createdAt='" + createdAt + "'" +
                ", updatedAt='" + modifiedAt + "'" +
                "}";
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        modifiedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        modifiedAt = LocalDateTime.now();
    }

    @ManyToOne(optional = false)
    private Course course;

    // ========== STUDENT ANSWER (WIKI-STYLE) ==========
    
    @Column(name = "student_answer", columnDefinition = "TEXT")
    private String studentAnswer;
    
    @Column(name = "student_answer_endorsed")
    private boolean studentAnswerEndorsed = false;
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_answer_author_id")
    private Account studentAnswerAuthor;
    
    @Column(name = "student_answer_updated_at")
    private LocalDateTime studentAnswerUpdatedAt;
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_answer_endorsed_by_id")
    private Account studentAnswerEndorsedBy;
    
    @Column(name = "student_answer_endorsed_at")
    private LocalDateTime studentAnswerEndorsedAt;

    // ========== POST ENDORSEMENT ==========
    
    @Column(name = "endorsed")
    private boolean endorsed = false;
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "endorsed_by_id")
    private Account endorsedBy;
    
    @Column(name = "endorsed_at")
    private LocalDateTime endorsedAt;

}