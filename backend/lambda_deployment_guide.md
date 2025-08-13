# Lambda Gallery Manager 部署指南

## 概述
这个Lambda函数提供了一个安全的后端API来管理摄影作品集的相册，替代了原来在客户端直接操作S3的方式。

## 功能特性
- ✅ 创建新相册 (POST /galleries)
- ✅ 列出所有相册 (GET /galleries)
- ✅ 获取特定相册 (GET /galleries?id=gallery_id)
- ✅ 更新相册信息 (PUT /galleries)
- ✅ 删除相册 (DELETE /galleries?id=gallery_id)
- ✅ 自动更新centralized metadata.json
- ✅ 并发安全的操作
- ✅ CORS支持

## 部署步骤

### 1. 准备文件
确保你有以下文件：
- `lambda_gallery_manager.py` - 主要Lambda函数代码
- `requirements.txt` - Python依赖

### 2. 创建IAM角色
创建一个IAM角色，包含以下权限：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::haophotography",
                "arn:aws:s3:::haophotography/*"
            ]
        }
    ]
}
```

### 3. 创建Lambda函数

#### 方法一：AWS Console
1. 登录AWS Console，进入Lambda服务
2. 点击"Create function"
3. 选择"Author from scratch"
4. 配置：
   - Function name: `gallery-manager`
   - Runtime: `Python 3.11`
   - Execution role: 选择上面创建的IAM角色
5. 点击"Create function"

#### 方法二：AWS CLI
```bash
# 打包代码
zip -r lambda_function.zip lambda_gallery_manager.py

# 创建Lambda函数
aws lambda create-function \
    --function-name gallery-manager \
    --runtime python3.11 \
    --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-s3-role \
    --handler lambda_gallery_manager.lambda_handler \
    --zip-file fileb://lambda_function.zip \
    --timeout 30 \
    --memory-size 256
```

### 4. 上传代码
1. 将`lambda_gallery_manager.py`的内容复制到Lambda函数的代码编辑器中
2. 或者打包上传：
```bash
zip lambda_function.zip lambda_gallery_manager.py
```
然后在Console中上传zip文件

### 5. 配置环境变量（可选）
如果需要，可以添加环境变量：
- `BUCKET_NAME`: S3桶名称（默认：haophotography）
- `LOG_LEVEL`: 日志级别（默认：INFO）

### 6. 创建API Gateway

#### 创建REST API
1. 进入API Gateway控制台
2. 创建新的REST API
3. 创建资源和方法：

```
/galleries
  ├── GET     (列出所有相册)
  ├── POST    (创建新相册)
  ├── PUT     (更新相册)
  └── DELETE  (删除相册)
```

#### 配置方法
对于每个HTTP方法：
1. Integration type: Lambda Function
2. Lambda Function: gallery-manager
3. Use Lambda Proxy integration: ✅ 勾选

#### 启用CORS
为每个方法启用CORS，允许的origins根据你的域名配置。

#### 部署API
1. 点击"Deploy API"
2. 创建新的deployment stage（如：prod）
3. 记录API Gateway的URL

### 7. 测试API

#### 创建相册
```bash
curl -X POST https://your-api-id.execute-api.region.amazonaws.com/prod/galleries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Gallery",
    "continent": "Asia",
    "country": "China",
    "description": "A test gallery",
    "tags": ["test", "sample"]
  }'
```

#### 列出相册
```bash
curl https://your-api-id.execute-api.region.amazonaws.com/prod/galleries
```

#### 获取特定相册
```bash
curl "https://your-api-id.execute-api.region.amazonaws.com/prod/galleries?id=gallery-id"
```

## 前端集成

### 修改现有admin panel
将原来的S3直接操作替换为API调用：

```javascript
// 原来的直接S3操作
s3.putObject(params).promise();

// 替换为API调用
const response = await fetch('https://your-api-id.execute-api.region.amazonaws.com/prod/galleries', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        name: galleryName,
        continent: continent,
        country: country,
        description: description,
        tags: tags
    })
});

const result = await response.json();
```

## 安全考虑

### API认证（推荐）
为了安全，建议添加API认证：

1. **API Key**: 在API Gateway中启用API Key
2. **Cognito**: 使用AWS Cognito进行用户认证
3. **IAM**: 使用IAM角色进行访问控制

### Lambda权限最小化
确保Lambda函数只有必要的S3权限，不要给予过多权限。

### 输入验证
Lambda函数已经包含基本的输入验证，但可以根据需要进行扩展。

## 监控和日志

### CloudWatch日志
Lambda函数自动将日志发送到CloudWatch，可以查看：
- 函数执行日志
- 错误信息
- 性能指标

### 监控指标
可以监控：
- 函数调用次数
- 错误率
- 执行时间
- 内存使用

## 故障排除

### 常见问题

1. **权限错误**
   - 检查IAM角色权限
   - 确保S3桶策略允许访问

2. **CORS错误**
   - 确保API Gateway已正确配置CORS
   - 检查允许的origins和headers

3. **超时错误**
   - 增加Lambda函数超时时间
   - 优化代码性能

4. **内存不足**
   - 增加Lambda函数内存分配

### 日志调试
查看CloudWatch日志了解详细错误信息：
```bash
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/gallery-manager
```

## 成本优化

- Lambda按调用次数和执行时间计费
- API Gateway按API调用次数计费
- 建议设置适当的超时时间和内存分配
- 考虑使用Lambda预留并发（如有高并发需求）

## 版本控制和CI/CD

建议设置CI/CD管道自动部署：

```yaml
# GitHub Actions示例
name: Deploy Lambda
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Lambda
        run: |
          zip lambda_function.zip lambda_gallery_manager.py
          aws lambda update-function-code \
            --function-name gallery-manager \
            --zip-file fileb://lambda_function.zip
```
