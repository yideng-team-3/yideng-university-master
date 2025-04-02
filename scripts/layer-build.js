const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始构建 Lambda Layer...');

const layerPath = path.join(__dirname, '../layer');
const nodejsPath = path.join(layerPath, 'nodejs');

// 清理并创建目录
console.log('📁 清理并创建目录...');
execSync(`rm -rf ${layerPath}`);
fs.mkdirSync(nodejsPath, { recursive: true });

// 创建精简版 package.json
console.log('📝 创建精简版 package.json...');
const packageJson = require('../package.json');
const layerPackageJson = {
  dependencies: packageJson.dependencies
};

// 写入精简的 package.json
fs.writeFileSync(
  path.join(nodejsPath, 'package.json'),
  JSON.stringify(layerPackageJson, null, 2)
);

// 安装生产依赖
console.log('📦 安装生产依赖...');
execSync(`cd ${nodejsPath} && yarn install --production`, { stdio: 'inherit' });

// 删除不需要打包的依赖
console.log('🗑️  删除 AWS SDK 相关依赖...');
const removePackages = [
  'aws-sdk',
  '@aws-sdk/client-dynamodb',
  '@aws-sdk/lib-dynamodb',
  '@aws-sdk/util-dynamodb',
  '@aws-sdk/credential-providers'
];

removePackages.forEach(pkg => {
  const pkgPath = path.join(nodejsPath, 'node_modules', pkg);
  if (fs.existsSync(pkgPath)) {
    execSync(`rm -rf ${pkgPath}`);
  }
});

console.log('✅ Lambda Layer 构建完成！');
