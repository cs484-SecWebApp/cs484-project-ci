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
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;


@Service
public class ResourceService {

    private static final Logger log = LoggerFactory.getLogger(ResourceService.class);

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

        String effectiveTitle = (title != null && !title.isBlank())
                ? title
                : file.getOriginalFilename();
        r.setTitle(effectiveTitle);

        // Store raw bytes in DB
        byte[] bytes = file.getBytes();
        r.setData(bytes);

        // Optional: extracted text for debugging / fallback
        String extracted = extractTextFromFile(file, bytes);
        r.setExtractedText(extracted);

        // Ensure course has a File Search store
        String storeName = fileSearchStoreService.ensureStoreForCourse(course);

        // Upload to File Search store
        try {
            UploadToFileSearchStoreConfig uploadConfig =
                    UploadToFileSearchStoreConfig.builder()
                            .displayName(effectiveTitle)
                            .mimeType(file.getContentType())
                            .build();

            UploadToFileSearchStoreOperation op =
                    client.fileSearchStores.uploadToFileSearchStore(
                            storeName,
                            bytes,
                            uploadConfig
                    );

            op.name().ifPresent(name ->
                    log.info("UploadToFileSearchStore operation for course {}: {}", courseId, name)
            );

        } catch (Exception e) {
            log.warn("Failed to upload to File Search store {} for course {}", storeName, courseId, e);
        }

        return resourceRepository.save(r);
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

    public List<Resource> listForCourse(Long courseId) {
        return resourceRepository.findByCourseIdOrderByUploadedAtDesc(courseId);
    }


    private String extractTextFromPdf(byte[] bytes) throws IOException {
        try (PDDocument document = PDDocument.load(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    public void deleteResource(Account requester, Long resourceId) {
        resourceRepository.deleteById(resourceId);
    }
}
