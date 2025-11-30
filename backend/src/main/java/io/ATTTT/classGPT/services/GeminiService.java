package io.ATTTT.classGPT.services;

import com.google.genai.Client;
import com.google.genai.errors.ApiException;
import com.google.genai.errors.ServerException;
import com.google.genai.types.GenerateContentResponse;
import io.ATTTT.classGPT.models.Post;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private static final String MODEL_NAME = "gemini-2.5-flash";
    private static final int MAX_ATTEMPTS = 3;

    private final Client client = new Client();

    public String generateReply(Post post) {
        String userPostContent = post.getBody() != null ? post.getBody() : "";
        String fullPrompt = String.format(
                "You are an expert tutor. Provide a helpful, concise, and encouraging reply " +
                        "to the following student post:\n\n%s " +
                        "Responses should be aim to be a one and done reply that answers the post",
                userPostContent
        );

        int attempt = 0;
        while (true) {
            attempt++;
            try {
                GenerateContentResponse response =
                        client.models.generateContent(
                                MODEL_NAME,
                                fullPrompt,
                                null
                        );

                return response.text();

            } catch (ServerException e) {
                log.warn("Gemini ServerException on attempt {} for post {}: {}",
                        attempt, post.getId(), e.getMessage());

                if (attempt >= MAX_ATTEMPTS) {
                    throw e;
                }

                sleepQuietly(500L * attempt);

            } catch (ApiException e) {
                log.error("Gemini API error for post {}: {}", post.getId(), e.getMessage());
                throw e;
            }
        }
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
