const LandingsPage = lazy(() => import('./LandingsPage.jsx'));
const QuizEditor = lazy(() => import('./QuizEditor.jsx'));
const QuizContacts = lazy(() => import('./QuizContacts.jsx'));
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useConvexAuth, useQuery } from 'convex/react';
import { DropdownMenu } from 'radix-ui';
import { ArrowUpRight, BadgePercent, BarChart3, BookOpen, Check, ChevronDown, CreditCard, LayoutDashboard, LayoutGrid, Library, LoaderCircle, LogOut, Menu, PanelTop, Plus, Settings2, ShoppingBag, ShoppingCart, Sparkles, X } from 'lucide-react';
import brand from '@/config/brandData.json';
import { api } from '@/lib/api.js';
import { authClient } from '@/lib/auth-client.js';
import { storePath, storeSwitchPath } from '@/lib/panel-routes.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import { InternalTheme, ThemeToggle } from '@/components/InternalTheme.jsx';
import { EmptyState, ErrorAlert, PageSkeleton } from '@/components/Field.jsx';
import { StoreWorkspaceContext } from './StoreWorkspace.jsx';
import ProductsPage from './ProductsPage.jsx';
import ArtifactsPage from './ArtifactsPage.jsx';
import ProductFormPage from './ProductFormPage.jsx';
import StoresPage from './StoresPage.jsx';
import StoreFormPage from './StoreFormPage.jsx';
import LandingEditPage from './LandingEditPage.jsx';
import LandingPreviewPage from './LandingPreviewPage.jsx';
import OrdersPage from './OrdersPage.jsx';
import StoreDashboardPage from './StoreDashboardPage.jsx';
import StoreCheckoutPage from './StoreCheckoutPage.jsx';
import ChangePasswordDialog from './ChangePasswordDialog.jsx';
const StoreAnalyticsPage = lazy(() => import('./StoreAnalyticsPage.jsx'));

const NAV_GROUPS = [
  { id: 'overview', label: 'Tienda', items: [
    { path: '', label: 'Inicio', icon: LayoutDashboard },
    { path: 'analiticas', label: 'Analíticas', icon: BarChart3 },
  ] },
  { id: 'offer', label: 'Oferta', items: [
    { path: 'productos', label: 'Productos y oferta', icon: BookOpen },
    { path: 'post-compra', label: 'Oferta post-compra', icon: Sparkles },
    { path: 'downsell', label: 'Downsell', icon: BadgePercent },
  ] },
  { id: 'experience', label: 'Experiencia de compra', items: [
    { path: 'landings', label: 'Landings', icon: PanelTop },
    { path: 'checkout', label: 'Checkout', icon: CreditCard },
  ] },
  { id: 'management', label: 'Gestión', items: [
    { path: 'contactos', label: 'Contactos y respuestas', icon: BookOpen },
    { path: 'cobros', label: 'Cobros y entregas', icon: ShoppingCart },
    { path: 'configuracion', label: 'Configuración', icon: Settings2 },
  ] },
];
const SECTIONS = NAV_GROUPS.flatMap(group => group.items);

function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true); setError('');
    try {
      const result = await authClient.signOut();
      if (result.error) setError('No se pudo cerrar la sesión. Volvé a intentar.');
    } catch { setError('No se pudo conectar. Volvé a intentar.'); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="ghost" onClick={signOut} disabled={busy} aria-label="Cerrar sesión">
      {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}<span className="hidden sm:inline">{busy ? 'Cerrando…' : 'Salir'}</span>
    </Button>
    {error && <div className="basis-full"><ErrorAlert>{error}</ErrorAlert></div>}
  </>;
}

function StoreSwitcher({ stores, selected, onNavigate, onCloseAutoFocus }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const go = to => { navigate(to); onNavigate(); };
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger className="workspace-store-switch" aria-label={`Cambiar tienda: ${selected?.name || 'Seleccionar tienda'}`}>
      <span className="workspace-store-icon"><ShoppingBag aria-hidden="true" /></span>
      <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{selected?.name || 'Tus tiendas'}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{selected?.subdomain || 'Elegí tu espacio de trabajo'}</span></span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </DropdownMenu.Trigger>
    <DropdownMenu.Content onCloseAutoFocus={onCloseAutoFocus} className="workspace-store-menu" sideOffset={8} align="start" collisionPadding={12}>
      <DropdownMenu.Item className="workspace-store-item" onSelect={() => go('/panel/tiendas')}><LayoutGrid className="size-4" aria-hidden="true" />Todas las tiendas</DropdownMenu.Item>
      <DropdownMenu.Separator className="my-2 h-px bg-border" />
      <DropdownMenu.Label className="px-3 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Mis tiendas</DropdownMenu.Label>
      {stores.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Todavía no hay tiendas.</p>}
      {stores.map(store => <DropdownMenu.Item key={store._id} className="workspace-store-item" onSelect={() => go(storeSwitchPath(pathname, store._id))}>
        <ShoppingBag className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block truncate">{store.name}</span><span className="block truncate text-xs text-muted-foreground">{store.subdomain || 'Sin landing'}</span></span>{selected?._id === store._id && <Check className="size-4" aria-label="Tienda actual" />}
      </DropdownMenu.Item>)}
      <DropdownMenu.Separator className="my-2 h-px bg-border" />
      <DropdownMenu.Item className="workspace-store-item text-primary" onSelect={() => go('/panel/tiendas/nueva')}><Plus className="size-4" aria-hidden="true" />Crear tienda</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>;
}

