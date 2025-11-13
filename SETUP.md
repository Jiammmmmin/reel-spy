# 本地开发设置指南

## 不需要 Supabase！

这个项目现在使用本地 Node.js 后端，不需要注册或登录 Supabase。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建环境变量文件

在项目根目录创建 `.env` 文件：

```bash
# AWS RDS Connection
AWS_RDS_CONNECTION_STRING=postgresql://postgres:ricetfmcvideo@video.cex4y6c02tbv.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require

# S3 Configuration
S3_BUCKET_NAME=tfmc-youtube-data
S3_REGION=us-east-1

# Server Port
PORT=3001
```

### 3. 启动服务

**方式 1：同时启动前端和后端（推荐）**

```bash
npm run dev:all
```

这会同时启动：
- 后端服务器：http://localhost:3001
- 前端应用：http://localhost:8080

**方式 2：分别启动**

```bash
# 终端 1：启动后端
npm run dev:server

# 终端 2：启动前端
npm run dev
```

### 4. 访问应用

打开浏览器访问：http://localhost:8080

## 项目结构

```
reel-spy/
├── server/
│   └── index.js          # Express 后端服务器
├── src/
│   ├── lib/
│   │   └── api.ts        # API 客户端（替代 Supabase）
│   └── pages/
│       └── Index.tsx     # 主页面
├── .env                  # 环境变量（需要创建）
└── package.json
```

## API 端点

后端提供以下 API：

- `POST /api/query-aws-rds`
  - Body: `{ videoId?: number, objectName?: string, test?: boolean }`
  - 返回：查询结果、视频 URL 等信息

## 环境变量说明

- `AWS_RDS_CONNECTION_STRING`: RDS PostgreSQL 连接字符串
- `S3_BUCKET_NAME`: S3 bucket 名称
- `S3_REGION`: S3 区域
- `PORT`: 后端服务器端口（默认 3001）

## 故障排除

### 后端无法连接 RDS

1. 检查 `.env` 文件中的 `AWS_RDS_CONNECTION_STRING` 是否正确
2. 确保 RDS 安全组允许你的 IP 访问
3. 检查连接字符串是否包含 `?sslmode=require`

### 前端无法连接后端

1. 确保后端服务器正在运行（`npm run dev:server`）
2. 检查后端是否在端口 3001 上运行
3. 查看浏览器控制台的错误信息

### 视频无法加载

1. 检查 S3 bucket 的 CORS 配置
2. 确保 `video_path` 在数据库中正确设置
3. 检查 S3 bucket 名称和区域是否正确

## 部署

如果要部署到生产环境：

1. 将后端服务器部署到云服务（如 AWS EC2, Heroku, Railway 等）
2. 更新前端中的 `VITE_API_URL` 环境变量指向生产后端 URL
3. 确保环境变量在生产环境中正确配置

