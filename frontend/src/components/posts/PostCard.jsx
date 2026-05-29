import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { postsApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

export default function PostCard({ post, onUpdate }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [liking, setLiking] = useState(false);

  const handleLike = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to like posts");
      return;
    }
    if (liking) return;
    setLiking(true);
    try {
      const { data } = await postsApi.like(post.id);
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      toast.error("Failed to like post");
    } finally {
      setLiking(false);
    }
  };

  const readingTime =
    post.reading_time ||
    Math.ceil((post.content?.split(" ").length || 0) / 200) ||
    1;

  return (
    <article
      style={{
        background: "var(--ink-soft)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        transition: "border-color 0.2s, transform 0.2s",
        animation: "fadeUp 0.4s ease both",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-soft)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <Link to={`/posts/${post.slug || post.id}`}>
        {post.cover_image_url && (
          <div style={{ height: 200, overflow: "hidden" }}>
            <img
              src={post.cover_image_url}
              alt={post.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "transform 0.4s",
              }}
              onMouseEnter={(e) => (e.target.style.transform = "scale(1.04)")}
              onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
            />
          </div>
        )}
        <div style={{ padding: "1.25rem" }}>
          {/* Meta */}
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
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--ink-muted)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: "var(--text-secondary)",
                flexShrink: 0,
              }}
            >
              {post.author_username?.[0]?.toUpperCase() || "A"}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {post.author_username || "Anonymous"}
            </span>
            <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              ·
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {post.published_at
                ? formatDistanceToNow(new Date(post.published_at), {
                    addSuffix: true,
                  })
                : "Draft"}
            </span>
            <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              ·
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {readingTime} min read
            </span>
          </div>

          {/* Title */}
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontSize: "1.2rem",
              fontWeight: 400,
              marginBottom: 8,
              color: "var(--text)",
              lineHeight: 1.3,
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
                marginBottom: 12,
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
          padding: "0.75rem 1.25rem",
          borderTop: "1px solid var(--border-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Like */}
          <button
            onClick={handleLike}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "none",
              color: liked ? "var(--accent)" : "var(--text-tertiary)",
              fontSize: 13,
              transition: "color 0.2s",
              padding: "2px 0",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = liked
                ? "var(--accent)"
                : "var(--text-tertiary)")
            }
          >
            <svg
              width="15"
              height="15"
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
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            {post.comment_count || 0}
          </Link>
        </div>

        {post.status === "draft" && (
          <span
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              background: "var(--ink-muted)",
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            Draft
          </span>
        )}
      </div>
    </article>
  );
}
