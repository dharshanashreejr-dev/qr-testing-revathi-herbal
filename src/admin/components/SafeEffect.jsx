import { Component } from 'react';

// Visual effects use WebGL. If a device cannot run them, show the fallback instead of breaking the page.
export default class SafeEffect extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* effect unavailable on this device */ }
  render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children; }
}
