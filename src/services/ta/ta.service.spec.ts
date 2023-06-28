import { Test, TestingModule } from '@nestjs/testing';
import { TaService } from './ta.service';

describe('TaService', () => {
  let service: TaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaService],
    }).compile();

    service = module.get<TaService>(TaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
