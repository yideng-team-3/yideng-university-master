#!/bin/bash
set -e

echo "🚀 正在设置 Web3 University 本地开发环境..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
  echo "❌ Docker 未安装，请先安装 Docker。"
  exit 1
fi

# 检查 AWS CLI 是否安装
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI 未安装，请先安装 AWS CLI。"
  exit 1
fi

# 启动本地 DynamoDB
echo "📦 正在启动本地 DynamoDB..."
CONTAINER_NAME="web3-university-dynamodb-local"

# 检查容器是否已存在
if [ ! "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
  if [ "$(docker ps -aq -f status=exited -f name=$CONTAINER_NAME)" ]; then
    # 如果容器存在但已停止，则启动容器
    echo "🔄 本地 DynamoDB 容器已存在但已停止，正在启动..."
    docker start $CONTAINER_NAME
  else
    # 创建新容器
    echo "🆕 创建并启动本地 DynamoDB 容器..."
    docker run -d -p 8000:8000 --name $CONTAINER_NAME amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb
  fi
else
  echo "✅ 本地 DynamoDB 容器已在运行。"
fi

# 等待 DynamoDB 启动
echo "⏳ 等待 DynamoDB 准备就绪..."
sleep 3

# 创建本地用户表
echo "📝 创建本地用户表..."
aws dynamodb create-table \
  --table-name web3-university-dev-users \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=walletAddress,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=walletAddressIndex,KeySchema=["{AttributeName=walletAddress,KeyType=HASH}"],Projection="{ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 || echo "📋 用户表已存在，跳过创建。"

# 创建.env.local文件（如果不存在）
if [ ! -f .env.local ]; then
  echo "📄 创建本地环境配置文件 .env.local..."
  cat > .env.local << EOL
# 本地开发环境配置
NODE_ENV=development
IS_OFFLINE=true
DB_TYPE=dynamodb
DYNAMODB_USERS_TABLE=web3-university-dev-users
REGION=us-east-2
APP_NAME=Web3 University Dev
JWT_SECRET=local_development_secret_key_please_change_in_production
SUPPORTED_CHAINS=ethereum,polygon
EOL
  echo "✅ 已创建 .env.local 文件。"
else
  echo "📋 .env.local 文件已存在，跳过创建。"
fi

echo "🔧 安装项目依赖..."
yarn install

echo "🌟 本地开发环境设置完成！"
echo "启动开发服务器: yarn start:dev"
echo "使用 IS_OFFLINE=true 环境变量来连接本地 DynamoDB"