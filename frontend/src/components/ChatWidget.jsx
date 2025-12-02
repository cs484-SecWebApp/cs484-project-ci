import React, { useState } from 'react';
import './ChatWidget.css';

const ChatWidget = ({ post, aiReply, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 'post',
      role: 'user',
      author: post.author,
      text: `Post: ${post.title}\n\n${post.content.replace(/<[^>]+>/g, '')}`,
    },
    {
      id: 'ai-initial',
      role: 'assistant',
      author: 'ClassGPT',
      text: aiReply,
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // flag panel state
  const [flaggingMessageId, setFlaggingMessageId] = useState(null);
  const [flagNote, setFlagNote] = useState('');
  const [isFlagSubmitting, setIsFlagSubmitting] = useState(false);


  const [flagToast, setFlagToast] = useState(null); // { type: 'success' | 'error', text: string }

  const showFlagToast = (type, text) => {
    setFlagToast({ type, text });
    // auto-hide after 3s
    setTimeout(() => setFlagToast(null), 3000);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      author: 'You',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const prompt = `
We are discussing this course post.

---
Title: ${post.title}

HTML content:
${post.content}

Here was your earlier reply:
${aiReply}
---

Student follow-up question:
${trimmed}

Please respond as a helpful CS course TA.
      `.trim();

      const res = await fetch(
        `/api/llm/chat?message=${encodeURIComponent(prompt)}`,
        { method: 'POST' }
      );

      const text = await res.text();

      const aiMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        author: 'ClassGPT',
        text,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        author: 'ClassGPT',
        text:
          'Sorry, I had trouble replying just now. Please try again in a moment.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartFlag = (aiMessage) => {
    setFlaggingMessageId(aiMessage.id);
    setFlagNote('');
  };

  const handleSubmitFlag = async () => {
    if (!flaggingMessageId) return;

    const aiMessage = messages.find((m) => m.id === flaggingMessageId);
    if (!aiMessage) return;

    setIsFlagSubmitting(true);
    try {
      await fetch('/api/chat/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          postId: post.id,
          aiReplyText: aiMessage.text,
          studentNote: flagNote.trim() || null,
        }),
      });

      showFlagToast('success', 'Sent to instructor for review ✅');
      setFlaggingMessageId(null);
      setFlagNote('');
    } catch (err) {
      console.error(err);
      showFlagToast('error', 'Sorry, failed to send to instructor.');
    } finally {
      setIsFlagSubmitting(false);
    }
  };

  const handleCancelFlag = () => {
    setFlaggingMessageId(null);
    setFlagNote('');
  };

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <span>Chat with ClassGPT</span>
        <button className="chat-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="chat-body">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-message ${
              m.role === 'assistant' ? 'from-ai' : 'from-user'
            }`}
          >
            <div className="chat-author">{m.author}</div>
            <div className="chat-bubble">{m.text}</div>

            {m.role === 'assistant' && (
              <button
                className="flag-ai-btn"
                onClick={() => handleStartFlag(m)}
              >
                Ask instructor about this answer
              </button>
            )}

            {m.id === flaggingMessageId && (
              <div className="flag-panel">
                <div className="flag-panel-title">
                  Send this AI answer to your instructor
                </div>
                <div className="flag-panel-subtitle">
                  (Optional) Add a short note or question for your instructor:
                </div>
                <textarea
                  className="flag-panel-textarea"
                  value={flagNote}
                  onChange={(e) => setFlagNote(e.target.value)}
                  placeholder="e.g., Is this explanation correct for our assignment?"
                  rows={3}
                />
                <div className="flag-panel-actions">
                  <button
                    className="flag-panel-cancel"
                    type="button"
                    onClick={handleCancelFlag}
                    disabled={isFlagSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    className="flag-panel-submit"
                    type="button"
                    onClick={handleSubmitFlag}
                    disabled={isFlagSubmitting}
                  >
                    {isFlagSubmitting ? 'Sending…' : 'Send to Instructor'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="chat-message from-ai">
            <div className="chat-author">ClassGPT</div>
            <div className="chat-bubble typing-bubble">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
      </div>


      {flagToast && (
        <div
          className={`flag-toast ${
            flagToast.type === 'success' ? 'flag-toast-success' : 'flag-toast-error'
          }`}
        >
          {flagToast.text}
        </div>
      )}

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder="Ask anything about this post..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? 'Thinking…' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatWidget;
