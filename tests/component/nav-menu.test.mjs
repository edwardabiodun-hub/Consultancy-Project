import assert from "node:assert/strict";
import test from "node:test";
import "./setup.mjs";

const React = await import("react");
const { cleanup, render, screen } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { NavMenu } = await import("../../components/NavMenu.tsx");

test.afterEach(() => {
  cleanup();
});

const links = [
  ["/how-i-help#dependency", "Reduce Owner Dependency"],
  ["/how-i-help#decisions", "Improve Executive Decisions"],
];

function getMenu() {
  const menu = document.querySelector(".nav-menu");
  assert.ok(menu instanceof window.HTMLDetailsElement);
  return menu;
}

test("navigation menu closes when the visitor clicks elsewhere on the page", async () => {
  const user = userEvent.setup();
  render(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(NavMenu, { label: "How I Help", links }),
      React.createElement("button", { type: "button" }, "Outside area"),
    ),
  );

  await user.click(screen.getByText("How I Help"));
  assert.equal(getMenu().open, true);

  await user.click(screen.getByText("Outside area"));
  assert.equal(getMenu().open, false);
});

test("navigation menu closes on Escape", async () => {
  const user = userEvent.setup();
  render(React.createElement(NavMenu, { label: "How I Help", links }));

  await user.click(screen.getByText("How I Help"));
  assert.equal(getMenu().open, true);

  await user.keyboard("{Escape}");
  assert.equal(getMenu().open, false);
});