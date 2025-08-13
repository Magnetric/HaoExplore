# AWS Lambda Pillow Layer 部署指南

本指南介绍如何为 AWS Lambda 创建包含 Pillow 库的 Layer，以支持照片元数据提取功能。

## 📋 前提条件

- AWS 账户和 Lambda 访问权限
- 选择以下一种构建方式：
  - **方式 1（推荐）**: Docker Desktop
  - **方式 2**: Python 3.9+ （无需 Docker）

## 🚀 方式 1: 使用 Docker 构建（推荐）

### Windows 用户：
```bash
# 运行构建脚本
build-pillow-layer.bat
```

### Linux/Mac 用户：
```bash
# 给脚本执行权限
chmod +x build-pillow-layer.sh

# 运行构建脚本
./build-pillow-layer.sh
```

## 🐍 方式 2: 使用 Python 构建（无需 Docker）

```bash
# 运行 Python 构建脚本
python build-pillow-layer-no-docker.py
```

## 📤 上传 Layer 到 AWS

1. **登录 AWS 控制台**
   - 进入 Lambda 服务

2. **创建 Layer**
   - 左侧导航 → "层"
   - 点击 "创建层"

3. **配置 Layer**
   - **名称**: `pillow-layer`
   - **描述**: `Pillow library for image processing`
   - **上传**: 选择生成的 `pillow-layer.zip`
   - **兼容运行时**: 选择 `Python 3.9`

4. **记录 Layer ARN**
   ```
   arn:aws:lambda:eu-north-1:你的账户ID:layer:pillow-layer:1
   ```

## 🔧 添加 Layer 到 Lambda 函数

1. **打开你的 Lambda 函数**
   - 选择 `lambda_gallery_manager` 函数

2. **添加 Layer**
   - 滚动到 "层" 部分
   - 点击 "添加层"
   - 选择 "自定义层"
   - 输入 Layer ARN
   - 点击 "添加"

3. **验证**
   - 在函数代码中，Pillow 导入应该可以正常工作
   - 测试一个简单的请求确认没有导入错误

## 🧪 测试

在 Lambda 控制台测试以下事件：

```json
{
  "httpMethod": "GET",
  "path": "/galleries",
  "queryStringParameters": {"id": "你的gallery_id"}
}
```

如果成功，应该看到正常的响应而不是 PIL 导入错误。

## 📋 后续使用 "Update Photo Metadata" 功能

1. **在 Admin 界面**
   - 点击 "Update Photo Metadata" 按钮
   - 等待处理完成

2. **查看照片详情**
   - 进入 gallery 编辑页面
   - 照片卡片应显示：
     - 真实的文件大小
     - 图片分辨率 (宽×高)
     - EXIF 拍摄时间（如果可用）

## 🛠️ 故障排除

### 常见问题：

1. **Docker 命令失败**
   ```bash
   # 确保 Docker 正在运行
   docker --version
   ```

2. **Layer 上传失败**
   - 检查文件大小（Lambda Layer 限制 50MB）
   - 确保 ZIP 文件结构正确

3. **函数仍报 PIL 错误**
   - 确认 Layer 已成功添加到函数
   - 检查 Python 运行时版本匹配 (3.9)

4. **权限问题**
   - 确保 Lambda 执行角色有 S3 访问权限
   - 参考之前的 IAM 配置

## 📊 预期性能

- **文件大小**: Layer 约 15-20MB
- **冷启动**: 增加 ~500ms
- **内存使用**: 增加 ~20-30MB
- **功能**: 完整的图像元数据提取

## 🔄 更新 Layer

如果需要更新 Pillow 版本：

1. 修改 `requirements.txt` 中的版本号
2. 重新运行构建脚本
3. 上传新的 Layer 版本
4. 更新 Lambda 函数使用新版本

完成这些步骤后，你的照片元数据提取功能就能正常工作了！









