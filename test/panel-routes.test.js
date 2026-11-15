import { describe, expect, it } from 'vitest';
import { storeSwitchPath } from '../src/lib/panel-routes.js';

describe('switching campaign context', () => {
  it.each(['analiticas', 'productos', 'bonos', 'upsells', 'post-compra', 'downsell', 'landing', 'checkout', 'cobros', 'configuracion'])("keeps the %s section in the selected store", section => {
    expect(storeSwitchPath(`/panel/tiendas/first/${section}`, 'second')).toBe(`/panel/tiendas/second/${section}`);
  });
  it('leaves a resource editor when switching stores', () => {
    expect(storeSwitchPath('/panel/tiendas/first/catalogo/product123', 'second')).toBe('/panel/tiendas/second/catalogo');
  });
  it.each(['/panel/tiendas', '/panel/tiendas/nueva', '/panel/productos', '/panel/tiendas/first'])('opens the store home from %s', path => {
    expect(storeSwitchPath(path, 'second')).toBe('/panel/tiendas/second');
  });
});
