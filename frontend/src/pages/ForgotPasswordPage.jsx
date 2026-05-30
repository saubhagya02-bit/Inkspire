import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../lib/api";
import { Button, Input } from "../components/ui";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Email is required");
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ink)",
        padding: "2rem",
      }}
    >
      {/* Background decoration */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 60% 50% at 50% -20%, rgba(232,97,58,0.08) 0%, transparent 70%)",
        }}
      />

      <div
        style={{ width: "100%", maxWidth: 420, animation: "fadeUp 0.4s ease" }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <Link
            to="/"
            style={{
              fontFamily: "var(--serif)",
              fontSize: "2rem",
              letterSpacing: "-0.03em",
            }}
          >
            Ink<span style={{ color: "var(--accent)" }}>Spire</span>
          </Link>
        </div>

        <div
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "2rem",
          }}
        >
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h2
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "1.4rem",
                  fontWeight: 400,
                  marginBottom: 8,
                }}
              >
                Check your inbox
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                If that email exists in our system, we've sent a password reset
                link. The link expires in 1 hour.
              </p>
              <Link
                to="/login"
                style={{
                  display: "inline-block",
                  marginTop: "1.5rem",
                  color: "var(--accent)",
                  fontSize: 14,
                }}
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "1.6rem",
                  fontWeight: 400,
                  marginBottom: 6,
                  textAlign: "center",
                }}
              >
                Reset password
              </h1>
              <p
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 13,
                  textAlign: "center",
                  marginBottom: "1.75rem",
                }}
              >
                Enter your email and we'll send you a reset link
              </p>

              <form
                onSubmit={handleSubmit}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  autoComplete="email"
                />
                <Button
                  type="submit"
                  loading={loading}
                  style={{ width: "100%", marginTop: 4 }}
                >
                  Send reset link
                </Button>
              </form>

              <p
                style={{
                  textAlign: "center",
                  marginTop: "1.25rem",
                  fontSize: 13,
                  color: "var(--text-tertiary)",
                }}
              >
                Remember your password?{" "}
                <Link to="/login" style={{ color: "var(--accent)" }}>
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
