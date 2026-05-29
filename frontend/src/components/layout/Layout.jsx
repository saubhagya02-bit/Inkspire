import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { notificationsApi } from "../../lib/api";
import toast from "react-hot-toast";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    notificationsApi
      .unreadCount()
      .then(({ data }) => setUnread(data.count))
      .catch(() => {});
    const interval = setInterval(() => {
      notificationsApi
        .unreadCount()
        .then(({ data }) => setUnread(data.count))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Navbar */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: scrolled ? "rgba(14,14,15,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled
            ? "1px solid var(--border-soft)"
            : "1px solid transparent",
          transition: "all 0.3s ease",
          padding: "0 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <Link
            to="/"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                fontFamily: "var(--serif)",
                fontSize: "1.5rem",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                color: "var(--text)",
              }}
            >
              Ink<span style={{ color: "var(--accent)" }}>Spire</span>
            </span>
          </Link>

          {/* Nav links */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {user ? (
              <>
                <NavLink to="/" active={isActive("/")}>
                  Feed
                </NavLink>
                <Link to="/write">
                  <button
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                      padding: "6px 16px",
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 400,
                      transition: "background 0.2s",
                      marginLeft: 8,
                    }}
                    onMouseEnter={(e) =>
                      (e.target.style.background = "var(--accent-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.background = "var(--accent)")
                    }
                  >
                    Write
                  </button>
                </Link>

                {/* Notifications */}
                <Link
                  to="/notifications"
                  style={{
                    position: "relative",
                    padding: "6px 10px",
                    borderRadius: 8,
                    color: isActive("/notifications")
                      ? "var(--text)"
                      : "var(--text-secondary)",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                  {unread > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 6,
                        background: "var(--accent)",
                        color: "#fff",
                        fontSize: 9,
                        fontWeight: 500,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid var(--ink)",
                      }}
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>

                {/* User menu */}
                <div ref={menuRef} style={{ position: "relative" }}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "var(--ink-muted)",
                      border: "1.5px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text)",
                      fontSize: 13,
                      fontWeight: 500,
                      marginLeft: 4,
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "var(--accent)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "var(--border)")
                    }
                  >
                    {user.username?.[0]?.toUpperCase() || "U"}
                  </button>
                  {menuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        background: "var(--ink-soft)",
                        border: "1px solid var(--border)",
                        borderRadius: var_radius_lg,
                        minWidth: 180,
                        boxShadow: "var(--shadow-lg)",
                        animation: "fadeUp 0.15s ease",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border-soft)",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {user.username}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-tertiary)",
                            marginTop: 2,
                          }}
                        >
                          {user.email}
                        </div>
                      </div>
                      <MenuLink
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                      >
                        Profile
                      </MenuLink>
                      <MenuLink to="/write" onClick={() => setMenuOpen(false)}>
                        New Post
                      </MenuLink>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          textAlign: "left",
                          background: "none",
                          color: "var(--accent)",
                          fontSize: 13,
                          borderTop: "1px solid var(--border-soft)",
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <NavLink to="/login">Sign in</NavLink>
                <Link to="/register">
                  <button
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                      padding: "6px 16px",
                      borderRadius: 20,
                      fontSize: 13,
                      marginLeft: 4,
                    }}
                  >
                    Get started
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-soft)",
          padding: "1.5rem",
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: 13,
        }}
      >
        <span style={{ fontFamily: "var(--serif)" }}>InkSpire</span> ·{" "}
        {new Date().getFullYear()}
      </footer>
    </div>
  );
}

const var_radius_lg = "var(--radius-lg)";

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 14,
        color: active ? "var(--text)" : "var(--text-secondary)",
        transition: "color 0.2s",
      }}
      onMouseEnter={(e) => (e.target.style.color = "var(--text)")}
      onMouseLeave={(e) =>
        (e.target.style.color = active
          ? "var(--text)"
          : "var(--text-secondary)")
      }
    >
      {children}
    </Link>
  );
}

function MenuLink({ to, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        display: "block",
        padding: "10px 16px",
        fontSize: 13,
        color: "var(--text-secondary)",
        transition: "color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--ink-muted)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "none";
        e.currentTarget.style.color = "var(--text-secondary)";
      }}
    >
      {children}
    </Link>
  );
}
