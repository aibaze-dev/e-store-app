import { createContext, useContext } from 'react';

export const StoreWorkspaceContext = createContext({ store: null, basePath: '/panel', productsPath: '/panel/productos' });
export const useStoreWorkspace = () => useContext(StoreWorkspaceContext);
