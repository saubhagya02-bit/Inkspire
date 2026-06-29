import { useState, useEffect } from "react";
import { followApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function FollowButton({
  userId,
  initialFollowing = false,
  initialCount = 0,
  onUpdate,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user || !userId || user.id === userId) return;
    followApi
      .status(userId)
      .then(({ data }) => {
        setFollowing(data.following);
        setCount(data.followerCount);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [userId, user]);

  if (!user || user.id === userId) return null;

  const handleClick = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (loading) return;
    setLoading(true);

    const wasFollowing = following;
    // Optimistic update
    setFollowing(!wasFollowing);
    setCount((c) => (wasFollowing ? c - 1 : c + 1));

    try {
      const { data } = wasFollowing
        ? await followApi.unfollow(userId)
        : await followApi.follow(userId);
      setFollowing(data.following);
      setCount(data.followerCount);
      if (onUpdate) onUpdate(data);
      toast.success(data.following ? "Following!" : "Unfollowed");
    } catch (err) {
      // Rollback
      setFollowing(wasFollowing);
      setCount((c) => (wasFollowing ? c + 1 : c - 1));
      toast.error(err.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || !checked}
      style={{
        padding: "7px 20px",
        borderRadius: 20,
        fontSize: 13,
        fontFamily: "var(--sans)",
        fontWeight: 400,
        cursor: loading ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        opacity: loading ? 0.7 : 1,
        ...(following
          ? {
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }
          : {
              background: "var(--accent)",
              color: "#fff",
              border: "1px solid var(--accent)",
            }),
      }}
      onMouseEnter={(e) => {
        if (following) {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.color = "var(--accent)";
        }
      }}
      onMouseLeave={(e) => {
        if (following) {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }
      }}
    >
      {loading ? "..." : following ? "Following" : "Follow"}
    </button>
  );
}
