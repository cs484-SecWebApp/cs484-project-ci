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

    private String contentType;

    private long sizeBytes;

    @ManyToOne(optional = false)
    private Course course;

    @ManyToOne(optional = false)
    private Account uploadedBy;

    private LocalDateTime uploadedAt;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    private byte[] data;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    private String extractedText;

    @Column(name = "indexed_in_file_search")
    private Boolean indexedInFileSearch = false;

    @Column(name = "file_search_operation_name")
    private String fileSearchOperationName;
}
