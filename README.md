# yideng-university-master

## 启动

```shell
pnpm install

pnpm start
```

## 签名登录

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

3. 后续调用带上 `accessToken`

## SQL

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  nonce VARCHAR(64) NOT NULL,
  username VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- 该表暂时先不用
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(50),
  user_agent TEXT,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);
```

users 表：

id - 唯一用户标识（UUID）
wallet_address - 用户的以太坊钱包地址
nonce - 用于签名验证的随机字符串，每次登录尝试都会更新
username - 用户名（可选）
avatar_url - 头像链接（可选）
created_at - 账户创建时间
updated_at - 账户信息更新时间
last_login_at - 最后登录时间

user_sessions 表：

id - 会话唯一标识
user_id - 关联到用户表的外键
signature - 用户签名
expires_at - 会话过期时间
created_at - 会话创建时间
ip_address - 用户 IP 地址
user_agent - 用户浏览器信息
