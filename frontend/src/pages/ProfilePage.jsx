import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi, postsApi } from "../lib/api";
import { Button, Input, PageLoader } from "../components/ui";
import PostCard from "../components/posts/PostCard";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState("posts");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: user?.full_name || "",
    username: user?.username || "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    postsApi
      .list({ limit: 20 })
      .then(({ data }) =>
        setPosts((data.posts || []).filter((p) => p.author_id === user?.id)),
      )
      .catch(() => {})
      .finally(() => setPostsLoading(false));
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await authApi.updateMe(form);
      updateUser(data);
      setEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <PageLoader />;

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "2rem 1.5rem",
        animation: "fadeUp 0.4s ease",
      }}
    >
      {/* Profile card */}
      <div
        style={{
          background: "var(--ink-soft)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--radius-lg)",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--ink-muted)",
                border: "2px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                color: "var(--text-secondary)",
                fontFamily: "var(--serif)",
                flexShrink: 0,
              }}
            >
              {user.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "1.5rem",
                  fontWeight: 400,
                }}
              >
                {user.full_name || user.username}
              </h1>
              <div
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                @{user.username}
              </div>
              <div
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                Joined{" "}
                {user.created_at
                  ? format(new Date(user.created_at), "MMMM yyyy")
                  : ""}
                {" · "}
                <span
                  style={{
                    color: user.is_verified ? "var(--green)" : "var(--accent)",
                  }}
                >
                  {user.is_verified ? "✓ Verified" : "⚠ Unverified"}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Cancel" : "Edit profile"}
          </Button>
        </div>

        {/* Edit form */}
        {editing && (
          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid var(--border-soft)",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <Input
              label="Full name"
              value={form.fullName}
              onChange={set("fullName")}
              placeholder="Your display name"
            />
            <Input
              label="Username"
              value={form.username}
              onChange={set("username")}
              placeholder="username"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={handleSave} loading={saving}>
                Save changes
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-soft)",
          marginBottom: "1.5rem",
        }}
      >
        {["posts", "about"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px",
              background: "none",
              fontSize: 14,
              color: tab === t ? "var(--text)" : "var(--text-tertiary)",
              borderBottom:
                tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              textTransform: "capitalize",
              transition: "color 0.2s",
            }}
          >
            {t === "posts"
              ? `Posts (${posts.length})`
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Posts tab */}
      {tab === "posts" &&
        (postsLoading ? (
          <PageLoader />
        ) : posts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--text-tertiary)",
              padding: "3rem",
              fontSize: 14,
            }}
          >
            You haven't written any posts yet.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        ))}

      {/* About tab */}
      {tab === "about" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[
            ["Email", user.email],
            ["Role", user.role],
            ["2FA", user.two_factor_enabled ? "Enabled" : "Disabled"],
            [
              "Last login",
              user.last_login_at
                ? format(new Date(user.last_login_at), "MMM d, yyyy HH:mm")
                : "N/A",
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                gap: 16,
                padding: "0.75rem 0",
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-tertiary)",
                  minWidth: 100,
                }}
              >
                {label}
              </span>
              <span style={{ fontSize: 13, color: "var(--text)" }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
