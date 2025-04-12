import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as contractJSON from './CourseMarket.json';

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
    // 获取RPC URL和合约地址
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL', 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID');
    this.contractAddress = this.configService.get<string>('COURSE_CONTRACT_ADDRESS', '0x436CbE7D8DC5593B3B7B137698a37212f4a4227a');
    
    // 导入完整的ABI
    try {
      // const contractJson = require('./CourseMarket.json');
      // console.log('合约ABI:', contractJSON.abi);
      this.contractAbi = contractJSON.abi;
      
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
      
      // 先检查课程是否已经存在
      const exists = await this.checkCourseExists(web2CourseId);
      if (exists) {
        this.logger.warn(`课程已存在于区块链上: ${web2CourseId}`);
        return false;
      }
      
      // 这里传入的私钥应该是创建者的钱包地址
      const privateKey = this.configService.get<string>('CONTRACT_PRIVATE_KEY', '');
      if (!privateKey) {
        // 模拟环境，直接返回成功
        this.logger.log(`模拟添加课程成功: ${web2CourseId}`);
        return true;
      }
      
      // 使用私钥创建钱包
      const wallet = new ethers.Wallet(privateKey, this.provider);
      
      // 连接合约
      const contractWithSigner = this.contract.connect(wallet);
      
      // 将价格转换为wei
      const priceInWei = ethers.parseEther(price.toString());
      
      // 调用合约方法添加课程
      // @ts-ignore
      const tx = await contractWithSigner.addCourse(web2CourseId, name, priceInWei);
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
    try {
      console.log('检查课程存在性:', this.contract);
      if (!this.contract) {
        throw new Error('合约未初始化');
      }
      
      // 调用web2ToCourseId映射查询课程ID
      const courseId = await this.contract.web2ToCourseId(web2CourseId);
      
      // 如果courseId为0，则表示课程不存在（在Solidity中，未赋值的mapping默认返回0）
      // 使用大于0判断是否存在
      return courseId > 0;
    } catch (error) {
      this.logger.error(`检查课程存在性失败: ${error.message}`, error.stack);
      return false;
    }
  }
}
