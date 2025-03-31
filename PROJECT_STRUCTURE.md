# 项目结构

```
/src
  /app.module.ts          # 应用程序主模块
  /app.controller.ts      # 应用程序主控制器
  /app.service.ts         # 应用程序主服务
  
  /auth                   # 身份验证模块
    /auth.module.ts       # 认证模块定义
    /auth.controller.ts   # 认证相关API控制器
    /auth.service.ts      # 认证业务逻辑
    /decorators           # 装饰器文件夹
      /current-user.decorator.ts  # 获取当前用户装饰器
      /public.decorator.ts        # 标记公开API装饰器
    /guards               # 守卫文件夹
      /jwt-auth.guard.ts  # JWT认证守卫
    /strategies           # 策略文件夹
      /jwt.strategy.ts    # JWT认证策略
      
  /users                  # 用户模块
    /users.module.ts      # 用户模块定义
    /users.controller.ts  # 用户相关API控制器
    /users.service.ts     # 用户业务逻辑
    /entities             # 实体文件夹
      /users.entity.ts    # 用户实体定义
      
  /web3                   # Web3模块
    /web3.module.ts       # Web3模块定义
    /web3.service.ts      # Web3服务实现
    
  /config                 # 配置文件夹
    /configuration.ts     # 应用配置
    
  /migrations             # 数据库迁移文件夹
    /UserSessionsDropMigration.ts  # 删除用户会话表的迁移
```

## 模块职责划分

1. **Auth模块**：处理用户认证相关功能，包括web3登录、JWT验证等
2. **Users模块**：管理用户信息，提供用户CRUD操作
3. **Web3模块**：提供与区块链交互的功能，如签名验证
4. **Config模块**：统一管理应用配置
