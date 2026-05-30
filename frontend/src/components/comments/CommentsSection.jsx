import { useState, useEffect, useRef } from "react";
import { commentsApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { Button, Spinner } from "../ui";
import toast from "react-hot-toast";

const REACTIONS = ["👍", "❤️", "😂", "😢", "😡"];
const REACTION_TYPES = ["like", "love", "laugh", "sad", "angry"];

// Inline confirm dialog
function ConfirmPopover({ message, onConfirm, onCancel }) {
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onCancel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        right: 0,
        background: "var(--ink-soft)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "12px 14px",
        minWidth: 210,
        boxShadow: "var(--shadow-lg)",
        zIndex: 50,
        animation: "fadeUp 0.15s ease",
      }}
    >
      {/* Arrow */}
      <div
        style={{
          position: "absolute",
          bottom: -5,
          right: 12,
          width: 8,
          height: 8,
          background: "var(--ink-soft)",
          border: "1px solid var(--border)",
          borderTop: "none",
          borderLeft: "none",
          transform: "rotate(45deg)",
        }}
      />

      <p
        style={{
          fontSize: 13,
          color: "var(--text)",
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {message}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            fontSize: 12,
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            fontFamily: "var(--sans)",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--text-tertiary)";
            e.currentTarget.style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            fontSize: 12,
            background: "rgba(232,97,58,0.12)",
            color: "var(--accent)",
            border: "1px solid rgba(232,97,58,0.3)",
            cursor: "pointer",
            fontFamily: "var(--sans)",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(232,97,58,0.2)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(232,97,58,0.12)")
          }
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// Main CommentsSection
export default function CommentsSection({ postId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  const fetchComments = async () => {
    try {
      const { data } = await commentsApi.list(postId, { limit: 50 });
      setComments(data.comments || []);
      setTotal(data.pagination?.total || 0);
    } catch {
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (!user) {
      toast.error("Sign in to comment");
      return;
    }
    setSubmitting(true);
    try {
      await commentsApi.create(postId, {
        content: content.trim(),
        parentId: replyTo,
      });
      setContent("");
      setReplyTo(null);
      await fetchComments();
      toast.success("Comment posted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  // FIX: no window.confirm — deletion is confirmed via inline popover in CommentItem
  const handleDelete = async (id) => {
    try {
      await commentsApi.delete(id);
      await fetchComments();
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleReact = async (id, type) => {
    if (!user) {
      toast.error("Sign in to react");
      return;
    }
    try {
      await commentsApi.react(id, type);
      await fetchComments();
    } catch {
      toast.error("Failed to react");
    }
  };

  return (
    <section id="comments" style={{ marginTop: "3rem" }}>
      <h3
        style={{
          fontFamily: "var(--serif)",
          fontSize: "1.3rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        Comments
        <span
          style={{
            fontSize: "0.9rem",
            fontFamily: "var(--sans)",
            color: "var(--text-tertiary)",
            fontWeight: 300,
          }}
        >
          ({total})
        </span>
      </h3>

      {/* Comment form */}
      {user ? (
        <form onSubmit={handleSubmit} style={{ marginBottom: "2rem" }}>
          {replyTo && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Replying to comment
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                style={{
                  background: "none",
                  color: "var(--accent)",
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
            </div>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              replyTo ? "Write a reply..." : "Share your thoughts..."
            }
            rows={3}
            style={{
              width: "100%",
              background: "var(--ink-soft)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text)",
              padding: "10px 14px",
              fontSize: 14,
              resize: "vertical",
              fontFamily: "var(--sans)",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--blue)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <Button
              type="submit"
              loading={submitting}
              disabled={!content.trim()}
            >
              {replyTo ? "Reply" : "Comment"}
            </Button>
          </div>
        </form>
      ) : (
        <div
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--border-soft)",
            borderRadius: "var(--radius)",
            padding: "1rem",
            marginBottom: "2rem",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
        >
          <a href="/login" style={{ color: "var(--accent)" }}>
            Sign in
          </a>{" "}
          to join the discussion
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
        >
          <Spinner />
        </div>
      ) : comments.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-tertiary)",
            padding: "2rem",
            fontSize: 14,
          }}
        >
          No comments yet. Be the first to share your thoughts.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              user={user}
              onReply={(id) => setReplyTo(id)}
              onDelete={handleDelete}
              onReact={handleReact}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// CommentItem
function CommentItem({ comment, user, onReply, onDelete, onReact, depth = 0 }) {
  const [showReactions, setShowReactions] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const reactionsRef = useRef(null);

  // Close reaction picker on outside click
  useEffect(() => {
    if (!showReactions) return;
    const handler = (e) => {
      if (reactionsRef.current && !reactionsRef.current.contains(e.target))
        setShowReactions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showReactions]);

  if (comment.isDeleted && (!comment.replies || comment.replies.length === 0))
    return null;

  const handleConfirmDelete = async () => {
    setShowConfirm(false);
    setDeleting(true);
    await onDelete(comment._id);
    setDeleting(false);
  };

  return (
    <div
      style={{
        marginLeft: depth > 0 ? "2rem" : 0,
        opacity: deleting ? 0.4 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <div
        style={{
          background: depth > 0 ? "transparent" : "var(--ink-soft)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--radius)",
          padding: "0.875rem 1rem",
          borderLeft:
            depth > 0
              ? "2px solid var(--border)"
              : "1px solid var(--border-soft)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--ink-muted)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)",
              flexShrink: 0,
            }}
          >
            {comment.authorUsername?.[0]?.toUpperCase() || "A"}
          </div>
          <span style={{ fontSize: 13, fontWeight: 400 }}>
            {comment.authorUsername}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
            })}
          </span>
          {comment.isEdited && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              (edited)
            </span>
          )}
        </div>

        {/* Content */}
        <p
          style={{
            fontSize: 14,
            color: comment.isDeleted ? "var(--text-tertiary)" : "var(--text)",
            lineHeight: 1.6,
            fontStyle: comment.isDeleted ? "italic" : "normal",
          }}
        >
          {comment.isDeleted ? "[deleted]" : comment.content}
        </p>

        {/* Actions */}
        {!comment.isDeleted && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 10,
            }}
          >
            {/* Reaction picker */}
            <div ref={reactionsRef} style={{ position: "relative" }}>
              <button
                onClick={() => setShowReactions((v) => !v)}
                style={{
                  background: "none",
                  color: "var(--text-tertiary)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  border: "none",
                  fontFamily: "var(--sans)",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-tertiary)")
                }
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
                {Object.values(comment.reactionCounts || {}).reduce(
                  (a, b) => a + b,
                  0,
                ) > 0 && (
                  <span>
                    {Object.values(comment.reactionCounts || {}).reduce(
                      (a, b) => a + b,
                      0,
                    )}
                  </span>
                )}
              </button>

              {showReactions && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 6px)",
                    left: 0,
                    background: "var(--ink-soft)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "6px 8px",
                    display: "flex",
                    gap: 4,
                    boxShadow: "var(--shadow)",
                    animation: "fadeUp 0.15s ease",
                    zIndex: 20,
                  }}
                >
                  {REACTIONS.map((emoji, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        onReact(comment._id, REACTION_TYPES[i]);
                        setShowReactions(false);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 18,
                        borderRadius: 6,
                        padding: "2px 4px",
                        cursor: "pointer",
                        transition: "transform 0.1s",
                        lineHeight: 1,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "scale(1.3)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "scale(1)")
                      }
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reaction counts */}
            {REACTION_TYPES.map(
              (type, i) =>
                comment.reactionCounts?.[type] > 0 && (
                  <span
                    key={type}
                    style={{ fontSize: 12, color: "var(--text-tertiary)" }}
                  >
                    {REACTIONS[i]} {comment.reactionCounts[type]}
                  </span>
                ),
            )}

            {/* Reply */}
            {depth < 2 && user && (
              <button
                onClick={() => onReply(comment._id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-tertiary)",
                  fontSize: 13,
                  marginLeft: 4,
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-tertiary)")
                }
              >
                Reply
              </button>
            )}

            {user &&
              (user.id === comment.authorId || user.role === "admin") && (
                <div style={{ marginLeft: "auto", position: "relative" }}>
                  <button
                    onClick={() => setShowConfirm((v) => !v)}
                    disabled={deleting}
                    style={{
                      background: "none",
                      border: "none",
                      color: showConfirm
                        ? "var(--accent)"
                        : "var(--text-tertiary)",
                      fontSize: 13,
                      cursor: deleting ? "not-allowed" : "pointer",
                      fontFamily: "var(--sans)",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--accent)")
                    }
                    onMouseLeave={(e) => {
                      if (!showConfirm)
                        e.currentTarget.style.color = "var(--text-tertiary)";
                    }}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>

                  {showConfirm && (
                    <ConfirmPopover
                      message="Delete this comment? This can't be undone."
                      onConfirm={handleConfirmDelete}
                      onCancel={() => setShowConfirm(false)}
                    />
                  )}
                </div>
              )}
          </div>
        )}
      </div>

      {/* Nested replies */}
      {comment.replies?.length > 0 && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply._id}
              comment={reply}
              user={user}
              onReply={onReply}
              onDelete={onDelete}
              onReact={onReact}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
