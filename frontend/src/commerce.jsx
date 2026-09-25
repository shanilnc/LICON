import React, { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, money, priceOf, imageOf } from "../../shared/api";
import { useData, State, Field, Form, Select, Message } from "../../shared/ui";
import { PageTitle, ProductCard } from "./components";
import { useStore } from "./store";
export function RequireAccount({ children }) {
  const { user, ready } = useStore();
  return !ready ? (
    <State loading />
  ) : user ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
}
export function Auth({ mode = "login" }) {
  const { setUser } = useStore(),
    navigate = useNavigate();
  return (
    <main className="narrow">
      <PageTitle
        title={mode === "register" ? "Make yourself at home." : "Welcome home."}
      />
      <Form
        button={mode === "register" ? "Create account" : "Sign in"}
        onSubmit={async (values) => {
          const result = await api("/auth/" + mode, {
            method: "POST",
            body: values,
          });
          setUser(result.user);
          navigate("/account");
        }}
      >
        {mode === "register" && (
          <Field
            label="Your name"
            name="name"
            autoComplete="name"
            required
            minLength="2"
          />
        )}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
          minLength="8"
          required
        />
      </Form>
      <p>
        <Link
          className="text-link"
          to={mode === "register" ? "/login" : "/register"}
        >
          {mode === "register"
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </Link>
      </p>
      <Link to="/forgot-password">Forgot password?</Link>
    </main>
  );
}
export function Cart() {
  const { cart, setCart } = useStore();
  const subtotal = cart.reduce(
    (s, x) => s + priceOf(x.product) * x.quantity,
    0,
  );
  return (
    <main className="section">
      <PageTitle
        title="Your thoughtfully chosen pieces."
        eyebrow="SHOPPING BAG"
      />
      <State empty={!cart.length}>
        <div className="checkout-layout">
          <div>
            {cart.map((x) => (
              <article className="cart-row" key={x.key}>
                <Link to={"/product/" + x.product.slug}>
                  <img src={imageOf(x.product)} alt={x.product.name} />
                </Link>
                <div>
                  <h3>{x.product.name}</h3>
                  <p>{Object.values(x.variant).join(" · ")}</p>
                  <p>{money(priceOf(x.product))}</p>
                  <label>
                    Quantity{" "}
                    <input
                      aria-label={"Quantity for " + x.product.name}
                      type="number"
                      min="1"
                      max="20"
                      value={x.quantity}
                      onChange={(e) =>
                        setCart((items) =>
                          items.map((i) =>
                            i.key === x.key
                              ? {
                                  ...i,
                                  quantity: Math.max(
                                    1,
                                    Math.min(20, Number(e.target.value)),
                                  ),
                                }
                              : i,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    className="text-link"
                    onClick={() =>
                      setCart((items) => items.filter((i) => i.key !== x.key))
                    }
                  >
                    Remove
                  </button>
                </div>
                <strong>{money(priceOf(x.product) * x.quantity)}</strong>
              </article>
            ))}
          </div>
          <aside className="summary">
            <h2>The details.</h2>
            <dl>
              <dt>Subtotal</dt>
              <dd>{money(subtotal)}</dd>
              <dt>Delivery & discounts</dt>
              <dd>At checkout</dd>
            </dl>
            <small>
              Final prices and availability are checked when you place your
              order.
            </small>
            <Link className="button" to="/checkout">
              Continue to checkout →
            </Link>
            <Link className="text-link" to="/shop">
              Keep exploring
            </Link>
          </aside>
        </div>
      </State>
      <Link to="/shop" className="text-link">
        Explore the collection ↗
      </Link>
    </main>
  );
}
export function Checkout() {
  const { cart, setCart, user } = useStore(),
    navigate = useNavigate(),
    [quote, setQuote] = useState(null),
    [message, setMessage] = useState(""),
    [checkoutKey] = useState(() => crypto.randomUUID());
  if (!cart.length) return <Navigate to="/cart" />;
  const items = cart.map((x) => ({
    product: x.product._id,
    quantity: x.quantity,
    variant: x.variant,
  }));
  return (
    <main className="section">
      <PageTitle title="Almost home." eyebrow="SECURE CHECKOUT" />
      <div className="checkout-layout">
        <Form
          disabled={!quote || !quote.cod}
          button="Place cash-on-delivery order"
          onSubmit={async (v) => {
            const { coupon, ...address } = v;
            const order = await api("/orders", {
              method: "POST",
              body: {
                items,
                address,
                paymentMethod: "COD",
                coupon: coupon || undefined,
                idempotencyKey: checkoutKey,
              },
            });
            setCart([]);
            navigate("/account/orders/" + order._id);
          }}
        >
          <h2>1. Contact & delivery</h2>
          <p>Signed in as {user.email}</p>
          <div className="form-grid">
            {[
              ["name", "Full name", user.name],
              ["phone", "Phone", ""],
              ["line1", "Street address", ""],
              ["city", "City", ""],
              ["state", "State", ""],
              ["pin", "Six-digit PIN", ""],
            ].map(([name, label, value]) => (
              <Field
                key={name}
                name={name}
                label={label}
                defaultValue={value}
                required
                minLength={name === "phone" ? 10 : name === "line1" ? 5 : 2}
                onChange={() => setQuote(null)}
                pattern={name === "pin" ? "[0-9]{6}" : undefined}
              />
            ))}
          </div>
          <Field
            label="Coupon code (optional)"
            name="coupon"
            onChange={() => setQuote(null)}
          />
          <button
            type="button"
            className="button outline"
            onClick={async (e) => {
              try {
                const v = Object.fromEntries(
                  new FormData(e.currentTarget.form),
                );
                setQuote(
                  await api("/cart/quote", {
                    method: "POST",
                    body: { items, pin: v.pin, coupon: v.coupon || undefined },
                  }),
                );
                setMessage("");
              } catch (e) {
                setQuote(null);
                setMessage(e.message);
              }
            }}
          >
            Calculate delivery & total
          </button>
          <Message>{message}</Message>
          <h2>2. Delivery method</h2>
          <p>
            Standard delivery. Timing and installation depend on your PIN code.
          </p>
          <h2>3. Payment</h2>
          <p>
            Cash on delivery. Online UPI, card and net banking payments are
            intentionally unavailable until the payment provider is configured
            and tested.
          </p>
        </Form>
        <aside className="summary">
          <h2>Order summary</h2>
          {cart.map((x) => (
            <p key={x.key}>
              {x.product.name} × {x.quantity}
            </p>
          ))}
          {quote ? (
            <dl>
              <dt>Subtotal</dt>
              <dd>{money(quote.subtotal)}</dd>
              <dt>Discount</dt>
              <dd>−{money(quote.discount)}</dd>
              <dt>Delivery</dt>
              <dd>{money(quote.delivery)}</dd>
              <dt>Tax</dt>
              <dd>{money(quote.tax)}</dd>
              <dt>Total</dt>
              <dd>
                <strong>{money(quote.total)}</strong>
              </dd>
            </dl>
          ) : (
            <p>Enter your address and calculate the final total.</p>
          )}
          {quote && !quote.cod && (
            <p>
              Cash on delivery is unavailable for this PIN. Please contact us.
            </p>
          )}
          <p>We verify price and stock again when your order is placed.</p>
        </aside>
      </div>
    </main>
  );
}
export function Wishlist() {
  const result = useData("/wishlist"),
    { notify } = useStore();
  return (
    <main className="section">
      <PageTitle title="A little wishful thinking." eyebrow="YOUR WISHLIST" />
      <State {...result} empty={!result.data?.length}>
        <div className="product-grid">
          {result.data?.map((p) => (
            <div key={p._id}>
              <ProductCard product={p} />
              <button
                className="text-link"
                onClick={async () => {
                  try {
                    await api("/wishlist/" + p._id, { method: "DELETE" });
                    result.reload();
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                Remove from wishlist
              </button>
            </div>
          ))}
        </div>
      </State>
    </main>
  );
}
export function Account() {
  const { user, setUser } = useStore(),
    navigate = useNavigate();
  return (
    <main className="section">
      <PageTitle
        title={`Welcome home, ${user.name.split(" ")[0]}.`}
        eyebrow="YOUR ACCOUNT"
      />
      <div className="account-links">
        {[
          ["Your orders", "/account/orders"],
          ["Saved pieces", "/wishlist"],
          ["Profile", "/account/profile"],
          ["Your addresses", "/account/addresses"],
        ].map(([title, url]) => (
          <Link className="summary" to={url} key={url}>
            <h2>{title} ↗</h2>
          </Link>
        ))}
      </div>
      <Notifications />
      <button
        className="button outline"
        onClick={async () => {
          await api("/auth/logout", { method: "POST" });
          setUser(null);
          navigate("/");
        }}
      >
        Sign out
      </button>
    </main>
  );
}
function Notifications() {
  const r = useData("/notifications");
  return (
    <section>
      <h2>Your updates</h2>
      <State {...r} empty={!r.data?.length}>
        {r.data?.map((n) => (
          <p key={n._id}>{n.message}</p>
        ))}
      </State>
    </section>
  );
}
export function Orders() {
  const { id } = useParams(),
    r = useData("/orders" + (id ? "/" + id : ""));
  return (
    <main className="section">
      <PageTitle title={id ? "From our home to yours." : "Your orders."} />
      <State {...r} empty={!id && !r.data?.length}>
        {id ? (
          r.data && (
            <>
              <h2>{r.data.orderId}</h2>
              <p className="pill">{r.data.status.replaceAll("_", " ")}</p>
              <p>
                Payment: {r.data.paymentStatus} · {money(r.data.total)}
              </p>
              {r.data.items.map((x, i) => (
                <p key={i}>
                  {x.name} × {x.quantity} — {money(x.price * x.quantity)}
                </p>
              ))}
              <h3>Order journey</h3>
              <ol className="timeline">
                {r.data.history.map((h, i) => (
                  <li key={i}>
                    <b>{h.status.replaceAll("_", " ")}</b>
                    <p>{new Date(h.at).toLocaleString()}</p>
                  </li>
                ))}
              </ol>
              <button className="button outline" onClick={r.reload}>
                Refresh status
              </button>
            </>
          )
        ) : (
          <div className="order-list">
            {r.data?.map((o) => (
              <Link
                className="cart-row"
                key={o._id}
                to={"/account/orders/" + o._id}
              >
                <div>
                  <h3>{o.orderId}</h3>
                  <p>
                    {new Date(o.createdAt).toLocaleDateString()} ·{" "}
                    {o.items.length} pieces
                  </p>
                </div>
                <span>{o.status.replaceAll("_", " ")}</span>
                <strong>{money(o.total)} ↗</strong>
              </Link>
            ))}
          </div>
        )}
      </State>
    </main>
  );
}
export function Profile() {
  const { user, setUser } = useStore();
  return (
    <main className="narrow">
      <PageTitle title="Your details." />
      <Form
        onSubmit={async (v) => {
          const u = await api("/auth/me", { method: "PATCH", body: v });
          setUser(u);
        }}
      >
        <Field label="Name" name="name" defaultValue={user.name} required />
        <Field label="Phone" name="phone" defaultValue={user.phone} />
        <Field label="Email" value={user.email} readOnly />
      </Form>
    </main>
  );
}
export function Addresses() {
  const { user, setUser } = useStore();
  return (
    <main className="narrow">
      <PageTitle title="Your places." />
      {user.addresses?.map((a, i) => (
        <div className="summary" key={i}>
          <p>
            {a.name} · {a.line1}, {a.city}, {a.pin}
          </p>
        </div>
      ))}
      <Form
        button="Save address"
        onSubmit={async (v) => {
          const u = await api("/auth/me", {
            method: "PATCH",
            body: { addresses: [...(user.addresses || []), v] },
          });
          setUser(u);
        }}
      >
        {["name", "phone", "line1", "city", "state", "pin"].map((n) => (
          <Field
            key={n}
            label={n}
            name={n}
            required
            pattern={n === "pin" ? "[0-9]{6}" : undefined}
          />
        ))}
      </Form>
    </main>
  );
}
