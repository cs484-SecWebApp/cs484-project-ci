package io.ATTTT.classGPT.controllers;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import org.springframework.http.MediaType;

@RestController
@RequestMapping("/api/llm") // optional but nicer for frontend routing
public class ChatController {

    private final ChatClient chatClient;

    public ChatController(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    @PostMapping("/chat")
    @PreAuthorize("isAuthenticated()")
    public String chat(@RequestParam String message) {
        return chatClient
                .prompt()
                .system("You are ClassGPT, a helpful TA for UIC courses.")
                .user(message)
                .call()
                .content();
    }

        @GetMapping(
            value = "/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
        )
        @PreAuthorize("isAuthenticated()")
        public Flux<String> chatWithStream(@RequestParam String message) {
        return chatClient
            .prompt()
            .user(message)
            .stream()
            .content();
        }
}
