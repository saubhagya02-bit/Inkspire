import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { postsApi } from "../lib/api";
import { EditPostPageInner } from "./CreatePostPage";
import { PageLoader } from "../components/ui";

export default function EditPostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    postsApi
      .get(id)
      .then(({ data }) => setPost(data))
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!post) return null;
  return <EditPostPageInner post={post} />;
}
