// Canonical form of a buyer email, used only to look orders up: the address a buyer typed (or
// Stripe returned) is stored as is, so "  Ana@Example.COM " and "ana@example.com" must match.
// Trims and removes any whitespace or zero-width character, folds compatibility forms
// (full-width letters) and lowercases. Provider aliases (gmail dots, "+tag") are not merged:
// those are different addresses as far as delivery goes.
export function emailKey(value: string | undefined | null) {
  return (value ?? '').normalize('NFKC').replace(/[\s​-‍⁠﻿]/g, '').toLowerCase();
}

// Fields to patch onto an order so its buyer is also searchable by `emailKey`.
export function buyerFields(buyer: { email: string; name: string }) {
  return { buyer, buyerEmailKey: emailKey(buyer.email) };
}
