import { Test, TestingModule } from '@nestjs/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiService],
    }).compile();

    service = module.get<ApiService>(ApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns the correct service name', () => {
    expect(service.getServiceInfo().service).toBe('tribe-backend');
  });

  it('returns the correct version', () => {
    expect(service.getServiceInfo().version).toBe('1.0.0');
  });

  it('returns an object with both service and version keys', () => {
    expect(service.getServiceInfo()).toEqual({
      service: 'tribe-backend',
      version: '1.0.0',
    });
  });
});
