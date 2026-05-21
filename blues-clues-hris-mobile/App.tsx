import "./global.css";
import React from "react";
import { Text } from "react-native";
import { AppNavigator } from "./src/navigation/AppNavigator";

const TEXT_LIKE_HOSTS = new Set([
  "Text",
  "RCTText",
  "TextInput",
  "RCTTextInput",
  "option",
  "Button",
  "FormattedMessage"
]);

function wrapPrimitiveChild(child: unknown): unknown {
  if (child == null || typeof child === "boolean") return child;
  if (typeof child === "string" || typeof child === "number") {
    // If it's a string containing only whitespace/newlines, prune it to prevent React Native crashes.
    if (typeof child === "string" && !child.trim()) {
      return null;
    }
    return <Text>{String(child)}</Text>;
  }
  if (Array.isArray(child)) {
    return child.map(wrapPrimitiveChild);
  }
  return child;
}

function patchJsxRuntime(runtime: any) {
  if (!runtime || runtime.__textChildPatchApplied) return;

  const originalJsx = typeof runtime.jsx === "function" ? runtime.jsx.bind(runtime) : null;
  const originalJsxs = typeof runtime.jsxs === "function" ? runtime.jsxs.bind(runtime) : null;
  const originalJsxDEV = typeof runtime.jsxDEV === "function" ? runtime.jsxDEV.bind(runtime) : null;

  const getComponentName = (type: any): string => {
    if (!type) return "";
    if (typeof type === "string") return type;
    return type.displayName || type.name || "";
  };

  const normalizeProps = (type: any, props: any) => {
    if (!props || props.children == null) {
      return props;
    }
    const name = getComponentName(type);
    if (TEXT_LIKE_HOSTS.has(name) || name.endsWith("Text") || name.endsWith("Input")) {
      return props;
    }
    return { ...props, children: wrapPrimitiveChild(props.children) };
  };

  if (originalJsx) {
    runtime.jsx = (type: any, props: any, key: any) => originalJsx(type, normalizeProps(type, props), key);
  }

  if (originalJsxs) {
    runtime.jsxs = (type: any, props: any, key: any) => originalJsxs(type, normalizeProps(type, props), key);
  }

  if (originalJsxDEV) {
    runtime.jsxDEV = (
      type: any,
      props: any,
      key: any,
      isStaticChildren: boolean,
      source: any,
      self: any,
    ) => originalJsxDEV(type, normalizeProps(type, props), key, isStaticChildren, source, self);
  }

  runtime.__textChildPatchApplied = true;
}

function patchCreateElement() {
  const React = require("react");
  if (!React || React.__createElementPatchApplied) return;

  const originalCreateElement = React.createElement;

  const getComponentName = (type: any): string => {
    if (!type) return "";
    if (typeof type === "string") return type;
    return type.displayName || type.name || "";
  };

  React.createElement = function (type: any, props: any, ...children: any[]) {
    if (children.length > 0) {
      const normalizedChildren = wrapPrimitiveChild(children.length === 1 ? children[0] : children);
      const normalizedProps = { ...(props || {}), children: normalizedChildren };
      return originalCreateElement.call(React, type, normalizedProps);
    } else if (props && props.children != null) {
      const name = getComponentName(type);
      if (!TEXT_LIKE_HOSTS.has(name) && !name.endsWith("Text") && !name.endsWith("Input")) {
        const normalizedProps = { ...props, children: wrapPrimitiveChild(props.children) };
        return originalCreateElement.call(React, type, normalizedProps);
      }
    }
    return originalCreateElement.call(React, type, props, ...children);
  };
  React.__createElementPatchApplied = true;
}

// Unconditionally patch all JSX runtimes and standard React.createElement
try {
  patchJsxRuntime(require("react/jsx-runtime"));
} catch (e) {}

try {
  patchJsxRuntime(require("react/jsx-dev-runtime"));
} catch (e) {}

try {
  patchCreateElement();
} catch (e) {}

export default function App() {
  return <AppNavigator />;
}
