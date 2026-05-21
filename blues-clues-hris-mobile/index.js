import { registerRootComponent } from 'expo';

const React = require("react");
const { Text } = require("react-native");

const TEXT_LIKE_HOSTS = new Set(["Text", "RCTText", "TextInput"]);

function wrapPrimitiveChild(child) {
  if (child == null || typeof child === "boolean") return child;
  if (typeof child === "string" || typeof child === "number") {
    return React.createElement(Text, null, String(child));
  }
  if (Array.isArray(child)) {
    return child.map(wrapPrimitiveChild);
  }
  return child;
}

function normalizeProps(type, props) {
  if (typeof type !== "string" || TEXT_LIKE_HOSTS.has(type) || !props || props.children == null) {
    return props;
  }
  return { ...props, children: wrapPrimitiveChild(props.children) };
}

function patchCreateElement() {
  if (React.__textChildPatchApplied) return;

  const originalCreateElement = React.createElement.bind(React);
  React.createElement = (type, props, ...children) => {
    const nextProps = children.length > 0
      ? { ...(props || {}), children: children.length === 1 ? children[0] : children }
      : props;
    return originalCreateElement(type, normalizeProps(type, nextProps), ...[]);
  };

  React.__textChildPatchApplied = true;
}

function patchJsxRuntime(runtime) {
  if (!runtime || runtime.__textChildPatchApplied) return;

  const normalizeProps = (type, props) => {
    if (typeof type !== "string" || TEXT_LIKE_HOSTS.has(type) || !props || props.children == null) {
      return props;
    }
    return { ...props, children: wrapPrimitiveChild(props.children) };
  };

  if (typeof runtime.jsx === "function") {
    const originalJsx = runtime.jsx;
    runtime.jsx = (type, props, key) => originalJsx(type, normalizeProps(type, props), key);
  }

  if (typeof runtime.jsxs === "function") {
    const originalJsxs = runtime.jsxs;
    runtime.jsxs = (type, props, key) => originalJsxs(type, normalizeProps(type, props), key);
  }

  if (typeof runtime.jsxDEV === "function") {
    const originalJsxDEV = runtime.jsxDEV;
    runtime.jsxDEV = (type, props, key, isStaticChildren, source, self) =>
      originalJsxDEV(type, normalizeProps(type, props), key, isStaticChildren, source, self);
  }

  runtime.__textChildPatchApplied = true;
}

patchCreateElement();
patchJsxRuntime(require("react/jsx-runtime"));
patchJsxRuntime(require("react/jsx-dev-runtime"));

const App = require("./App").default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
