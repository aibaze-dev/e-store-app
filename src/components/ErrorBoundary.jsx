import { Component } from 'react';
import { Button } from './ui/button';

// Queries throw while rendering when the server rejects them (bad link, lost access).
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">No pudimos cargar esta pantalla</h1>
      <p className="text-sm leading-6 text-muted-foreground">Puede que el link ya no exista o que haya un problema de conexión.</p>
      <Button variant="outline" onClick={() => window.location.reload()}>Volver a intentar</Button>
    </div>;
  }
}
