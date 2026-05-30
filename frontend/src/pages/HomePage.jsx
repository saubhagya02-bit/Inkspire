import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { postsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PostCard from "../components/posts/PostCard";
import { PageLoader, Empty, Button } from "../components/ui";

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
      if (p === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const { data } = await postsApi.list({ page: p, limit: 9, sort: s });
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

  const loadMore = async () => {
    const next = page + 1;
    setPage(next);
    await fetchPosts(next, sort, true);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Hero (unauthenticated)  */}
      {!user && (
        <div
          style={{
            textAlign: "center",
            padding: "5rem 2rem 4rem",
            animation: "fadeUp 0.5s ease",
            position: "relative",
          }}
        >
          {/* Decorative glow */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 600,
              height: 300,
              background:
                "radial-gradient(ellipse, rgba(232,97,58,0.06) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <h1
            style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(2.8rem, 7vw, 4.5rem)",
              fontWeight: 300,
              letterSpacing: "-0.04em",
              marginBottom: "1.25rem",
              lineHeight: 1.05,
              position: "relative",
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
              marginBottom: "2.5rem",
              maxWidth: 440,
              margin: "0 auto 2.5rem",
              lineHeight: 1.7,
            }}
          >
            Discover stories, thinking, and expertise from writers on any topic.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link to="/register">
              <Button size="lg">Start writing</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Welcome banner for logged-in users  */}
      {user && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
            padding: "1.5rem 0 0",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontSize: "1.8rem",
                fontWeight: 400,
                letterSpacing: "-0.02em",
              }}
            >
              Good to see you, {user.username} ✦
            </h1>
            <p
              style={{
                color: "var(--text-tertiary)",
                fontSize: 14,
                marginTop: 4,
              }}
            >
              Here's what's been published lately
            </p>
          </div>
          <Link to="/write">
            <Button>Write a story</Button>
          </Link>
        </div>
      )}

      {/* Filter / Sort bar  */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "2rem 0 1.5rem",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "1px solid var(--border-soft)",
          paddingBottom: "1rem",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontSize: "1.1rem",
            fontWeight: 400,
            color: "var(--text-secondary)",
            letterSpacing: "-0.01em",
          }}
        >
          {user ? "Latest stories" : "Explore stories"}
        </h2>

        <div style={{ display: "flex", gap: 4 }}>
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
                transition: "all 0.2s",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content  */}
      {loading ? (
        <PageLoader />
      ) : posts.length === 0 ? (
        <Empty
          icon="✦"
          title="No stories yet"
          description="Be the first to share something with the world."
          action={
            user && (
              <Link to="/write">
                <Button>Write a story</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* Responsive grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {posts.map((post, i) => (
              <div
                key={post.id}
                style={{ animationDelay: `${Math.min(i, 6) * 0.06}s` }}
              >
                <PostCard post={post} />
              </div>
            ))}
          </div>

          {/* Load more */}
          {page < totalPages && (
            <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
              <Button
                variant="secondary"
                onClick={loadMore}
                loading={loadingMore}
              >
                Load more stories
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
