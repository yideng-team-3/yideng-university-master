# yideng-university-master

## 启动

```shell
pnpm install

pnpm start
```

## Web3 无状态登录

1. 获取 nonce

```js
// 方法与地址
POST /auth/nonce

// 请求体
{
  "walletAddress": "0xlksjakldjklas" // 传入钱包地址
}
//响应
{
  "success": true,
  "nonce": "xx"
}
```

2. 用户签名并登录

```js
POST /auth/web3-login

// 请求体
{
  "walletAddress": "0xlksjakldjklas",
  "signature": "0x签名内容...",
  "nonce": "xx",
  "avatarUrl": "https://example.com/avatar.png", // 可选
  "ensName": "user.eth" // 可选
}

// 响应
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "walletAddress": "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
    "username": "wallet_5B38Da_1680123456789",
    "avatarUrl": "https://example.com/avatar.png",
    "ensName": "user.eth"
  }
}
```

3. 后续调用带上 `Authorization` 头，使用 Bearer 令牌认证

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 使用JWT保护API接口

所有需要身份验证的接口都需要在请求头中携带JWT令牌：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 获取用户个人资料示例

```js
GET /auth/profile

// 请求头
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// 响应
{
  "user": {
    "id": 1,
    "walletAddress": "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
    "username": "wallet_5B38Da_1680123456789"
  }
}
```

### 在控制器中使用当前用户信息

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('some-resource')
export class SomeController {
  @Get()
  getSomeResource(@CurrentUser() user) {
    // user 包含当前登录用户的信息
    return { message: `Hello, ${user.username}!` };
  }
}
```

## SQL

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  nonce VARCHAR(64) NOT NULL,
  username VARCHAR(100),
  avatar_url TEXT,
  ens_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

users 表：

id - 唯一用户标识（UUID）
wallet_address - 用户的以太坊钱包地址
nonce - 用于签名验证的随机字符串，每次登录尝试都会更新
username - 用户名（可选）
avatar_url - 头像链接（可选）
ens_name - 以太坊域名服务名称（可选）
created_at - 账户创建时间
updated_at - 账户信息更新时间
last_login_at - 最后登录时间
```