export function WorkspaceLayout({ user, stores, selected, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef(null);
  const mobileToggleRef = useRef(null);
  useEffect(() => {
    if (mobileOpen) sidebarRef.current?.querySelector('button')?.focus();
  }, [mobileOpen]);
  const location = useLocation();
  const basePath = selected ? storePath(selected._id) : '/panel';
  const section = SECTIONS.find(item => location.pathname === `${basePath}${item.path ? `/${item.path}` : ''}`);
  const title = location.pathname.startsWith('/panel/artefactos') ? 'Artefactos' : location.pathname === '/panel/tiendas' ? 'Todas las tiendas' : location.pathname === '/panel/tiendas/nueva' ? 'Nueva tienda' : location.pathname.includes('/catalogo') || location.pathname.startsWith('/panel/productos') ? 'Catálogo compartido' : section?.label || 'Tu tienda';
  const closeMenu = () => {
    setMobileOpen(false);
    if (mobileOpen) mobileToggleRef.current?.focus();
  };
  return <InternalTheme className="workspace-theme">
    <div className="workspace-shell">
      <aside ref={sidebarRef} id="store-navigation" className={cn('workspace-sidebar', mobileOpen && 'is-open')} aria-label="Navegación de la tienda" onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) closeMenu(); }}>
        <div className="p-4"><StoreSwitcher stores={stores} selected={selected} onNavigate={closeMenu} onCloseAutoFocus={event => {
          if (sidebarRef.current?.getClientRects().length === 0) { event.preventDefault(); mobileToggleRef.current?.focus(); }
        }} /></div>
        <nav className="workspace-navigation" aria-label="Secciones de la tienda">
          {selected ? NAV_GROUPS.map(group => <section key={group.id} className="workspace-nav-group" aria-labelledby={`nav-${group.id}`}>
            <h2 id={`nav-${group.id}`} className="workspace-nav-label">{group.label}</h2>
            {group.items.map(({ path, label, icon: Icon }) => <NavLink key={path} end to={`${basePath}${path ? `/${path}` : ''}`} onClick={closeMenu} className={({ isActive }) => cn('workspace-nav-link', isActive && 'is-active')}><Icon className="size-[18px] shrink-0" aria-hidden="true" />{label}</NavLink>)}
          </section>) : <section className="workspace-nav-group" aria-labelledby="nav-start">
            <h2 id="nav-start" className="workspace-nav-label">Empezá por acá</h2>
            <NavLink to="/panel/tiendas/nueva" onClick={closeMenu} className={({ isActive }) => cn('workspace-nav-link', isActive && 'is-active')}><ShoppingBag className="size-[18px]" aria-hidden="true" />Crear mi primera tienda</NavLink>
          </section>}
          <section className="workspace-nav-group" aria-labelledby="nav-shared">
            <h2 id="nav-shared" className="workspace-nav-label">Recursos compartidos</h2>
            <NavLink to={selected ? `${basePath}/catalogo` : '/panel/productos'} onClick={closeMenu} className={({ isActive }) => cn('workspace-nav-link', isActive && 'is-active')}><Library className="size-[18px]" aria-hidden="true" />Catálogo de ebooks</NavLink>
            <NavLink end to="/panel/tiendas" onClick={closeMenu} className={({ isActive }) => cn('workspace-nav-link', isActive && 'is-active')}><LayoutGrid className="size-[18px]" aria-hidden="true" />Todas las tiendas</NavLink>
            <NavLink to="/panel/artefactos" onClick={closeMenu} className={({ isActive }) => cn('workspace-nav-link', isActive && 'is-active')}><Sparkles className="size-[18px]" aria-hidden="true" />Artefactos</NavLink>
          </section>
        </nav>
        <div className="workspace-sidebar-footer"><span className="workspace-avatar">{(user.name || user.email || 'A').slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{user.name || 'Mi espacio'}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span><ChangePasswordDialog /></div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Button ref={mobileToggleRef} variant="ghost" size="icon" className="lg:hidden" aria-label={mobileOpen ? 'Cerrar navegación' : 'Abrir navegación'} aria-expanded={mobileOpen} aria-controls="store-navigation" onClick={() => mobileOpen ? closeMenu() : setMobileOpen(true)}>{mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</Button>
            <Link to={selected ? basePath : '/panel'} className="hidden shrink-0 text-lg font-semibold tracking-tight sm:block">{brand.shortName}<span className="text-primary">.</span></Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <div className="min-w-0"><p className="truncate text-sm font-medium">{title}</p><p className="truncate text-xs text-muted-foreground lg:hidden">{selected?.name || 'Tus tiendas'}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2"><ThemeToggle /><SignOutButton /></div>
        </header>
        <main className="workspace-content"><ErrorBoundary key={location.pathname}>{children}</ErrorBoundary></main>
        <footer className="workspace-footer"><span>{brand.shortName} · Tu espacio de campañas</span>{selected && <Link to={`${basePath}/landing`} className="inline-flex items-center gap-1">Diseñar mi landing<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>}</footer>
      </div>
    </div>
  </InternalTheme>;
}

function Workspace({ user }) {
  const stores = useQuery(api.stores.list, {});
  const { pathname } = useLocation();
  const match = matchPath('/panel/tiendas/:storeId/*', pathname);
  const requestedId = match?.params.storeId === 'nueva' ? null : match?.params.storeId;
  if (stores === undefined) return <InternalTheme><main className="p-6"><PageSkeleton label="Cargando tus tiendas" /></main></InternalTheme>;
  const selected = requestedId ? stores.find(store => store._id === requestedId) : stores[0];
  const basePath = selected ? storePath(selected._id) : '/panel';
  const productsPath = selected ? `${basePath}/catalogo` : '/panel/productos';
  return <StoreWorkspaceContext.Provider value={{ store: selected || null, basePath, productsPath }}>
    <WorkspaceLayout user={user} stores={stores} selected={selected}>
      {requestedId && !selected ? <EmptyState title="Esta tienda no está disponible"><Button asChild variant="outline"><Link to="/panel/tiendas">Ver mis tiendas</Link></Button></EmptyState> : <Routes key={pathname}>
        <Route index element={<Navigate to={selected ? basePath : '/panel/tiendas'} replace />} />
        <Route path="tiendas" element={<StoresPage />} />
        <Route path="tiendas/nueva" element={<StoreFormPage />} />
        <Route path="tiendas/:storeId" element={<StoreDashboardPage />} />
        <Route path="tiendas/:storeId/analiticas" element={<Suspense fallback={<PageSkeleton label="Cargando analíticas" />}><StoreAnalyticsPage /></Suspense>} />
        <Route path="tiendas/:storeId/configuracion" element={<StoreFormPage section="settings" />} />
        <Route path="tiendas/:storeId/productos" element={<StoreFormPage section="offer" />} />
        <Route path="tiendas/:storeId/bonos" element={<Navigate to={`${basePath}/productos#bonos`} replace />} />
        <Route path="tiendas/:storeId/upsells" element={<Navigate to={`${basePath}/productos#upsells`} replace />} />
        <Route path="tiendas/:storeId/post-compra" element={<StoreFormPage section="post" />} />
        <Route path="tiendas/:storeId/downsell" element={<StoreFormPage section="downsell" />} />
        <Route path="tiendas/:storeId/landings" element={<Suspense fallback={<PageSkeleton label="Cargando" />}><LandingsPage /></Suspense>} />
        <Route path="tiendas/:storeId/quiz" element={<Suspense fallback={<PageSkeleton label="Cargando" />}><QuizEditor /></Suspense>} />
        <Route path="tiendas/:storeId/contactos" element={<Suspense fallback={<PageSkeleton label="Cargando" />}><QuizContacts /></Suspense>} />
        <Route path="tiendas/:storeId/landing" element={<LandingEditPage />} />
        <Route path="tiendas/:storeId/checkout" element={<StoreCheckoutPage />} />
        <Route path="tiendas/:storeId/cobros" element={<OrdersPage />} />
        <Route path="tiendas/:storeId/catalogo" element={<ProductsPage />} />
        <Route path="tiendas/:storeId/catalogo/nuevo" element={<ProductFormPage />} />
        <Route path="tiendas/:storeId/catalogo/:productId" element={<ProductFormPage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="artefactos" element={<ArtifactsPage />} />
        <Route path="artefactos/:artifactSlug" element={<ProductFormPage artifactMode />} />
        <Route path="productos/nuevo" element={<ProductFormPage />} />
        <Route path="productos/:productId" element={<ProductFormPage />} />
        <Route path="cobros" element={selected ? <Navigate to={`${basePath}/cobros`} replace /> : <EmptyState title="Primero creá una tienda" />} />
        <Route path="*" element={<Navigate to={selected ? basePath : '/panel/tiendas'} replace />} />
      </Routes>}
    </WorkspaceLayout>
  </StoreWorkspaceContext.Provider>;
}

export default function Panel() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : 'skip');
  if (isLoading || (isAuthenticated && user === undefined)) return <InternalTheme><main className="p-6"><PageSkeleton label="Verificando acceso" /></main></InternalTheme>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!user.isAdmin) return <InternalTheme><main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 className="text-3xl font-semibold tracking-tight">Sin acceso al panel</h1>
    <p className="text-sm leading-6 text-muted-foreground">La cuenta {user.email} no está habilitada para gestionar campañas.</p>
    <div className="flex gap-2"><ThemeToggle /><SignOutButton /></div>
  </main></InternalTheme>;
  return <Routes>
    <Route path="tiendas/:storeId/vista-previa" element={<LandingPreviewPage />} />
    <Route path="*" element={<Workspace user={user} />} />
  </Routes>;
}
