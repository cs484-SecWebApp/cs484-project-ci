package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.dto.FlagChatReplyRequest;
import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.models.Replies;
import io.ATTTT.classGPT.repositories.PostRepository;
import io.ATTTT.classGPT.repositories.RepliesRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/chat")
public class ChatFlagController {

    private final PostRepository postRepository;
    private final RepliesRepository repliesRepository;

    public ChatFlagController(PostRepository postRepository,
                              RepliesRepository repliesRepository) {
        this.postRepository = postRepository;
        this.repliesRepository = repliesRepository;
    }

    /**
     * Called from the ChatWidget when the student clicks
     * "Ask instructor about this answer" on an AI reply.
     */
    @PostMapping("/flag")
    public ResponseEntity<Void> flagAiReply(@RequestBody FlagChatReplyRequest request) {

        Post post = postRepository.findById(request.postId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Post not found"));

        Replies aiReply = new Replies();
        aiReply.setPost(post);
        aiReply.setBody(request.aiReplyText());
        aiReply.setLlmGenerated(true);
        aiReply.setFromInstructor(false);
        aiReply.setFlagged(true);
        aiReply.setParentReplyId(null);

        aiReply.setModifiedAt(LocalDateTime.now());

        repliesRepository.save(aiReply);

        if (request.studentNote() != null && !request.studentNote().isBlank()) {
            Replies note = new Replies();
            note.setPost(post);
            note.setBody(request.studentNote());
            note.setLlmGenerated(false);
            note.setFromInstructor(false);
            note.setFlagged(false);
            note.setParentReplyId(aiReply.getId());

            note.setModifiedAt(LocalDateTime.now());
            repliesRepository.save(note);
        }

        return ResponseEntity.ok().build();
    }
}
