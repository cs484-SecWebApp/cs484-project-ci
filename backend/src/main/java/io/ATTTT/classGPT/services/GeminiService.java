package io.ATTTT.classGPT.services;

import com.google.genai.Client;
import com.google.genai.errors.ApiException;
import com.google.genai.errors.ServerException;
import com.google.genai.types.Content;
import com.google.genai.types.FileSearch;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.GroundingChunk;
import com.google.genai.types.GroundingChunkRetrievedContext;
import com.google.genai.types.GroundingMetadata;
import com.google.genai.types.Part;
import com.google.genai.types.Tool;
import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.models.Replies;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);
    private static final String MODEL_NAME = "gemini-2.5-flash";
    private static final int MAX_ATTEMPTS = 3;

    private final Client client;
    private final PostService postService;
    private final ResourceService resourceService;

    public GeminiService(
            @Value("${spring.ai.google.genai.api-key}") String apiKey,
            PostService postService,
            ResourceService resourceService
    ) {
        this.client = Client.builder()
                .apiKey(apiKey)
                .build();
        this.postService = postService;
        this.resourceService = resourceService;
    }

    public String answerForCourse(Long courseId,
                                  String courseName,
                                  String storeName,
                                  String userQuestion,
                                  String logTag) {
        String effectiveCourseName = courseName != null ? courseName : "Unknown course";

        if (courseId != null && !resourceService.areCourseResourcesIndexed(courseId)) {
            long indexingCount = resourceService.getIndexingCount(courseId);
            log.warn("{} resources still being indexed for course {}", indexingCount, courseId);
        }

        String systemPrompt = """
            You are an expert tutor for a specific university course.
    
            You have access to TWO kinds of context:
            1) The course's File Search documents (slides, PDFs, assignments, etc.).
            2) Past forum threads including:
               - [INSTRUCTOR ANNOUNCEMENT]: Official announcements from instructors/admins
               - [INSTRUCTOR ANSWERED]: Q&A threads where instructors provided answers
    
            ABSOLUTE RULES - INSTRUCTOR INFORMATION IS SUPREME:
            - **HIGHEST PRIORITY:** Posts marked [INSTRUCTOR ANNOUNCEMENT] contain official course information (dates, times, locations, policies). These are DEFINITIVE FACTS.
            - **SECOND PRIORITY:** Posts marked [INSTRUCTOR ANSWERED] contain authoritative answers to questions.
            - Instructor announcements override everything - even if documents say otherwise, trust the announcement.
            - You MUST base all concrete facts ONLY on the provided resources.
            - If the resources do NOT contain a specific fact, say you cannot find it.
            
            CITATION RULES (STRICT):
            - ALWAYS cite instructor announcements: "According to an instructor announcement in post #[ID]..."
            - ALWAYS cite instructor answers: "According to an instructor's reply in post #[ID]..."
            - For documents: "According to [document name]..." or "As explained in [document name]..."
            - Be specific about which resource you're citing
            
            DUPLICATE QUESTION HANDLING:
            - If you see a forum thread with a VERY similar or identical question, YOU MUST start your response with:
              "This question was previously answered in Post #[ID]: [Title]"
            - Then provide the answer based on that thread.
            - Be especially attentive to questions about logistics (location, times) - these are commonly repeated.
            - Even if the wording is slightly different, if the intent is the same, treat it as a duplicate.
              
            IMPORTANT FOR FILE SEARCH:
            - Use File Search for course content questions
            - Always search uploaded materials before answering
            - If File Search returns no results, explicitly state that
    
            Course name: %s
        """.formatted(effectiveCourseName);

        String forumContext = "";
        String duplicateNotice = "";

        if (courseId != null) {
            try {
                List<Post> similar = postService.findSimilarPosts(courseId, userQuestion, 10);
                List<Post> recentAdmin = postService.findRecentInstructorPosts(courseId, 5);

                // Check for very similar questions (potential duplicates)
                if (!similar.isEmpty()) {
                    Post mostSimilar = similar.get(0);
                    if (mostSimilar.getReplies() != null && !mostSimilar.getReplies().isEmpty()) {
                        duplicateNotice = String.format(
                                "\n\n**NOTE:** A very similar question was previously asked in Post #%d: \"%s\"\n\n",
                                mostSimilar.getId(),
                                mostSimilar.getTitle()
                        );
                    }
                }

                Set<Post> uniqueContext = new LinkedHashSet<>();
                uniqueContext.addAll(recentAdmin);
                uniqueContext.addAll(similar);

                log.info("RAG Context for {}: merged {} semantic and {} admin posts",
                        logTag, similar.size(), recentAdmin.size());


                for (Post p : uniqueContext) {
                    boolean hasInstructorReply = p.getReplies() != null &&
                            p.getReplies().stream().anyMatch(Replies::isFromInstructor);
                    log.debug("Including post #{} '{}' - has instructor reply: {}",
                            p.getId(), p.getTitle(), hasInstructorReply);
                }

                if (!uniqueContext.isEmpty()) {
                    StringBuilder sb = new StringBuilder();
                    sb.append("=== RELEVANT FORUM CONTEXT ===\n");
                    sb.append("Posts marked [INSTRUCTOR ANNOUNCEMENT] are official course information.\n");
                    sb.append("Posts marked [INSTRUCTOR ANSWERED] contain authoritative answers.\n\n");

                    for (Post p : uniqueContext) {
                        sb.append(postService.buildThreadDocument(p))
                                .append("\n========================================\n\n");
                    }
                    forumContext = sb.toString();
                }
            } catch (Exception e) {
                log.warn("Failed to build forum context", e);
            }
        }

        Content systemInstruction = Content.fromParts(
                Part.fromText(systemPrompt)
        );

        String combined = """
        Student question:

        %s

        ----

        Related forum threads (if any):

        %s
        """.formatted(
                userQuestion,
                (forumContext == null || forumContext.isBlank())
                        ? "(No similar resolved threads were found.)"
                        : forumContext
        );

        Content userContent = Content.fromParts(
                Part.fromText(combined)
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
                    .topK(5f)
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
                }, () -> log.warn("No candidates at all in Gemini response for {}", logTag));

                String answer = response.text();

                List<String> docNames = (courseId != null)
                        ? extractFileDocNames(response, courseId, logTag)
                        : List.of();

                if (docNames.isEmpty()) {
                    log.info("No grounded file docs for {}", logTag);
                }

                String cleaned = Pattern.compile("(?s)Sources:.*$")
                        .matcher(answer)
                        .replaceFirst("")
                        .trim();

                StringBuilder sources = new StringBuilder();
                sources.append("\n\nSources:\n");

                if (!docNames.isEmpty()) {
                    for (String name : docNames) {
                        sources.append("- ").append(name).append("\n");
                    }
                } else {
                    sources.append("- Class Resources\n");
                }

                if (forumContext != null && !forumContext.isBlank()) {
                    sources.append("- Forum: course forum threads (see instructor/admin posts above)\n");
                }

                return duplicateNotice + cleaned + sources;

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

        return answerForCourse(courseId, courseName, storeName, question, logTag);
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    private List<String> extractFileDocNames(
            GenerateContentResponse response,
            Long courseId,
            String logTag
    ) {
        var chunksOpt = response.candidates()
                .flatMap(candidates ->
                        candidates.stream()
                                .findFirst()
                                .flatMap(first -> first.groundingMetadata())
                                .flatMap(GroundingMetadata::groundingChunks)
                );

        List<GroundingChunk> chunks = chunksOpt.orElse(List.of());
        if (chunks.isEmpty()) {
            log.info("No grounding chunks found for {}", logTag);
            return List.of();
        }

        List<String> names = new ArrayList<>();
        Set<String> seenTexts = new HashSet<>();

        for (GroundingChunk chunk : chunks) {
            chunk.retrievedContext()
                    .flatMap(GroundingChunkRetrievedContext::text)
                    .ifPresent(text -> {
                        String textKey = text.length() > 200 ? text.substring(0, 200) : text;

                        if (!seenTexts.contains(textKey)) {
                            seenTexts.add(textKey);

                            resourceService.findByCourseAndSnippet(courseId, text)
                                    .ifPresentOrElse(
                                            resource -> {
                                                String name = (resource.getTitle() != null && !resource.getTitle().isBlank())
                                                        ? resource.getTitle()
                                                        : resource.getOriginalFilename();

                                                if (!names.contains(name)) {
                                                    log.info("Matched grounding chunk to resource: {}", name);
                                                    names.add(name);
                                                }
                                            },
                                            () -> log.debug("Could not match chunk to any resource: {}",
                                                    textKey.substring(0, Math.min(50, textKey.length())))
                                    );
                        }
                    });
        }

        return names;
    }
}