import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../../shared/api";
const Context = createContext();
function saved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
export function Store({ children }) {
  const [cart, setCart] = useState(() => saved("licon-cart", [])),
    [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [toast, setToast] = useState("");
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    localStorage.setItem("licon-cart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const add = (product, quantity = 1, variant = {}) => {
    if (product.stock - product.reserved < quantity) {
      setToast("This quantity is unavailable.");
      return;
    }
    const key = product._id + JSON.stringify(variant);
    setCart((items) => {
      const found = items.find((x) => x.key === key);
      if (
        found &&
        found.quantity + quantity > product.stock - product.reserved
      ) {
        setToast("No more stock available.");
        return items;
      }
      return found
        ? items.map((x) =>
            x.key === key ? { ...x, quantity: x.quantity + quantity } : x,
          )
        : [...items, { key, product, quantity, variant }];
    });
    setToast("Added to your bag");
  };
  return (
    <Context.Provider
      value={{ cart, setCart, user, setUser, ready, add, notify: setToast }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
