package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.dto.CourseSummary;
import io.ATTTT.classGPT.dto.EnrollmentResponse;
import io.ATTTT.classGPT.dto.EnrollmentSummary;
import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Course;
import io.ATTTT.classGPT.models.Enrollment;
import io.ATTTT.classGPT.repositories.CourseRepository;
import io.ATTTT.classGPT.services.AccountService;
import io.ATTTT.classGPT.services.EnrollmentService;
import io.ATTTT.classGPT.repositories.EnrollmentRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.security.Principal;
import java.util.List;
import java.util.Random;

@RestController
@RequestMapping("/api/classes")
public class ClassController {

    private final EnrollmentService enrollmentService;
    private final AccountService accountService;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private EnrollmentSummary toSummary(Enrollment e) {
        Course c = e.getCourse();
        return new EnrollmentSummary(
                e.getId(),
                c.getId(),
                c.getCode(),
                c.getName(),
                c.getTerm()
        );
    }

    public ClassController(EnrollmentService enrollmentService,
                           AccountService accountService,
                           EnrollmentRepository enrollmentRepository,
                           CourseRepository courseRepository) {
        this.enrollmentService = enrollmentService;
        this.accountService = accountService;
        this.enrollmentRepository = enrollmentRepository;
        this.courseRepository = courseRepository;
    }

    @PostMapping("/join-by-code")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<EnrollmentSummary> joinByCode(@RequestBody JoinCodeRequest req,
                                                        Principal principal) {

        Account me = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        Enrollment enrollment = enrollmentService.joinByCode(me, req.getCode());
        return ResponseEntity.ok(toSummary(enrollment));
    }

    @GetMapping("/mine")
    @PreAuthorize("isAuthenticated()")
    public List<CourseWithJoinResponse> myCourses(Principal principal) {
        Account me = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        return enrollmentRepository.findByAccountId(me.getId())
                .stream()
                .map(Enrollment::getCourse)
                .map(c -> new CourseWithJoinResponse(
                    c.getId(), c.getCode(), c.getName(), c.getTerm(), c.getJoinCode()
                ))
                .toList();
    }

    @PostMapping("/instructor-create")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<CourseWithJoinResponse> createCourse(@RequestBody CreateCourseRequest req,
                                                               Principal principal) {

        Account me = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        // Create course
        Course course = new Course();
        course.setCode(req.getCode());
        course.setName(req.getName());
        course.setTerm(req.getTerm());
        course.setOwner(me);

        String joinCode = generateUniqueJoinCode();
        course.setJoinCode(joinCode);

        Course saved = courseRepository.save(course);

        Enrollment e = new Enrollment();
        e.setAccount(me);
        e.setCourse(saved);
        enrollmentRepository.save(e);

        CourseWithJoinResponse dto = new CourseWithJoinResponse(
                saved.getId(),
                saved.getCode(),
                saved.getName(),
                saved.getTerm(),
                saved.getJoinCode()
        );
        return ResponseEntity.ok(dto);
    }



    private String generateUniqueJoinCode() {
        // simple 6-char alphanumeric; tweak length / charset if you like
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        Random rnd = new Random();
        String code;
        do {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                sb.append(chars.charAt(rnd.nextInt(chars.length())));
            }
            code = sb.toString();
        } while (courseRepository.existsByJoinCode(code));
        return code;
    }


    public static class JoinCodeRequest {
        private String code;
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
    }

    public static class CreateCourseRequest {
        private String code;
        private String name;
        private String term;

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getTerm() { return term; }
        public void setTerm(String term) { this.term = term; }
    }

    public static class CourseWithJoinResponse {
        public Long id;
        public String code;
        public String name;
        public String term;
        public String joinCode;

        public CourseWithJoinResponse(Long id, String code, String name, String term, String joinCode) {
            this.id = id;
            this.code = code;
            this.name = name;
            this.term = term;
            this.joinCode = joinCode;
        }
    }
}
