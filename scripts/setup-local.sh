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

# 定义重试函数
retry_command() {
  local retries=$1
  shift
  local count=0
  until "$@"; do
    exit=$?
    count=$((count + 1))
    if [ $count -lt $retries ]; then
      echo "⚠️ 命令失败，正在重试 ($count/$retries)..."
      sleep 3
    else
      echo "❌ 命令失败，已达到最大重试次数。"
      return $exit
    fi
  done
  return 0
}

# 启动本地 DynamoDB
echo "📦 正在启动本地 DynamoDB..."
DYNAMO_CONTAINER_NAME="web3-university-dynamodb-local"

# 检查容器是否已存在
if [ ! "$(docker ps -q -f name=$DYNAMO_CONTAINER_NAME)" ]; then
  if [ "$(docker ps -aq -f status=exited -f name=$DYNAMO_CONTAINER_NAME)" ]; then
    # 如果容器存在但已停止，则启动容器
    echo "🔄 本地 DynamoDB 容器已存在但已停止，正在启动..."
    docker start $DYNAMO_CONTAINER_NAME || {
      echo "⚠️ 无法启动已存在的容器，尝试重新创建..."
      docker rm $DYNAMO_CONTAINER_NAME
      # 尝试使用多个不同的镜像源
      if retry_command 3 docker pull amazon/dynamodb-local; then
        echo "✅ 成功拉取 amazon/dynamodb-local 镜像"
      else
        echo "⚠️ 尝试使用替代镜像..."
        retry_command 3 docker pull registry.cn-hangzhou.aliyuncs.com/developerq/dynamodb-local || {
          echo "❌ 无法拉取 DynamoDB 镜像，请检查网络连接或手动下载镜像。"
          exit 1
        }
        docker tag registry.cn-hangzhou.aliyuncs.com/developerq/dynamodb-local amazon/dynamodb-local
      fi
      retry_command 3 docker run -d -p 8000:8000 --name $DYNAMO_CONTAINER_NAME amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb
    }
  else
    # 创建新容器
    echo "🆕 创建并启动本地 DynamoDB 容器..."
    # 尝试使用多个不同的镜像源
    if retry_command 3 docker pull amazon/dynamodb-local; then
      echo "✅ 成功拉取 amazon/dynamodb-local 镜像"
    else
      echo "⚠️ 尝试使用替代镜像..."
      retry_command 3 docker pull registry.cn-hangzhou.aliyuncs.com/developerq/dynamodb-local || {
        echo "❌ 无法拉取 DynamoDB 镜像，请检查网络连接或手动下载镜像。"
        exit 1
      }
      docker tag registry.cn-hangzhou.aliyuncs.com/developerq/dynamodb-local amazon/dynamodb-local
    fi
    retry_command 3 docker run -d -p 8000:8000 --name $DYNAMO_CONTAINER_NAME amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb
  fi
else
  echo "✅ 本地 DynamoDB 容器已在运行。"
fi

# 启动本地 LocalStack S3
echo "📦 正在启动本地 LocalStack S3 服务..."
S3_CONTAINER_NAME="web3-university-localstack-s3"

# 检查容器是否已存在
if [ ! "$(docker ps -q -f name=$S3_CONTAINER_NAME)" ]; then
  if [ "$(docker ps -aq -f status=exited -f name=$S3_CONTAINER_NAME)" ]; then
    # 如果容器存在但已停止，则启动容器
    echo "🔄 本地 LocalStack S3 容器已存在但已停止，正在启动..."
    docker start $S3_CONTAINER_NAME || {
      echo "⚠️ 无法启动已存在的容器，尝试重新创建..."
      docker rm $S3_CONTAINER_NAME
      retry_command 3 docker pull localstack/localstack || {
        echo "❌ 无法拉取 LocalStack 镜像，请检查网络连接或手动下载镜像。"
        exit 1
      }
      retry_command 3 docker run -d -p 4566:4566 -e SERVICES=s3 -e DEBUG=1 \
        -e DATA_DIR=/tmp/localstack/data --name $S3_CONTAINER_NAME localstack/localstack
    }
  else
    # 创建新容器
    echo "🆕 创建并启动本地 LocalStack S3 容器..."
    retry_command 3 docker pull localstack/localstack || {
      echo "❌ 无法拉取 LocalStack 镜像，请检查网络连接或手动下载镜像。"
      exit 1
    }
    retry_command 3 docker run -d -p 4566:4566 -e SERVICES=s3 -e DEBUG=1 \
      -e DATA_DIR=/tmp/localstack/data --name $S3_CONTAINER_NAME localstack/localstack
  fi
