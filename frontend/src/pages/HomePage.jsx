import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { postsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PostCard from "../components/posts/PostCard";
import { Button } from "../components/ui";

// Skeleton loaders
function SkeletonCard() {
  return (
    <div
      style={{
        background: "var(--ink-soft)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 180,
          background: "var(--ink-muted)",
          animation: "pulse 1.4s ease infinite",
        }}
      />
      <div style={{ padding: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--ink-muted)",
              animation: "pulse 1.4s ease infinite",
            }}
          />
          <div
            style={{
              width: 80,
              height: 11,
              borderRadius: 6,
              background: "var(--ink-muted)",
              animation: "pulse 1.4s ease infinite",
            }}
          />
          <div
            style={{
              width: 50,
              height: 11,
              borderRadius: 6,
              background: "var(--ink-muted)",
              animation: "pulse 1.4s ease infinite",
            }}
          />
        </div>
        <div
          style={{
            width: "90%",
            height: 18,
            borderRadius: 6,
            background: "var(--ink-muted)",
            marginBottom: 8,
            animation: "pulse 1.4s ease infinite",
          }}
        />
        <div
          style={{
            width: "70%",
            height: 18,
            borderRadius: 6,
            background: "var(--ink-muted)",
            marginBottom: 12,
            animation: "pulse 1.4s ease infinite",
          }}
        />
        <div
          style={{
            width: "100%",
            height: 12,
            borderRadius: 6,
            background: "var(--ink-muted)",
            marginBottom: 6,
            animation: "pulse 1.4s ease infinite",
          }}
        />
        <div
          style={{
            width: "80%",
            height: 12,
            borderRadius: 6,
            background: "var(--ink-muted)",
            animation: "pulse 1.4s ease infinite",
          }}
        />
      </div>
    </div>
  );
}

function SkeletonFeatured() {
  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        background: "var(--ink-soft)",
        border: "1px solid var(--border-soft)",
        height: 420,
        animation: "pulse 1.4s ease infinite",
      }}
    />
  );
}

// Featured post
function FeaturedPost({ post }) {
  const { user } = useAuth();
  const authorName = post.author_username || "Anonymous";

  return (
    <Link
      to={`/posts/${post.slug || post.id}`}
      style={{ display: "block", textDecoration: "none" }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          height: 420,
          background: post.cover_image_url ? "transparent" : "var(--ink-soft)",
          border: "1px solid var(--border-soft)",
          cursor: "pointer",
          transition: "transform 0.3s ease, box-shadow 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.boxShadow = "var(--shadow-lg)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Background image */}
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.title}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(135deg, var(--ink-muted) 0%, var(--ink-soft) 100%)",
            }}
          />
        )}

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: post.cover_image_url
              ? "linear-gradient(to top, rgba(14,14,15,0.97) 0%, rgba(14,14,15,0.6) 50%, rgba(14,14,15,0.1) 100%)"
              : "linear-gradient(to top, rgba(14,14,15,0.98) 0%, rgba(14,14,15,0.4) 100%)",
          }}
        />

        {/* Featured badge */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            background: "var(--accent)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 500,
            padding: "4px 10px",
            borderRadius: 20,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Featured
        </div>

        {/* Content */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "2rem",
          }}
        >
          {/* Author */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "var(--ink-muted)",
                border: "2px solid rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text)",
                flexShrink: 0,
              }}
            >
              {authorName[0]?.toUpperCase()}
            </div>
            <span
              style={{
                fontSize: 13,
                color: "rgba(240,237,232,0.85)",
                fontWeight: 400,
              }}
            >
              {authorName}
            </span>
            <span style={{ color: "rgba(240,237,232,0.4)", fontSize: 12 }}>
              ·
            </span>
            <span style={{ fontSize: 12, color: "rgba(240,237,232,0.5)" }}>
              {post.published_at
                ? formatDistanceToNow(new Date(post.published_at), {
                    addSuffix: true,
                  })
                : "Draft"}
            </span>
            <span style={{ color: "rgba(240,237,232,0.4)", fontSize: 12 }}>
              ·
            </span>
            <span style={{ fontSize: 12, color: "rgba(240,237,232,0.5)" }}>
              {post.reading_time || 1} min read
            </span>
          </div>

          {/* Title */}
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(1.5rem, 3vw, 2.1rem)",
              fontWeight: 400,
              color: "#fff",
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            {post.title}
          </h2>

          {/* Excerpt */}
          {post.excerpt && (
            <p
              style={{
                fontSize: 14,
                color: "rgba(240,237,232,0.65)",
                lineHeight: 1.6,
                marginBottom: 16,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {post.excerpt}
            </p>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
                color: "rgba(240,237,232,0.5)",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              {post.like_count || 0}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
                color: "rgba(240,237,232,0.5)",
              }}
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
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
                color: "rgba(240,237,232,0.5)",
              }}
            >
              <svg
                width="14"
                height="14"
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
        </div>
      </div>
    </Link>
  );
}

