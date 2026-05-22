import './styles.css';
import './pages-styles.css';
import { Component } from 'react';
import { AppRouter } from './app/AppRouter';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Application render failed', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-error-boundary">
          <section>
            <strong>Không thể hiển thị màn hình này</strong>
            <p>{this.state.error.message || 'Ứng dụng gặp lỗi khi render giao diện.'}</p>
            <button type="button" onClick={() => window.location.reload()}>Tải lại</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  );
}
