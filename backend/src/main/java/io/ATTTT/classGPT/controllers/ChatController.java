package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.services.GeminiService;
import io.ATTTT.classGPT.services.CourseService;
import io.ATTTT.classGPT.models.Course;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/llm")
@RequiredArgsConstructor
public class ChatController {

    private final GeminiService geminiService;
    private final CourseService courseService;


    @PostMapping("/course/{courseId}/chat")
    public String chatForCourse(@PathVariable Long courseId,
                                @RequestParam String message) {

        Course course = courseService.getById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        String courseName = course.getName();
        String storeName = course.getFileSearchStoreName();

        return geminiService.answerForCourse(
                courseName,
                storeName,
                message,
                "course " + courseId + " chat"
        );
    }


    @GetMapping(
            value = "/course/{courseId}/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public Flux<String> chatForCourseStream(@PathVariable Long courseId,
                                            @RequestParam String message) {

        Course course = courseService.getById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        String courseName = course.getName();
        String storeName = course.getFileSearchStoreName();

        String answer = geminiService.answerForCourse(
                courseName,
                storeName,
                message,
                "course " + courseId + " stream"
        );


        return Flux.just(answer);
    }
}
