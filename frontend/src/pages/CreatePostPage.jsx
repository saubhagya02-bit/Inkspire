import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { postsApi } from "../lib/api";
import { Button, Input, Textarea } from "../components/ui";
import toast from "react-hot-toast";

export default function CreatePostPage() {
  return <PostEditor />;
}

export function EditPostPageInner({ post }) {
  return <PostEditor initial={post} isEdit />;
}

function PostEditor({ initial, isEdit }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("write");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title || "",
    content: initial?.content || "",
    excerpt: initial?.excerpt || "",
    status: initial?.status || "draft",
    visibility: initial?.visibility || "public",
    coverImageUrl: initial?.cover_image_url || "",
    seoTitle: initial?.seo_title || "",
    seoDescription: initial?.seo_description || "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async (status) => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.content.trim()) {
      toast.error("Content is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        excerpt: form.excerpt,
        status,
        visibility: form.visibility,
        coverImageUrl: form.coverImageUrl,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
      };

      const { data } = isEdit
        ? await postsApi.update(initial.id, payload)
        : await postsApi.create(payload);

      toast.success(status === "published" ? "Post published!" : "Draft saved");
      navigate(`/posts/${data.slug || data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const wordCount = form.content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontSize: "1.6rem",
            fontWeight: 400,
          }}
        >
          {isEdit ? "Edit story" : "New story"}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="secondary"
            onClick={() => handleSave("draft")}
            loading={saving}
          >
            Save draft
          </Button>
          <Button onClick={() => handleSave("published")} loading={saving}>
            Publish
          </Button>
        </div>
      </div>

      {/* Title input */}
      <textarea
        value={form.title}
        onChange={set("title")}
        placeholder="Your story title..."
        rows={2}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid var(--border-soft)",
          color: "var(--text)",
          fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
          fontFamily: "var(--serif)",
          fontWeight: 300,
          lineHeight: 1.3,
          padding: "0 0 1rem",
          marginBottom: "1.5rem",
          resize: "none",
          letterSpacing: "-0.02em",
          outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderBottomColor = "var(--border)")}
        onBlur={(e) =>
          (e.target.style.borderBottomColor = "var(--border-soft)")
        }
      />

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: "1rem",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        {["write", "preview", "settings"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "none",
              fontSize: 13,
              color: tab === t ? "var(--text)" : "var(--text-tertiary)",
              borderBottom:
                tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              textTransform: "capitalize",
              transition: "color 0.2s",
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Write tab */}
      {tab === "write" && (
        <textarea
          value={form.content}
          onChange={set("content")}
          placeholder={`Write your story in markdown...\n\n## Heading\n\n**Bold**, *italic*, \`code\`\n\n> Blockquote\n\n- List item`}
          style={{
            width: "100%",
            minHeight: 520,
            background: "var(--ink-soft)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text)",
            padding: "1rem",
            fontSize: 15,
            fontFamily: "'DM Mono', 'Fira Code', monospace",
            lineHeight: 1.8,
            resize: "vertical",
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--blue)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
      )}

      {/* Preview tab */}
      {tab === "preview" && (
        <div
          style={{
            minHeight: 520,
            background: "var(--ink-soft)",
            border: "1px solid var(--border-soft)",
            borderRadius: "var(--radius)",
            padding: "1.5rem",
          }}
        >
          {form.content ? (
            <div className="prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {form.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p
              style={{
                color: "var(--text-tertiary)",
                fontStyle: "italic",
                textAlign: "center",
                marginTop: "4rem",
              }}
            >
              Nothing to preview yet.
            </p>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            maxWidth: 560,
          }}
        >
          <Textarea
            label="Excerpt / Summary"
            value={form.excerpt}
            onChange={set("excerpt")}
            placeholder="A short summary shown in the feed..."
            rows={3}
          />

          <Input
            label="Cover image URL"
            value={form.coverImageUrl}
            onChange={set("coverImageUrl")}
            placeholder="https://images.unsplash.com/..."
          />
          {form.coverImageUrl && (
            <img
              src={form.coverImageUrl}
              alt="Cover preview"
              style={{
                borderRadius: "var(--radius)",
                maxHeight: 200,
                objectFit: "cover",
                width: "100%",
              }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          )}

          <div>
            <label
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Status
            </label>
            <select
              value={form.status}
              onChange={set("status")}
              style={{
                background: "var(--ink-soft)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text)",
                padding: "10px 14px",
                fontSize: 14,
                width: "100%",
              }}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Visibility
            </label>
            <select
              value={form.visibility}
              onChange={set("visibility")}
              style={{
                background: "var(--ink-soft)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text)",
                padding: "10px 14px",
                fontSize: 14,
                width: "100%",
              }}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>

          <Input
            label="SEO Title"
            value={form.seoTitle}
            onChange={set("seoTitle")}
            placeholder="Custom SEO title..."
          />
          <Textarea
            label="SEO Description"
            value={form.seoDescription}
            onChange={set("seoDescription")}
            rows={2}
            placeholder="Custom meta description..."
          />
        </div>
      )}

      {/* Word count */}
      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "var(--text-tertiary)",
          textAlign: "right",
        }}
      >
        {wordCount} words · {Math.ceil(wordCount / 200) || 0} min read
      </div>
    </div>
  );
}
