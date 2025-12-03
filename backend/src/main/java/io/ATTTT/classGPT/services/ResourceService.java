package io.ATTTT.classGPT.services;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Course;
import io.ATTTT.classGPT.models.Resource;
import io.ATTTT.classGPT.repositories.CourseRepository;
import io.ATTTT.classGPT.repositories.ResourceRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ResourceService {

    private final ResourceRepository resourceRepo;
    private final CourseRepository courseRepo;
    private final FileService fileService;

    public ResourceService(ResourceRepository resourceRepo,
                           CourseRepository courseRepo,
                           FileService fileService) {
        this.resourceRepo = resourceRepo;
        this.courseRepo = courseRepo;
        this.fileService = fileService;
    }

    public List<Resource> listForCourse(Long courseId) {
        return resourceRepo.findByCourseIdOrderByUploadedAtDesc(courseId);
    }

    public Resource uploadResource(Account uploader,
                                   Long courseId,
                                   String title,
                                   MultipartFile file) throws IOException {

        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found"));

        if (!uploader.hasRole("ROLE_ADMIN")) {
            throw new SecurityException("Only instructors/admins can upload resources");
        }

        String storageKey = fileService.storeCourseFile(courseId, file);

        Resource r = new Resource();
        r.setCourse(course);
        r.setUploadedBy(uploader);
        r.setUploadedAt(LocalDateTime.now());
        r.setTitle(title != null && !title.isBlank()
                ? title
                : file.getOriginalFilename());
        r.setOriginalFilename(file.getOriginalFilename());
        r.setStorageKey(storageKey);
        r.setContentType(file.getContentType());
        r.setSizeBytes(file.getSize());

        return resourceRepo.save(r);
    }

    public void deleteResource(Account requester, Long resourceId) {
        Resource r = resourceRepo.findById(resourceId)
                .orElseThrow(() -> new IllegalArgumentException("Resource not found"));

        if (!requester.hasRole("ROLE_ADMIN")) {
            throw new SecurityException("Only instructors/admins can delete resources");
        }

        fileService.deleteFile(r.getStorageKey());
        resourceRepo.delete(r);
    }
}
