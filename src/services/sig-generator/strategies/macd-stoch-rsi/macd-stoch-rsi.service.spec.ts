import { Test, TestingModule } from '@nestjs/testing';
import { MacdStochRsiService } from './macd-stoch-rsi.service';

describe('MacdStochRsiService', () => {
  let service: MacdStochRsiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MacdStochRsiService],
    }).compile();

    service = module.get<MacdStochRsiService>(MacdStochRsiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
