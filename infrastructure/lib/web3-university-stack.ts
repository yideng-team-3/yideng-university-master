import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as fs from 'fs';

interface Web3UniversityStackProps extends cdk.StackProps {
  stage: string;
  isFirstDeploy?: boolean;
}

export class Web3UniversityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Web3UniversityStackProps) {
    super(scope, id, props);

    const stage = props.stage || 'dev';
    const isFirstDeploy = props.isFirstDeploy || false;

    // 只在首次部署或明确指定时创建DynamoDB表
    let userTableName: string;

    if (isFirstDeploy) {
      // 创建用户表
      const userTable = new dynamodb.Table(this, 'UsersTable', {
        tableName: `web3-university-${stage}-users`,
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN, // 保护表不被意外删除
      });

      // 添加GSI用于钱包地址查询
      userTable.addGlobalSecondaryIndex({
        indexName: 'walletAddressIndex',
        partitionKey: { name: 'walletAddress', type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      });

      // 存储表名到参数存储
      new ssm.StringParameter(this, 'UsersTableName', {
        parameterName: `/web3-university/${stage}/dynamodb/users-table`,
        stringValue: userTable.tableName,
      });
      
      userTableName = userTable.tableName;
    } else {
      try {
        // 尝试读取已存在表的名称
        userTableName = ssm.StringParameter.valueForStringParameter(
          this,
          `/web3-university/${stage}/dynamodb/users-table`
        );
      } catch (error) {
        // 如果 SSM 参数不存在，直接使用预期的表名
        console.warn('注意: SSM 参数不存在，使用默认表名');
        userTableName = `web3-university-${stage}-users`;
      }
    }

    // 创建单一的依赖层 - 简化层结构
    const dependenciesLayer = new lambda.LayerVersion(this, 'DependenciesLayer', {
      layerVersionName: `web3-university-dependencies-${stage}`,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../layers/dependencies')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Core dependencies for Web3 University Lambda functions',
    });

    // 创建Lambda函数执行角色
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // 添加DynamoDB访问权限
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [`arn:aws:dynamodb:${this.region}:${this.account}:table/${userTableName}*`],
      })
    );

    // 创建一个干净的dist目录，只包含应用代码
    const web3UniversityLambda = new lambda.Function(this, 'Web3UniversityFunction', {
      functionName: `web3-university-${stage}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../dist')),
      timeout: cdk.Duration.seconds(60), // 增加超时时间到60秒
      memorySize: 1536, // 增加内存到1536MB以避免内存不足
      role: lambdaRole,
      layers: [dependenciesLayer],
      environment: {
        NODE_ENV: stage,
        DYNAMODB_USERS_TABLE: userTableName,
        STAGE: stage,
        // 精简NODE_PATH
        NODE_PATH: '/var/task:/opt/nodejs/node_modules:/opt/nodejs',
        // 关闭调试输出
        DEBUG: '',
        DB_TYPE: 'dynamodb',
        // 禁用源映射以避免不必要的内存使用
        NODE_OPTIONS: '--no-warnings',
      },
    });

    // 创建API Gateway
    const api = new apigateway.RestApi(this, 'Web3UniversityApi', {
      restApiName: `web3-university-api-${stage}`,
      description: 'Web3 University API Gateway',
      deployOptions: {
        stageName: stage,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // 将API Gateway与Lambda函数集成
    const lambdaIntegration = new apigateway.LambdaIntegration(web3UniversityLambda);
    
    // 添加代理资源，将所有请求转发到Lambda
    api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // 输出API Gateway URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/${stage}/`,
      description: 'Web3 University API URL',
    });
  }
}
