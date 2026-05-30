import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef, useEffect } from "react";
import { postsApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

// Inline confirm popover (reusable)
function ConfirmPopover({ message, onConfirm, onCancel }) {
  const ref = useRef(null);

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
        bottom: "calc(100% + 10px)",
        right: 0,
        background: "var(--ink-soft)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "14px 16px",
        minWidth: 220,
        boxShadow: "var(--shadow-lg)",
        zIndex: 100,
        animation: "fadeUp 0.15s ease",
      }}
    >
      {/* Arrow */}
      <div
        style={{
          position: "absolute",
          bottom: -5,
          right: 14,
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
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "5px 14px",
            borderRadius: 6,
            fontSize: 12,
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            fontFamily: "var(--sans)",
            transition: "all 0.15s",
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
            padding: "5px 14px",
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
            (e.currentTarget.style.background = "rgba(232,97,58,0.22)")
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

// PostCard
export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();

  const [liked, setLiked] = useState(Boolean(post.is_liked));
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [liking, setLiking] = useState(false);

  const commentCount = post.comment_count ?? 0;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = user && (user.id === post.author_id || user.role === "admin");

  // Like
  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to like posts");
      return;
    }
    if (liking) return;
    setLiking(true);

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    try {
      const { data } = await postsApi.like(post.id);
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      // Rollback
      setLiked(wasLiked);
      setLikeCount((c) => (wasLiked ? c + 1 : c - 1));
      toast.error("Failed to like post");
    } finally {
      setLiking(false);
    }
  };

  // Delete
  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await postsApi.delete(post.id);
      toast.success("Post deleted");
      if (onDelete) onDelete(post.id);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  const readingTime =
    post.reading_time ||
    Math.ceil((post.content?.split(" ").length || 0) / 200) ||
    1;

  const authorName = post.author_username || "Anonymous";
  const authorInitial = authorName[0]?.toUpperCase() || "A";

  return (
    <article
      style={{
        background: "var(--ink-soft)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
        animation: "fadeUp 0.4s ease both",
        display: "flex",
        flexDirection: "column",
        opacity: deleting ? 0.5 : 1,
        pointerEvents: deleting ? "none" : "auto",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-soft)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Clickable area  */}
      <Link
        to={`/posts/${post.slug || post.id}`}
        style={{ flex: 1, display: "block", textDecoration: "none" }}
      >
        {/* Cover image */}
        {post.cover_image_url && (
          <div style={{ height: 190, overflow: "hidden", flexShrink: 0 }}>
            <img
              src={post.cover_image_url}
              alt={post.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "transform 0.45s ease",
              }}
              onMouseEnter={(e) => (e.target.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
            />
          </div>
        )}

        <div style={{ padding: "1.1rem 1.1rem 0.75rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
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
              {authorInitial}
            </div>
            <span
              style={{
                fontSize: 12.5,
                color: "var(--text-secondary)",
                fontWeight: 400,
              }}
            >
              {authorName}
            </span>
            <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
              ·
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {post.published_at
                ? formatDistanceToNow(new Date(post.published_at), {
                    addSuffix: true,
                  })
                : "Draft"}
            </span>
            <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
              ·
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {readingTime} min
            </span>
          </div>

          {/* Title */}
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontSize: "1.1rem",
              fontWeight: 400,
              marginBottom: 7,
              color: "var(--text)",
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
            }}
          >
            {post.title}
          </h2>

          {/* Excerpt */}
          {post.excerpt && (
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {post.excerpt}
            </p>
          )}
        </div>
      </Link>

      {/* Footer */}
      <div
        style={{
          padding: "0.65rem 1.1rem",
          borderTop: "1px solid var(--border-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={handleLike}
            disabled={liking}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "none",
              border: "none",
              color: liked ? "var(--accent)" : "var(--text-tertiary)",
              fontSize: 13,
              cursor: liking ? "not-allowed" : "pointer",
              padding: "2px 0",
              transition: "color 0.2s",
              fontFamily: "var(--sans)",
            }}
            onMouseEnter={(e) => {
              if (!liking) e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = liked
                ? "var(--accent)"
                : "var(--text-tertiary)";
            }}
            title={liked ? "Unlike" : "Like"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={liked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {likeCount}
          </button>

          <Link
            to={`/posts/${post.slug || post.id}#comments`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: "var(--text-tertiary)",
              fontSize: 13,
              transition: "color 0.2s",
              textDecoration: "none",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-tertiary)")
            }
            title="View comments"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            {/* FIX: comment_count is now kept in sync by commentController HTTP call */}
            {commentCount}
          </Link>

          {/* Views */}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "var(--text-tertiary)",
              fontSize: 13,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {post.view_count || 0}
          </span>
        </div>

        {/* Right: badges + delete */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {post.status === "draft" && (
            <span
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                background: "var(--ink-muted)",
                padding: "2px 8px",
                borderRadius: 20,
                border: "1px solid var(--border-soft)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Draft
            </span>
          )}

          {isOwner && (
            <div style={{ position: "relative" }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteConfirm((v) => !v);
                }}
                title="Delete post"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid transparent",
                  color: showDeleteConfirm
                    ? "var(--accent)"
                    : "var(--text-tertiary)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "var(--sans)",
                  fontSize: 14,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-soft)";
                  e.currentTarget.style.borderColor = "rgba(232,97,58,0.25)";
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  if (!showDeleteConfirm) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.color = "var(--text-tertiary)";
                  }
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>

              {showDeleteConfirm && (
                <ConfirmPopover
                  message="Delete this post? This action cannot be undone."
                  onConfirm={handleConfirmDelete}
                  onCancel={() => setShowDeleteConfirm(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
