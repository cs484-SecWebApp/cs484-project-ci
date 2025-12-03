package io.ATTTT.classGPT.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Resource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    private String originalFilename;

    private String storageKey;

    private String contentType;

    private long sizeBytes;

    @ManyToOne(optional = false)
    private Course course;

    @ManyToOne(optional = false)
    private Account uploadedBy;

    private LocalDateTime uploadedAt;
}