else
  echo "✅ 本地 LocalStack S3 容器已在运行。"
fi

# 等待 DynamoDB 和 LocalStack 启动
echo "⏳ 等待服务准备就绪..."
sleep 10

# 验证 DynamoDB 是否可访问
echo "🔍 验证 DynamoDB 服务是否可访问..."
if ! retry_command 5 aws dynamodb list-tables --endpoint-url http://localhost:8000 --region us-east-2; then
  echo "⚠️ DynamoDB 服务似乎不可用，继续执行但可能会失败。"
fi

# 验证 LocalStack S3 是否可访问
echo "🔍 验证 LocalStack S3 服务是否可访问..."
if ! retry_command 5 aws --endpoint-url=http://localhost:4566 s3 ls; then
  echo "⚠️ LocalStack S3 服务似乎不可用，继续执行但可能会失败。"
fi

# 创建本地用户表
echo "📝 创建本地用户表..."
retry_command 3 aws dynamodb create-table \
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

# 创建本地课程表
echo "📝 创建本地课程表..."
retry_command 3 aws dynamodb create-table \
  --table-name web3-university-dev-courses \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=web2CourseId,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=web2CourseIdIndex,KeySchema=["{AttributeName=web2CourseId,KeyType=HASH}"],Projection="{ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000 \
  --region us-east-2 || echo "📋 课程表已存在，跳过创建。"

# 创建本地 S3 存储桶
echo "📝 创建本地 S3 存储桶..."
retry_command 3 aws --endpoint-url=http://localhost:4566 s3 mb s3://web3-university-dev || echo "📋 S3 存储桶已存在，跳过创建。"

# 设置 S3 存储桶为公共访问
echo "🔓 设置 S3 存储桶为公共访问..."
retry_command 3 aws --endpoint-url=http://localhost:4566 s3api put-bucket-policy \
  --bucket web3-university-dev \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::web3-university-dev/*"
        }
    ]
}' || echo "⚠️ 设置 S3 存储桶策略失败，可能需要手动配置。"

# 创建uploads目录
echo "📁 创建上传目录..."
mkdir -p uploads

# 创建.env.local文件（如果不存在）
if [ ! -f .env.local ]; then
  echo "📄 创建本地环境配置文件 .env.local..."
  cat > .env.local << EOL
# 本地开发环境配置
NODE_ENV=development
IS_OFFLINE=true
USE_LOCALSTACK=true
DB_TYPE=dynamodb
DYNAMODB_USERS_TABLE=web3-university-dev-users
DYNAMODB_COURSES_TABLE=web3-university-dev-courses
S3_BUCKET_NAME=web3-university-dev
AWS_REGION=us-east-2
REGION=us-east-2
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
APP_NAME=Web3 University Dev
JWT_SECRET=local_development_secret_key_please_change_in_production
SUPPORTED_CHAINS=ethereum,sepolia
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
COURSE_CONTRACT_ADDRESS=0x436CbE7D8DC5593B3B7B137698a37212f4a4227a
CONTRACT_PRIVATE_KEY=YOUR_PRIVATE_KEY
EOL
  echo "✅ 已创建 .env.local 文件。"
else
  echo "📋 .env.local 文件已存在，跳过创建。"
fi

echo "🔧 安装项目依赖..."
yarn install || {
  echo "⚠️ 安装依赖失败，请手动运行 'yarn install'。"
}

echo "🌟 本地开发环境设置完成！"
echo "启动开发服务器: yarn start:dev"
echo "使用 IS_OFFLINE=true 和 USE_LOCALSTACK=true 环境变量来连接本地 DynamoDB 和 S3"
echo "本地 S3 端点: http://localhost:4566"
echo "本地 DynamoDB 端点: http://localhost:8000"