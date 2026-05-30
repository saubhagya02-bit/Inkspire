import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { postsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import CommentsSection from "../components/comments/CommentsSection";
import { PageLoader, Button, Badge } from "../components/ui";
import { formatDistanceToNow, format } from "date-fns";
import toast from "react-hot-toast";

export default function PostPage() {
  const { slugOrId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    postsApi
      .get(slugOrId)
      .then(({ data }) => {
        setPost(data);
        setLikeCount(data.like_count || 0);

        setLiked(data.is_liked || false);
      })
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [slugOrId]);

  const handleLike = async () => {
    if (!user) {
      toast.error("Sign in to like");
      return;
    }
    if (liking) return;
    setLiking(true);

    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    try {
      const { data } = await postsApi.like(post.id);
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      setLiked((prev) => !prev);
      setLikeCount((prev) => (liked ? prev + 1 : prev - 1));
      toast.error("Failed to like post");
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post permanently?")) return;
    try {
      await postsApi.delete(post.id);
      toast.success("Post deleted");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete");
    }
  };

  if (loading) return <PageLoader />;
  if (!post) return null;

  const isAuthor = user?.id === post.author_id;
  const isAdmin = user?.role === "admin" || user?.role === "editor";
  const canEdit = isAuthor || isAdmin;

  const readingTime =
    post.reading_time ||
    Math.ceil((post.content?.split(" ").length || 0) / 200) ||
    1;

  const authorName =
    post.author_username || post.author_full_name || "Anonymous";

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "2rem 1.5rem",
        animation: "fadeUp 0.4s ease",
      }}
    >
      {/* Back */}
      <Link
        to="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--text-tertiary)",
          fontSize: 13,
          marginBottom: "1.5rem",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
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
          strokeWidth="2"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to feed
      </Link>

      {/* Cover */}
      {post.cover_image_url && (
        <div
          style={{
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            marginBottom: "2rem",
            height: 360,
          }}
        >
          <img
            src={post.cover_image_url}
            alt={post.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* Status badge */}
      {post.status !== "published" && (
        <div style={{ marginBottom: 12 }}>
          <Badge color="orange">{post.status}</Badge>
        </div>
      )}

      {/* Title */}
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          marginBottom: "1rem",
        }}
      >
        {post.title}
      </h1>

      {/* Meta */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: "2rem",
          paddingBottom: "1.5rem",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--ink-muted)",
              border: "1.5px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: "var(--text-secondary)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {post.author_avatar ? (
              <img
                src={post.author_avatar}
                alt={authorName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              authorName[0]?.toUpperCase() || "A"
            )}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 400 }}>{authorName}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {post.published_at
                ? format(new Date(post.published_at), "MMM d, yyyy")
                : "Draft"}
              {" · "}
              {readingTime} min read
            </div>
          </div>
        </div>

        {canEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            {isAuthor && (
              <Link to={`/posts/${post.id}/edit`}>
                <Button variant="secondary" size="sm">
                  Edit
                </Button>
              </Link>
            )}
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Excerpt */}
      {post.excerpt && (
        <p
          style={{
            fontSize: "1.1rem",
            color: "var(--text-secondary)",
            fontStyle: "italic",
            marginBottom: "2rem",
            borderLeft: "3px solid var(--accent)",
            paddingLeft: "1rem",
            lineHeight: 1.7,
          }}
        >
          {post.excerpt}
        </p>
      )}

      {/* Content */}
      <div className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content || ""}
        </ReactMarkdown>
      </div>

      {/* Like / stats bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          margin: "3rem 0",
          padding: "1.25rem",
          background: "var(--ink-soft)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-soft)",
        }}
      >
        <button
          onClick={handleLike}
          disabled={liking}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            color: liked ? "var(--accent)" : "var(--text-secondary)",
            fontSize: 14,
            transition: "color 0.2s",
            padding: 0,
            cursor: liking ? "not-allowed" : "pointer",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={liked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
          <span>
            {likeCount} {likeCount === 1 ? "like" : "likes"}
          </span>
        </button>
        <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>·</span>
        <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
          {post.comment_count || 0}{" "}
          {(post.comment_count || 0) === 1 ? "comment" : "comments"}
        </span>
        <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>·</span>
        <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
          {post.view_count || 0} views
        </span>
      </div>

      {/* Comments */}
      <CommentsSection postId={post.id} />
    </div>
  );
}
