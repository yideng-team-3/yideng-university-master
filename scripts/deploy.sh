#!/bin/bash
set -e

# 默认部署环境
STAGE="dev"
FIRST_DEPLOY="false"
AWS_PROFILE="default"
DEBUG="false"

# 解析命令行参数
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -s|--stage) STAGE="$2"; shift ;;
    -p|--profile) AWS_PROFILE="$2"; shift ;;
    --first-deploy) FIRST_DEPLOY="true" ;;
    --debug) DEBUG="true" ;;
    *) echo "未知选项: $1"; exit 1 ;;
  esac
  shift
done

echo "🚀 开始部署 Web3 University 项目到 $STAGE 环境..."
echo "📝 使用 AWS 配置文件: $AWS_PROFILE"

# 安装依赖
echo "📦 安装依赖..."
yarn install --frozen-lockfile

# 确保nestjs相关依赖都正确安装
echo "🔍 验证关键依赖..."
if [ ! -d "node_modules/@nestjs" ]; then
  echo "⚠️ NestJS 依赖未找到，尝试重新安装..."
  yarn add @nestjs/core @nestjs/common @nestjs/platform-express
fi

# 编译TypeScript
echo "🔨 编译项目..."
yarn build

# 验证dist目录结构
echo "🔍 验证dist目录结构..."
if [ ! -f "dist/lambda.js" ] || [ ! -f "dist/app.module.js" ]; then
  echo "❌ 缺少关键文件。确保dist目录包含lambda.js和app.module.js"
  exit 1
fi

# 创建Lambda依赖层前先清理
echo "🧹 清理旧的依赖层..."
rm -rf layers/dependencies/nodejs
mkdir -p layers/dependencies/nodejs

# 构建精简的Lambda层
echo "🧩 构建Lambda依赖层..."
chmod +x ./scripts/build-layer.sh && ./scripts/build-layer.sh

# 移除dist中的不必要文件
echo "🧹 精简部署包..."
find dist -name "*.spec.js" -o -name "*.d.ts" -o -name "*.map" | xargs rm -f 2>/dev/null || true

# 优化dist目录
echo "📦 优化Lambda部署包..."
if [ -d "dist/node_modules" ]; then
  echo "移除dist中的node_modules，依赖将由层提供"
  rm -rf dist/node_modules
fi

# 确保产物中包含lambda.js入口
if [ ! -f "dist/lambda.js" ]; then
  echo "⚠️ 未找到Lambda入口文件，检查构建流程..."
  if [ -f "src/lambda.ts" ]; then
    echo "源码中找到lambda.ts，确保它被正确编译"
  else
    echo "⚠️ 源码中也未找到lambda.ts，可能需要创建此文件"
  fi
fi

# 安装CDK依赖
echo "📦 安装 CDK 依赖..."
cd infrastructure
yarn install --frozen-lockfile

# 确保CDK依赖项正确安装
if [ ! -d "node_modules/aws-cdk-lib" ]; then
  echo "⚠️ CDK依赖未正确安装，尝试重新安装..."
  rm -rf node_modules
  yarn cache clean
  yarn install --force
fi

cd ..

# 确保AWS凭证已配置
echo "🔑 检查 AWS 凭证..."
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
  echo "❌ AWS 凭证未配置或已过期，请先运行 'aws sso login --profile $AWS_PROFILE' 或配置有效的 AWS 凭证。"
  exit 1
fi

# 设置环境变量，使CDK使用正确的配置文件
export AWS_PROFILE="$AWS_PROFILE"

# 可选：先生成CloudFormation模板进行验证
if [ "$DEBUG" = "true" ]; then
  echo "🔍 生成CloudFormation模板用于检查..."
  cd infrastructure
  yarn cdk synth "Web3UniversityStack-${STAGE}" \
    --context stage="${STAGE}" \
    --context isFirstDeploy="${FIRST_DEPLOY}"
  cd ..
fi

# CDK 部署
echo "☁️ 使用 CDK 部署基础设施..."
cd infrastructure

# 首次运行需要引导环境
if [ "$FIRST_DEPLOY" = "true" ]; then
  echo "🔧 首次部署: 引导CDK环境..."
  # 获取当前账户ID和区域
  ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query "Account" --output text)
  REGION=$(aws configure get region --profile "$AWS_PROFILE" || echo "us-east-2")
  
  echo "🌍 使用账户 $ACCOUNT_ID 和区域 $REGION 引导 CDK 环境"
  
  # 使用--debug标志以获取更多日志信息
  if [ "$DEBUG" = "true" ]; then
    yarn cdk bootstrap "aws://$ACCOUNT_ID/$REGION" --profile "$AWS_PROFILE" --debug
  else
    # 增加超时时间，避免大型项目打包超时
    yarn cdk bootstrap "aws://$ACCOUNT_ID/$REGION" --profile "$AWS_PROFILE" --toolkit-timeout 1800
  fi
fi

# 部署堆栈
echo "🏗️ 部署 CDK 堆栈..."
if [ "$DEBUG" = "true" ]; then
  yarn cdk deploy "Web3UniversityStack-${STAGE}" \
    --context stage="${STAGE}" \
    --context isFirstDeploy="${FIRST_DEPLOY}" \
    --require-approval never \
    --profile "$AWS_PROFILE" \
    --debug
else
  yarn cdk deploy "Web3UniversityStack-${STAGE}" \
    --context stage="${STAGE}" \
    --context isFirstDeploy="${FIRST_DEPLOY}" \
    --require-approval never \
    --profile "$AWS_PROFILE"
fi

# 部署后验证
echo "🔍 验证部署..."
LAMBDA_NAME="web3-university-${STAGE}"

# 检查Lambda函数是否已创建
aws lambda get-function --function-name $LAMBDA_NAME --profile "$AWS_PROFILE" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Lambda函数 $LAMBDA_NAME 已成功创建"
else
  echo "⚠️ 无法验证Lambda函数 $LAMBDA_NAME，请在AWS控制台检查"
fi

cd ..

echo "✅ 部署完成! Web3 University 已成功部署到 $STAGE 环境。"
echo "查看AWS控制台以获取更多详情。"