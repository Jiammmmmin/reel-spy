# AWS RDS 连接配置说明

## 环境变量配置

已配置的 AWS RDS 连接字符串（包含 SSL 参数）：
```
postgresql://postgres:ricetfmcvideo@video.cex4y6c02tbv.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require
```

## 配置方法

### 方法 1：通过 Supabase Dashboard（推荐）

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard/project/zoeypgckdlxclakjctuj)
2. 进入 **Settings** → **Edge Functions** → **Secrets**
3. 点击 **Add new secret**
4. 设置：
   - **Key**: `AWS_RDS_CONNECTION_STRING`
   - **Value**: `postgresql://postgres:ricetfmcvideo@video.cex4y6c02tbv.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require`
5. 保存

### 方法 2：通过 Supabase CLI

```bash
# 1. 登录 Supabase CLI
npx supabase login

# 2. 设置环境变量
npx supabase secrets set AWS_RDS_CONNECTION_STRING="postgresql://postgres:ricetfmcvideo@video.cex4y6c02tbv.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require"
```

## 验证配置

配置完成后，可以通过以下方式验证：

1. 在前端页面查询视频数据
2. 如果连接成功，会返回数据
3. 如果连接失败，会显示错误信息

## S3 配置

Edge Function 需要 S3 配置来生成视频 URL。配置方法：

### 方法 1：通过 Supabase Dashboard

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard/project/zoeypgckdlxclakjctuj)
2. 进入 **Settings** → **Edge Functions** → **Secrets**
3. 添加以下环境变量：
   - **Key**: `S3_BUCKET_NAME`
   - **Value**: `tfmc-youtube-data`
   
   - **Key**: `S3_REGION`
   - **Value**: `us-east-1`

### 方法 2：通过 Supabase CLI

```bash
# 设置 S3 bucket 名称
npx supabase secrets set S3_BUCKET_NAME="tfmc-youtube-data"

# 设置 S3 区域
npx supabase secrets set S3_REGION="us-east-1"
```

### S3 URL 格式

代码会自动将 `video_path` 转换为 S3 URL：
- 格式：`https://{bucket}.s3.{region}.amazonaws.com/{path}`
- 如果 `video_path` 已经是完整 URL，则直接使用

## 注意事项

- 确保 AWS RDS 的安全组允许来自 Supabase Edge Functions 的 IP 地址访问
- 连接字符串包含敏感信息，请妥善保管
- 不要将连接字符串提交到 Git 仓库
- 确保 S3 bucket 配置了正确的 CORS 策略，允许前端访问视频文件

