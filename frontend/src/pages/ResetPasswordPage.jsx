import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { authApi } from "../lib/api";
import { Button, Input } from "../components/ui";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.password || form.password.length < 8)
      e.password = "Password must be at least 8 characters";
    if (!/(?=.*[A-Z])(?=.*\d)/.test(form.password))
      e.password = "Must include an uppercase letter and number";
    if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, { password: form.password });
      toast.success("Password reset! You can now sign in.");
      navigate("/login");
    } catch (err) {
      const msg =
        err.response?.data?.error || "Reset failed. The link may have expired.";
      toast.error(msg);
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
          <h1
            style={{
              fontFamily: "var(--serif)",
              fontSize: "1.6rem",
              fontWeight: 400,
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            Set new password
          </h1>
          <p
            style={{
              color: "var(--text-tertiary)",
              fontSize: 13,
              textAlign: "center",
              marginBottom: "1.75rem",
            }}
          >
            Choose a strong password for your account
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <Input
              label="New password"
              type="password"
              value={form.password}
              onChange={set("password")}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              error={errors.password}
              autoComplete="new-password"
            />
            <Input
              label="Confirm new password"
              type="password"
              value={form.confirm}
              onChange={set("confirm")}
              placeholder="Repeat your password"
              error={errors.confirm}
              autoComplete="new-password"
            />
            <Button
              type="submit"
              loading={loading}
              style={{ width: "100%", marginTop: 4 }}
            >
              Reset password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
