import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class CourseContractService {
  private readonly logger = new Logger(CourseContractService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly contractAddress: string;
  private readonly contractAbi: any[];
  private contract: ethers.Contract;

  constructor(
    public readonly configService: ConfigService // 改为public以便其他服务可以访问
  ) {
    // 初始化网络连接和合约
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL', 'https://goerli.infura.io/v3/your-infura-key');
    this.contractAddress = this.configService.get<string>('COURSE_CONTRACT_ADDRESS', '');
    
    // 简化的ABI，只包含我们需要的功能
    this.contractAbi = [
      // addCourse函数
      {
        "inputs": [
          { "internalType": "string", "name": "web2CourseId", "type": "string" },
          { "internalType": "string", "name": "name", "type": "string" },
          { "internalType": "uint256", "name": "price", "type": "uint256" }
        ],
        "name": "addCourse",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      // courseCount变量
      {
        "inputs": [],
        "name": "courseCount",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
      },
      // CourseAdded事件
      {
        "anonymous": false,
        "inputs": [
          { "indexed": true, "internalType": "uint256", "name": "courseId", "type": "uint256" },
          { "indexed": false, "internalType": "string", "name": "web2CourseId", "type": "string" },
          { "indexed": false, "internalType": "string", "name": "name", "type": "string" }
        ],
        "name": "CourseAdded",
        "type": "event"
      }
    ];
    
    try {
      // 创建provider
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // 初始化合约
      if (this.contractAddress) {
        this.contract = new ethers.Contract(this.contractAddress, this.contractAbi, this.provider);
        this.logger.log(`课程合约服务初始化完成, 合约地址: ${this.contractAddress}`);
      } else {
        this.logger.warn('未配置课程合约地址，合约服务将不可用');
      }
    } catch (error) {
      this.logger.error(`课程合约服务初始化失败: ${error.message}`, error.stack);
    }
  }
  
  /**
   * 添加课程到区块链
   * @param web2CourseId Web2平台的课程ID
   * @param name 课程名称
   * @param price 课程价格
   * @param creatorAddress 创建者钱包地址
   * @returns 是否添加成功
   */
  async addCourse(web2CourseId: string, name: string, price: number, creatorAddress: string): Promise<boolean> {
    try {
      if (!this.contract) {
        throw new Error('合约未初始化');
      }
      
      const privateKey = this.configService.get<string>('CONTRACT_PRIVATE_KEY');
      if (!privateKey) {
        // 模拟环境，直接返回成功
        this.logger.log(`模拟添加课程成功: ${web2CourseId}`);
        return true;
      }
      
      // 使用私钥创建钱包
      const wallet = new ethers.Wallet(privateKey, this.provider);
      
      // 连接合约
      const contractWithSigner = this.contract.connect(wallet) as ethers.Contract;
      
      // 将价格转换为wei
      const priceInWei = ethers.parseEther(price.toString());
      
      // 调用合约方法 - 使用类型断言解决类型错误
      const tx = await (contractWithSigner as any).addCourse(web2CourseId, name, priceInWei);
      await tx.wait();
      
      this.logger.log(`课程添加成功: ${web2CourseId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`添加课程到区块链失败: ${error.message}`, error.stack);
      throw new Error(`添加课程到区块链失败: ${error.message}`);
    }
  }

  /**
   * 检查课程是否存在
   * @param web2CourseId Web2平台的课程ID
   * @returns 是否存在
   */
  async checkCourseExists(web2CourseId: string): Promise<boolean> {
    // 由于合约没有直接提供检查的方法，这里实现一个模拟方法
    // 在实际应用中，可以通过查询web2ToCourseId映射来实现
    return true;
  }
}
