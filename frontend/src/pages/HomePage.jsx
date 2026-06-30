import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { postsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PostCard from "../components/posts/PostCard";
import { PageLoader, Empty, Button } from "../components/ui";

export default function HomePage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState("published_at");

  const fetchPosts = async (p = 1, s = sort) => {
    setLoading(true);
    try {
      const { data } = await postsApi.list({ page: p, limit: 9, sort: s });
      if (p === 1) setPosts(data.posts || []);
      else setPosts((prev) => [...prev, ...(data.posts || [])]);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchPosts(1, sort);
  }, [sort]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next, sort);
  };

  const handlePostDelete = (id) => {
    setPosts((p) => p.filter((post) => post.id !== id));
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Hero */}
      {!user && (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 2rem 3rem",
            animation: "fadeUp 0.5s ease",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(2.5rem, 6vw, 4rem)",
              fontWeight: 300,
              letterSpacing: "-0.03em",
              marginBottom: "1rem",
              lineHeight: 1.1,
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
              marginBottom: "2rem",
              maxWidth: 480,
              margin: "0 auto 2rem",
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

      {/* Personalized greeting */}
      {user && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontSize: "1.6rem",
                fontWeight: 400,
              }}
            >
              Good to see you, {user.username} ✦
            </h1>
            <p
              style={{
                color: "var(--text-tertiary)",
                fontSize: 13,
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

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontSize: "1.1rem",
            fontWeight: 400,
            color: "var(--text-secondary)",
          }}
        >
          {user ? "Latest stories" : "Explore stories"}
        </h2>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            ["published_at", "Latest"],
            ["view_count", "Popular"],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSort(val)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                fontSize: 13,
                background: sort === val ? "var(--ink-muted)" : "transparent",
                color: sort === val ? "var(--text)" : "var(--text-tertiary)",
                border: `1px solid ${sort === val ? "var(--border)" : "transparent"}`,
                transition: "all 0.2s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--border-soft)",
          marginBottom: "1.5rem",
        }}
      />

      {/* Grid */}
      {loading && posts.length === 0 ? (
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {posts.map((post, i) => (
              <div key={post.id} style={{ animationDelay: `${i * 0.04}s` }}>
                <PostCard post={post} onDelete={handlePostDelete} />
              </div>
            ))}
          </div>

          {page < totalPages && (
            <div style={{ textAlign: "center", marginTop: "2rem" }}>
              <Button variant="secondary" onClick={loadMore} loading={loading}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
