import React, { useEffect, useState } from "react";
import {
  Link,
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Truck,
  ShieldCheck,
  Leaf,
  SlidersHorizontal,
} from "lucide-react";
import { api, money, priceOf, imageOf } from "../../shared/api";
import { useData, State, Form, Field, Select, Message } from "../../shared/ui";
import { ProductCard, PageTitle, SectionHeading } from "./components";
import { useStore } from "./store";
const room =
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2000&q=85";
export function Home() {
  const products = useData("/products?limit=4&sort=recommended"),
    content = useData("/content/home");
  return (
    <>
      <section className="hero">
        <img
          src={content.data?.image || room}
          alt="A calm living room with natural wood and soft neutral furniture"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="eyebrow">LESS NOISE. MORE HOME.</p>
          <h1>{content.data?.title || "Furniture for\nmodern living."}</h1>
          <p>
            {content.data?.description ||
              "Thoughtfully designed pieces for calm, comfortable spaces."}
          </p>
          <Link to="/shop" className="button light">
            Shop the collection <ArrowUpRight size={18} />
          </Link>
          <Link className="hero-link" to="/shop/sofas">
            Explore sofas <ArrowRight size={16} />
          </Link>
        </div>
        <div className="hero-foot">
          <span>CONSIDERED DESIGN. EVERYDAY COMFORT.</span>
          <span>01 — THE ART OF SLOW LIVING</span>
        </div>
      </section>
      <div className="promise">
        <span>
          <Leaf size={18} /> Natural materials
        </span>
        <span>
          <ShieldCheck size={18} /> Made with care
        </span>
        <span>
          <Truck size={18} /> Delivered to your space
        </span>
      </div>
      <section className="section">
        <SectionHeading
          tag="FIND YOUR FAVOURITE CORNER"
          title="A place for everything."
          link="Shop by room"
        />
        <div className="categories">
          {[
            [
              "Sofas",
              "Comfort, thoughtfully designed",
              "sofas",
              "photo-1555041469-a586c61ea9bc",
            ],
            [
              "Beds",
              "Designed for better rest",
              "beds",
              "photo-1505693416388-ac5ce068fe85",
            ],
            [
              "Tables",
              "Simple forms, everyday function",
              "tables",
              "photo-1499933374294-4584851497cc",
            ],
            [
              "Small space",
              "Room for the things you love",
              "small-space",
              "photo-1493663284031-b7e3aefcae8e",
            ],
          ].map(([name, desc, slug, img]) => (
            <Link to={"/shop/" + slug} className="category-card" key={slug}>
              <img
                loading="lazy"
                src={`https://images.unsplash.com/${img}?auto=format&fit=crop&w=650&q=80`}
                alt={name}
              />
              <div>
                <h3>{name}</h3>
                <ArrowUpRight size={20} />
              </div>
              <p>{desc}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="section featured">
        <SectionHeading
          tag="THE EVERYDAY FAVOURITES"
          title="Good design. Great company."
        />
        <State {...products} empty={!products.data?.items.length}>
          <div className="product-grid">
            {products.data?.items.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </State>
      </section>
      <section className="story">
        <img
          loading="lazy"
          src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85"
          alt="Natural tones and tactile materials in a restful home"
        />
        <div>
          <p className="eyebrow">THE LICON WAY</p>
          <h2>Less, but better.</h2>
          <p>
            We create furniture that feels natural in the spaces you already
            call home. Honest materials. Considered details. Pieces that belong,
            for years to come.
          </p>
          <Link className="text-link" to="/materials">
            Explore our materials <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="section space-callout">
        <p className="eyebrow">BIG IDEAS FOR SMALLER HOMES</p>
        <h2>
          Small space.
          <br />
          <em>Smart furniture.</em>
        </h2>
        <p>Make every corner count, without compromising on comfort.</p>
        <Link className="button" to="/shop/small-space">
          Explore small-space living <ArrowUpRight size={18} />
        </Link>
        <Link className="text-link" to="/quiz">
          Not sure where to start? Find your furniture →
        </Link>
      </section>
    </>
  );
}
export function Shop() {
  const { category } = useParams(),
    [params, setParams] = useSearchParams(),
    [filters, setFilters] = useState(false);
  const query = new URLSearchParams(params);
  if (category) query.set("category", category);
  const result = useData("/products?" + query.toString());
  function set(key, value) {
    setParams((p) => {
      value ? p.set(key, value) : p.delete(key);
      p.delete("page");
      return p;
    });
  }
  return (
    <main className="section">
      <PageTitle
        eyebrow="THE COLLECTION"
        title={
          category
            ? category.replace("-", " ")
            : "Considered pieces. Everyday living."
        }
      >
        Find something that feels like home.
      </PageTitle>
      <div className="shop-toolbar">
        <span>{result.data?.total || 0} pieces</span>
        <button className="icon mobile" onClick={() => setFilters(!filters)}>
          <SlidersHorizontal /> Filters
        </button>
        <select
          aria-label="Sort products"
          value={params.get("sort") || "recommended"}
          onChange={(e) => set("sort", e.target.value)}
        >
          {[
            ["recommended", "Recommended"],
            ["newest", "New arrivals"],
            ["best", "Best sellers"],
            ["price_asc", "Price: low to high"],
            ["price_desc", "Price: high to low"],
            ["rating", "Top rated"],
          ].map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="shop-layout">
        <aside className={"filters " + (filters ? "show" : "")}>
          <Field
            label="Search"
            value={params.get("search") || ""}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Find your piece"
          />
          <h4>Category</h4>
          {["sofas", "beds", "tables", "chairs", "small-space"].map((c) => (
            <Link
              key={c}
              className={category === c ? "selected" : ""}
              to={"/shop/" + c}
            >
              {c.replace("-", " ")}
            </Link>
          ))}
          <Link to="/shop">All furniture</Link>
          <Field
            label="Maximum price (₹)"
            type="number"
            min="0"
            value={params.get("maxPrice") || ""}
            onChange={(e) => set("maxPrice", e.target.value)}
          />
          <Select
            label="Material"
            value={params.get("material") || ""}
            onChange={(e) => set("material", e.target.value)}
          >
            <option value="">All materials</option>
            <option>Oak</option>
            <option>Fabric</option>
            <option>Walnut</option>
          </Select>
          <Select
            label="Availability"
            onChange={(e) => set("availability", e.target.value)}
            value={params.get("availability") || ""}
          >
            <option value="">All pieces</option>
            <option value="in-stock">In stock</option>
          </Select>
          <Field
            label="Color"
            value={params.get("color") || ""}
            onChange={(e) => set("color", e.target.value)}
          />
          <Select
            label="Minimum rating"
            value={params.get("minRating") || ""}
            onChange={(e) => set("minRating", e.target.value)}
          >
            <option value="">Any rating</option>
            <option value="4">4 stars & up</option>
            <option value="3">3 stars & up</option>
          </Select>
          <button className="text-link" onClick={() => setParams({})}>
            Reset filters
          </button>
        </aside>
        <div>
          <State {...result} empty={!result.data?.items.length}>
            <div className="product-grid three">
              {result.data?.items.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </State>
          <div className="pagination">
            {Array.from({ length: result.data?.pages || 0 }, (_, i) => (
              <button
                className={
                  Number(params.get("page") || 1) === i + 1 ? "selected" : ""
                }
                key={i}
                onClick={() =>
                  setParams((p) => {
                    p.set("page", i + 1);
                    return p;
                  })
                }
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
export function Product() {
  const { slug } = useParams(),
    result = useData("/products/" + slug),
    { add, user } = useStore(),
    navigate = useNavigate(),
    [index, setIndex] = useState(0),
    [quantity, setQuantity] = useState(1),
    [color, setColor] = useState(""),
    [zoom, setZoom] = useState(false),
    [delivery, setDelivery] = useState(null),
    [fit, setFit] = useState("");
  useEffect(() => {
    setIndex(0);
    setQuantity(1);
    setColor("");
    setDelivery(null);
  }, [slug]);
  const p = result.data;
  return (
    <main className="section">
      <State {...result}>
        {p && (
          <>
            <div className="breadcrumb">
              <Link to="/shop">Furniture</Link> / {p.category} / {p.name}
            </div>
            <div className="product-detail">
              <div>
                <button
                  className="gallery-main"
                  onClick={() => setZoom(true)}
                  aria-label="Enlarge product image"
                >
                  <img
                    src={p.images[index]?.url || imageOf(p)}
                    alt={p.images[index]?.alt || p.name}
                  />
                </button>
                <div className="thumbnails">
                  {p.images.map((im, i) => (
                    <button
                      className={i === index ? "selected" : ""}
                      key={i}
                      onClick={() => setIndex(i)}
                      aria-label={"View image " + (i + 1)}
                    >
                      <img src={im.url} alt={im.alt || p.name} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="product-info">
                <p className="eyebrow">
                  {p.category} / {p.material}
                </p>
                <h1>{p.name}</h1>
                <p>
                  {p.reviewCount
                    ? `★ ${p.rating.toFixed(1)} · ${p.reviewCount} reviews`
                    : "A new piece for your space"}
                </p>
                <h3>
                  {money(priceOf(p))}{" "}
                  {p.salePrice != null && <del>{money(p.price)}</del>}
                </h3>
                <p>{p.description}</p>
                {p.colors?.length > 0 && (
                  <Select
                    label="Color"
                    value={color || p.colors[0]}
                    onChange={(e) => setColor(e.target.value)}
                  >
                    {p.colors.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                )}
                <Field
                  label="Quantity"
                  type="number"
                  min="1"
                  max={Math.min(20, p.stock - p.reserved)}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(1, Math.min(20, Number(e.target.value))),
                    )
                  }
                />
                <p>
                  {p.stock - p.reserved > 0
                    ? `${p.stock - p.reserved} available`
                    : "Out of stock"}
                </p>
                <div className="actions">
                  <button
                    className="button"
                    disabled={p.stock - p.reserved < quantity}
                    onClick={() =>
                      add(
                        p,
                        quantity,
                        color || p.colors?.[0]
                          ? { color: color || p.colors[0] }
                          : {},
                      )
                    }
                  >
                    Add to bag — {money(priceOf(p) * quantity)}
                  </button>
                  <button
                    className="button outline"
                    disabled={p.stock - p.reserved < quantity}
                    onClick={() => {
                      add(
                        p,
                        quantity,
                        color || p.colors?.[0]
                          ? { color: color || p.colors[0] }
                          : {},
                      );
                      navigate("/checkout");
                    }}
                  >
                    Buy now
                  </button>
                </div>
                <Link className="text-link" to="/contact">
                  Ask us about this piece ↗
                </Link>
                <details open>
                  <summary>Dimensions & details</summary>
                  <dl>
                    {Object.entries(p.dimensions || {})
                      .filter(([k]) => k !== "_id")
                      .map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt>{k}</dt>
                          <dd>{v} cm</dd>
                        </React.Fragment>
                      ))}
                    {Object.entries(p.specifications || {}).map(([k, v]) => (
                      <React.Fragment key={k}>
                        <dt>{k}</dt>
                        <dd>{String(v)}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </details>
                <details>
                  <summary>Check delivery</summary>
                  <Form
                    button="Check PIN code"
                    onSubmit={async ({ pin }) => {
                      setDelivery(await api("/delivery/" + pin));
                      return "";
                    }}
                  >
                    <Field
                      label="PIN code"
                      name="pin"
                      pattern="[0-9]{6}"
                      required
                      maxLength="6"
                    />
                  </Form>
                  {delivery && (
                    <p>
                      {delivery.available
                        ? `Delivery in approximately ${delivery.days} days · ${money(delivery.fee)} · ${delivery.installation ? "Installation available" : "No installation service"}`
                        : "We do not deliver to this PIN yet."}
                    </p>
                  )}
                </details>
                <details>
                  <summary>Will it fit?</summary>
                  <Form
                    button="Check the fit"
                    onSubmit={async (v) => {
                      const d = p.dimensions;
                      if (!d?.width || !d?.depth || !d?.height) {
                        setFit(
                          "Dimensions are not available. Contact us before ordering.",
                        );
                        return "";
                      }
                      setFit(
                        Number(v.width) >= d.width + 60 &&
                          Number(v.depth) >= d.depth + 60
                          ? `Room space looks suitable with 60 cm clearance. ${Number(v.door) >= Math.min(d.width, d.depth, d.height) + 5 ? "Basic door clearance looks suitable." : "Door clearance may be too tight; check with us."}`
                          : "The room may be too small with recommended clearance.",
                      );
                      return "";
                    }}
                  >
                    <Field
                      label="Room width (cm)"
                      name="width"
                      type="number"
                      min="1"
                      required
                    />
                    <Field
                      label="Room depth (cm)"
                      name="depth"
                      type="number"
                      min="1"
                      required
                    />
                    <Field
                      label="Door width (cm)"
                      name="door"
                      type="number"
                      min="1"
                      required
                    />
                  </Form>
                  <Message>{fit}</Message>
                  <small>
                    Estimate only, not a guarantee. Packaging, turns, stairs and
                    handling space also matter.
                  </small>
                </details>
              </div>
            </div>
            {zoom && (
              <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-label="Product image"
                onClick={() => setZoom(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setZoom(false);
                }}
              >
                <button
                  autoFocus
                  className="button"
                  onClick={() => setZoom(false)}
                >
                  Close image ×
                </button>
                <img src={p.images[index]?.url || imageOf(p)} alt={p.name} />
              </div>
            )}
            {p.related?.length > 0 && (
              <section className="section">
                <SectionHeading
                  title="Complete the look."
                  tag="BETTER TOGETHER"
                />
                <div className="product-grid">
                  {p.related
                    .filter((x) => x.published)
                    .map((x) => (
                      <ProductCard key={x._id} product={x} />
                    ))}
                </div>
              </section>
            )}
            <Reviews product={p._id} user={user} />
          </>
        )}
      </State>
    </main>
  );
}
function Reviews({ product, user }) {
  const result = useData("/reviews/" + product);
  return (
    <section className="reviews">
      <h2>At home with LICON.</h2>
      <State {...result} empty={!result.data?.length}>
        {result.data?.map((r) => (
          <article key={r._id}>
            <b>
              {"★".repeat(r.rating)} — {r.user?.name || "Customer"}
            </b>
            {r.verified && <small> Verified purchase</small>}
            <p>{r.text}</p>
          </article>
        ))}
      </State>
      {user ? (
        <Form
          button="Submit review"
          onSubmit={async (v) => {
            await api("/reviews", {
              method: "POST",
              body: { ...v, product, rating: Number(v.rating) },
            });
            return "Thank you. Your review is awaiting moderation.";
          }}
        >
          <Select label="Your rating" name="rating">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} stars
              </option>
            ))}
          </Select>
          <Field
            label="Your experience"
            name="text"
            minLength="10"
            maxLength="2000"
            required
          />
        </Form>
      ) : (
        <Link className="text-link" to="/login">
          Sign in to leave a review
        </Link>
      )}
    </section>
  );
}
export function Collections() {
  const { slug } = useParams(),
    result = useData("/collections" + (slug ? "/" + slug : ""));
  return (
    <main className="section">
      <PageTitle
        title={result.data?.collection?.name || "Rooms with a point of view."}
        eyebrow="THE COLLECTIONS"
      >
        Pieces that feel even better together.
      </PageTitle>
      <State
        {...result}
        empty={slug ? !result.data?.products?.length : !result.data?.length}
      >
        <div className="product-grid">
          {slug
            ? result.data?.products?.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))
            : result.data?.map((c) => (
                <Link
                  key={c._id}
                  to={"/collections/" + c.slug}
                  className="category-card"
                >
                  <img src={c.image} alt={c.name} />
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                </Link>
              ))}
        </div>
      </State>
    </main>
  );
}
