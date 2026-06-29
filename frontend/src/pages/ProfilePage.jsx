import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi, postsApi, mediaApi, followApi } from "../lib/api";
import { Button, Input, PageLoader, Spinner } from "../components/ui";
import FollowButton from "../components/ui/FollowButton";
import PostCard from "../components/posts/PostCard";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [tab, setTab] = useState("posts");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    avatarUrl: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.full_name || "",
      username: user.username || "",
      avatarUrl: user.avatar_url || "",
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Fetch own posts
    postsApi
      .list({ limit: 50 })
      .then(({ data }) => {
        setPosts((data.posts || []).filter((p) => p.author_id === user.id));
      })
      .catch(() => {})
      .finally(() => setPostsLoading(false));
  }, [user]);

  // Load followers/following when tab is clicked
  useEffect(() => {
    if (!user) return;
    if (tab === "followers") {
      followApi
        .followers(user.id)
        .then(({ data }) => setFollowers(data))
        .catch(() => toast.error("Failed to load followers"));
    }
    if (tab === "following") {
      followApi
        .following(user.id)
        .then(({ data }) => setFollowing(data))
        .catch(() => toast.error("Failed to load following"));
    }
  }, [tab, user]);

  // Avatar upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("altText", `${user.username} avatar`);
      const { data } = await mediaApi.upload(formData);
      const avatarUrl = data.url;

      // Save to profile immediately
      const { data: updated } = await authApi.updateMe({ avatarUrl });
      updateUser(updated);
      setForm((f) => ({ ...f, avatarUrl }));
      toast.success("Profile picture updated!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Save profile
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await authApi.updateMe({
        fullName: form.fullName || undefined,
        username: form.username || undefined,
        avatarUrl: form.avatarUrl || undefined,
      });
      updateUser(data);
      setEditing(false);
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handlePostDelete = (id) => {
    setPosts((p) => p.filter((post) => post.id !== id));
  };

  if (!user) return <PageLoader />;

  const avatarUrl = user.avatar_url || form.avatarUrl;

  return (
    <div
      style={{
        maxWidth: 860,
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
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "var(--ink-muted)",
                border: "2px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontFamily: "var(--serif)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                user.username?.[0]?.toUpperCase()
              )}
              {/* Hover overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0,
                  transition: "opacity 0.2s",
                  borderRadius: "50%",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
              >
                {uploading ? (
                  <Spinner size={18} color="#fff" />
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarUpload}
            />
            {/* Small camera badge */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--accent)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid var(--ink-soft)",
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontSize: "1.4rem",
                fontWeight: 400,
                marginBottom: 4,
              }}
            >
              {user.full_name || user.username}
            </h1>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-tertiary)",
                marginBottom: 8,
              }}
            >
              @{user.username}
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: "1.5rem", marginBottom: 10 }}>
              <StatItem
                label="Posts"
                value={posts.length}
                onClick={() => setTab("posts")}
              />
              <StatItem
                label="Followers"
                value={user.follower_count || 0}
                onClick={() => setTab("followers")}
              />
              <StatItem
                label="Following"
                value={user.following_count || 0}
                onClick={() => setTab("following")}
              />
            </div>

            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <Input
                label="Full name"
                value={form.fullName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fullName: e.target.value }))
                }
                placeholder="Your display name"
              />
              <Input
                label="Username"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
                placeholder="username"
              />
            </div>
            <Input
              label="Avatar URL (or upload above)"
              value={form.avatarUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, avatarUrl: e.target.value }))
              }
              placeholder="https://..."
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
        {[
          ["posts", `Posts (${posts.length})`],
          ["followers", `Followers (${user.follower_count || 0})`],
          ["following", `Following (${user.following_count || 0})`],
          ["about", "About"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 18px",
              background: "none",
              fontSize: 13,
              color: tab === key ? "var(--text)" : "var(--text-tertiary)",
              borderBottom:
                tab === key
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.2s",
            }}
          >
            {label}
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
              <PostCard key={p.id} post={p} onDelete={handlePostDelete} />
            ))}
          </div>
        ))}

      {/* Followers tab */}
      {tab === "followers" && (
        <UserList users={followers} emptyText="No followers yet" />
      )}

      {/* Following tab */}
      {tab === "following" && (
        <UserList users={following} emptyText="Not following anyone yet" />
      )}

      {/* About tab */}
      {tab === "about" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            maxWidth: 480,
          }}
        >
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

function StatItem({ label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        textAlign: "left",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <div
        style={{
          fontSize: "1.1rem",
          fontWeight: 500,
          color: "var(--text)",
          fontFamily: "var(--serif)",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</div>
    </button>
  );
}

function UserList({ users, emptyText }) {
  if (!users.length)
    return (
      <div
        style={{
          textAlign: "center",
          color: "var(--text-tertiary)",
          padding: "3rem",
          fontSize: 14,
        }}
      >
        {emptyText}
      </div>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {users.map((u) => (
        <div
          key={u.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.875rem",
            padding: "0.75rem",
            borderRadius: "var(--radius)",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--ink-soft)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--ink-muted)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontFamily: "var(--serif)",
              color: "var(--text-secondary)",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {u.avatar_url ? (
              <img
                src={u.avatar_url}
                alt={u.username}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              u.username?.[0]?.toUpperCase()
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 400 }}>
              {u.full_name || u.username}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              @{u.username} · {u.follower_count || 0} followers
            </div>
          </div>
          <FollowButton userId={u.id} />
        </div>
      ))}
    </div>
  );
}
