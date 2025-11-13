# S3 视频访问配置指南

## 问题

视频无法播放，返回 403 Forbidden 错误。这是因为 S3 bucket 是私有的，需要配置访问权限。

## 解决方案

### 方案 1：配置 S3 Bucket 为公开读取（最简单，适合开发环境）

1. 登录 AWS Console
2. 进入 S3 → 选择 `tfmc-youtube-data` bucket
3. 进入 **Permissions** 标签
4. 编辑 **Block public access** 设置：
   - 取消勾选 "Block all public access"（或至少取消 "Block public access to buckets and objects granted through new access control lists (ACLs)")
5. 编辑 **Bucket policy**，添加以下策略：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::tfmc-youtube-data/*"
        }
    ]
}
```

6. 保存后，视频 URL 就可以直接访问了

### 方案 2：使用预签名 URL（更安全，适合生产环境）

需要安装 AWS SDK 并配置 AWS 凭证：

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

然后在 `server/index.js` 中使用：

```javascript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: process.env.S3_REGION });

const getS3Url = async (path) => {
  // ... 生成预签名 URL
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: cleanPath
  });
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};
```

### 方案 3：使用 CloudFront（推荐用于生产环境）

1. 创建 CloudFront distribution
2. 指向 S3 bucket
3. 在 `.env` 中设置 `CLOUDFRONT_URL`
4. 代码会自动使用 CloudFront URL

## 当前状态

- ✅ 数据查询：正常（来自 RDS）
- ✅ S3 URL 生成：正常
- ❌ 视频访问：403 Forbidden（需要配置权限）

## 快速测试

配置完成后，可以测试：

```bash
curl -I "https://tfmc-youtube-data.s3.us-east-1.amazonaws.com/test/eCTqwj3iRBk_28000_76000.mp4"
```

应该返回 `200 OK` 而不是 `403 Forbidden`。

