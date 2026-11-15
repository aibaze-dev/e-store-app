import { describe, expect, it, vi } from 'vitest';
import { confirmCheckout } from '../src/storefront/confirmCheckout.js';
import { storefrontMoney } from '../src/lib/storefront-money.js';

const buyer = { firstName: ' Ana ', lastName: ' Pérez ', email: ' ana@example.com ', phone: '+54 (9) 11-1234-5678' };
const checkout = () => ({ currency: 'ars', total: { total: { minorUnitsAmount: 1699000 } }, updateIndividualName: vi.fn().mockResolvedValue({ type: 'success' }), confirm: vi.fn().mockResolvedValue({ type: 'success' }) });
describe('Spanish checkout confirmation', () => {
  it('passes contact details to Stripe and confirms only after the name is accepted', async () => {
    const stripe = checkout();
    const initiate = vi.fn();
    expect(await confirmCheckout(stripe, buyer, { total: 1699000, currency: 'ARS' }, initiate)).toEqual({ type: 'success' });
    expect(stripe.updateIndividualName).toHaveBeenCalledWith('Ana Pérez');
    expect(stripe.confirm).toHaveBeenCalledWith({ email: 'ana@example.com', phoneNumber: '+5491112345678' });
    expect(initiate).toHaveBeenCalledOnce();
  });
  it('blocks payment if the server price or currency changed', async () => {
    for (const expected of [{ total: 1, currency: 'ARS' }, { total: 1699000, currency: 'USD' }]) {
      const stripe = checkout();
      expect((await confirmCheckout(stripe, buyer, expected, vi.fn())).type).toBe('error');
      expect(stripe.confirm).not.toHaveBeenCalled();
    }
  });
  it('preserves Stripe validation errors and never confirms invalid personal details', async () => {
    const stripe = checkout();
    stripe.updateIndividualName.mockResolvedValue({ type: 'error', error: { message: 'Nombre inválido' } });
    expect((await confirmCheckout(stripe, buyer, { total: 1699000, currency: 'ARS' }, vi.fn())).error.message).toBe('Nombre inválido');
    expect(stripe.confirm).not.toHaveBeenCalled();
    expect((await confirmCheckout(checkout(), { ...buyer, firstName: '  ' }, { total: 1699000, currency: 'ARS' }, vi.fn())).type).toBe('error');
  });
  it('rejects incomplete international phone numbers before contacting Stripe', async () => {
    const stripe = checkout();
    expect((await confirmCheckout(stripe, { ...buyer, phone: '1234' }, { total: 1699000, currency: 'ARS' }, vi.fn())).type).toBe('error');
    expect(stripe.updateIndividualName).not.toHaveBeenCalled();
    expect(stripe.confirm).not.toHaveBeenCalled();
  });
  it('formats public prices in Spanish without discarding cents or zero-decimal currencies', () => {
    expect(storefrontMoney(1699000, 'ARS')).toBe('AR$ 16.990');
    expect(storefrontMoney(1699050, 'ARS')).toBe('AR$ 16.990,50');
    expect(storefrontMoney(2700, 'USD')).toBe('US$ 27');
    expect(storefrontMoney(2700, 'JPY')).toBe('JPY 2.700');
  });
});
