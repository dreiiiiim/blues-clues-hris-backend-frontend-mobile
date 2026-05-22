import { Test, TestingModule } from '@nestjs/testing';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';

describe('ApiController', () => {
  let ApiController: ApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ApiController],
      providers: [ApiService],
    }).compile();

    ApiController = app.get<ApiController>(ApiController);
  });

  describe('root', () => {
    it('should return service identity', () => {
      expect(ApiController.getServiceInfo()).toEqual({
        service: 'tribe-backend',
        version: '1.0.0',
      });
    });
  });
});
