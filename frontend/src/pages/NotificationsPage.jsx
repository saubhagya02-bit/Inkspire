import { useState, useEffect, useCallback } from "react";
import { notificationsApi } from "../lib/api";
import { Button, PageLoader, Empty } from "../components/ui";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

const TYPE_ICONS = {
  comment_on_post: "💬",
  reply_to_comment: "↩️",
  post_published: "📝",
  post_liked: "❤️",
  new_follower: "👤",
  welcome: "👋",
  password_reset: "🔐",
  email_verify: "✉️",
  system: "🔔",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await notificationsApi.list({
        limit: 50,
        unreadOnly: unreadOnly ? "true" : "false",
      });
      setNotifications(data.notifications || []);
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    setLoading(true);
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications((n) => n.map((x) => ({ ...x, isRead: true })));
      toast.success("All marked as read");
    } catch {
      toast.error("Failed");
    } finally {
      setMarking(false);
    }
  };

  const markRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((n) =>
        n.map((x) => (x._id === id ? { ...x, isRead: true } : x)),
      );
    } catch {}
  };

  const deleteNotif = async (id) => {
    try {
      await notificationsApi.delete(id);
      setNotifications((n) => n.filter((x) => x._id !== id));
    } catch {
      toast.error("Failed to delete");
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      style={{
        maxWidth: 680,
        margin: "0 auto",
        padding: "2rem 1.5rem",
        animation: "fadeUp 0.4s ease",
      }}
    >
      {/* Header */}
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
        <div>
          <h1
            style={{
              fontFamily: "var(--serif)",
              fontSize: "1.6rem",
              fontWeight: 400,
            }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p
              style={{
                fontSize: 13,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {unreadCount} unread
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setUnreadOnly((v) => !v)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              fontSize: 13,
              background: unreadOnly ? "var(--ink-muted)" : "transparent",
              color: unreadOnly ? "var(--text)" : "var(--text-tertiary)",
              border: `1px solid ${unreadOnly ? "var(--border)" : "transparent"}`,
              transition: "all 0.2s",
              cursor: "pointer",
            }}
          >
            Unread only
          </button>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllRead}
              loading={marking}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <PageLoader />
      ) : notifications.length === 0 ? (
        <Empty
          icon="🔔"
          title="You're all caught up"
          description={
            unreadOnly
              ? "No unread notifications."
              : "No notifications to show."
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {notifications.map((n) => (
            <NotifItem
              key={n._id}
              notif={n}
              onRead={() => markRead(n._id)}
              onDelete={() => deleteNotif(n._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotifItem({ notif, onRead, onDelete }) {
  const icon = TYPE_ICONS[notif.type] || "🔔";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "1rem",
        background: notif.isRead ? "transparent" : "var(--ink-soft)",
        borderRadius: "var(--radius)",
        border: `1px solid ${notif.isRead ? "transparent" : "var(--border-soft)"}`,
        transition: "all 0.2s",
        cursor: notif.isRead ? "default" : "pointer",
        position: "relative",
      }}
      onClick={() => !notif.isRead && onRead()}
    >
      {/* Unread indicator */}
      {!notif.isRead && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: "60%",
            background: "var(--accent)",
            borderRadius: "0 3px 3px 0",
          }}
        />
      )}

      {/* Icon */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "var(--ink-muted)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: notif.isRead ? 300 : 400,
            color: "var(--text)",
            marginBottom: 3,
            lineHeight: 1.4,
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
          style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 5 }}
        >
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {notif.actionUrl && (
          <Link
            to={notif.actionUrl}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              background: "var(--ink-muted)",
              color: "var(--text-secondary)",
            }}
          >
            View
          </Link>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            fontSize: 12,
            background: "none",
            color: "var(--text-tertiary)",
            transition: "color 0.15s",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.target.style.color = "var(--accent)")}
          onMouseLeave={(e) => (e.target.style.color = "var(--text-tertiary)")}
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
