package io.ATTTT.classGPT.services;

import com.google.genai.Client;
import com.google.genai.types.CreateFileSearchStoreConfig;
import com.google.genai.types.FileSearchStore;
import io.ATTTT.classGPT.models.Course;
import io.ATTTT.classGPT.repositories.CourseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class FileSearchStoreService {

    private static final Logger log = LoggerFactory.getLogger(FileSearchStoreService.class);

    private final Client client;
    private final CourseRepository courseRepository;

    public FileSearchStoreService(Client client, CourseRepository courseRepository) {
        this.client = client;
        this.courseRepository = courseRepository;
    }


    public String ensureStoreForCourse(Course course) {
        String existing = course.getFileSearchStoreName();
        if (existing != null && !existing.isBlank()) {
            return existing;
        }

        String displayName = "course-" + course.getId() + "-" +
                (course.getName() != null ? course.getName() : "classGPT");

        CreateFileSearchStoreConfig config =
                CreateFileSearchStoreConfig.builder()
                        .displayName(displayName)
                        .build();

        FileSearchStore store = client.fileSearchStores.create(config);
        String storeName = store.name().orElseThrow(
                () -> new IllegalStateException("FileSearchStore name missing from response")
        );

        log.info("Created File Search store {} for course {}", storeName, course.getId());

        course.setFileSearchStoreName(storeName);
        courseRepository.save(course);

        return storeName;
    }
}
