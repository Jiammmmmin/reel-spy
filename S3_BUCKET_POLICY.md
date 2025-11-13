# S3 Bucket Policy 配置指南

## 问题

即使关闭了 "Block public access"，仍然返回 403 Forbidden。这是因为还需要添加 **Bucket Policy** 来明确允许公开访问。

## 解决步骤

### 1. 确认 Block Public Access 已关闭 ✅
你已经完成了这一步。

### 2. 添加 Bucket Policy（必需）

1. 进入 S3 Console → `tfmc-youtube-data` bucket
2. 点击 **Permissions** 标签
3. 滚动到 **Bucket policy** 部分
4. 点击 **Edit** 按钮
5. 粘贴以下策略：

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

6. 点击 **Save changes**

### 3. 检查 Object 权限（可选）

如果还是不行，检查具体文件的权限：

1. 进入 S3 Console → `tfmc-youtube-data` bucket
2. 找到文件：`test/eCTqwj3iRBk_28000_76000.mp4`
3. 点击文件名
4. 在 **Permissions** 标签中，检查 **Access control list (ACL)**
5. 确保有 "Public read" 权限

或者批量设置所有对象为公开：

1. 在 bucket 中，选择所有文件
2. 点击 **Actions** → **Make public using ACL**

### 4. 测试

配置完成后，运行：

```bash
curl -I "https://tfmc-youtube-data.s3.us-east-1.amazonaws.com/test/eCTqwj3iRBk_28000_76000.mp4"
```

应该返回 `200 OK` 而不是 `403 Forbidden`。

## 常见问题

### Q: 为什么关闭 Block Public Access 还不够？
A: Block Public Access 只是"允许"公开访问，但还需要 Bucket Policy 来"授权"公开访问。

### Q: Bucket Policy 和 ACL 的区别？
A: 
- **Bucket Policy**: 在 bucket 级别设置，适用于所有对象
- **ACL**: 在对象级别设置，需要逐个文件设置

推荐使用 Bucket Policy，因为它可以一次性设置所有文件。

### Q: 安全吗？
A: 如果视频是公开内容，使用 Bucket Policy 是安全的。如果需要更安全，可以使用预签名 URL（代码已支持）。

## 预签名 URL 方案（更安全）

如果不想将 bucket 设为公开，可以使用预签名 URL。代码已经支持，只需要：

1. 配置 AWS 凭证（在 `.env` 文件中）：
   ```
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

2. 重启服务器，系统会自动生成预签名 URL

