import { Test, TestingModule } from '@nestjs/testing';
import { SigGeneratorService } from './sig-generator.service';

describe('SigGeneratorService', () => {
  let service: SigGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SigGeneratorService],
    }).compile();

    service = module.get<SigGeneratorService>(SigGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
