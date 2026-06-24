<div align="center">

# HACO-food-OS

**He thong van hanh trung tam cho Bep Co Ha (Hacofood.vn)**

Quan tri chi phi AI, do luong ROI, kiem soat token, va dieu phoi toan bo hoat dong cong nghe — tu van hanh tren ha tang rieng.

![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Self-hosted](https://img.shields.io/badge/Self--hosted-100%25-success)

</div>

---

## HACO-food-OS la gi?

HACO-food-OS la he thong "nao bo" cua Bep Co Ha — mot reverse proxy trung gian dung giua cac cong cu AI (Claude Code, Cursor, Continue.dev) va cac nha cung cap LLM (OpenAI, Anthropic, Ollama local). He thong giup:

- **Kiem soat chi phi AI** — biet chinh xac ai, du an nao, task nao tieu bao nhieu token
- **Bao ve du lieu** — chay local LLM (Ollama/vLLM), source code khong roi ha tang
- **Do luong ROI** — quy doi token thanh chi phi thuc, doi chieu voi gio cong tiet kiem
- **Phan quyen RBAC** — moi thanh vien co token rieng, master key chi nam tren server

---

## Kien truc

```
IDE / Cursor / Claude Code
        |
        v (Internal Token)
  Backend Gateway (NestJS :3900)
        |
   +----|----+-----------+
   |    |    |           |
 MySQL Redis OpenAI   Ollama
   8    7   Anthropic  (local)
        |
  Admin Dashboard (Vue 3 :5173)
```

| App | Vai tro | Port |
| :-- | :-- | :-- |
| `apps/backend-gateway` | API Gateway, Quota, Audit, RBAC, Reports | 3900 |
| `apps/admin-dashboard` | Dashboard quan tri (Vue 3) | 5173 |
| `apps/node-red` | Cau noi MCP <-> Gateway | 1880 |
| `apps/aigg-mcp` | MCP server cho AI agent | stdio |
| `apps/vscode-extension` | VS Code extension | VSIX |

---

## Tinh nang chinh

| Nhom | Chi tiet |
| :-- | :-- |
| **Gateway** | Proxy streaming (SSE) sang OpenAI/Anthropic/Local; kiem tra quota truoc moi request |
| **Local LLM** | Ollama / vLLM — chi phi $0, van du governance |
| **Han ngach** | Quota theo Ngay/Tuan/Thang/Task; addon cong don |
| **ROI Dashboard** | KPI chi phi AI, gio cong tiet kiem, Net ROI; bieu do xu huong |
| **Prompt** | Capture preview + SHA-256 hash; cham diem chat luong tu dong |
| **RBAC** | Module -> Scope -> Permission; vai tro; menu dong theo quyen |
| **Tich hop** | Jira/GitLab/GitHub; webhook; outbound API |

---

## Cai dat nhanh

### Yeu cau
- Node.js >= 20
- MySQL 8 + Redis 7 (hoac Docker)

### Buoc 1 — Clone
```bash
git clone https://github.com/nhamha240587/HACO-OS.git
cd HACO-OS
```

### Buoc 2 — Cau hinh
```bash
cp .env.example .env
# Sua cac bien: MYSQL_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
```

### Buoc 3 — Chay database
```bash
docker compose up -d mysql redis
```

### Buoc 4 — Backend
```bash
cd apps/backend-gateway
npm install
npm run start:dev
# -> http://localhost:3900
```

### Buoc 5 — Dashboard
```bash
cd apps/admin-dashboard
cp .env.example .env
npm install
npm run dev
# -> http://localhost:5173
```

Dang nhap bang `ADMIN_EMAIL` / `ADMIN_PASSWORD` da cau hinh trong `.env`.

---

## Bien moi truong quan trong

| Bien | Y nghia | Mac dinh |
| :-- | :-- | :-- |
| `MYSQL_*` / `REDIS_*` | Ket noi database | localhost |
| `BACKEND_PORT` | Cong backend | 3900 |
| `DB_SYNC` / `DB_SEED` | Tu tao schema / seed lan dau | true |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Master key (chi server-side) | — |
| `LOCAL_LLM_BASE_URL` | Ollama/vLLM endpoint | :11434/v1 |
| `JWT_SECRET` | Ky JWT dang nhap | — |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Tai khoan admin seed | — |
| `USD_TO_VND_FALLBACK` | Ty gia du phong | 25400 |

---

## Bao mat

- Master API Key chi nam o backend, khong gui xuong client
- Audit log khong luu noi dung code — chi metadata tai chinh/token
- Prompt chi luu preview + SHA-256 hash, khong luu prompt goc
- Token tich hop 3rd-party ma hoa AES-256-GCM

---

## Lien he

**Bep Co Ha — Hacofood.vn**
- Website: [hacofood.vn](https://hacofood.vn)
- Email: nhamha240587@gmail.com

---

<div align="center">
<sub>HACO-food-OS — Built on <a href="https://github.com/techablevn/ai-governance-gateway">AI Governance Gateway</a> (AGPL-3.0)</sub>
</div>
