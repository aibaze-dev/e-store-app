export const storePath = storeId => `/panel/tiendas/${storeId}`;

// Switching campaigns keeps the section, but leaves resource-specific editors.
export function storeSwitchPath(pathname, nextStoreId) {
  const match = pathname.match(/^\/panel\/tiendas\/[^/]+\/(analiticas|configuracion|landings|quiz|contactos|landing|checkout|cobros|productos|bonos|upsells|post-compra|downsell|catalogo)(?:\/|$)/);
  return `${storePath(nextStoreId)}${match ? `/${match[1]}` : ''}`;
}
