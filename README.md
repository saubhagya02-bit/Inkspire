<div align="center">

# ✦ InkSpire

**A full-stack blogging platform built with a production-grade microservices architecture**

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.13-FF6600?style=flat-square&logo=rabbitmq&logoColor=white)](https://rabbitmq.com)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)


</div>

---

## Overview

InkSpire is a modern blogging platform where writers share stories and readers discover ideas. Built as a **portfolio-grade microservices application**, it demonstrates real-world patterns including event-driven architecture, JWT authentication with refresh tokens, Redis caching, S3 media uploads and async notification delivery via RabbitMQ.

### What makes it interesting architecturally

- **6 independent microservices** behind a single API gateway — each with its own database
- **Hybrid database strategy** — PostgreSQL for structured relational data (users, posts, likes), MongoDB for flexible document data (comments, media, notifications)
- **Event-driven notifications** — services communicate via RabbitMQ topic exchanges; no direct service-to-service coupling for non-critical paths
- **Redis caching layer** — post lists and comment threads cached with smart invalidation on writes
- **JWT token rotation** — 15-minute access tokens, 7-day refresh tokens, token blacklisting on logout

---

## ✨ Features

### For readers
- Browse a magazine-style feed with featured posts, like counts, comment counts and view tracking
- Read posts with rendered Markdown, syntax-highlighted code blocks and estimated reading time
- Comment on posts with nested replies (up to 2 levels) and emoji reactions
- Real-time notification badge for comments on your posts, new likes and system events

### For writers
- Rich Markdown editor with live preview and word count
- Draft / publish posts
- Cover image URL with live preview in the settings panel
- SEO title and meta description fields
- Edit and delete your own posts with an inline confirmation dialog 

### Auth & security
- Email + password registration with bcrypt
- Google OAuth and GitHub OAuth via Passport.js
- Password reset with 1-hour expiry tokens
- Token blacklisting via Redis on logout

### Media
- File uploads to S3 / MinIO (local dev) via `multer-s3`

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / Mobile                      │
│                     React 18 + Vite SPA                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│                      API Gateway :3000                       │
│          JWT auth · CORS · Rate limiting · Routing           │
└──┬──────────┬──────────┬───────────┬───────────┬────────────┘
   │          │          │           │           │
   ▼          ▼          ▼           ▼           ▼
:3001      :3002      :3003       :3004       :3005
Auth       Post      Comment     Media     Notification
Service   Service   Service     Service     Service
  │          │          │           │           │
  ▼          ▼          ▼           ▼           ▼
Postgres  Postgres   MongoDB     MongoDB     MongoDB
(auth_db) (post_db)              MinIO/S3

                    RabbitMQ (event bus)
              ┌──────────┼──────────────┐
         user.events  post.events  comment.events
              │          │              │
              └──────────▼──────────────┘
                  Notification Worker
                  (consumes all events,
                   creates in-app + email
                   notifications)

              Redis (shared cache + token blacklist)
```

### Service responsibilities

| Service | Port | Database | Responsibility |
|---|---|---|---|
| **API Gateway** | 3000 | Redis | Auth middleware, request routing, header forwarding |
| **Auth Service** | 3001 | PostgreSQL | Registration, login, JWT, OAuth, 2FA, email verify |
| **Post Service** | 3002 | PostgreSQL | CRUD posts, likes, categories, tags, view counting |
| **Comment Service** | 3003 | MongoDB | Threaded comments, reactions, soft delete |
| **Media Service** | 3004 | MongoDB + S3 | Upload, resize, thumbnail generation |
| **Notification Service** | 3005 | MongoDB | In-app notifications, email dispatch, RabbitMQ consumer |

---

## 📁 Project Structure

```
inkspire/
├── docker-compose.yml
├── _env                          # Template — copy to .env
├── infrastructure/
│   └── docker/
│       └── postgres-init.sql     # Creates auth_db and post_db
│
├── services/
│   ├── api-gateway/              # Express — JWT auth + proxy
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   │   └── auth.js
│   │   │   └── utils/
│   │   ├── index.js
│   │   └── Dockerfile
│   │
│   ├── auth-service/             # Express + PostgreSQL
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── authController.js
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   │   ├── auth.js
│   │   │   │   └── users.js
│   │   │   └── utils/
│   │   │       ├── database.js
│   │   │       ├── passport.js
│   │   │       ├── rabbitmq.js
│   │   │       └── redis.js
│   │   ├── index.js
│   │   └── Dockerfile
│   │
│   ├── post-service/             # Express + PostgreSQL
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── postController.js
│   │   │   ├── middleware/
│   │   │   └── routes/
│   │   │       ├── posts.js
│   │   │       ├── categories.js
│   │   │       └── tags.js
│   │   ├── index.js
│   │   └── Dockerfile
│   │
│   ├── comment-service/          # Express + MongoDB
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── commentController.js
│   │   │   ├── models/
│   │   │   │   └── Comment.js
│   │   │   └── routes/
│   │   │       └── comments.js
│   │   ├── index.js
│   │   └── Dockerfile
│   │
│   ├── media-service/            # Express + MongoDB + S3/MinIO
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── mediaController.js
│   │   │   ├── models/
│   │   │   │   └── Media.js
│   │   │   ├── routes/
│   │   │   │   └── media.js
│   │   │   └── utils/
│   │   │       └── s3.js
│   │   ├── index.js
│   │   └── Dockerfile
│   │
│   └── notification-service/     # Express + MongoDB + RabbitMQ worker
│       ├── src/
│       │   ├── controllers/
│       │   │   └── notificationController.js
│       │   ├── models/
│       │   │   └── Notification.js
│       │   ├── routes/
│       │   │   └── notifications.js
│       │   ├── workers/
│       │   │   └── notificationWorker.js
│       │   └── utils/
│       │       ├── mailer.js
│       │       └── emailTemplates.js
│       ├── index.js
│       └── Dockerfile
│
└── frontend/                     # React 18 + Vite
    ├── src/
    │   ├── components/
    │   │   ├── comments/
    │   │   │   └── CommentsSection.jsx
    │   │   ├── layout/
    │   │   │   └── Layout.jsx
    │   │   ├── posts/
    │   │   │   └── PostCard.jsx
    │   │   └── ui/
    │   │       └── index.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── lib/
    │   │   └── api.js
    │   ├── pages/
    │   │   ├── HomePage.jsx
    │   │   ├── PostPage.jsx
    │   │   ├── CreatePostPage.jsx
    │   │   ├── EditPostPage.jsx
    │   │   ├── ProfilePage.jsx
    │   │   ├── NotificationsPage.jsx
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── ForgotPasswordPage.jsx
    │   │   ├── ResetPasswordPage.jsx
    │   │   └── NotFoundPage.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    └── package.json
```

---

## 📡 API Reference

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Register with email + password |
| `POST` | `/api/auth/login` | — | Login, returns token pair |
| `POST` | `/api/auth/refresh` | — | Exchange refresh token for new pair |
| `POST` | `/api/auth/logout` | ✓ | Blacklist access token |
| `GET` | `/api/auth/users/me` | ✓ | Get current user profile |
| `PATCH` | `/api/auth/users/me` | ✓ | Update profile |
| `POST` | `/api/auth/forgot-password` | — | Send reset email |
| `POST` | `/api/auth/reset-password/:token` | — | Set new password |
| `GET` | `/api/auth/verify-email/:token` | — | Verify email address |
| `POST` | `/api/auth/2fa/setup` | ✓ | Generate 2FA QR code |
| `POST` | `/api/auth/2fa/enable` | ✓ | Confirm and enable 2FA |
| `GET` | `/api/auth/oauth/google` | — | Begin Google OAuth flow |
| `GET` | `/api/auth/oauth/github` | — | Begin GitHub OAuth flow |

### Posts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/posts` | — | List posts (paginated, sortable) |
| `GET` | `/api/posts/:slugOrId` | — | Get single post |
| `POST` | `/api/posts` | ✓ | Create post |
| `PATCH` | `/api/posts/:id` | ✓ | Update post (partial) |
| `DELETE` | `/api/posts/:id` | ✓ | Delete post (owner or admin) |
| `POST` | `/api/posts/:id/like` | ✓ | Toggle like |

### Comments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/comments/posts/:postId` | — | Get threaded comments |
| `POST` | `/api/comments/posts/:postId` | ✓ | Create comment or reply |
| `PATCH` | `/api/comments/:id` | ✓ | Edit own comment |
| `DELETE` | `/api/comments/:id` | ✓ | Soft-delete (owner or admin) |
| `POST` | `/api/comments/:id/react` | ✓ | Add/toggle reaction |

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications` | ✓ | List notifications |
| `GET` | `/api/notifications/unread-count` | ✓ | Get unread count |
| `PATCH` | `/api/notifications/read-all` | ✓ | Mark all as read |
| `PATCH` | `/api/notifications/:id/read` | ✓ | Mark one as read |
| `DELETE` | `/api/notifications/:id` | ✓ | Delete notification |

### Media

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/media/upload` | ✓ | Upload single file |
| `POST` | `/api/media/upload/multiple` | ✓ | Upload up to 10 files |
| `GET` | `/api/media/my` | ✓ | List your uploads |
| `PATCH` | `/api/media/:id` | ✓ | Update alt text / caption |
| `DELETE` | `/api/media/:id` | ✓ | Delete file from S3 + DB |

---

## 🔧 Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 20, Express 4 |
| Auth | JWT (jsonwebtoken), bcryptjs, Passport.js |
| Primary DB | PostgreSQL 16 (via `pg` pool) |
| Document DB | MongoDB 7 (via Mongoose 8) |
| Cache / Blacklist | Redis 7 (via ioredis) |
| Message broker | RabbitMQ 3.13 (via amqplib) |
| File storage | AWS S3 / MinIO (via `@aws-sdk/client-s3`, `multer-s3`) |
| Image processing | Sharp |
| Email | Nodemailer + Handlebars templates |
| 2FA | speakeasy + qrcode |
| Logging | Winston |
| Validation | express-validator |
| Sanitisation | DOMPurify + jsdom |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build tool | Vite |
| Routing | React Router v6 |
| HTTP client | Axios (with auto-refresh interceptor) |
| Markdown | react-markdown + remark-gfm |
| Dates | date-fns |
| Toasts | react-hot-toast |
| Styling | CSS custom properties (no framework) |

### Infrastructure
| Tool | Purpose |
|---|---|
| Docker Compose | Local orchestration of all services |
| MinIO | Local S3-compatible object storage |
| pgAdmin | PostgreSQL GUI |
| RabbitMQ Management | Queue monitoring UI |

---

## 🛠 Common Commands

```bash
# Start everything
docker-compose up -d

# Rebuild a specific service after code changes
docker-compose up --build -d post-service

# View logs for a service
docker-compose logs -f notification-service

# Stop everything (keeps volumes)
docker-compose down

# Stop everything and wipe all data
docker-compose down -v

# Run frontend dev server
cd frontend && npm run dev
```

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---
