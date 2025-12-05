package io.ATTTT.classGPT.services;

import com.google.genai.Client;
import com.google.genai.errors.ApiException;
import com.google.genai.errors.ServerException;
import com.google.genai.types.Content;
import com.google.genai.types.FileSearch;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import com.google.genai.types.Tool;
import io.ATTTT.classGPT.models.Post;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);
    private static final String MODEL_NAME = "gemini-2.5-flash";
    private static final int MAX_ATTEMPTS = 3;

    private final Client client;

    public GeminiService(@Value("${spring.ai.google.genai.api-key}") String apiKey) {
        this.client = Client.builder()
                .apiKey(apiKey)
                .build();
    }

    public String answerForCourse(String courseName,
                                  String storeName,
                                  String userQuestion,
                                  String logTag) {

        String effectiveCourseName = courseName != null ? courseName : "Unknown course";

        String systemPrompt = """
                You are an expert tutor for a specific university course.
            
                You MUST use the course's File Search documents as your primary source.
            
                Workflow (you MUST follow this order):
                1. ALWAYS call the File Search tool at least once before answering,
                   even if the question seems easy or you think you already know the answer.
                2. Look for relevant passages in the course resources.
                3. If you find relevant passages, quote or paraphrase them and explain clearly.
                4. If, after searching, you truly cannot find the answer in the resources, say:
                   "I could not find this in the class resources; the following explanation is
                    based on general knowledge."
                   Then answer from general knowledge.
                5. Keep answers concise, structured, and encouraging.
                6. Whenever you use information from a document, mention the document name/title.
            
                At the end of every answer, add a section:
            
                Sources:
                - <document name 1>
                - <document name 2>
                - ...
            
                Course name: %s
                """.formatted(effectiveCourseName);

        Content systemInstruction = Content.fromParts(
                Part.fromText(systemPrompt)
        );

        Content userContent = Content.fromParts(
                Part.fromText("Student question:\n\n" + userQuestion)
        );

        GenerateContentConfig config;

        if (storeName != null && !storeName.isBlank()) {
            FileSearch fileSearch = FileSearch.builder()
                    .fileSearchStoreNames(List.of(storeName))
                    .build();

            Tool fileSearchTool = Tool.builder()
                    .fileSearch(fileSearch)
                    .build();

            config = GenerateContentConfig.builder()
                    .systemInstruction(systemInstruction)
                    .tools(List.of(fileSearchTool))
                    .temperature(0.2f)
                    .build();
        } else {
            log.warn("No File Search store for {} – answering without RAG.", logTag);
            config = GenerateContentConfig.builder()
                    .systemInstruction(systemInstruction)
                    .temperature(0.2f)
                    .build();
        }

        int attempt = 0;
        while (true) {
            attempt++;
            try {
                GenerateContentResponse response =
                        client.models.generateContent(MODEL_NAME, userContent, config);

                // Optional: log grounding usage
                response.candidates().ifPresentOrElse(candidates -> {
                    if (candidates.isEmpty()) {
                        log.warn("No candidates in Gemini response for {}", logTag);
                        return;
                    }
                    var first = candidates.get(0);
                    first.groundingMetadata().ifPresentOrElse(
                            gm -> log.info("Gemini grounding metadata for {}: {}", logTag, gm),
                            () -> log.warn("No grounding metadata for {} – probably no File Search used.", logTag)
                    );
                }, () -> {
                    log.warn("No candidates at all in Gemini response for {}", logTag);
                });

                return response.text();

            } catch (ServerException e) {
                log.warn("Gemini ServerException on attempt {} for {}: {}",
                        attempt, logTag, e.getMessage());
                if (attempt >= MAX_ATTEMPTS) throw e;
                sleepQuietly(500L * attempt);

            } catch (ApiException e) {
                log.error("Gemini API error for {}: {}", logTag, e.getMessage());
                throw e;
            }
        }
    }


    public String generateReply(Post post) {
        Long courseId = post.getCourse().getId();
        String courseName = post.getCourse().getName();
        String storeName = post.getCourse().getFileSearchStoreName();

        String question = post.getBody() != null ? post.getBody() : "";
        String logTag = "post " + post.getId();

        return answerForCourse(courseName, storeName, question, logTag);
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}

