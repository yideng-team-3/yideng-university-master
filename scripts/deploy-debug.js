/**
 * 部署调试工具 - 用于检查Lambda层和函数依赖
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const STAGE = process.env.STAGE || 'dev';
const PROFILE = process.env.AWS_PROFILE || 'default';
const FUNCTION_NAME = `web3-university-${STAGE}`;

/**
 * 主函数
 */
async function main() {
  console.log('🔍 开始检查Lambda部署...');
  
  // 1. 检查函数是否存在
  console.log(`检查Lambda函数 ${FUNCTION_NAME}...`);
  try {
    const functionInfo = JSON.parse(execSync(
      `aws lambda get-function --function-name ${FUNCTION_NAME} --profile ${PROFILE}`,
      { encoding: 'utf8' }
    ));
    console.log(`✅ 函数已部署，运行时: ${functionInfo.Configuration.Runtime}`);
    console.log(`内存: ${functionInfo.Configuration.MemorySize}MB, 超时: ${functionInfo.Configuration.Timeout}秒`);
    
    // 检查环境变量
    if (functionInfo.Configuration.Environment) {
      console.log('环境变量:');
      Object.entries(functionInfo.Configuration.Environment.Variables).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    // 检查层
    if (functionInfo.Configuration.Layers && functionInfo.Configuration.Layers.length > 0) {
      console.log('已附加层:');
      functionInfo.Configuration.Layers.forEach(layer => {
        console.log(`  ${layer.Arn}`);
      });
    }
  } catch (error) {
    console.error(`❌ 无法获取函数信息: ${error.message}`);
    process.exit(1);
  }
  
  // 2. 检查日志以查找依赖错误
  console.log('\n检查最近的日志以查找依赖错误...');
  try {
    // 获取日志组名称
    const logGroupName = `/aws/lambda/${FUNCTION_NAME}`;
    
    // 检查是否存在
    execSync(`aws logs describe-log-groups --log-group-name-prefix ${logGroupName} --profile ${PROFILE}`);
    
    // 获取最近的日志流
    const logStreams = JSON.parse(execSync(
      `aws logs describe-log-streams --log-group-name ${logGroupName} --order-by LastEventTime --descending --limit 1 --profile ${PROFILE}`,
      { encoding: 'utf8' }
    ));
    
    if (logStreams.logStreams && logStreams.logStreams.length > 0) {
      const latestStream = logStreams.logStreams[0].logStreamName;
      
      // 获取最近的日志事件
      const logEvents = JSON.parse(execSync(
        `aws logs get-log-events --log-group-name ${logGroupName} --log-stream-name "${latestStream}" --limit 100 --profile ${PROFILE}`,
        { encoding: 'utf8' }
      ));
      
      // 查找错误消息
      const errorMessages = logEvents.events
        .map(event => event.message)
        .filter(message => message.includes('Error') || message.includes('error') || message.includes('Cannot find module'));
      
      if (errorMessages.length > 0) {
        console.log('❌ 发现错误:');
        errorMessages.forEach(msg => console.log(`  ${msg.trim()}`));
      } else {
        console.log('✅ 未发现明显错误');
      }
    } else {
      console.log('⚠️ 未找到日志流');
    }
  } catch (error) {
    console.error(`⚠️ 无法检查日志: ${error.message}`);
  }
  
  // 3. 检查本地依赖层内容
  console.log('\n检查本地依赖层内容...');
  const layerPath = path.join(__dirname, '../layers/dependencies/nodejs/node_modules');
  
  if (fs.existsSync(layerPath)) {
    const nestjsModules = fs.readdirSync(layerPath).filter(dir => dir.startsWith('@nestjs'));
    
    if (nestjsModules.length > 0) {
      console.log('发现NestJS模块:');
      nestjsModules.forEach(dir => {
        const submodules = fs.readdirSync(path.join(layerPath, dir)).join(', ');
        console.log(`  ${dir}: ${submodules}`);
      });
    } else {
      console.warn('⚠️ 未在依赖层中找到NestJS模块!');
    }
    
    // 检查特定的模块
    const criticalModules = [
      '@nestjs/config', '@nestjs/core', '@nestjs/common', '@nestjs/platform-express',
      '@nestjs/swagger', 'ethers', 'web3', 'viem', '@metamask/eth-sig-util', 'siwe',
      'class-validator-jsonschema'
    ];
    const missingModules = criticalModules.filter(module => {
      // 处理不同的模块路径格式
      let modulePath;
      if (module.startsWith('@')) {
        // 如果是作用域包 (@xxx/yyy)，则需要检查父目录
        const parts = module.split('/');
        modulePath = path.join(layerPath, parts[0], parts[1]);
      } else {
        modulePath = path.join(layerPath, module);
      }
      return !fs.existsSync(modulePath);
    });
    
    if (missingModules.length > 0) {
      console.error('❌ 缺少关键模块:');
      missingModules.forEach(module => console.error(`  ${module}`));
    } else {
      console.log('✅ 所有关键模块都存在于依赖层中');
    }
  } else {
    console.error('❌ 依赖层目录不存在，请先构建层');
  }
  
  console.log('\n🔧 建议:');
  console.log('1. 确保build-layer.sh脚本包含所有必要的依赖');
  console.log('2. 检查NODE_PATH环境变量是否正确设置');
  console.log('3. 考虑在Lambda函数中添加诊断代码，打印模块搜索路径');
  console.log('4. 重新部署更新后的层和函数代码');
}

main().catch(error => {
  console.error('执行脚本时出错:', error);
  process.exit(1);
});
