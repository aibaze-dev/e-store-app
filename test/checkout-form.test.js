import { CHECKOUT_DEFAULTS, checkoutConfig, checkoutText } from '../shared/checkout-copy.js';
import { mergeGeneratedContent, normalizeContent } from '../src/templates/content.js';
import { describe, expect, it, vi } from 'vitest';
import { confirmCheckout } from '../src/storefront/confirmCheckout.js';
import { storefrontMoney } from '../src/lib/storefront-money.js';

const buyer = { name: ' Ana   Pérez ', email: ' ana@example.com ' };
const checkout = () => ({ currency: 'ars', total: { total: { minorUnitsAmount: 1699000 } }, updateIndividualName: vi.fn().mockResolvedValue({ type: 'success' }), confirm: vi.fn().mockResolvedValue({ type: 'success' }) });
describe('Checkout confirmation', () => {
  it('passes contact details to Stripe and confirms only after the name is accepted', async () => {
    const stripe = checkout();
    const initiate = vi.fn();
    expect(await confirmCheckout(stripe, buyer, { total: 1699000, currency: 'ARS' }, initiate)).toEqual({ type: 'success' });
    expect(stripe.updateIndividualName).toHaveBeenCalledWith('Ana Pérez');
    expect(stripe.confirm).toHaveBeenCalledWith({ email: 'ana@example.com' });
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
    expect((await confirmCheckout(checkout(), { ...buyer, name: '  ' }, { total: 1699000, currency: 'ARS' }, vi.fn())).type).toBe('error');
  });
  it('confirms a post-purchase session with the email Stripe already has, or asks for it', async () => {
    const known = { ...checkout(), email: 'ana@example.com' };
    expect(await confirmCheckout(known, null, { total: 1699000, currency: 'ARS' }, vi.fn())).toEqual({ type: 'success' });
    expect(known.confirm).toHaveBeenCalledWith(undefined);
    expect(known.updateIndividualName).not.toHaveBeenCalled();

    const unknown = { ...checkout(), email: null };
    expect((await confirmCheckout(unknown, null, { total: 1699000, currency: 'ARS' }, vi.fn())).type).toBe('error');
    expect(unknown.confirm).not.toHaveBeenCalled();
    await confirmCheckout(unknown, null, { total: 1699000, currency: 'ARS' }, vi.fn(), ' ana@example.com ');
    expect(unknown.confirm).toHaveBeenCalledWith({ email: 'ana@example.com' });
  });
  it('asks only for name and email, never a phone number', async () => {
    const stripe = checkout();
    expect((await confirmCheckout(stripe, { ...buyer, email: ' ' }, { total: 1699000, currency: 'ARS' }, vi.fn())).type).toBe('error');
    expect(stripe.updateIndividualName).not.toHaveBeenCalled();
    expect(stripe.confirm).not.toHaveBeenCalled();
  });
  it('formats public prices without discarding cents or zero-decimal currencies', () => {
    expect(storefrontMoney(1699000, 'ARS')).toBe('$\u00a016.990,00');
    expect(storefrontMoney(1699050, 'ARS')).toBe('$\u00a016.990,50');
    expect(storefrontMoney(2700, 'USD')).toBe('$27.00');
    expect(storefrontMoney(19990, 'CLP')).toBe('$19.990');
  });
});

describe('editable checkout copy', () => {
  it('corrects saved surname copy while preserving other custom name fields', () => {
    const resolve = checkout => checkoutConfig({ content: { checkout } });
    expect(resolve({ nameLabel: 'Surname *', namePlaceholder: 'Your surname' }))
      .toMatchObject({ nameLabel: 'Name *', namePlaceholder: 'Your name' });
    expect(resolve({ nameLabel: 'Surname', namePlaceholder: 'Ana' }))
      .toMatchObject({ nameLabel: 'Name *', namePlaceholder: 'Ana' });
    expect(resolve({ nameLabel: 'Nombre *' }).nameLabel).toBe('Nombre *');
  });
  it('keeps legacy overrides through normalization and preserves edits during AI regeneration', () => {
    const view = { checkout: { upsellTitle: 'Extras', notifications: false }, content: normalizeContent({}) };
    expect(checkoutConfig(view)).toMatchObject({ upsellTitle: 'Extras', notifications: false });
    const content = normalizeContent({ checkout: { summaryTitle: 'Tu pedido', showTimer: false } });
    expect(mergeGeneratedContent(content, { hero: { title: 'Nueva oferta' } }).checkout).toEqual(content.checkout);
    expect(checkoutText({ pay: 'Comprar por {importe}' }, 'pay', { importe: '$19 {importe}' })).toBe('Comprar por $19 {importe}');
  });
  it('uses configurable validation messages without allowing an altered price to be confirmed', async () => {
    const stripe = checkout();
    const copy = { ...CHECKOUT_DEFAULTS, changedError: 'Revisá el nuevo importe', emailError: 'Falta tu email', nameError: 'Falta tu nombre' };
    const initiate = vi.fn();
    expect((await confirmCheckout(stripe, buyer, { total: 1, currency: 'ARS' }, initiate, '', copy)).error.message).toBe(copy.changedError);
    expect((await confirmCheckout(stripe, { ...buyer, name: '' }, { total: 1699000, currency: 'ARS' }, initiate, '', copy)).error.message).toBe(copy.nameError);
    expect((await confirmCheckout(stripe, { ...buyer, email: '' }, { total: 1699000, currency: 'ARS' }, initiate, '', copy)).error.message).toBe(copy.emailError);
    expect(stripe.confirm).not.toHaveBeenCalled();
    expect(initiate).not.toHaveBeenCalled();
  });
});
