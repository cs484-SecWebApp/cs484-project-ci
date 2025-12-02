package io.ATTTT.classGPT.dto;

public record FlagChatReplyRequest(
        Long postId,
        String aiReplyText,
        String studentNote
) {}
