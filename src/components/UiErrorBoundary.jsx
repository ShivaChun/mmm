import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class UiErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Keep the failure visible in devtools without crashing the whole page.
        console.error('UiErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="theme-panel p-8 bg-white">
                    <div className="flex items-start gap-4">
                        <AlertTriangle className="text-red-600 shrink-0" size={28} strokeWidth={3} />
                        <div className="space-y-3">
                            <h3 className="text-xl font-black theme-text-title">此區塊載入失敗</h3>
                            <p className="theme-text-muted font-bold">
                                已攔截前端執行錯誤，避免整頁白屏。請先重新整理此區塊，若仍失敗再回報操作步驟。
                            </p>
                            {this.state.error?.message && (
                                <div className="border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                                    {this.state.error.message}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={this.handleReset}
                                className="theme-btn"
                            >
                                <RefreshCw size={16} strokeWidth={3} />
                                重新載入此區塊
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default UiErrorBoundary;
