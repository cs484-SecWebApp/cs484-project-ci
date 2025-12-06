package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.dto.ResourceSummary;
import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Resource;
import io.ATTTT.classGPT.repositories.ResourceRepository;
import io.ATTTT.classGPT.services.AccountService;
import io.ATTTT.classGPT.services.EnrollmentService;
import io.ATTTT.classGPT.services.FileService;
import io.ATTTT.classGPT.services.ResourceService;
import lombok.Data;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.access.prepost.PreAuthorize;

import java.io.IOException;
import java.security.Principal;
import java.util.List;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/courses/{courseId}/resources")
public class ResourceController {

    private final ResourceService resourceService;
    private final AccountService accountService;
    private final EnrollmentService enrollmentService;
    private final FileService fileService;
    private final ResourceRepository resourceRepository;

    public ResourceController(ResourceService resourceService,
                              AccountService accountService,
                              EnrollmentService enrollmentService,
                              FileService fileService,
                              ResourceRepository resourceRepository) {
        this.resourceService = resourceService;
        this.accountService = accountService;
        this.enrollmentService = enrollmentService;
        this.fileService = fileService;
        this.resourceRepository = resourceRepository;
    }

    private ResourceSummary toSummary(Resource r) {
        return new ResourceSummary(
                r.getId(),
                r.getTitle(),
                r.getOriginalFilename(),
                r.getContentType(),
                r.getCourse().getId(),
                r.getUploadedAt()
        );
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<ResourceSummary> listResources(@PathVariable Long courseId,
                                               Principal principal) {
        Account me = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        if (!enrollmentService.isEnrolled(me.getId(), courseId) && !me.hasRole("ROLE_ADMIN")) {
            throw new ResponseStatusException(FORBIDDEN);
        }

        return resourceService.listForCourse(courseId)
                .stream()
                .map(this::toSummary)
                .toList();
    }

        @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @PreAuthorize("isAuthenticated()")
        public ResponseEntity<ResourceSummary> uploadResource(
            @PathVariable Long courseId,
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "meta", required = false) ResourceUploadMeta meta,
            Principal principal) throws IOException {

        Account me = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        if (!me.hasRole("ROLE_ADMIN")) {
            throw new ResponseStatusException(FORBIDDEN);
        }

        String title = meta != null ? meta.getTitle() : null;

        Resource saved = resourceService.uploadResource(me, courseId, title, file);
        return ResponseEntity.status(CREATED).body(toSummary(saved));
    }

        @GetMapping("/{resourceId}/download")
        @PreAuthorize("isAuthenticated()")
        public ResponseEntity<org.springframework.core.io.Resource> downloadResource(
            @PathVariable Long courseId,
            @PathVariable Long resourceId,
            Principal principal) {

        Account me = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        if (!enrollmentService.isEnrolled(me.getId(), courseId) && !me.hasRole("ROLE_ADMIN")) {
            throw new ResponseStatusException(FORBIDDEN);
        }

        Resource r = resourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));

        if (!r.getCourse().getId().equals(courseId)) {
            throw new ResponseStatusException(FORBIDDEN);
        }

        org.springframework.core.io.Resource file = fileService.loadAsResource(r.getStorageKey());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + r.getOriginalFilename() + "\"")
                .contentType(MediaType.parseMediaType(
                        r.getContentType() != null ? r.getContentType() : "application/octet-stream"))
                .body(file);
    }

    @DeleteMapping("/{resourceId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteResource(@PathVariable Long courseId,
                                               @PathVariable Long resourceId,
                                               Principal principal) {
        Account me = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        if (!me.hasRole("ROLE_ADMIN")) {
            throw new ResponseStatusException(FORBIDDEN);
        }

        resourceService.deleteResource(me, resourceId);
        return ResponseEntity.noContent().build();
    }

    @Data
    public static class ResourceUploadMeta {
        private String title;
    }
}
