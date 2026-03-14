import { Test, TestingModule } from '@nestjs/testing';
import { TimekeepingService } from './timekeeping.service';
import { SupabaseService } from '../supabase/supabase.service';


describe('TimekeepingService', () => {
  let service: TimekeepingService;


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimekeepingService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();


    service = module.get<TimekeepingService>(TimekeepingService);
  });


  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

