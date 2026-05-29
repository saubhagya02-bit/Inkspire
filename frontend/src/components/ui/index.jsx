// Button
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  style: extraStyle,
  ...props
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "none",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    fontFamily: "var(--sans)",
    fontWeight: 400,
    transition: "all 0.2s",
    opacity: disabled || loading ? 0.6 : 1,
    borderRadius: "var(--radius)",
  };
  const sizes = {
    sm: { padding: "6px 14px", fontSize: 13 },
    md: { padding: "9px 20px", fontSize: 14 },
    lg: { padding: "12px 28px", fontSize: 15 },
  };
  const variants = {
    primary: { background: "var(--accent)", color: "#fff" },
    secondary: {
      background: "var(--ink-muted)",
      color: "var(--text)",
      border: "1px solid var(--border)",
    },
    ghost: { background: "transparent", color: "var(--text-secondary)" },
    danger: {
      background: "rgba(232,97,58,0.1)",
      color: "var(--accent)",
      border: "1px solid rgba(232,97,58,0.3)",
    },
  };
  return (
    <button
      style={{ ...base, ...sizes[size], ...variants[variant], ...extraStyle }}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

// Input
export function Input({ label, error, style: extraStyle, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            fontWeight: 400,
          }}
        >
          {label}
        </label>
      )}
      <input
        style={{
          background: "var(--ink-soft)",
          border: `1px solid ${error ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          color: "var(--text)",
          padding: "10px 14px",
          fontSize: 14,
          width: "100%",
          transition: "border-color 0.2s",
          ...extraStyle,
        }}
        onFocus={(e) =>
          (e.target.style.borderColor = error ? "var(--accent)" : "var(--blue)")
        }
        onBlur={(e) =>
          (e.target.style.borderColor = error
            ? "var(--accent)"
            : "var(--border)")
        }
        {...props}
      />
      {error && (
        <span style={{ fontSize: 12, color: "var(--accent)" }}>{error}</span>
      )}
    </div>
  );
}

// Textarea
export function Textarea({ label, error, style: extraStyle, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {label}
        </label>
      )}
      <textarea
        style={{
          background: "var(--ink-soft)",
          border: `1px solid ${error ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          color: "var(--text)",
          padding: "10px 14px",
          fontSize: 14,
          width: "100%",
          resize: "vertical",
          minHeight: 120,
          transition: "border-color 0.2s",
          fontFamily: "var(--sans)",
          ...extraStyle,
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--blue)")}
        onBlur={(e) =>
          (e.target.style.borderColor = error
            ? "var(--accent)"
            : "var(--border)")
        }
        {...props}
      />
      {error && (
        <span style={{ fontSize: 12, color: "var(--accent)" }}>{error}</span>
      )}
    </div>
  );
}

// Spinner
export function Spinner({ size = 20, color = "var(--accent)" }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid transparent`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// Full page loader
export function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40vh",
      }}
    >
      <Spinner size={32} />
    </div>
  );
}

// Badge
export function Badge({ children, color = "default" }) {
  const colors = {
    default: { background: "var(--ink-muted)", color: "var(--text-secondary)" },
    green: { background: "var(--green-soft)", color: "var(--green)" },
    orange: { background: "var(--accent-soft)", color: "var(--accent)" },
    blue: { background: "var(--blue-soft)", color: "var(--blue)" },
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 400,
        ...colors[color],
      }}
    >
      {children}
    </span>
  );
}

// Empty state
export function Empty({ icon, title, description, action }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "4rem 2rem",
        color: "var(--text-tertiary)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon || "✦"}</div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: "1.2rem",
          color: "var(--text-secondary)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 14, marginBottom: 20 }}>{description}</div>
      )}
      {action}
    </div>
  );
}

// Divider
export function Divider({ style }) {
  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid var(--border-soft)",
        ...style,
      }}
    />
  );
}
