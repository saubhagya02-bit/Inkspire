import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "../components/ui";
import toast from "react-hot-toast";

function AuthLayout({
  children,
  title,
  subtitle,
  linkText,
  linkTo,
  linkLabel,
}) {
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

        {/* Card */}
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
            {title}
          </h1>
          <p
            style={{
              color: "var(--text-tertiary)",
              fontSize: 13,
              textAlign: "center",
              marginBottom: "1.75rem",
            }}
          >
            {subtitle}
          </p>
          {children}
        </div>

        <p
          style={{
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: 13,
            marginTop: "1.25rem",
          }}
        >
          {linkText}{" "}
          <Link
            to={linkTo}
            style={{
              color: "var(--accent)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {linkLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!form.email) {
      setErrors({ email: "Email is required" });
      return;
    }
    if (!form.password) {
      setErrors({ password: "Password is required" });
      return;
    }
    setLoading(true);
    try {
      await login(form);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.error || "Login failed";
      if (msg.includes("credentials"))
        setErrors({ password: "Invalid email or password" });
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your InkSpire account"
      linkText="Don't have an account?"
      linkTo="/register"
      linkLabel="Sign up"
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={set("email")}
          placeholder="example@gmail.com"
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={set("password")}
          placeholder="••••••••"
          error={errors.password}
          autoComplete="current-password"
        />
        <div style={{ textAlign: "right", marginTop: -4 }}>
          <Link
            to="/forgot-password"
            style={{ fontSize: 12, color: "var(--text-tertiary)" }}
          >
            Forgot password?
          </Link>
        </div>
        <Button
          type="submit"
          loading={loading}
          style={{ width: "100%", marginTop: 4 }}
        >
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    fullName: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.email) e.email = "Email is required";
    if (!form.username || form.username.length < 3)
      e.username = "Username must be at least 3 characters";
    if (!/^[a-zA-Z0-9]+$/.test(form.username))
      e.username = "Username must be alphanumeric";
    if (!form.password || form.password.length < 8)
      e.password = "Password must be at least 8 characters";
    if (!/(?=.*[A-Z])(?=.*\d)/.test(form.password))
      e.password = "Must include an uppercase letter and number";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created! Welcome to InkSpire.");
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.error || "Registration failed";
      if (msg.includes("already"))
        setErrors({ email: "Email or username already taken" });
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Start writing and sharing your ideas"
      linkText="Already have an account?"
      linkTo="/login"
      linkLabel="Sign in"
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <Input
          label="Full name (optional)"
          value={form.fullName}
          onChange={set("fullName")}
          placeholder="James Smith"
        />
        <Input
          label="Username"
          value={form.username}
          onChange={set("username")}
          placeholder="jamessmith"
          error={errors.username}
          autoComplete="username"
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={set("email")}
          placeholder="example@gmail.com"
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={set("password")}
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          error={errors.password}
          autoComplete="new-password"
        />
        <Button
          type="submit"
          loading={loading}
          style={{ width: "100%", marginTop: 4 }}
        >
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
