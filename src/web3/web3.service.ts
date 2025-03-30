import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class Web3Service {
  /**
   * 验证以太坊签名
   * @param message 原始消息内容
   * @param signature 签名
   * @param address 钱包地址
   * @returns 签名是否有效
   */
  async verifySignature(message: string, signature: string, address: string): Promise<boolean> {
    try {
      // 恢复签名者地址
      const signerAddr = ethers.verifyMessage(message, signature);
      
      // 检查恢复的地址是否与提供的地址匹配（不区分大小写）
      return signerAddr.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('验证签名失败:', error);
      return false;
    }
  }

  /**
   * 创建要签名的消息
   * @param walletAddress 钱包地址
   * @param nonce 一次性随机数
   * @returns 格式化的消息
   */
  createSignMessage(walletAddress: string, nonce: string): string {
    return `欢迎访问 Web3 University!

点击签名以登录并接受我们的服务条款和隐私政策。

此请求不会触发区块链交易或消耗任何 gas 费用。

钱包地址:
${walletAddress}

Nonce:
${nonce}`;
  }

  /**
   * 生成一个新的 nonce
   * @returns nonce 字符串
   */
  generateNonce(): string {
    return crypto.randomUUID();
  }
}
