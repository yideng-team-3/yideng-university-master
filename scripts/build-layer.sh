#!/bin/bash
set -e

echo "🧪 开始构建优化的Lambda层..."

# 清理旧的层目录
rm -rf layers
mkdir -p layers/dependencies/nodejs

# 创建临时package.json，包含所有必要依赖
cat > layers/dependencies/package.json << EOF
{
  "name": "web3-university-dependencies",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.523.0",
    "@aws-sdk/lib-dynamodb": "^3.523.0",
    "@aws-sdk/util-dynamodb": "^3.523.0",
    "@metamask/eth-sig-util": "^5.1.0",
    "@nestjs/common": "^10.3.3",
    "@nestjs/config": "^3.2.0",
    "@nestjs/core": "^10.3.3",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.3.3",
    "@nestjs/swagger": "^7.3.0",
    "@nestjs/typeorm": "^10.0.1",
    "aws-lambda": "^1.0.7",
    "aws-serverless-express": "^3.4.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "class-validator-jsonschema": "^5.0.0",
    "ethereumjs-util": "^7.1.5",
    "ethers": "^6.11.1",
    "express": "^4.18.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1",
    "siwe": "^2.1.4",
    "typeorm": "^0.3.20",
    "uuid": "^9.0.1",
    "viem": "^2.7.9",
    "web3": "^4.5.0"
  }
}
EOF

echo "📦 安装所有必要运行时依赖..."
cd layers/dependencies

# 安装精简的依赖集
yarn install --production --frozen-lockfile

echo "🧹 优化层大小..."
# 删除测试、文档和其他非必要文件
find node_modules -type d -name "test" -o -name "tests" -o -name ".git" -o -name "docs" -o -name "examples" | xargs rm -rf 2>/dev/null || true
find node_modules -type f -name "*.md" -o -name "*.ts" -o -name "*.map" -o -name "*.d.ts" | xargs rm -f 2>/dev/null || true

# 将node_modules移动到正确的Lambda层结构
mkdir -p nodejs/node_modules
cp -r node_modules/* nodejs/node_modules/
rm -rf node_modules package.json yarn.lock

# 返回项目根目录
cd ../..

# 显示层大小并验证是否在限制内
LAYER_SIZE=$(du -sh layers/dependencies | cut -f1)
LAYER_SIZE_BYTES=$(du -s -b layers/dependencies | cut -f1)
COMPRESSED_SIZE=$(cd layers && zip -r -q dependencies.zip dependencies && du -h dependencies.zip | cut -f1)
echo "📊 Lambda层统计:"
echo "- 解压缩大小: $LAYER_SIZE (限制: 250MB)"
echo "- 压缩后估计: $COMPRESSED_SIZE (限制: 50MB)"

# 检查大小是否超过限制
if [ $LAYER_SIZE_BYTES -gt 262144000 ]; then
  echo "⚠️ 警告: 层大小可能超过限制，考虑拆分为多个层"
fi

# 删除临时zip文件
rm -f layers/dependencies.zip

echo "✅ Lambda层构建完成"
