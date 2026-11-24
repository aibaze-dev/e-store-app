import { expect, it } from 'vitest';
import { groupStoresByName } from '../src/lib/store-groups.js';

const store = (_id, name) => ({ _id, name });

it('groups market variants with the base store while preserving their identities and order', () => {
  const us = store('1', 'Master Claude - US');
  const other = store('2', 'Master Cocina - US');
  const br = store('3', 'MÁSTER   CLAUDE–br');
  const base = store('4', 'Master Claude');
  const mx = store('5', 'Master Claude MX');
  expect(groupStoresByName([us, other, br, base, mx])).toEqual([
    { label: 'Master Claude', stores: [us, br, base, mx] },
    { label: 'Master Cocina', stores: [other] },
  ]);
});

it('groups duplicate names and explicit variants while keeping distinct names separate', () => {
  const shops = ['Arte', 'Artesanía', 'Arte', 'Arte - Digital', 'Arte Moderno'].map((name, i) => store(String(i), name));
  expect(groupStoresByName(shops).map(group => group.stores)).toEqual([
    [shops[0], shops[2], shops[3]], [shops[1]], [shops[4]],
  ]);
  expect(groupStoresByName([])).toEqual([]);
});
