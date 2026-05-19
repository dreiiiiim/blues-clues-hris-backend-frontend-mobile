import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCenterSdkService } from '../api-center/api-center-sdk.service';
import { MailService } from '../mail/mail.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SubscriptionService } from './subscription.service';

function buildSupabaseChain(overrides: Record<string, jest.Mock> = {}) {
  const chain: any = {};
  const methods = [
    'from',
    'select',
    'eq',
    'maybeSingle',
    'update',
    'single',
    'insert',
    'upsert',
    'is',
    'ilike',
    'limit',
  ];
  for (const method of methods) {
    chain[method] = overrides[method] ?? jest.fn().mockReturnValue(chain);
  }
  return chain;
}

describe('SubscriptionService', () => {
  describe('createCheckout', () => {
    let service: SubscriptionService;
    let mockSdkClient: { paymentCreateCheckoutSession: jest.Mock };
    let supabaseChain: ReturnType<typeof buildSupabaseChain>;

    beforeEach(async () => {
      mockSdkClient = {
        paymentCreateCheckoutSession: jest.fn().mockResolvedValue({
          checkoutId: 'chk_test_123',
          redirectUrl: 'https://pm.link/chk_test_123',
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
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SubscriptionService,
          {
            provide: SupabaseService,
            useValue: { getClient: jest.fn().mockReturnValue(supabaseChain) },
          },
          { provide: MailService, useValue: {} },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') },
          },
          {
            provide: ApiCenterSdkService,
            useValue: { getClient: jest.fn().mockReturnValue(mockSdkClient) },
          },
        ],
      }).compile();

      service = module.get<SubscriptionService>(SubscriptionService);
    });

    it('returns checkout_url and checkout_id', async () => {
      const result = await service.createCheckout({ registration_id: 'reg-uuid' });
      expect(result.checkout_url).toBe('https://pm.link/chk_test_123');
      expect(result.checkout_id).toBe('chk_test_123');
    });

    it('passes success/cancel urls to SDK', async () => {
      await service.createCheckout({ registration_id: 'reg-uuid' });
      expect(mockSdkClient.paymentCreateCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceId: 'reg-uuid',
          successUrl: 'http://localhost:3000/payment/success?registration_id=reg-uuid',
          cancelUrl: 'http://localhost:3000/payment/cancel?registration_id=reg-uuid',
        }),
      );
    });

    it('throws NotFoundException when registration is missing', async () => {
      supabaseChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(
        service.createCheckout({ registration_id: 'bad-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when already paid', async () => {
      supabaseChain.maybeSingle.mockResolvedValueOnce({
        data: { registration_id: 'reg-uuid', payment_status: 'Paid' },
        error: null,
      });
      await expect(
        service.createCheckout({ registration_id: 'reg-uuid' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmPayment', () => {
    let service: SubscriptionService;
    let mockSdkClient: { paymentGetCheckoutSession: jest.Mock };
    let supabaseChain: ReturnType<typeof buildSupabaseChain>;

    beforeEach(async () => {
      mockSdkClient = {
        paymentGetCheckoutSession: jest.fn().mockResolvedValue({
          checkoutId: 'chk_test_123',
          provider: 'paymongo',
          status: 'paid',
          referenceId: 'ref_abc',
          redirectUrl: 'https://example.com',
        }),
      };

      supabaseChain = buildSupabaseChain({
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            registration_id: 'reg-uuid',
            payment_status: 'Pending',
            checkout_id: 'chk_test_123',
            company_name: 'Test Co',
            email: 'admin@test.com',
            subscription_plan: 'monthly',
            company_id: null,
          },
          error: null,
        }),
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SubscriptionService,
          {
            provide: SupabaseService,
            useValue: { getClient: jest.fn().mockReturnValue(supabaseChain) },
          },
          {
            provide: MailService,
            useValue: {
              sendPaymentConfirmation: jest.fn().mockResolvedValue(undefined),
              sendSystemAdminCredentials: jest.fn().mockResolvedValue(undefined),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key: string) => {
                const values: Record<string, string> = {
                  SUBSCRIPTION_WEBHOOK_SECRET: 'test-secret',
                  APP_URL: 'http://localhost:3000',
                  NODE_ENV: 'test',
                };
                return values[key] ?? '';
              }),
            },
          },
          {
            provide: ApiCenterSdkService,
            useValue: { getClient: jest.fn().mockReturnValue(mockSdkClient) },
          },
        ],
      }).compile();

      service = module.get<SubscriptionService>(SubscriptionService);
      jest
        .spyOn(service as any, 'provisionTenant')
        .mockResolvedValue(undefined);
    });

    it('throws UnauthorizedException on invalid webhook secret', async () => {
      await expect(
        service.confirmPayment({ registration_id: 'reg-uuid' }, 'bad-secret'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException when checkout_id is missing', async () => {
      supabaseChain.maybeSingle.mockResolvedValueOnce({
        data: {
          registration_id: 'reg-uuid',
          payment_status: 'Pending',
          checkout_id: null,
        },
        error: null,
      });

      await expect(
        service.confirmPayment({ registration_id: 'reg-uuid' }, 'test-secret'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when checkout status is not paid', async () => {
      mockSdkClient.paymentGetCheckoutSession.mockResolvedValueOnce({
        checkoutId: 'chk_test_123',
        provider: 'paymongo',
        status: 'pending',
        referenceId: 'ref_abc',
        redirectUrl: 'https://example.com',
      });

      await expect(
        service.confirmPayment({ registration_id: 'reg-uuid' }, 'test-secret'),
      ).rejects.toThrow(BadRequestException);
    });

    it('verifies checkout status and provisions tenant when paid', async () => {
      const result = await service.confirmPayment(
        { registration_id: 'reg-uuid' },
        'test-secret',
      );

      expect(mockSdkClient.paymentGetCheckoutSession).toHaveBeenCalledWith(
        'chk_test_123',
      );
      expect(supabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_status: 'Paid',
          subscription_status: 'Active',
          transaction_id: 'ref_abc',
        }),
      );
      expect(result).toEqual({
        message: 'Payment confirmed. Tenant provisioned.',
        registration_id: 'reg-uuid',
      });
    });
  });
});
