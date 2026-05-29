import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let refreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      if (err.response?.data?.code === "TOKEN_EXPIRED") {
        if (refreshing) {
          return new Promise((resolve, reject) => {
            refreshQueue.push({ resolve, reject });
          }).then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          });
        }
        original._retry = true;
        refreshing = true;
        try {
          const refresh = localStorage.getItem("refreshToken");
          if (!refresh) throw new Error("No refresh token");
          const { data } = await axios.post("/api/auth/refresh", {
            refreshToken: refresh,
          });
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          refreshQueue.forEach((p) => p.resolve(data.accessToken));
          refreshQueue = [];
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          refreshQueue.forEach((p) => p.reject());
          refreshQueue = [];
          localStorage.clear();
          window.location.href = "/login";
        } finally {
          refreshing = false;
        }
      }
    }
    return Promise.reject(err);
  },
);

// Auth
export const authApi = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  logout: (data) => api.post("/auth/logout", data),
  refresh: (data) => api.post("/auth/refresh", data),
  me: () => api.get("/auth/users/me"),
  updateMe: (data) => api.patch("/auth/users/me", data),
  forgotPassword: (data) => api.post("/auth/forgot-password", data),
  resetPassword: (token, data) =>
    api.post(`/auth/reset-password/${token}`, data),
  verifyEmail: (token) => api.get(`/auth/verify-email/${token}`),
};

// Posts
export const postsApi = {
  list: (params) => api.get("/posts", { params }),
  get: (slugOrId) => api.get(`/posts/${slugOrId}`),
  create: (data) => api.post("/posts", data),
  update: (id, data) => api.patch(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
  like: (id) => api.post(`/posts/${id}/like`),
};

// Comments
export const commentsApi = {
  list: (postId, params) => api.get(`/comments/posts/${postId}`, { params }),
  create: (postId, data) => api.post(`/comments/posts/${postId}`, data),
  update: (id, data) => api.patch(`/comments/${id}`, data),
  delete: (id) => api.delete(`/comments/${id}`),
  react: (id, type) => api.post(`/comments/${id}/react`, { type }),
};

// Media
export const mediaApi = {
  upload: (formData) =>
    api.post("/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  myMedia: (params) => api.get("/media/my", { params }),
  delete: (id) => api.delete(`/media/${id}`),
};

// Notifications
export const notificationsApi = {
  list: (params) => api.get("/notifications", { params }),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export default api;
