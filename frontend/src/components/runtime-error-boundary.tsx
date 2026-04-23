import React from "react";

interface RuntimeErrorBoundaryState {
  error: Error | null;
}

export class RuntimeErrorBoundary extends React.Component<
  React.PropsWithChildren,
  RuntimeErrorBoundaryState
> {
  state: RuntimeErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RuntimeErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#050505",
            color: "#fff",
            padding: "32px",
            fontFamily: "Barlow, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 24,
              background: "rgba(255,255,255,0.04)",
              padding: 24,
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.7 }}>页面运行时出错了</div>
            <h1 style={{ marginTop: 12, fontSize: 28 }}>前端没有正常渲染，所以你看到的是白屏。</h1>
            <pre
              style={{
                marginTop: 20,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 13,
                lineHeight: 1.7,
                opacity: 0.9,
              }}
            >
              {this.state.error.stack || this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