// Main HomePage
const SORT_OPTIONS = [
  { value: "published_at", label: "Latest" },
  { value: "view_count", label: "Popular" },
];

export default function HomePage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState("published_at");

  const fetchPosts = useCallback(
    async (p = 1, s = sort, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      try {
        const { data } = await postsApi.list({ page: p, limit: 10, sort: s });
        if (append) setPosts((prev) => [...prev, ...(data.posts || [])]);
        else setPosts(data.posts || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch {
        if (!append) setPosts([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sort],
  );

  useEffect(() => {
    setPage(1);
    fetchPosts(1, sort, false);
  }, [sort]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next, sort, true);
  };

  const featured = posts[0] || null;
  const gridPosts = posts.slice(1);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem 4rem" }}>
      {/* Guest hero  */}
      {!user && (
        <div
          style={{
            textAlign: "center",
            padding: "6rem 2rem 4rem",
            position: "relative",
            animation: "fadeUp 0.6s ease both",
          }}
        >
          {/* Ambient glow */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 700,
              height: 400,
              background:
                "radial-gradient(ellipse, rgba(232,97,58,0.07) 0%, transparent 65%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--accent)",
              background: "var(--accent-soft)",
              padding: "5px 14px",
              borderRadius: 20,
              marginBottom: "1.5rem",
              border: "1px solid rgba(232,97,58,0.2)",
            }}
          >
            A home for thoughtful writing
          </div>

          <h1
            style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(3rem, 7vw, 5rem)",
              fontWeight: 300,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              marginBottom: "1.5rem",
            }}
          >
            Where ideas find
            <br />
            <em style={{ color: "var(--accent)", fontStyle: "italic" }}>
              their voice
            </em>
          </h1>

          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "1.1rem",
              lineHeight: 1.7,
              maxWidth: 460,
              margin: "0 auto 2.5rem",
            }}
          >
            Discover stories, thinking, and expertise from writers on any topic.
            Share your ideas with the world.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link to="/register">
              <button
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  padding: "12px 28px",
                  borderRadius: 24,
                  fontSize: 14,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.2s, transform 0.2s",
                  fontFamily: "var(--sans)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-hover)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--accent)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Start writing — it's free
              </button>
            </Link>
            <Link to="/login">
              <button
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  padding: "12px 28px",
                  borderRadius: 24,
                  fontSize: 14,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "border-color 0.2s, color 0.2s",
                  fontFamily: "var(--sans)",
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
                Sign in
              </button>
            </Link>
          </div>

          {/* Stats strip */}
          <div
            style={{
              display: "flex",
              gap: 40,
              justifyContent: "center",
              marginTop: "3rem",
              paddingTop: "2rem",
              borderTop: "1px solid var(--border-soft)",
            }}
          >
            {[
              ["10K+", "Writers"],
              ["50K+", "Stories"],
              ["200K+", "Readers"],
            ].map(([num, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: "1.5rem",
                    color: "var(--text)",
                    marginBottom: 2,
                  }}
                >
                  {num}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logged-in welcome strip */}
      {user && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "2.5rem 0 0",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontSize: "2rem",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                marginBottom: 4,
              }}
            >
              Good to see you, {user.username} ✦
            </h1>
            <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>
              Here's what's been published lately
            </p>
          </div>
          <Link to="/write">
            <button
              style={{
                background: "var(--accent)",
                color: "#fff",
                padding: "10px 22px",
                borderRadius: 22,
                fontSize: 14,
                fontWeight: 400,
                border: "none",
                cursor: "pointer",
                transition: "background 0.2s",
                fontFamily: "var(--sans)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--accent-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--accent)")
              }
            >
              Write a story
            </button>
          </Link>
        </div>
      )}

      {/* Sort / filter bar  */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.75rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--border-soft)",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              fontFamily: "var(--serif)",
              fontSize: "1rem",
              color: "var(--text-secondary)",
              marginRight: 4,
            }}
          >
            {user ? "Stories" : "Explore"}
          </span>
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                fontSize: 13,
                background: sort === value ? "var(--ink-muted)" : "transparent",
                color: sort === value ? "var(--text)" : "var(--text-tertiary)",
                border: `1px solid ${sort === value ? "var(--border)" : "transparent"}`,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "var(--sans)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {user && (
          <Link
            to="/write"
            style={{
              fontSize: 13,
              color: "var(--text-tertiary)",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-tertiary)")
            }
          >
            + New story
          </Link>
        )}
      </div>

      {/* Loading skeletons  */}
      {loading && (
        <>
          <div style={{ marginBottom: "2rem" }}>
            <SkeletonFeatured />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "6rem 2rem",
            color: "var(--text-tertiary)",
          }}
        >
          <div style={{ fontSize: 52, marginBottom: 20 }}>✦</div>
          <h3
            style={{
              fontFamily: "var(--serif)",
              fontSize: "1.4rem",
              color: "var(--text-secondary)",
              marginBottom: 8,
            }}
          >
            No stories yet
          </h3>
          <p style={{ fontSize: 14, marginBottom: 24 }}>
            Be the first to share something with the world.
          </p>
          {user && (
            <Link to="/write">
              <Button>Write the first story</Button>
            </Link>
          )}
        </div>
      )}

      {/* Content */}
      {!loading && posts.length > 0 && (
        <>
          {/* Featured post */}
          <div
            style={{
              marginBottom: "2.5rem",
              animation: "fadeUp 0.5s ease both",
            }}
          >
            <FeaturedPost post={featured} />
          </div>

          {/* Divider with label */}
          {gridPosts.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: "1.75rem",
              }}
            >
              <div
                style={{ flex: 1, height: 1, background: "var(--border-soft)" }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                More stories
              </span>
              <div
                style={{ flex: 1, height: 1, background: "var(--border-soft)" }}
              />
            </div>
          )}

          {/* Post grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {gridPosts.map((post, i) => (
              <div
                key={post.id}
                style={{
                  animation: "fadeUp 0.4s ease both",
                  animationDelay: `${Math.min(i, 8) * 0.05}s`,
                }}
              >
                <PostCard post={post} />
              </div>
            ))}
          </div>

          {/* Load more */}
          {page < totalPages && (
            <div style={{ textAlign: "center", marginTop: "3rem" }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  background: "transparent",
                  color: loadingMore
                    ? "var(--text-tertiary)"
                    : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  padding: "10px 28px",
                  borderRadius: 22,
                  fontSize: 14,
                  cursor: loadingMore ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  fontFamily: "var(--sans)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!loadingMore) {
                    e.currentTarget.style.borderColor = "var(--text-tertiary)";
                    e.currentTarget.style.color = "var(--text)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = loadingMore
                    ? "var(--text-tertiary)"
                    : "var(--text-secondary)";
                }}
              >
                {loadingMore ? (
                  <>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid transparent",
                        borderTopColor: "var(--accent)",
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    Loading…
                  </>
                ) : (
                  "Load more stories"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
