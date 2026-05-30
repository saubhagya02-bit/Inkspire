import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { postsApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

export default function PostCard({ post }) {
  const { user } = useAuth();

  const [liked, setLiked] = useState(Boolean(post.is_liked));
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [liking, setLiking] = useState(false);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to like posts");
      return;
    }
    if (liking) return;
    setLiking(true);
    const prev = liked;
    setLiked(!prev);
    setLikeCount((c) => (prev ? c - 1 : c + 1));
    try {
      const { data } = await postsApi.like(post.id);
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      setLiked(prev);
      setLikeCount((c) => (prev ? c + 1 : c - 1));
      toast.error("Failed to like");
    } finally {
      setLiking(false);
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
        height: "100%",
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
      <Link
        to={`/posts/${post.slug || post.id}`}
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        {/* Cover image */}
        {post.cover_image_url && (
          <div
            style={{
              height: 190,
              overflow: "hidden",
              flexShrink: 0,
              position: "relative",
            }}
          >
            <img
              src={post.cover_image_url}
              alt={post.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "transform 0.5s ease",
              }}
              onMouseEnter={(e) => (e.target.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
            />
          </div>
        )}

        <div style={{ padding: "1.1rem 1.1rem 0.75rem", flex: 1 }}>
          {/* Author row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
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
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-secondary)",
                flexShrink: 0,
                overflow: "hidden",
                letterSpacing: "0.02em",
              }}
            >
              {post.author_avatar ? (
                <img
                  src={post.author_avatar}
                  alt={authorName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                authorInitial
              )}
            </div>

            <span
              style={{
                fontSize: 12.5,
                color: "var(--text-secondary)",
                fontWeight: 400,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {authorName}
            </span>

            <span
              style={{
                color: "var(--text-tertiary)",
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              ·
            </span>

            <span
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                flexShrink: 0,
              }}
            >
              {post.published_at
                ? formatDistanceToNow(new Date(post.published_at), {
                    addSuffix: true,
                  })
                : "Draft"}
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
          {/* Like */}
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
              if (!liking)
                e.currentTarget.style.color = liked
                  ? "var(--accent-hover)"
                  : "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = liked
                ? "var(--accent)"
                : "var(--text-tertiary)";
            }}
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

          {/* Comments */}
          <Link
            to={`/posts/${post.slug || post.id}#comments`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: "var(--text-tertiary)",
              fontSize: 13,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-tertiary)")
            }
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
            {post.comment_count || 0}
          </Link>

          {/* Read time */}
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {readingTime} min
          </span>
        </div>

        {/* Draft badge */}
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
      </div>
    </article>
  );
}
