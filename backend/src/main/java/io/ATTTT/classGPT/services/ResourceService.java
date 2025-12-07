package io.ATTTT.classGPT.services;

import com.google.genai.Client;
import com.google.genai.types.UploadToFileSearchStoreConfig;
import com.google.genai.types.UploadToFileSearchStoreOperation;
import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Course;
import io.ATTTT.classGPT.models.Resource;
import io.ATTTT.classGPT.repositories.CourseRepository;
import io.ATTTT.classGPT.repositories.ResourceRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Service
public class ResourceService {

    private static final Logger log = LoggerFactory.getLogger(ResourceService.class);
    private static final long INDEXING_WAIT_MS = 10000; // 10 seconds

    private final ResourceRepository resourceRepository;
    private final CourseRepository courseRepository;
    private final Client client;
    private final FileSearchStoreService fileSearchStoreService;

    public ResourceService(ResourceRepository resourceRepository,
                           CourseRepository courseRepository,
                           FileSearchStoreService fileSearchStoreService,
                           @Value("${spring.ai.google.genai.api-key}") String apiKey) {
        this.resourceRepository = resourceRepository;
        this.courseRepository = courseRepository;
        this.fileSearchStoreService = fileSearchStoreService;
        this.client = Client.builder()
                .apiKey(apiKey)
                .build();
    }

    public Resource uploadResource(Account uploader,
                                   Long courseId,
                                   String title,
                                   MultipartFile file) throws IOException {

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found"));

        Resource r = new Resource();
        r.setCourse(course);
        r.setUploadedBy(uploader);
        r.setUploadedAt(LocalDateTime.now());
        r.setOriginalFilename(file.getOriginalFilename());
        r.setContentType(file.getContentType());
        r.setSizeBytes(file.getSize());

        String rawTitle = (title != null && !title.isBlank())
                ? title
                : file.getOriginalFilename();

        String effectiveTitle = rawTitle.replaceAll("[^a-zA-Z0-9.-]", "_");
        r.setTitle(rawTitle);

        byte[] bytes = file.getBytes();
        r.setData(bytes);

        String extracted = extractTextFromFile(file, bytes);
        r.setExtractedText(extracted);

        // Save to database first
        Resource savedResource = resourceRepository.save(r);

        // Upload to File Search asynchronously with corrected MIME type
        String storeName = fileSearchStoreService.ensureStoreForCourse(course);
        String effectiveMimeType = getEffectiveMimeType(file.getOriginalFilename(), file.getContentType());
        
        log.info("Uploading to File Search: filename={}, mimeType={}", 
                file.getOriginalFilename(), effectiveMimeType);
        
        uploadToFileSearchAsync(savedResource.getId(), storeName, effectiveTitle,
                bytes, effectiveMimeType);

        return savedResource;
    }

    /**
     * Get the correct MIME type for a file.
     * Browsers often send application/octet-stream for .md files,
     * which Gemini may not handle correctly.
     */
    private String getEffectiveMimeType(String filename, String originalMimeType) {
        if (filename != null) {
            String lower = filename.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
                return "text/markdown";
            }
            if (lower.endsWith(".txt")) {
                return "text/plain";
            }
            if (lower.endsWith(".json")) {
                return "application/json";
            }
            if (lower.endsWith(".csv")) {
                return "text/csv";
            }
            if (lower.endsWith(".html") || lower.endsWith(".htm")) {
                return "text/html";
            }
        }
        return originalMimeType != null ? originalMimeType : "application/octet-stream";
    }

    @Async
    public CompletableFuture<Void> uploadToFileSearchAsync(Long resourceId,
                                                           String storeName,
                                                           String displayName,
                                                           byte[] bytes,
                                                           String mimeType) {
        return CompletableFuture.runAsync(() -> {
            try {
                UploadToFileSearchStoreConfig uploadConfig =
                        UploadToFileSearchStoreConfig.builder()
                                .displayName(displayName)
                                .mimeType(mimeType)
                                .build();

                UploadToFileSearchStoreOperation op =
                        client.fileSearchStores.uploadToFileSearchStore(
                                storeName,
                                bytes,
                                uploadConfig
                        );

                String operationName = op.name().orElse("unknown");
                log.info("Started File Search upload operation: {}", operationName);

                // Wait for indexing
                Thread.sleep(INDEXING_WAIT_MS);

                // Mark resource as indexed in database
                resourceRepository.findById(resourceId).ifPresent(resource -> {
                    resource.setIndexedInFileSearch(true);
                    resource.setFileSearchOperationName(operationName);
                    resourceRepository.save(resource);
                    log.info("Resource {} marked as indexed in File Search", resourceId);
                });

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.error("File Search upload interrupted for resource {}", resourceId, e);
            } catch (Exception e) {
                log.error("Failed to upload resource {} to File Search", resourceId, e);
            }
        });
    }

    private String extractTextFromFile(MultipartFile file, byte[] bytes) {
        String filename = file.getOriginalFilename();
        String contentType = file.getContentType();

        String lowerName = filename != null ? filename.toLowerCase(Locale.ROOT) : "";
        String lowerType = contentType != null ? contentType.toLowerCase(Locale.ROOT) : "";

        try {
            if (lowerName.endsWith(".pdf") || lowerType.contains("pdf")) {
                return extractTextFromPdf(bytes);
            }

            if (lowerType.startsWith("text/")
                    || lowerName.endsWith(".txt")
                    || lowerName.endsWith(".md")
                    || lowerName.endsWith(".csv")) {
                return new String(bytes, StandardCharsets.UTF_8);
            }

        } catch (Exception e) {
            log.warn("Failed to extract text from file {}: {}", filename, e.getMessage());
        }

        return null;
    }

    private String extractTextFromPdf(byte[] bytes) throws IOException {
        try (PDDocument document = PDDocument.load(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(document);
        }
    }

    public List<Resource> listForCourse(Long courseId) {
        return resourceRepository.findByCourseIdOrderByUploadedAtDesc(courseId);
    }

    public void deleteResource(Account requester, Long resourceId) {
        resourceRepository.deleteById(resourceId);
    }


    public boolean areCourseResourcesIndexed(Long courseId) {
        List<Resource> resources = resourceRepository.findByCourseIdOrderByUploadedAtDesc(courseId);

        if (resources.isEmpty()) {
            return true; // No resources to index
        }

        return resources.stream()
                .allMatch(r -> r.getIndexedInFileSearch() != null && r.getIndexedInFileSearch());
    }


    public long getIndexingCount(Long courseId) {
        List<Resource> resources = resourceRepository.findByCourseIdOrderByUploadedAtDesc(courseId);
        return resources.stream()
                .filter(r -> r.getIndexedInFileSearch() == null || !r.getIndexedInFileSearch())
                .count();
    }

    public Optional<Resource> findByCourseAndSnippet(Long courseId, String snippetRaw) {
        if (snippetRaw == null || snippetRaw.isBlank()) return Optional.empty();

        String snippet = snippetRaw.replaceAll("\\s+", " ").trim();
        if (snippet.length() > 400) {
            snippet = snippet.substring(0, 400);
        }

        List<Resource> resources = resourceRepository.findByCourseIdOrderByUploadedAtDesc(courseId);
        for (Resource r : resources) {
            String extracted = r.getExtractedText();
            if (extracted == null || extracted.isBlank()) continue;

            String normalized = extracted.replaceAll("\\s+", " ");
            if (normalized.contains(snippet)) {
                return Optional.of(r);
            }
        }

        return Optional.empty();
    }
}