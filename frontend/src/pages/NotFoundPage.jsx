import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ink)",
        padding: "2rem",
        animation: "fadeIn 0.4s ease",
      }}
    >
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: "clamp(6rem, 20vw, 12rem)",
          fontWeight: 300,
          color: "var(--ink-muted)",
          lineHeight: 1,
          letterSpacing: "-0.05em",
          marginBottom: "1rem",
          textShadow: "0 0 80px rgba(232,97,58,0.15)",
        }}
      >
        404
      </div>
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontSize: "1.5rem",
          fontWeight: 400,
          marginBottom: 8,
        }}
      >
        Page not found
      </h1>
      <p
        style={{
          color: "var(--text-tertiary)",
          fontSize: 14,
          marginBottom: "2rem",
        }}
      >
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/">
        <Button>Back to feed</Button>
      </Link>
    </div>
  );
}
