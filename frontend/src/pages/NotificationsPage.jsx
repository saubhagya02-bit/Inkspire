import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { notificationsApi } from "../lib/api";
import { PageLoader } from "../components/ui";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import toast from "react-hot-toast";

// Icon map
const TYPE_CONFIG = {
  comment_on_post: { icon: "💬", color: "#5b9cf6", label: "Comment" },
  reply_to_comment: { icon: "↩️", color: "#5b9cf6", label: "Reply" },
  post_published: { icon: "📝", color: "#4caf7d", label: "Published" },
  post_liked: { icon: "❤️", color: "#e8613a", label: "Like" },
  new_follower: { icon: "👤", color: "#e8c547", label: "Follower" },
  welcome: { icon: "👋", color: "#4caf7d", label: "Welcome" },
  password_reset: { icon: "🔐", color: "#a09d98", label: "Security" },
  email_verify: { icon: "✉️", color: "#5b9cf6", label: "Verify" },
  system: { icon: "🔔", color: "#a09d98", label: "System" },
};

// Date group label
function groupLabel(dateStr) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

function groupNotifications(notifications) {
  const groups = [];
  let currentLabel = null;
  let currentItems = [];

  for (const n of notifications) {
    const label = groupLabel(n.createdAt);
    if (label !== currentLabel) {
      if (currentItems.length)
        groups.push({ label: currentLabel, items: currentItems });
      currentLabel = label;
      currentItems = [n];
    } else {
      currentItems.push(n);
    }
  }
  if (currentItems.length)
    groups.push({ label: currentLabel, items: currentItems });
  return groups;
}

// Single notification row
function NotifRow({ notif, onRead, onDelete }) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
  const [hovering, setHovering] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    await onDelete();
  };

  if (deleting) return null;

  return (
    <div
      onClick={() => !notif.isRead && onRead()}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 16px",
        borderRadius: "var(--radius)",
        background: notif.isRead
          ? hovering
            ? "var(--ink-soft)"
            : "transparent"
          : "var(--ink-soft)",
        border: `1px solid ${notif.isRead ? (hovering ? "var(--border-soft)" : "transparent") : "var(--border-soft)"}`,
        cursor: notif.isRead ? "default" : "pointer",
        transition: "background 0.15s, border-color 0.15s",
        position: "relative",
      }}
    >
      {/* Unread accent bar */}
      {!notif.isRead && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: "55%",
            background: "var(--accent)",
            borderRadius: "0 3px 3px 0",
          }}
        />
      )}

      {/* Icon bubble */}
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
          fontSize: 17,
          flexShrink: 0,
        }}
      >
        {cfg.icon}
      </div>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: notif.isRead ? 300 : 400,
            color: "var(--text)",
            lineHeight: 1.45,
            marginBottom: 3,
          }}
        >
          {notif.title}
        </div>

        {notif.body && (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {notif.body}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 6,
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {formatDistanceToNow(new Date(notif.createdAt), {
              addSuffix: true,
            })}
          </span>

          {!notif.isRead && (
            <span
              style={{
                fontSize: 10,
                color: "var(--accent)",
                fontWeight: 500,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              New
            </span>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexShrink: 0,
          alignItems: "center",
          opacity: hovering ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      >
        {notif.actionUrl && (
          <Link
            to={notif.actionUrl}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              background: "var(--ink-muted)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              transition: "color 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            View
          </Link>
        )}

        <button
          onClick={handleDelete}
          title="Dismiss"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "transparent",
            border: "1px solid transparent",
            color: "var(--text-tertiary)",
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s",
            fontFamily: "var(--sans)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent-soft)";
            e.currentTarget.style.color = "var(--accent)";
            e.currentTarget.style.borderColor = "rgba(232,97,58,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-tertiary)";
            e.currentTarget.style.borderColor = "transparent";
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

//  Empty state
function EmptyNotifications({ unreadOnly }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "5rem 2rem",
        color: "var(--text-tertiary)",
        animation: "fadeUp 0.4s ease both",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "var(--ink-soft)",
          border: "1px solid var(--border-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          marginBottom: 20,
        }}
      >
        🔔
      </div>
      <h3
        style={{
          fontFamily: "var(--serif)",
          fontSize: "1.2rem",
          color: "var(--text-secondary)",
          marginBottom: 8,
        }}
      >
        {unreadOnly ? "No unread notifications" : "You're all caught up"}
      </h3>
      <p
        style={{
          fontSize: 14,
          maxWidth: 280,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        {unreadOnly
          ? "All notifications have been read."
          : "Activity from posts, comments, and follows will appear here."}
      </p>
    </div>
  );
}

//  Main page
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await notificationsApi.list({
          limit: 50,
          unreadOnly: unreadOnly ? "true" : "false",
        });
        setNotifications(data.notifications || []);
      } catch {
        if (!silent) toast.error("Failed to load notifications");
      } finally {
        setLoading(false);
      }
    },
    [unreadOnly],
  );

  useEffect(() => {
    fetchNotifications(false);
  }, [fetchNotifications]);

  useEffect(() => {
    const id = setInterval(() => fetchNotifications(true), 30000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  const markRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      );
    } catch {}
  };

  const deleteNotif = async (id) => {
    try {
      await notificationsApi.delete(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch {
      toast.error("Failed to remove notification");
    }
  };

  const markAllRead = async () => {
    setMarking(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All marked as read");
    } catch {
      toast.error("Failed");
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const groups = groupNotifications(notifications);

  return (
    <div
      style={{
        maxWidth: 680,
        margin: "0 auto",
        padding: "2rem 1.5rem 4rem",
        animation: "fadeUp 0.4s ease both",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
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
              fontSize: "1.8rem",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              marginBottom: 4,
            }}
          >
            Notifications
            {unreadCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 500,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  marginLeft: 10,
                  verticalAlign: "middle",
                  fontFamily: "var(--sans)",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All caught up"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setUnreadOnly((v) => !v)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 13,
              background: unreadOnly ? "var(--ink-muted)" : "transparent",
              color: unreadOnly ? "var(--text)" : "var(--text-tertiary)",
              border: `1px solid ${unreadOnly ? "var(--border)" : "transparent"}`,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "var(--sans)",
            }}
          >
            Unread only
          </button>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 13,
                background: "var(--ink-soft)",
                color: marking
                  ? "var(--text-tertiary)"
                  : "var(--text-secondary)",
                border: "1px solid var(--border)",
                cursor: marking ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                fontFamily: "var(--sans)",
              }}
            >
              {marking ? "Marking…" : "Mark all read"}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <PageLoader />
      ) : notifications.length === 0 ? (
        <EmptyNotifications unreadOnly={unreadOnly} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {groups.map((group) => (
            <div key={group.label}>
              {/* Date group header */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                  paddingLeft: 2,
                }}
              >
                {group.label}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  background: "var(--ink-soft)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: "var(--radius-lg)",
                  padding: "4px",
                  overflow: "hidden",
                }}
              >
                {group.items.map((n) => (
                  <NotifRow
                    key={n._id}
                    notif={n}
                    onRead={() => markRead(n._id)}
                    onDelete={() => deleteNotif(n._id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
