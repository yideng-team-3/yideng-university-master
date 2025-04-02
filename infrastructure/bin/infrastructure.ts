#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Web3UniversityStack } from '../lib/web3-university-stack';

const app = new cdk.App();

// 从命令行参数获取部署阶段和是否首次部署
const stage = app.node.tryGetContext('stage') || 'dev';
const isFirstDeploy = app.node.tryGetContext('isFirstDeploy') === 'true';

new Web3UniversityStack(app, `Web3UniversityStack-${stage}`, {
  stage,
  isFirstDeploy,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
  },
  description: `Web3 University 后端服务 (${stage})`,
});
