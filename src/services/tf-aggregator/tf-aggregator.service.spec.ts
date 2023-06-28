import { Test, TestingModule } from '@nestjs/testing';
import { TfAggregatorService } from './tf-aggregator.service';

describe('TfAggregatorService', () => {
  let service: TfAggregatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TfAggregatorService],
    }).compile();

    service = module.get<TfAggregatorService>(TfAggregatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
