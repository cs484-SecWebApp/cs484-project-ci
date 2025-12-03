package io.ATTTT.classGPT.services;

import io.ATTTT.classGPT.dto.CreateCourseRequest;
import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Course;
import io.ATTTT.classGPT.repositories.CourseRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class CourseService {

    private final CourseRepository courseRepo;

    public CourseService(CourseRepository courseRepo) {
        this.courseRepo = courseRepo;
    }

    public Course createCourse(Account owner, CreateCourseRequest req) {
        Course c = new Course();
        c.setCode(req.code());
        c.setName(req.name());
        c.setTerm(req.term());
        c.setOwner(owner);
        c.setJoinCode(generateJoinCode());
        return courseRepo.save(c);
    }

    public Optional<Course> getById(Long id) {
        return courseRepo.findById(id);
    }

    private String generateJoinCode() {
        String code;
        do {
            code = UUID.randomUUID()
                    .toString()
                    .replace("-", "")
                    .substring(0, 8)
                    .toUpperCase();
        } while (courseRepo.existsByJoinCode(code));
        return code;
    }
}
