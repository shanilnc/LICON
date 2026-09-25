import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Link,
} from "react-router-dom";
import { Store } from "./store";
import { Header, Footer } from "./components";
import { Home, Shop, Product, Collections } from "./catalog";
import {
  RequireAccount,
  Auth,
  Cart,
  Checkout,
  Wishlist,
  Account,
  Orders,
  Profile,
  Addresses,
} from "./commerce";
import { Custom, Quiz, Editorial, Contact, Forgot } from "./editorial";
import "./style.css";
function Scroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title =
      pathname === "/"
        ? "LICON — Furniture for modern living"
        : `${pathname.split("/").filter(Boolean).join(" · ")} — LICON`;
  }, [pathname]);
  return null;
}
function App() {
  return (
    <BrowserRouter>
      <Store>
        <Scroll />
        <a className="skip" href="#content">
          Skip to content
        </a>
        <Header />
        <div id="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop/:category" element={<Shop />} />
            <Route path="/product/:slug" element={<Product />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/collections/:slug" element={<Collections />} />
            <Route path="/cart" element={<Cart />} />
            <Route
              path="/checkout"
              element={
                <RequireAccount>
                  <Checkout />
                </RequireAccount>
              }
            />
            <Route
              path="/wishlist"
              element={
                <RequireAccount>
                  <Wishlist />
                </RequireAccount>
              }
            />
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/forgot-password" element={<Forgot />} />
            <Route
              path="/account"
              element={
                <RequireAccount>
                  <Account />
                </RequireAccount>
              }
            />
            <Route
              path="/account/orders"
              element={
                <RequireAccount>
                  <Orders />
                </RequireAccount>
              }
            />
            <Route
              path="/account/orders/:id"
              element={
                <RequireAccount>
                  <Orders />
                </RequireAccount>
              }
            />
            <Route
              path="/account/profile"
              element={
                <RequireAccount>
                  <Profile />
                </RequireAccount>
              }
            />
            <Route
              path="/account/addresses"
              element={
                <RequireAccount>
                  <Addresses />
                </RequireAccount>
              }
            />
            <Route path="/custom-furniture" element={<Custom />} />
            <Route path="/quiz" element={<Quiz />} />
            {["about", "materials", "inspiration", "policies"].map((p) => (
              <Route key={p} path={"/" + p} element={<Editorial />} />
            ))}
            <Route path="/contact" element={<Contact />} />
            <Route
              path="*"
              element={
                <main className="narrow">
                  <h1>A little out of place.</h1>
                  <p>This page doesn’t exist.</p>
                  <Link to="/" className="button">
                    Back home
                  </Link>
                </main>
              }
            />
          </Routes>
        </div>
        <Footer />
      </Store>
    </BrowserRouter>
  );
}
createRoot(document.getElementById("root")).render(<App />);
