package io.ATTTT.classGPT.services;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Course;
import io.ATTTT.classGPT.models.Enrollment;
import io.ATTTT.classGPT.repositories.CourseRepository;
import io.ATTTT.classGPT.repositories.EnrollmentRepository;
import org.springframework.stereotype.Service;

@Service
public class EnrollmentService {

    private final CourseRepository courseRepo;
    private final EnrollmentRepository enrollRepo;

    public EnrollmentService(CourseRepository courseRepo,
                             EnrollmentRepository enrollRepo) {
        this.courseRepo = courseRepo;
        this.enrollRepo = enrollRepo;
    }

    public Enrollment joinByCode(Account student, String joinCode) {
        String code = joinCode == null ? null : joinCode.trim();

        System.out.println("[joinByCode] rawCode='" + joinCode + "', cleaned='" + code + "'");

        Course course = courseRepo.findByJoinCode(code)
                .orElseThrow(() -> new IllegalArgumentException("Invalid code"));

        if (enrollRepo.existsByAccountIdAndCourseId(student.getId(), course.getId())) {
            return enrollRepo.findByAccountId(student.getId()).stream()
                    .filter(e -> e.getCourse().getId().equals(course.getId()))
                    .findFirst()
                    .orElseThrow();
        }

        Enrollment e = new Enrollment();
        e.setAccount(student);
        e.setCourse(course);
        return enrollRepo.save(e);
    }

    public boolean isEnrolled(Long accountId, Long courseId) {
        return enrollRepo.existsByAccountIdAndCourseId(accountId, courseId);
    }
}
