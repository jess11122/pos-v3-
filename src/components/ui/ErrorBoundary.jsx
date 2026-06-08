import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-8">
          <div className="bg-zinc-800 rounded-2xl p-8 max-w-md text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="font-oswald text-2xl text-white mb-2">Something went wrong</h2>
            <p className="text-zinc-400 font-barlow mb-6">{this.state.error?.message}</p>
            <button
              className="bg-amber-600 text-white font-oswald px-6 py-3 rounded-xl text-lg hover:bg-amber-700 transition-colors"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
