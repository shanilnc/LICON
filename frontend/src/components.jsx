import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart,
  ShoppingBag,
  User,
  Search,
  Menu,
  X,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { api, money, priceOf, imageOf } from "../../shared/api";
import { Form, Field } from "../../shared/ui";
import { useStore } from "./store";
export function Header() {
  const { cart } = useStore(),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState(false),
    navigate = useNavigate();
  return (
    <>
      <div className="announcement">
        Thoughtfully made. Beautifully lived in.{" "}
        <span>Discover the LICON collection ↗</span>
      </div>
      <header>
        <button
          className="icon mobile"
          aria-label="Toggle menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <Link to="/" className="logo">
          LICON<span>FURNITURE & LIVING</span>
        </Link>
        <nav className={open ? "open" : ""} onClick={() => setOpen(false)}>
          {[
            ["Shop", "/shop"],
            ["Collections", "/collections"],
            ["Custom", "/custom-furniture"],
            ["Inspiration", "/inspiration"],
            ["About", "/about"],
          ].map(([label, path]) => (
            <Link key={path} to={path}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="nav-icons">
          <button
            className="icon"
            aria-label="Search"
            onClick={() => setSearch(!search)}
          >
            <Search />
          </button>
          <Link className="icon desktop" aria-label="Wishlist" to="/wishlist">
            <Heart />
          </Link>
          <Link className="icon desktop" aria-label="Account" to="/account">
            <User />
          </Link>
          <Link
            className="icon bag"
            aria-label={`Shopping bag, ${cart.reduce((s, x) => s + x.quantity, 0)} items`}
            to="/cart"
          >
            <ShoppingBag />
            <small>{cart.reduce((s, x) => s + x.quantity, 0)}</small>
          </Link>
        </div>
      </header>
      {search && (
        <form
          className="searchbar"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(
              "/shop?search=" +
                encodeURIComponent(e.currentTarget.search.value),
            );
            setSearch(false);
          }}
        >
          <Field
            label="Find your next favourite piece"
            name="search"
            autoFocus
            placeholder="Search sofas, oak, tables…"
          />
          <button className="button">Search</button>
        </form>
      )}
    </>
  );
}
export function Footer() {
  return (
    <>
      <section className="newsletter">
        <div>
          <p className="eyebrow">A LITTLE INSPIRATION</p>
          <h2>Make room for good things.</h2>
          <p>New collections, considered spaces, and stories from LICON.</p>
        </div>
        <Form
          button="Subscribe ↗"
          onSubmit={async (values) => {
            await api("/newsletter", { method: "POST", body: values });
            return "You’re on the list. Thank you!";
          }}
        >
          <Field
            label="Your email address"
            name="email"
            type="email"
            required
            placeholder="hello@example.com"
          />
        </Form>
      </section>
      <footer>
        <div>
          <Link className="logo" to="/">
            LICON
          </Link>
          <p>
            Minimal furniture.
            <br />
            More meaningful living.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link to="/shop">All furniture</Link>
          <Link to="/collections">Collections</Link>
          <Link to="/custom-furniture">Made for you</Link>
        </div>
        <div>
          <h4>Get to know us</h4>
          <Link to="/about">Our story</Link>
          <Link to="/materials">Materials & care</Link>
          <Link to="/inspiration">The journal</Link>
        </div>
        <div>
          <h4>Here to help</h4>
          <Link to="/contact">Contact us</Link>
          <Link to="/account/orders">Track your order</Link>
          <Link to="/policies">Delivery & returns</Link>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} LICON. Designed for everyday living.
          <span>Thoughtful by design.</span>
        </div>
      </footer>
    </>
  );
}
export function ProductCard({ product: p }) {
  const { add, user, notify } = useStore(),
    navigate = useNavigate();
  return (
    <article className="product-card">
      <div className="product-image">
        <Link to={"/product/" + p.slug}>
          <img
            loading="lazy"
            src={imageOf(p)}
            alt={p.images?.[0]?.alt || p.name}
          />
        </Link>
        {(p.badge || p.stock - p.reserved <= 0) && (
          <span className="badge">
            {p.stock - p.reserved <= 0 ? "Out of stock" : p.badge}
          </span>
        )}
        <button
          className="wish"
          aria-label={"Save " + p.name}
          onClick={async () => {
            if (!user) return navigate("/login");
            try {
              await api("/wishlist/" + p._id, { method: "POST" });
              notify("Saved to your wishlist");
            } catch (e) {
              notify(e.message);
            }
          }}
        >
          <Heart size={18} />
        </button>
        <button
          className="quick-add"
          disabled={p.stock - p.reserved <= 0}
          onClick={() => add(p)}
          aria-label={"Add " + p.name + " to bag"}
        >
          <Plus size={18} /> Add to bag
        </button>
      </div>
      <div className="product-copy">
        <Link to={"/product/" + p.slug}>
          <h3>{p.name}</h3>
        </Link>
        <span>{money(priceOf(p))}</span>
      </div>
      <p>
        {p.shortDescription || p.material}
        {p.reviewCount > 0 && (
          <small>
            {" "}
            ★ {p.rating.toFixed(1)} ({p.reviewCount})
          </small>
        )}
      </p>
      {p.salePrice != null && <del>{money(p.price)}</del>}
    </article>
  );
}
export function PageTitle({ eyebrow, title, children }) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow || "THOUGHTFULLY DESIGNED"}</p>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
export function SectionHeading({
  tag,
  title,
  to = "/shop",
  link = "Explore all furniture",
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{tag}</p>
        <h2>{title}</h2>
      </div>
      <Link className="text-link" to={to}>
        {link} <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}
