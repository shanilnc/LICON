import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Armchair,
  Package,
  Users,
  Star,
  PenTool,
  Ticket,
  Truck,
  ChartNoAxesCombined,
  Settings,
  FileText,
  LogOut,
  Menu,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api, money, imageOf } from "../../shared/api";
import { useData, State, Form, Field, Select, Message } from "../../shared/ui";
import "../../frontend/src/style.css";
import "./style.css";
const links = [
  ["dashboard", "Overview", LayoutDashboard],
  ["orders", "Orders", ShoppingBag],
  ["products", "Products", Armchair],
  ["inventory", "Inventory", Package],
  ["categories", "Categories", Package],
  ["collections", "Collections", Package],
  ["customers", "Customers", Users],
  ["reviews", "Reviews", Star],
  ["custom-requests", "Custom requests", PenTool],
  ["coupons", "Coupons", Ticket],
  ["payments", "Payments", Ticket],
  ["delivery", "Delivery zones", Truck],
  ["analytics", "Analytics", ChartNoAxesCombined],
  ["content", "Content", FileText],
  ["settings", "Settings", Settings],
  ["admin-users", "Team", Users],
  ["audit-logs", "Audit logs", FileText],
];
function Login({ onLogin }) {
  return (
    <main className="admin-login">
      <div className="logo">
        LICON<span>THE BUSINESS OF GOOD LIVING</span>
      </div>
      <h1>Welcome back.</h1>
      <p>Your studio, at a glance.</p>
      <Form
        button="Sign in to your studio →"
        onSubmit={async (v) => {
          const r = await api("/auth/login", { method: "POST", body: v });
          if (!["OWNER", "ADMIN", "STAFF"].includes(r.user.role)) {
            await api("/auth/logout", { method: "POST" });
            throw Error("This account does not have staff access.");
          }
          onLogin(r.user);
        }}
      >
        <Field
          label="Work email"
          name="email"
          type="email"
          required
          autoComplete="username"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </Form>
    </main>
  );
}
function Layout() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [open, setOpen] = useState(false);
  useEffect(() => {
    api("/auth/me")
      .then((u) => {
        if (u.role !== "CUSTOMER") setUser(u);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  if (!ready) return <State loading />;
  if (!user) return <Login onLogin={setUser} />;
  return (
    <div className="admin-shell">
      <aside className={"sidebar " + (open ? "open" : "")}>
        <Link className="logo" to="/dashboard">
          LICON<span>STUDIO / ADMINISTRATION</span>
        </Link>
        <p className="eyebrow">YOUR WORKSPACE</p>
        <nav>
          {links
            .filter(
              ([key]) =>
                user.role === "OWNER" ||
                (!["audit-logs", "admin-users", "settings"].includes(key) &&
                  (user.role === "ADMIN" ||
                    !["customers", "coupons", "payments"].includes(key))),
            )
            .map(([key, name, Icon]) => (
              <NavLink key={key} to={"/" + key} onClick={() => setOpen(false)}>
                <Icon size={17} />
                {name}
              </NavLink>
            ))}
        </nav>
        <button
          className="logout"
          onClick={async () => {
            await api("/auth/logout", { method: "POST" });
            setUser(null);
          }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <div className="admin-body">
        <div className="admin-top">
          <button
            className="icon mobile"
            aria-label="Toggle navigation"
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <span>LICON / Business studio</span>
          <span>
            {user.name} <b className="pill">{user.role}</b>
          </span>
        </div>
        <main className="admin-main">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/new" element={<ProductEditor />} />
            <Route path="/products/:id/edit" element={<ProductEditor />} />
            <Route path="/inventory" element={<Products inventory />} />
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/custom-requests" element={<Requests />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/content" element={<Content />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route
              path="/categories"
              element={<Taxonomy type="categories" />}
            />
            <Route
              path="/collections"
              element={<Taxonomy type="collections" />}
            />
            <Route path="/customers" element={<Records type="customers" />} />
            <Route path="/payments" element={<Records type="payments" />} />
            <Route path="/audit-logs" element={<Records type="audit-logs" />} />
            <Route path="/admin-users" element={<Team />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
function Title({ title, description, children }) {
  return (
    <div className="admin-title">
      <div>
        <p className="eyebrow">THE BUSINESS OF GOOD LIVING</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function Table({ columns, rows }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map(([name]) => (
              <th key={name}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows?.map((r, i) => (
            <tr key={r._id || i}>
              {columns.map(([name, cell]) => (
                <td key={name}>{cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows?.length && <div className="state">No records yet.</div>}
    </div>
  );
}
const orderCols = [
  [
    "Order",
    (r) => (
      <Link className="text-link" to={"/orders/" + r._id}>
        {r.orderId}
      </Link>
    ),
  ],
  ["Customer", (r) => r.customer?.name],
  ["Total", (r) => money(r.total)],
  ["Payment", (r) => r.paymentStatus],
  [
    "Status",
    (r) => <span className="pill">{r.status.replaceAll("_", " ")}</span>,
  ],
  ["Date", (r) => new Date(r.createdAt).toLocaleDateString()],
];
function Dashboard() {
  const r = useData("/admin/dashboard");
  return (
    <>
      <Title
        title="A good day to grow."
        description="A clear view of your store, your orders, and what needs attention."
      />
      <State {...r}>
        {r.data && (
          <>
            <div className="metrics">
              {[
                ["Today’s order value", money(r.data.revenue)],
                ["Orders today", r.data.todayOrders],
                ["Pending orders", r.data.pending],
                ["Customers", r.data.customers],
                ["Low stock pieces", r.data.lowStock],
              ].map(([name, value]) => (
                <div className="metric" key={name}>
                  <p>{name}</p>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <Analytics compact />
            <section className="panel">
              <h2>Recent orders</h2>
              <Table columns={orderCols} rows={r.data.orders} />
            </section>
          </>
        )}
      </State>
    </>
  );
}
function Orders() {
  const [status, setStatus] = useState(""),
    r = useData("/admin/orders" + (status ? "?status=" + status : ""));
  return (
    <>
      <Title title="Every order, thoughtfully handled." />
      <Select
        label="Filter by status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">All orders</option>
        {[
          "PENDING",
          "CONFIRMED",
          "PROCESSING",
          "PACKED",
          "SHIPPED",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "CANCELLED",
          "RETURN_REQUESTED",
          "RETURNED",
          "REFUNDED",
        ].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
      <State {...r}>
        <Table columns={orderCols} rows={r.data} />
      </State>
    </>
  );
}
const transitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED"],
  RETURNED: ["REFUNDED"],
};
function OrderDetail() {
  const { id } = useParams(),
    r = useData("/admin/orders/" + id),
    [message, setMessage] = useState("");
  async function advance(status) {
    try {
      await api("/admin/orders/" + id + "/status", {
        method: "PATCH",
        body: { status, expectedStatus: r.data.status },
      });
      r.reload();
      setMessage("Order updated. The customer can see the new status.");
    } catch (e) {
      setMessage(e.message);
    }
  }
  return (
    <>
      <Title title={r.data?.orderId || "Order details"} />
      <State {...r}>
        {r.data && (
          <div className="admin-columns">
            <section className="panel">
              <h2>{r.data.customer.name}</h2>
              <p>
                {r.data.customer.email} · {r.data.customer.phone}
              </p>
              <p>{Object.values(r.data.address).join(", ")}</p>
              <Table
                columns={[
                  ["Product", (x) => x.name],
                  ["Qty", (x) => x.quantity],
                  ["Price", (x) => money(x.price)],
                  ["Total", (x) => money(x.price * x.quantity)],
                ]}
                rows={r.data.items}
              />
              <h3>Total {money(r.data.total)}</h3>
              <p>
                Payment: {r.data.paymentStatus} ({r.data.paymentMethod})
              </p>
              {r.data.paymentMethod === "COD" &&
                r.data.paymentStatus === "PENDING" &&
                r.data.status === "DELIVERED" && (
                  <button
                    className="button outline"
                    onClick={async () => {
                      try {
                        await api("/admin/orders/" + id + "/collect", {
                          method: "POST",
                        });
                        r.reload();
                      } catch (e) {
                        setMessage(e.message);
                      }
                    }}
                  >
                    Record COD collected
                  </button>
                )}
            </section>
            <section className="panel">
              <h2>Order journey</h2>
              <span className="pill">{r.data.status}</span>
              <Message>{message}</Message>
              <div className="stack">
                {(transitions[r.data.status] || []).map((s) => (
                  <button className="button" key={s} onClick={() => advance(s)}>
                    {s === "CONFIRMED"
                      ? "Accept order"
                      : s === "CANCELLED"
                        ? "Reject / cancel order"
                        : "Mark " + s.toLowerCase().replaceAll("_", " ")}
                  </button>
                ))}
              </div>
              <ol className="timeline">
                {r.data.history.map((h, i) => (
                  <li key={i}>
                    <b>{h.status}</b>
                    <p>{new Date(h.at).toLocaleString()}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </State>
    </>
  );
}
function Products({ inventory = false }) {
  const r = useData("/admin/products");
  return (
    <>
      <Title
        title={inventory ? "Keep the shelves in balance." : "Your collection."}
        description="Considered products, ready for everyday living."
      >
        <Link className="button" to="/products/new">
          Add a piece +
        </Link>
      </Title>
      <State {...r}>
        <Table
          rows={r.data}
          columns={[
            [
              "Product",
              (p) => (
                <Link
                  className="product-cell"
                  to={"/products/" + p._id + "/edit"}
                >
                  <img src={imageOf(p)} alt="" />
                  <div>
                    {p.name}
                    <small>{p.sku}</small>
                  </div>
                </Link>
              ),
            ],
            ["Category", (p) => p.category],
            ["Price", (p) => money(p.salePrice ?? p.price)],
            ["Stock", (p) => p.stock],
            ["Reserved", (p) => p.reserved],
            [
              "Available",
              (p) => (
                <span
                  className={
                    p.stock - p.reserved <= p.lowStockThreshold ? "alert" : ""
                  }
                >
                  {p.stock - p.reserved}
                </span>
              ),
            ],
            ["Published", (p) => (p.published ? "Live" : "Draft")],
          ]}
        />
      </State>
    </>
  );
}
function ProductEditor() {
  const { id } = useParams(),
    r = useData("/admin/products"),
    navigate = useNavigate(),
    p = id ? r.data?.find((x) => x._id === id) : {};
  return (
    <>
      <Title
        title={id ? "Refine the details." : "A new piece of the collection."}
      />
      <State loading={id && r.loading} error={id && r.error}>
        {p && (
          <Form
            className="panel"
            button="Save product"
            onSubmit={async (v) => {
              const body = {
                ...v,
                price: Number(v.price),
                stock: Number(v.stock),
                salePrice: v.salePrice ? Number(v.salePrice) : null,
                colors: v.colors
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                sizes: v.sizes
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                images: v.images
                  .split("\n")
                  .filter(Boolean)
                  .map((url) => ({ url: url.trim(), alt: v.name })),
                dimensions: {
                  width: Number(v.width) || undefined,
                  depth: Number(v.depth) || undefined,
                  height: Number(v.height) || undefined,
                },
                specifications: JSON.parse(v.specifications || "{}"),
                published: v.published === "on",
                featured: v.featured === "on",
                bestSeller: v.bestSeller === "on",
                newArrival: v.newArrival === "on",
                lowStockThreshold: Number(v.lowStockThreshold),
              };
              for (const key of ["width", "depth", "height"]) delete body[key];
              await api("/admin/products" + (id ? "/" + id : ""), {
                method: id ? "PATCH" : "POST",
                body,
              });
              navigate("/products");
            }}
          >
            <div className="form-grid">
              {[
                ["name", "Product name"],
                ["slug", "URL slug"],
                ["sku", "SKU"],
                ["category", "Category slug"],
                ["material", "Material"],
                ["price", "Price (₹)"],
                ["salePrice", "Sale price (optional)"],
                ["stock", "Total physical stock"],
                ["lowStockThreshold", "Low stock threshold"],
              ].map(([name, label]) => (
                <Field
                  key={name}
                  name={name}
                  label={label}
                  defaultValue={
                    p[name] ?? (name === "lowStockThreshold" ? 5 : "")
                  }
                  required={[
                    "name",
                    "slug",
                    "sku",
                    "category",
                    "price",
                    "stock",
                  ].includes(name)}
                  type={
                    [
                      "price",
                      "salePrice",
                      "stock",
                      "lowStockThreshold",
                    ].includes(name)
                      ? "number"
                      : "text"
                  }
                  min="0"
                />
              ))}
              {["width", "depth", "height"].map((n) => (
                <Field
                  key={n}
                  label={n + " (cm)"}
                  name={n}
                  type="number"
                  min="0"
                  defaultValue={p.dimensions?.[n]}
                />
              ))}
              <Field
                label="Colors, separated by commas"
                name="colors"
                defaultValue={p.colors?.join(", ")}
              />
              <Field
                label="Sizes, separated by commas"
                name="sizes"
                defaultValue={p.sizes?.join(", ")}
              />
              <Field label="Badge" name="badge" defaultValue={p.badge} />
              <Field
                label="Short description"
                name="shortDescription"
                defaultValue={p.shortDescription}
              />
            </div>
            <label className="field">
              Description
              <textarea
                name="description"
                rows="5"
                defaultValue={p.description}
              />
            </label>
            <label className="field">
              Image URLs, one per line (reorder lines to reorder images)
              <textarea
                name="images"
                rows="4"
                defaultValue={p.images?.map((x) => x.url).join("\n")}
              />
            </label>
            <Field
              label="Upload an image (5 MB max)"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const input = e.currentTarget,
                  form = input.form;
                if (!input.files[0]) return;
                try {
                  const body = new FormData();
                  body.append("image", input.files[0]);
                  const data = await api("/uploads", { method: "POST", body });
                  form.elements.images.value +=
                    (form.elements.images.value ? "\n" : "") + data.url;
                } catch (err) {
                  input.setCustomValidity(err.message);
                  input.reportValidity();
                  input.setCustomValidity("");
                }
              }}
            />
            <label className="field">
              Specifications (JSON object)
              <textarea
                name="specifications"
                rows="4"
                defaultValue={JSON.stringify(
                  p.specifications || { warranty: "", care: "" },
                  null,
                  2,
                )}
              />
            </label>
            <div className="checkboxes">
              {["published", "featured", "bestSeller", "newArrival"].map(
                (n) => (
                  <label key={n}>
                    <input name={n} type="checkbox" defaultChecked={p[n]} /> {n}
                  </label>
                ),
              )}
            </div>
          </Form>
        )}
      </State>
    </>
  );
}
function Delivery() {
  const r = useData("/admin/delivery");
  return (
    <>
      <Title title="A smooth journey home." />
      <Form
        className="panel"
        button="Save delivery zone"
        onSubmit={async (v) => {
          await api("/admin/delivery/" + v.pin, {
            method: "PUT",
            body: {
              available: v.available === "on",
              installation: v.installation === "on",
              cod: v.cod === "on",
              fee: Number(v.fee),
              days: Number(v.days),
            },
          });
          r.reload();
        }}
      >
        <div className="form-grid">
          <Field label="PIN code" name="pin" required pattern="[0-9]{6}" />
          <Field
            label="Delivery fee (₹)"
            name="fee"
            type="number"
            min="0"
            required
          />
          <Field
            label="Estimated days"
            name="days"
            type="number"
            min="1"
            required
          />
        </div>
        <div className="checkboxes">
          {["available", "installation", "cod"].map((n) => (
            <label key={n}>
              <input type="checkbox" name={n} defaultChecked /> {n}
            </label>
          ))}
        </div>
      </Form>
      <State {...r}>
        <Table
          rows={r.data}
          columns={[
            ["PIN", (x) => x.pin],
            ["Available", (x) => String(x.available)],
            ["Fee", (x) => money(x.fee)],
            ["Days", (x) => x.days],
            ["Installation", (x) => String(x.installation)],
            ["COD", (x) => String(x.cod)],
          ]}
        />
      </State>
    </>
  );
}
function Reviews() {
  const r = useData("/admin/reviews"),
    [message, setMessage] = useState("");
  return (
    <>
      <Title title="Listen to your customers." />
      <Message>{message}</Message>
      <State {...r}>
        {r.data?.map((x) => (
          <article className="panel" key={x._id}>
            <h3>
              {x.product?.name} — {x.rating} stars
            </h3>
            <p>
              {x.user?.name}: {x.text}
            </p>
            <span className="pill">{x.status}</span>
            <div className="inline-actions">
              {["APPROVED", "REJECTED"].map((status) => (
                <button
                  className="button outline"
                  key={status}
                  onClick={async () => {
                    try {
                      await api("/admin/reviews/" + x._id, {
                        method: "PATCH",
                        body: { status },
                      });
                      r.reload();
                    } catch (e) {
                      setMessage(e.message);
                    }
                  }}
                >
                  {status === "APPROVED" ? "Approve" : "Reject"}
                </button>
              ))}
            </div>
          </article>
        ))}
      </State>
    </>
  );
}
function Requests() {
  const r = useData("/admin/custom-requests");
  return (
    <>
      <Title title="Made-to-measure conversations." />
      <State {...r}>
        {r.data?.map((x) => (
          <article className="panel" key={x._id}>
            <h2>{x.furnitureType}</h2>
            <p>
              {x.name} · {x.email} · {x.phone}
            </p>
            <p>
              {x.dimensions} · {x.material} · {x.color} · Budget: {x.budget}
            </p>
            <p>{x.requirements}</p>
            {x.referenceImage && (
              <a
                className="text-link"
                href={x.referenceImage}
                target="_blank"
                rel="noreferrer"
              >
                View reference
              </a>
            )}
            <Form
              button="Update request"
              onSubmit={async (v) => {
                await api("/admin/custom-requests/" + x._id, {
                  method: "PATCH",
                  body: v,
                });
                r.reload();
              }}
            >
              <Select label="Status" name="status" defaultValue={x.status}>
                {[
                  "NEW",
                  "CONTACTED",
                  "QUOTED",
                  "NEGOTIATING",
                  "APPROVED",
                  "IN_PRODUCTION",
                  "COMPLETED",
                  "CANCELLED",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Field label="Internal note" name="note" />
            </Form>
            {x.notes?.map((n, i) => (
              <p key={i}>{n.body}</p>
            ))}
          </article>
        ))}
      </State>
    </>
  );
}
function Analytics({ compact = false }) {
  const r = useData("/admin/analytics");
  return (
    <>
      {!compact && (
        <Title
          title="See the bigger picture."
          description="Order value excludes cancelled and refunded orders. This is not a cash-received report."
        />
      )}
      <div className="panel">
        <h2>Orders over the last 30 days</h2>
        <State {...r} empty={!r.data?.length}>
          <div style={{ height: 260, width: "100%", minWidth: 0 }}>
            <ResponsiveContainer>
              <AreaChart data={r.data || []}>
                <CartesianGrid vertical={false} stroke="#e2e5dc" />
                <XAxis dataKey="_id" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => money(v)} />
                <Area
                  dataKey="revenue"
                  name="Order value"
                  stroke="#58664e"
                  fill="#e3e8dd"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </State>
      </div>
    </>
  );
}
function Content() {
  const r = useData("/admin/content");
  return (
    <>
      <Title
        title="Tell the LICON story."
        description="Home accepts title, description and image. Editorial pages accept title and body."
      />
      <Form
        className="panel"
        onSubmit={async (v) => {
          await api("/admin/content/" + v.key, {
            method: "PUT",
            body: { value: JSON.parse(v.value) },
          });
          r.reload();
        }}
      >
        <Select label="Page" name="key">
          {["home", "about", "materials", "inspiration", "policies"].map(
            (k) => (
              <option key={k}>{k}</option>
            ),
          )}
        </Select>
        <label className="field">
          Content (JSON)
          <textarea
            required
            name="value"
            rows="7"
            defaultValue={
              '{\n  "title": "Furniture for modern living.",\n  "description": "Thoughtfully designed pieces."\n}'
            }
          />
        </label>
      </Form>
      <State {...r}>
        {r.data?.map((x) => (
          <details className="panel" key={x._id}>
            <summary>{x.key}</summary>
            <pre>{JSON.stringify(x.value, null, 2)}</pre>
          </details>
        ))}
      </State>
    </>
  );
}
function Coupons() {
  const r = useData("/admin/coupons");
  return (
    <>
      <Title title="A thoughtful little extra." />
      <Form
        className="panel"
        button="Save coupon"
        onSubmit={async (v) => {
          const body = {
            ...v,
            active: v.active === "on",
            categories: v.categories
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          };
          for (const k of [
            "value",
            "minOrder",
            "maxDiscount",
            "usageLimit",
            "perCustomerLimit",
          ])
            body[k] = v[k] ? Number(v[k]) : undefined;
          for (const k of ["startAt", "endAt"])
            body[k] = v[k] ? new Date(v[k]).toISOString() : undefined;
          await api("/admin/coupons/" + v.code.toUpperCase(), {
            method: "PUT",
            body,
          });
          r.reload();
        }}
      >
        <div className="form-grid">
          <Field label="Code" name="code" required />
          <Select label="Type" name="type">
            <option value="PERCENT">Percentage</option>
            <option value="FIXED">Fixed amount</option>
          </Select>
          {[
            "value",
            "minOrder",
            "maxDiscount",
            "usageLimit",
            "perCustomerLimit",
          ].map((k) => (
            <Field
              key={k}
              label={k}
              name={k}
              type="number"
              min="0"
              required={k === "value"}
            />
          ))}
          <Field label="Starts" name="startAt" type="datetime-local" />
          <Field label="Ends" name="endAt" type="datetime-local" />
          <Field label="Categories, comma separated" name="categories" />
        </div>
        <label className="checkboxes">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
      </Form>
      <State {...r}>
        <Table
          rows={r.data}
          columns={[
            ["Code", (x) => x.code],
            ["Type", (x) => x.type],
            ["Value", (x) => x.value],
            ["Used", (x) => x.used],
            ["Active", (x) => String(x.active)],
          ]}
        />
      </State>
    </>
  );
}
function Taxonomy({ type }) {
  const r = useData("/admin/" + type);
  return (
    <>
      <Title
        title={
          type === "categories"
            ? "Give every piece a place."
            : "Curate a collection."
        }
      />
      <Form
        className="panel"
        onSubmit={async (v) => {
          await api("/admin/" + type + "/" + v.slug, {
            method: "PUT",
            body: { ...v, published: true },
          });
          r.reload();
        }}
      >
        <Field label="Name" name="name" required />
        <Field label="Slug" name="slug" required pattern="[a-z0-9-]+" />
        <Field label="Description" name="description" />
        <Field label="Image URL" name="image" type="url" />
      </Form>
      <State {...r}>
        <Table
          rows={r.data}
          columns={[
            ["Name", (x) => x.name],
            ["Slug", (x) => x.slug],
            ["Description", (x) => x.description],
          ]}
        />
      </State>
    </>
  );
}
function Records({ type }) {
  const r = useData("/admin/" + type);
  const cols =
    type === "customers"
      ? [
          ["Name", (x) => x.name],
          ["Email", (x) => x.email],
          ["Phone", (x) => x.phone],
          ["Active", (x) => String(x.active)],
        ]
      : type === "payments"
        ? [
            ["Order", (x) => x.order?.orderId || x.order],
            ["Provider", (x) => x.provider],
            ["Amount", (x) => money(x.amount)],
            ["Status", (x) => x.status],
          ]
        : [
            ["Actor", (x) => x.actor?.email],
            ["Action", (x) => x.action],
            ["Target", (x) => x.target],
            ["Date", (x) => new Date(x.createdAt).toLocaleString()],
          ];
  return (
    <>
      <Title title={type.replaceAll("-", " ")} />
      <State {...r}>
        <Table rows={r.data} columns={cols} />
      </State>
    </>
  );
}
function Team() {
  const r = useData("/admin/admin-users");
  return (
    <>
      <Title title="The people behind the pieces." />
      <Form
        className="panel"
        button="Create staff account"
        onSubmit={async (v) => {
          await api("/admin/admin-users", { method: "POST", body: v });
          r.reload();
        }}
      >
        <Field label="Name" name="name" required />
        <Field label="Email" name="email" type="email" required />
        <Field
          label="Initial password (share securely)"
          name="password"
          type="password"
          minLength="12"
          required
        />
        <Select label="Role" name="role">
          <option>STAFF</option>
          <option>ADMIN</option>
        </Select>
      </Form>
      <State {...r}>
        <Table
          rows={r.data}
          columns={[
            ["Name", (x) => x.name],
            ["Email", (x) => x.email],
            ["Role", (x) => x.role],
          ]}
        />
      </State>
    </>
  );
}
function SettingsPage() {
  return (
    <>
      <Title title="Your studio settings." />
      <div className="panel">
        <h2>Deployment configuration</h2>
        <p>
          Database, payment and image-storage credentials are configured through
          server environment variables. Secrets are never exposed in this
          dashboard.
        </p>
        <p>
          Owner: full access. Admin: catalog, orders and customers. Staff: order
          fulfillment, delivery visibility, reviews and custom requests.
        </p>
        <p>
          Granular permission editing, password reset email and two-factor
          authentication are not enabled in this version.
        </p>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Layout />
  </BrowserRouter>,
);
