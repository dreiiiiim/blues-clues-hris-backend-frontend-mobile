import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { ApiCenterSdkService } from '../api-center/api-center-sdk.service';

function buildSupabaseChain(overrides: Record<string, jest.Mock> = {}) {
  const chain: any = {};
  const methods = ['from','select','eq','maybeSingle','update','single','insert','upsert','is','ilike','limit','neq'];
  for (const m of methods) {
    chain[m] = overrides[m] ?? jest.fn().mockReturnValue(chain);
  }
  return chain;
}

describe('SubscriptionService.createCheckout', () => {
  let service: SubscriptionService;
  let mockSdkClient: { paymentCreateCheckoutSession: jest.Mock };
  let supabaseChain: ReturnType<typeof buildSupabaseChain>;

  beforeEach(async () => {
    mockSdkClient = {
      paymentCreateCheckoutSession: jest.fn().mockResolvedValue({
        checkoutId: 'chk_test_123',
        checkoutUrl: 'https://pm.link/chk_test_123',
      }),
    };

    supabaseChain = buildSupabaseChain({
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          registration_id: 'reg-uuid',
          payment_status: 'Pending',
          subscription_plan: 'monthly',
          billing_cycle: 'monthly',
          company_name: 'Test Co',
        },
        error: null,
      }),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: SupabaseService, useValue: { getClient: jest.fn().mockReturnValue(supabaseChain) } },
        { provide: MailService, useValue: { sendRegistrationConfirmation: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') } },
        { provide: ApiCenterSdkService, useValue: { getClient: jest.fn().mockReturnValue(mockSdkClient) } },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('returns checkout_url and checkout_id', async () => {
    const result = await service.createCheckout({ registration_id: 'reg-uuid' });
    expect(result.checkout_url).toBe('https://pm.link/chk_test_123');
    expect(result.checkout_id).toBe('chk_test_123');
  });

  it('passes correct successUrl and cancelUrl to SDK', async () => {
    await service.createCheckout({ registration_id: 'reg-uuid' });
    expect(mockSdkClient.paymentCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: 'reg-uuid',
        successUrl: 'http://localhost:3000/payment/success?registration_id=reg-uuid',
        cancelUrl: 'http://localhost:3000/payment/cancel?registration_id=reg-uuid',
      }),
    );
  });

  it('throws NotFoundException when registration not found', async () => {
    supabaseChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(service.createCheckout({ registration_id: 'bad-uuid' })).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when already paid', async () => {
    supabaseChain.maybeSingle.mockResolvedValueOnce({
      data: { registration_id: 'reg-uuid', payment_status: 'Paid' },
      error: null,
    });
    await expect(service.createCheckout({ registration_id: 'reg-uuid' })).rejects.toThrow(BadRequestException);
  });
});
