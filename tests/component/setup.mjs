import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/assessment",
});

for (const property of [
  "window",
  "self",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLDetailsElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "Node",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "DOMException",
  "MutationObserver",
  "getComputedStyle",
  "sessionStorage",
]) {
  Object.defineProperty(globalThis, property, {
    configurable: true,
    value:
      property === "getComputedStyle"
        ? dom.window.getComputedStyle.bind(dom.window)
        : dom.window[property],
  });
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
